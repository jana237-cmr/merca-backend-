import { CanActivate, ExecutionContext, Injectable, SetMetadata, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Décorateur à poser sur une route : @Roles('commercant')
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>('roles', context.getHandler());
    if (!required || required.length === 0) return true; // pas de rôle exigé -> accès libre (mais toujours authentifié via JwtStrategy)

    const request = context.switchToHttp().getRequest();
    const userRoles: string[] = request.user?.roles || [];
    const ok = required.some(r => userRoles.includes(r));
    if (!ok) throw new ForbiddenException(`Rôle requis : ${required.join(' ou ')}`);
    return true;
  }
}
