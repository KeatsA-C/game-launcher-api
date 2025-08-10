// src/auth/token-blocklist.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

// token-blocklist.service.ts
@Injectable()
export class TokenBlocklistService {
  private banned = new Map<string, NodeJS.Timeout>();
  async isBlocked(jti: string) {
    return this.banned.has(jti);
  }
  async block(jti: string, ttlSeconds: number) {
    if (!jti || ttlSeconds <= 0 || this.banned.has(jti)) return;
    const t = setTimeout(() => this.banned.delete(jti), ttlSeconds * 1000);
    this.banned.set(jti, t);
  }
}
