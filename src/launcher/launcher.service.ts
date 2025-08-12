// src/launcher/launcher.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.provider';

type CodeRecord = {
  userId: string;
  roleSnapshot: string[];
  browserSessionId?: string;
  ip?: string;
  uaHash?: string;
  createdAt: number;
  ttl: number;
};

@Injectable()
export class LauncherService {
  private readonly ttl: number;
  private readonly codeBytes: number;
  private readonly scheme: string;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    cfg: ConfigService,
  ) {
    this.ttl = Number(cfg.get('LAUNCH_CODE_TTL_SECONDS') ?? 60);
    this.codeBytes = Number(cfg.get('LAUNCH_CODE_BYTES') ?? 32);
    this.scheme = cfg.get<string>('LAUNCHER_URI_SCHEME') || 'svlauncher';
    if (this.ttl <= 0 || this.ttl > 300)
      throw new Error('LAUNCH_CODE_TTL_SECONDS must be 1..300');
    if (this.codeBytes < 16 || this.codeBytes > 64)
      throw new Error('LAUNCH_CODE_BYTES must be 16..64');
  }

  async createOneTimeCode(params: {
    userId: string;
    roleSnapshot: string[];
    browserSessionId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const code = this.base64url(randomBytes(this.codeBytes));
    const key = this.keyFor(code);

    const rec: CodeRecord = {
      userId: params.userId,
      roleSnapshot: params.roleSnapshot.slice(),
      browserSessionId: params.browserSessionId,
      ip: params.ip,
      uaHash: params.userAgent ? this.sha1(params.userAgent) : undefined,
      createdAt: Math.floor(Date.now() / 1000),
      ttl: this.ttl,
    };

    // NX + TTL ensures single logical issuance window
    const ok = await this.redis.set(
      key,
      JSON.stringify(rec),
      'EX',
      this.ttl,
      'NX',
    );
    if (ok !== 'OK') throw new Error('Failed to store launch code');

    return {
      code,
      launchUri: `${this.scheme}://auth?code=${encodeURIComponent(code)}`,
      expiresIn: this.ttl,
    };
  }

  // Redis 6.2+: GETDEL is atomic
  async consume(code: string): Promise<CodeRecord | null> {
    const key = this.keyFor(code);
    const raw = (await (this.redis as any).getdel?.(key)) ?? null;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private keyFor(code: string): string {
    const sha = createHash('sha256').update(code, 'utf8').digest('hex');
    return `launch:code:${sha}`;
  }

  private base64url(buf: Buffer): string {
    return buf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private sha1(s: string): string {
    return createHash('sha1').update(s).digest('hex');
  }
}
