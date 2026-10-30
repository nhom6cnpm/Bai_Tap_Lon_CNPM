import { SetMetadata } from '@nestjs/common';

export const USER_ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLES_KEY = 'roles';

/** Only users with one of these roles may call the route (use with RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
