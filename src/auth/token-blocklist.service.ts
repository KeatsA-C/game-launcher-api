// src/auth/token-blocklist.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.provider';

@Injectable()
export class TokenBlocklistService {
  private readonly logger = new Logger(TokenBlocklistService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  // Block a token's jti for ttlSec seconds. No-op if ttlSec <= 0.
  async block(jti: string, ttlSec: number): Promise<void> {
    if (!jti) return;
    if (!Number.isFinite(ttlSec) || ttlSec <= 0) return;

    // Value is a tiny JSON for future-proofing/inspection
    const val = JSON.stringify({ reason: 'logout', ts: Date.now() });
    // Overwrite any existing TTL (extend or reset) to be safe
    await this.redis.set(this.key(jti), val, 'EX', Math.ceil(ttlSec));
  }

  async isBlocked(jti: string): Promise<boolean> {
    if (!jti) return false;
    const exists = await this.redis.exists(this.key(jti));
    return exists === 1;
  }

  async ttl(jti: string): Promise<number | null> {
    const t = await this.redis.ttl(this.key(jti));
    if (t < 0) return null; // -2 key doesn't exist, -1 no expire (shouldn't happen)
    return t;
  }

  private key(jti: string): string {
    return `blocklist:jti:${jti}`;
  }
}
