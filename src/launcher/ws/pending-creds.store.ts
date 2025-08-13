// src/launcher/ws/pending-creds.store.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class PendingCredsStore {
  private readonly log = new Logger('PendingCredsStore');
  private readonly instanceId = randomUUID(); // identify DI instance
  private map = new Map<string, { userId: string | number; exp: number }>();

  issue(cred: string, userId: string | number, ttlSeconds = 60) {
    const exp = Date.now() + ttlSeconds * 1000;
    this.map.set(cred, { userId, exp });
    this.log.debug(`issue inst=${this.instanceId} size=${this.map.size}`);
  }

  redeem(cred: string): { userId: string | number } | null {
    const e = this.map.get(cred);
    this.log.debug(
      `redeem inst=${this.instanceId} hit=${!!e} size=${this.map.size}`,
    );
    if (!e) return null;
    this.map.delete(cred); // single-use
    if (Date.now() > e.exp) return null;
    return { userId: e.userId };
  }
}
