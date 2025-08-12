// src/launcher/launcher-token-issuer.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.provider';
import { randomBytes } from 'crypto';

type IssueInput = {
  userId: string;
  roles: string[];
  deviceId?: string; // now optional
  buildVersion?: string; // now optional
  scope?: string[];
};

type IssueOutput = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string; // opaque id for Redis session
};

@Injectable()
export class LauncherTokenIssuerService {
  private readonly accessTtl = Number(
    process.env.JWT_ACCESS_TTL_SECONDS ?? 900,
  );
  private readonly refreshTtl = Number(
    process.env.JWT_REFRESH_TTL_SECONDS ?? 60 * 60 * 24 * 30,
  );
  private readonly issuer = process.env.JWT_ISSUER;
  private readonly audience = process.env.JWT_AUDIENCE;

  constructor(
    private readonly jwt: JwtService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async issueForDevice(input: IssueInput): Promise<IssueOutput> {
    const jti = this.b64url(randomBytes(16));

    const roles = Array.isArray(input.roles) ? input.roles.filter(Boolean) : [];
    const payload: Record<string, any> = {
      sub: input.userId,
      roles, // array claim – source of truth
      role: roles[0] ?? undefined, // optional legacy single-role
      jti,
      scope: input.scope ?? ['launcher'],
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtl,
      issuer: this.issuer,
      audience: this.audience,
    });

    // Opaque refresh session stored in Redis
    const sessionId = this.b64url(randomBytes(32));
    await this.redis.set(
      `refresh:session:${sessionId}`,
      JSON.stringify({
        userId: input.userId,
        roles: input.roles,
        deviceId: input.deviceId,
        buildVersion: input.buildVersion,
        createdAt: Date.now(),
      }),
      'EX',
      this.refreshTtl,
      'NX',
    );

    return {
      accessToken,
      accessTokenExpiresIn: this.accessTtl,
      refreshToken: sessionId,
    };
  }

  private b64url(buf: Buffer) {
    return buf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
}
