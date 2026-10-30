import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { UserRole } from './roles';

describe('RolesGuard', () => {
  const contextFor = (role?: UserRole) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    }) as unknown as ExecutionContext;

  const guardRequiring = (roles?: UserRole[]) =>
    new RolesGuard({
      getAllAndOverride: () => roles,
    } as unknown as Reflector);

  it('ADMIN gọi được API admin', () => {
    expect(guardRequiring(['ADMIN']).canActivate(contextFor('ADMIN'))).toBe(
      true,
    );
  });

  it('khách thường gọi API admin → 403', () => {
    expect(() =>
      guardRequiring(['ADMIN']).canActivate(contextFor('CUSTOMER')),
    ).toThrow(ForbiddenException);
  });

  it('không có role → 403', () => {
    expect(() => guardRequiring(['ADMIN']).canActivate(contextFor())).toThrow(
      ForbiddenException,
    );
  });

  it('route không yêu cầu role thì cho qua', () => {
    expect(guardRequiring(undefined).canActivate(contextFor('CUSTOMER'))).toBe(
      true,
    );
  });
});
