// src/launcher/ws/launcher.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { randomUUID, createHash } from 'crypto';
import { LauncherSessions } from './launcher.sessions';
import { PendingCredsStore } from './pending-creds.store';
import { ConnectionAliases } from './connection-aliases';
import type {
  ServerHello,
  ServerCommand,
  ClientFrame,
} from './launcher.messages';

export const LAUNCHER_WS_PATH = '/socket';

function parseQuery(url?: string): Record<string, string> {
  if (!url) return {};
  const u = new URL(url, 'http://localhost');
  const q: Record<string, string> = {};
  u.searchParams.forEach((v, k) => (q[k] = v));
  return q;
}
const fp = (s: string) =>
  createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
function buildSanitizedWsUrl(req: IncomingMessage, maskedCred: string): string {
  const host = String(req.headers['host'] ?? 'localhost');
  const u = new URL(req.url ?? '/', `ws://${host}`);
  if (u.searchParams.has('cred')) u.searchParams.set('cred', maskedCred);
  return u.toString();
}

@WebSocketGateway({ path: LAUNCHER_WS_PATH })
@Injectable()
export class LauncherGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly log = new Logger('LauncherGateway');
  @WebSocketServer() private server?: Server;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly sessions: LauncherSessions,
    private readonly pendingCreds: PendingCredsStore,
    private readonly aliases: ConnectionAliases,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.heartbeatTimer = setInterval(() => {
      const wss = this.server;
      if (!wss || !wss.clients) return;
      wss.clients.forEach((ws: any) => {
        if (ws.isAlive === false) {
          try {
            ws.terminate();
          } catch {}
          return;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {}
      });
    }, 15000);
    this.log.log(`Launcher WS mounted at path: ${LAUNCHER_WS_PATH}`);
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  handleConnection(socket: WebSocket, req: IncomingMessage) {
    const q = parseQuery(req.url);
    const cred = q['cred'];
    const ip = req.socket.remoteAddress ?? '-';
    const ua = String(req.headers['user-agent'] ?? '');
    const masked =
      process.env.LOG_WS_FULL_CRED === '1'
        ? (cred ?? '')
        : cred
          ? `${cred.slice(0, 4)}…${cred.slice(-4)}`
          : '';
    const urlMasked = buildSanitizedWsUrl(req, masked);

    if (!cred) {
      this.log.warn(
        `WS connect rejected (missing cred) url=${urlMasked} ip=${ip} ua="${ua}"`,
      );
      socket.close(4401, 'Missing cred');
      return;
    }

    const printFp = fp(cred);
    this.log.log(
      `WS connect attempt url=${urlMasked} ip=${ip} ua="${ua}" cred.fp=${printFp}`,
    );

    const res = this.pendingCreds.redeem(cred);
    if (!res) {
      this.log.warn(
        `WS connect rejected (invalid/expired) ip=${ip} cred.fp=${printFp}`,
      );
      socket.close(4401, 'Invalid or expired cred');
      return;
    }

    (socket as any).isAlive = true;
    socket.on('pong', () => ((socket as any).isAlive = true));

    const sess = this.sessions.create(res.userId, socket);
    this.aliases.bind(cred, res.userId, sess.wsSessionId);
    this.log.log(
      `WS connect accepted userId=${res.userId} wsSessionId=${sess.wsSessionId} ip=${ip}`,
    );
    this.log.log(`alias bound code.fp=${printFp} -> ws=${sess.wsSessionId}`);

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientFrame;

        if (msg.t === 'hello') {
          if (!msg.instanceId || typeof msg.instanceId !== 'string') {
            this.safeSend(socket, {
              t: 'error',
              code: 'bad_hello',
              message: 'instanceId required',
            });
            return;
          }
          this.sessions.setClientMeta(sess.wsSessionId, {
            instanceId: msg.instanceId,
          });
          this.sessions.touch(sess.wsSessionId);
          this.log.log(
            `WS hello wsSessionId=${sess.wsSessionId} instanceId=${msg.instanceId}`,
          );
          return;
        }

        if (msg.t === 'ack') {
          if (!msg.id) return;
          this.sessions.get(sess.wsSessionId)?.inflight.delete(msg.id);
          this.sessions.touch(sess.wsSessionId);
          return;
        }

        // Unknown type
        this.safeSend(socket, {
          t: 'error',
          code: 'unknown_type',
          message: 'Unsupported frame',
        });
      } catch {
        this.safeSend(socket, {
          t: 'error',
          code: 'bad_json',
          message: 'Malformed message',
        });
      }
    });

    socket.on('close', (code: number, reason: Buffer) => {
      this.sessions.remove(sess.wsSessionId);
      this.aliases.unbindSession(sess.wsSessionId);
      const why = reason?.toString() || '';
      this.log.log(
        `WS disconnect wsSessionId=${sess.wsSessionId} code=${code} reason="${why}"`,
      );
    });

    const hello: ServerHello = {
      t: 'hello',
      wsSessionId: sess.wsSessionId,
      protocol: 1,
      serverTime: Date.now(),
    };
    this.safeSend(socket, hello);
  }

  handleDisconnect(_socket: WebSocket) {
    // no-op
  }

  // Command fanout helpers
  sendCommandToSession<T>(wsSessionId: string, type: string, payload: T) {
    const s = this.sessions.get(wsSessionId);
    if (!s) return { delivered: [], commandId: null };
    const id = randomUUID();
    const frame: ServerCommand<T> = {
      t: 'command',
      id,
      type: type as any,
      payload,
    };
    s.inflight.add(id);
    this.safeSend(s.socket, frame);
    return { delivered: [wsSessionId], commandId: id };
  }

  sendCommandToUser<T>(userId: string | number, type: string, payload: T) {
    const sessions = this.sessions.findByUser(userId);
    const id = randomUUID();
    const frame: ServerCommand<T> = {
      t: 'command',
      id,
      type: type as any,
      payload,
    };
    sessions.forEach((s) => {
      s.inflight.add(id);
      this.safeSend(s.socket, frame);
    });
    return { delivered: sessions.map((s) => s.wsSessionId), commandId: id };
  }

  sendCommandToInstance<T>(
    userId: string | number,
    instanceId: string,
    type: string,
    payload: T,
  ) {
    const s = this.sessions.findByInstance(userId, instanceId);
    if (!s) return { delivered: [], commandId: null };
    const id = randomUUID();
    const frame: ServerCommand<T> = {
      t: 'command',
      id,
      type: type as any,
      payload,
    };
    s.inflight.add(id);
    this.safeSend(s.socket, frame);
    return { delivered: [s.wsSessionId], commandId: id };
  }

  private safeSend(ws: WebSocket, data: unknown) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    } catch (e) {
      this.log.warn(`send failed: ${(e as Error).message}`);
    }
  }
}
