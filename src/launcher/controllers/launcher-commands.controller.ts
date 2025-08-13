// src/launcher/controllers/launcher-commands.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LauncherGateway } from '../ws/launcher.gateway';
import { ConnectionAliases } from '../ws/connection-aliases';
import { PushCommandDto } from '../dto/push-command.dto';

// Replace with your real guard
class JwtAuthGuard {
  canActivate() {
    return true;
  }
}

@Controller('launcher')
export class LauncherCommandsController {
  constructor(
    private readonly gateway: LauncherGateway,
    private readonly aliases: ConnectionAliases,
  ) {}

  @Post('commands')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  push(@Body() body: PushCommandDto) {
    const { userId, instanceId, deviceId, code, type, payload } = body;

    if (instanceId) {
      return this.gateway.sendCommandToInstance(
        userId,
        instanceId,
        type,
        payload,
      );
    }
    if (deviceId) {
      return this.gateway.sendCommandToDevice(userId, deviceId, type, payload);
    }
    if (code) {
      const wsSessionId = this.aliases.resolve(userId, code);
      if (!wsSessionId) return { delivered: [], commandId: null };
      return this.gateway.sendCommandToSession(wsSessionId, type, payload);
    }
    // default: broadcast to all instances for the user
    return this.gateway.sendCommandToUser(userId, type, payload);
  }
}
