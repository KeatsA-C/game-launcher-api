// src/launcher/launcher.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { LauncherService } from './launcher.service';
import { LauncherTokenIssuerService } from './launcher-token-issuer.service';

import { LauncherAuthDto } from './dto/auth.dto';

import { PendingCredsStore } from './ws/pending-creds.store';
import { createHash } from 'crypto';
import { Public } from '../auth/public.decorator';

type ReqUser = {
  sub?: string;
  userId?: string;
  id?: string;
  roles?: string[];
  role?: string;
  sessionId?: string;
};

@Controller('launcher')
export class LauncherController {
  constructor(
    private readonly launcher: LauncherService,
    private readonly issuer: LauncherTokenIssuerService,
    private readonly pendingCreds: PendingCredsStore,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('run')
  @HttpCode(HttpStatus.OK)
  async run(@Req() req: any, @Ip() ip: string) {
    const u: ReqUser = req.user ?? {};
    const userId = u.sub ?? u.userId ?? u.id;
    if (!userId) throw new UnauthorizedException('JWT missing user id');

    const roleSnapshot: string[] = Array.isArray(u.roles)
      ? u.roles
      : u.role
        ? [u.role]
        : [];

    const { code, launchUri } = await this.launcher.createOneTimeCode({
      userId,
      roleSnapshot, // snapshot roles from the web user
      ip,
      userAgent: req.headers['user-agent'],
    });

    return { code, launchUri };
  }

  @Public()
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  async auth(@Body() body: LauncherAuthDto) {
    if (!body?.code || typeof body.code !== 'string' || body.code.length < 8) {
      return { error: 'invalid_or_expired_code', message: 'Invalid code.' };
    }
    const rec = await this.launcher.consume(body.code);
    if (!rec)
      return {
        error: 'invalid_or_expired_code',
        message: 'The launch code is invalid or has expired.',
      };

    const tokens = await this.issuer.issueForDevice({
      userId: rec.userId,
      roles: rec.roleSnapshot ?? [],
      scope: ['launcher'],
    });
    const fp = createHash('sha256').update(body.code).digest('hex').slice(0, 8);
    Logger.log(
      `Issued WS cred fp=${fp} ttl=60s for user=${rec.userId}`,
      'LauncherController',
    );
    this.pendingCreds.issue(body.code, rec.userId, 60);

    return { accessToken: tokens.accessToken };
  }
}
