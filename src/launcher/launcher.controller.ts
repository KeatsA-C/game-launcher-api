// src/launcher/launcher.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { LauncherService } from './launcher.service';
import { LauncherTokenIssuerService } from './launcher-token-issuer.service';

import { LauncherRunDto } from './dto/run.dto';
import { LauncherAuthDto } from './dto/auth.dto';
import { Public } from 'src/auth/public.decorator';

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
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('run')
  @HttpCode(HttpStatus.OK)
  async run(@Req() req: any, @Body() _body: LauncherRunDto, @Ip() ip: string) {
    const u: ReqUser = req.user ?? {};
    const userId = u.sub ?? u.userId ?? u.id;
    if (!userId) throw new UnauthorizedException('JWT missing user id');

    const roleSnapshot: string[] = Array.isArray(u.roles)
      ? u.roles
      : u.role
        ? [u.role]
        : [];

    const { code, launchUri, expiresIn } =
      await this.launcher.createOneTimeCode({
        userId,
        roleSnapshot, // snapshot roles from the web user
        ip,
        userAgent: req.headers['user-agent'],
      });

    return { code, launchUri, expiresIn };
  }

  @Public()
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  async auth(@Body() body: LauncherAuthDto) {
    const rec = await this.launcher.consume(body.code);
    if (!rec) {
      return {
        error: 'invalid_or_expired_code',
        message: 'The launch code is invalid or has expired.',
      };
    }

    const tokens = await this.issuer.issueForDevice({
      userId: rec.userId,
      roles: rec.roleSnapshot, // this is what ensures the bearer’s role matches the initiator
      scope: ['launcher'],
    });

    // Minimal payload: only the bearer (access token)
    return { accessToken: tokens.accessToken };
  }
}
