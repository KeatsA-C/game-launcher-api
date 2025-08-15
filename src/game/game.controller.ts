import { Body, Controller, Post, Req } from '@nestjs/common';

import { Roles } from '../auth/roles.decorator';
import { GameService } from './game.service';
import { GetLicenseDto } from './dto/get-license.dto';
import { Request } from 'express';

@Controller('game')
export class GameController {
  constructor(private readonly games: GameService) {}

  @Post('license')
  @Roles('User', 'Admin', 'Dev')
  async fetchLicense(
    @Body() dto: GetLicenseDto,
    @Req() req: Request & { user: { role: string } },
  ) {
    const lic = await this.games.getLicense(dto.id, dto.name);
    return {
      gameLicense: lic,
      userRole: req.user.role,
    };
  }
}
