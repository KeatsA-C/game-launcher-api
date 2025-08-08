import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameService {
  constructor(private readonly db: PrismaService) {}

  async getLicense(id: string, name: string) {
    const game = await this.db.game.findUnique({ where: { id } });
    if (!game || game.name !== name)
      throw new NotFoundException('Game not found');
    return game.license;
  }
}
