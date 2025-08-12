import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants } from './constants';
import { TokenBlocklistService } from './token-blocklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly blocklist: TokenBlocklistService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtConstants.secret,
      ignoreExpiration: false,
    });
  }
  async validate(payload: any) {
    const jti = payload?.jti;
    if (jti && (await this.blocklist.isBlocked(jti))) {
      throw new UnauthorizedException('Token revoked');
    }
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
