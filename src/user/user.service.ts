import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly rounds = 12;

  constructor(private readonly db: PrismaService) {}

  async create(username: string, password: string, role = 'User') {
    const exists = await this.db.user.findUnique({ where: { username } });
    if (exists) throw new BadRequestException('Username taken');

    const passwordHash = await bcrypt.hash(password, this.rounds);

    return this.db.user.create({
      data: { username, passwordHash, role },
    });
  }

  async validate(username: string, password: string) {
    const user = await this.db.user.findUnique({ where: { username } });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }
}
