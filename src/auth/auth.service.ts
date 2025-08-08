import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(private users: UserService, private jwt: JwtService) {}

  async login(username: string, password: string) {
    const user = await this.users.validate(username, password);
    if (!user) throw new UnauthorizedException();

    const payload = { username: user.username, sub: user.id, role: user.role };
    return { access_token: this.jwt.sign(payload) };
  }
}
