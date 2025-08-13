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
import {
  CommandFrame,
  HelloServerFrame,
  WsClientFrame,
} from './launcher.messages';
import { ConnectionAliases } from './connection-aliases';

export const LAUNCHER_WS_PATH = '/socket';

function parseQuery(url?: string): Record<string, string> {
  if (!url) return {};
  const u = new URL(url, 'http://localhost'); // base required for URL parsing
  const q: Record<string, string> = {};
  u.searchParams.forEach((v, k) => (q[k] = v));
  return q;
}

// logging helpers
function sha256fp(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 8);
}
function redact(s: string): string {
  if (!s) return '';
  if (s.length <= 8) return '*'.repeat(s.length);
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
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

  @WebSocketServer()
  private server?: Server;

  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly sessions: LauncherSessions,
    private readonly pendingCreds: PendingCredsStore,
    private readonly aliases: ConnectionAliases,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.log.log(`Launcher WS mounted at path: ${LAUNCHER_WS_PATH}`);

    // Heartbeat: ping every 15s, drop if no pong (2-tick tolerance via isAlive flag)
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
        // mark as dead; the 'pong' handler will set back to true
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {}
      });
    }, 15000);
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  handleConnection(socket: WebSocket, req: IncomingMessage) {
    const q = parseQuery(req.url);
    const cred = q['cred'];
    const ip = req.socket.remoteAddress ?? '-';
    const ua = String(req.headers['user-agent'] ?? '');

    const fullCredLogging = process.env.LOG_WS_FULL_CRED === '1';
    const masked = fullCredLogging ? (cred ?? '') : redact(cred ?? '');
    const urlMasked = buildSanitizedWsUrl(req, masked);

    if (!cred) {
      this.log.warn(
        `WS connect rejected (missing cred) url=${urlMasked} ip=${ip} ua="${ua}"`,
      );
      socket.close(4401, 'Missing cred');
      return;
    }

    const fp = sha256fp(cred);
    this.log.log(
      `WS connect attempt url=${urlMasked} ip=${ip} ua="${ua}" cred.fp=${fp}`,
    );

    const res = this.pendingCreds.redeem(cred);
    if (!res) {
      this.log.warn(
        `WS connect rejected (invalid/expired) ip=${ip} cred.fp=${fp}`,
      );
      socket.close(4401, 'Invalid or expired cred');
      return;
    }

    // liveness
    (socket as any).isAlive = true;
    socket.on('pong', () => ((socket as any).isAlive = true));

    const sess = this.sessions.create(res.userId, socket);
    this.log.log(
      `WS connect accepted userId=${res.userId} wsSessionId=${sess.wsSessionId} ip=${ip}`,
    );

    // Bind the launch code as an alias to this live session for routing from web
    // Alias lifetime == session lifetime (unbind on close)
    this.aliases.bind(cred, res.userId, sess.wsSessionId);

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientFrame;

        if (msg.t === 'hello') {
          this.sessions.setClientMeta(sess.wsSessionId, {
            deviceId: msg.deviceId,
            instanceId: msg.instanceId,
          });
          this.log.log(
            `WS hello wsSessionId=${sess.wsSessionId} instanceId=${msg.instanceId ?? '-'} deviceId=${msg.deviceId ?? '-'}`,
          );
        } else if (msg.t === 'ack') {
          this.sessions.get(sess.wsSessionId)?.inflight.delete(msg.ref);
        } else if (msg.t === 'pong') {
          // app-level pong ignored; network-level pong handled above
        } else {
          // strict protocol: reject unknown frames to avoid junk
          this.safeSend(socket, {
            t: 'error',
            code: 'unknown_type',
            message: `Unsupported frame t=${(msg as any).t}`,
          });
          return;
        }

        this.sessions.touch(sess.wsSessionId);
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
      this.aliases.unbindSession(sess.wsSessionId); // drop all aliases for this connection
      const why = reason?.toString() || '';
      this.log.log(
        `WS disconnect wsSessionId=${sess.wsSessionId} code=${code} reason="${why}"`,
      );
    });

    // Server hello
    const hello: HelloServerFrame = {
      t: 'hello',
      wsSessionId: sess.wsSessionId,
      protocol: 1,
      serverTime: Date.now(),
    };
    this.safeSend(socket, hello);
  }

  handleDisconnect(_socket: WebSocket) {
    // handled in 'close'
  }

  // ---- Push helpers used by HTTP controller ----

  sendCommandToUser<T>(userId: string | number, type: string, payload: T) {
    const sessions = this.sessions.findByUser(userId);
    const id = randomUUID();
    const frame: CommandFrame<T> = {
      t: 'command',
      id,
      type: type as any,
      payload,
      ts: Date.now(),
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
    const frame: CommandFrame<T> = {
      t: 'command',
      id,
      type: type as any,
      payload,
      ts: Date.now(),
    };
    s.inflight.add(id);
    this.safeSend(s.socket, frame);
    return { delivered: [s.wsSessionId], commandId: id };
  }

  sendCommandToDevice<T>(
    userId: string | number,
    deviceId: string,
    type: string,
    payload: T,
  ) {
    const list = this.sessions.findByDevice(userId, deviceId);
    const id = randomUUID();
    const frame: CommandFrame<T> = {
      t: 'command',
      id,
      type: type as any,
      payload,
      ts: Date.now(),
    };
    list.forEach((s) => {
      s.inflight.add(id);
      this.safeSend(s.socket, frame);
    });
    return { delivered: list.map((s) => s.wsSessionId), commandId: id };
  }

  sendCommandToSession<T>(wsSessionId: string, type: string, payload: T) {
    const s = this.sessions.get(wsSessionId);
    if (!s) return { delivered: [], commandId: null };
    const id = randomUUID();
    const frame: CommandFrame<T> = {
      t: 'command',
      id,
      type: type as any,
      payload,
      ts: Date.now(),
    };
    s.inflight.add(id);
    this.safeSend(s.socket, frame);
    return { delivered: [wsSessionId], commandId: id };
  }

  // ------------------------------------------------

  private safeSend(ws: WebSocket, data: unknown) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    } catch (e) {
      this.log.warn(`send failed: ${(e as Error).message}`);
    }
  }
}
