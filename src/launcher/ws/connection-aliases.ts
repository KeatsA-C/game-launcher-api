// src/launcher/ws/connection-aliases.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';

type AliasRec = { userId: string | number; wsSessionId: string; exp?: number };

// Short fingerprint for safe logging (never log full secrets)
function fp(s: string): string {
  return createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
}

@Injectable()
export class ConnectionAliases {
  private readonly log = new Logger('ConnectionAliases');
  private readonly instanceId = randomUUID(); // identify the DI instance
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

    this.log.debug(
      `bind inst=${this.instanceId} alias.fp=${fp(alias)} ws=${wsSessionId}`,
    );
  }

  resolve(userId: string | number, alias: string): string | null {
    const rec = this.byAlias.get(alias);
    const sid = rec?.wsSessionId;
    // Evaluate hit before returning to log accurately
    const hit =
      !!rec && rec.userId === userId && (!rec.exp || Date.now() <= rec.exp);

    this.log.debug(
      `resolve inst=${this.instanceId} alias.fp=${fp(alias)} hit=${hit}`,
    );

    if (!rec) return null;
    if (rec.userId !== userId) return null;
    if (rec.exp && Date.now() > rec.exp) {
      this.unbindAlias(alias);
      return null;
    }
    return sid!;
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
    this.log.debug(
      `unbind alias inst=${this.instanceId} alias.fp=${fp(alias)}`,
    );
  }

  unbindSession(wsSessionId: string) {
    const set = this.bySession.get(wsSessionId);
    if (!set) return;
    const n = set.size;
    for (const a of set) this.byAlias.delete(a);
    this.bySession.delete(wsSessionId);
    this.log.debug(
      `unbind session inst=${this.instanceId} ws=${wsSessionId} removed=${n}`,
    );
  }
}
