import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../enums';

/**
 * Resolves the effective companyId for multi-tenant isolation.
 * - If the user is SUPER_ADMIN, they may query across companies or target any specific company.
 * - For all other roles, the query MUST be strictly scoped to their own companyId.
 *   If a different companyId is requested in query params, a ForbiddenException is thrown.
 */
export function resolveEffectiveCompanyId(currentUser?: any, requestedCompanyId?: string): string {
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  if (isSuperAdmin) {
    return requestedCompanyId || currentUser?.companyId || '';
  }

  const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
  if (!userCompanyId) {
    throw new ForbiddenException('User is not associated with any company.');
  }

  if (requestedCompanyId && requestedCompanyId !== userCompanyId) {
    throw new ForbiddenException('Cross-tenant data access is strictly forbidden.');
  }

  return userCompanyId;
}
