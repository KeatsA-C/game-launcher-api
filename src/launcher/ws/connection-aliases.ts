// src/launcher/ws/connection-aliases.ts
import { Injectable, Logger } from '@nestjs/common';

type AliasRec = { userId: string | number; wsSessionId: string; exp?: number };

@Injectable()
export class ConnectionAliases {
  private readonly log = new Logger('ConnectionAliases');
  private byAlias = new Map<string, AliasRec>();
  private bySession = new Map<string, Set<string>>();

  bind(
    alias: string,
    userId: string | number,
    wsSessionId: string,
    ttlMs?: number,
  ) {
    const rec: AliasRec = {
      userId,
      wsSessionId,
      exp: ttlMs ? Date.now() + ttlMs : undefined,
    };
    this.byAlias.set(alias, rec);
    if (!this.bySession.has(wsSessionId))
      this.bySession.set(wsSessionId, new Set());
    this.bySession.get(wsSessionId)!.add(alias);
  }

  resolve(userId: string | number, alias: string): string | null {
    const rec = this.byAlias.get(alias);
    if (!rec) return null;
    if (rec.userId !== userId) return null;
    if (rec.exp && Date.now() > rec.exp) {
      this.unbindAlias(alias);
      return null;
    }
    return rec.wsSessionId;
  }

  unbindAlias(alias: string) {
    const rec = this.byAlias.get(alias);
    if (!rec) return;
    this.byAlias.delete(alias);
    const set = this.bySession.get(rec.wsSessionId);
    if (set) {
      set.delete(alias);
      if (!set.size) this.bySession.delete(rec.wsSessionId);
    }
  }

  unbindSession(wsSessionId: string) {
    const set = this.bySession.get(wsSessionId);
    if (!set) return;
    for (const a of set) this.byAlias.delete(a);
    this.bySession.delete(wsSessionId);
  }
}
