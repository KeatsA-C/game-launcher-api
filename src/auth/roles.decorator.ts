import { SetMetadata } from '@nestjs/common';

/**
 * Declare which roles may access a route.
 * Example: `@Roles('User', 'Admin')`
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
