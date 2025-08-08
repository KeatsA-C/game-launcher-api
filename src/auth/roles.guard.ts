import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const allowed =
      this.reflector.get<string[]>('roles', ctx.getHandler()) ?? [];
    if (allowed.length === 0) return true; // no roles declared

    const request = ctx.switchToHttp().getRequest();
    const role = request.user?.role; // set by JwtStrategy
    if (!role || !allowed.includes(role))
      throw new ForbiddenException('Role not permitted');

    return true;
  }
}
