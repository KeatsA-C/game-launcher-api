import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const allowed =
      this.reflector.get<string[]>('roles', ctx.getHandler()) ?? [];
    if (allowed.length === 0) return true;

    const role = ctx.switchToHttp().getRequest().user?.role;
    if (!role || !allowed.includes(role))
      throw new ForbiddenException('Role not permitted');
    return true;
  }
}
