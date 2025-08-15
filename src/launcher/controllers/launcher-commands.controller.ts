// src/launcher/controllers/launcher-commands.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LauncherGateway } from '../ws/launcher.gateway';
import { ConnectionAliases } from '../ws/connection-aliases';
import { PushCommandDto } from '../dto/push-command.dto';
import { Roles } from 'src/auth/roles.decorator';

type ReqUser = { sub?: string; userId?: string; id?: string };

@Controller('launcher')
export class LauncherCommandsController {
  constructor(
    private readonly gateway: LauncherGateway,
    private readonly aliases: ConnectionAliases,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('commands')
  @Roles('Admin', 'Dev')
  @HttpCode(HttpStatus.ACCEPTED)
  async push(@Req() req: any, @Body() body: PushCommandDto) {
    const u: ReqUser = req.user ?? {};
    const userId = u.sub ?? u.userId ?? u.id;
    if (!userId) throw new UnauthorizedException('JWT missing user id');

    const wsSessionId = this.aliases.resolve(userId, body.code);
    if (!wsSessionId) {
      return {
        delivered: [],
        commandId: null,
        error: 'no_live_session_for_code',
      };
    }

    const res = this.gateway.sendCommandToSession(
      wsSessionId,
      body.type,
      body.payload,
    );
    return res; // { delivered: [wsSessionId], commandId: '<uuid>' }
  }
}
