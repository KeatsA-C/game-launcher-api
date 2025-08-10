import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';
import { TokenBlocklistService } from './token-blocklist.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly blocklist: TokenBlocklistService, // in-memory is fine
  ) {
    super();
  }

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const ok = (await super.canActivate(ctx)) as boolean;

    const req = ctx.switchToHttp().getRequest();
    const jti: string | undefined = req.user?.jti;
    if (jti && (await this.blocklist.isBlocked(jti))) {
      throw new UnauthorizedException('Token revoked');
    }
    return ok;
  }
}
