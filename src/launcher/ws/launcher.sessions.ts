import { Injectable, Logger } from '@nestjs/common';
import type { WebSocket } from 'ws';
import { randomUUID } from 'crypto';

export interface Session {
  wsSessionId: string;
  userId: string | number;
  deviceId?: string;
  instanceId?: string;
  socket: WebSocket;
  lastSeen: number;
  inflight: Set<string>; // outstanding command ids awaiting ack
}

@Injectable()
export class LauncherSessions {
  private readonly log = new Logger('LauncherSessions');
  private readonly bySession = new Map<string, Session>();
  private readonly byUser = new Map<string | number, Set<string>>();

  create(userId: string | number, socket: WebSocket): Session {
    const wsSessionId = randomUUID();
    const sess: Session = {
      wsSessionId,
      userId,
      socket,
      lastSeen: Date.now(),
      inflight: new Set(),
    };
    this.bySession.set(wsSessionId, sess);
    if (!this.byUser.has(userId)) this.byUser.set(userId, new Set());
    this.byUser.get(userId)!.add(wsSessionId);
    return sess;
  }

  setClientMeta(
    wsSessionId: string,
    meta: { deviceId?: string; instanceId?: string },
  ) {
    const s = this.bySession.get(wsSessionId);
    if (!s) return;
    if (meta.deviceId) s.deviceId = meta.deviceId;
    if (meta.instanceId) s.instanceId = meta.instanceId;
  }

  touch(wsSessionId: string) {
    const s = this.bySession.get(wsSessionId);
    if (s) s.lastSeen = Date.now();
  }

  remove(wsSessionId: string) {
    const s = this.bySession.get(wsSessionId);
    if (!s) return;
    this.bySession.delete(wsSessionId);
    const set = this.byUser.get(s.userId);
    if (set) {
      set.delete(wsSessionId);
      if (!set.size) this.byUser.delete(s.userId);
    }
  }

  findByUser(userId: string | number): Session[] {
    const set = this.byUser.get(userId);
    if (!set) return [];
    return [...set].map((id) => this.bySession.get(id)!).filter(Boolean);
  }

  findByInstance(
    userId: string | number,
    instanceId: string,
  ): Session | undefined {
    return this.findByUser(userId).find((s) => s.instanceId === instanceId);
  }

  findByDevice(userId: string | number, deviceId: string): Session[] {
    return this.findByUser(userId).filter((s) => s.deviceId === deviceId);
  }

  get(wsSessionId: string) {
    return this.bySession.get(wsSessionId);
  }

  listPresence(userId?: string | number) {
    const all = userId ? this.findByUser(userId) : [...this.bySession.values()];
    return all.map((s) => ({
      wsSessionId: s.wsSessionId,
      userId: s.userId,
      deviceId: s.deviceId,
      instanceId: s.instanceId,
      lastSeen: s.lastSeen,
    }));
  }
}
