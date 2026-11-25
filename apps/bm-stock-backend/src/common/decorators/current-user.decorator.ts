import { User } from '@/modules/users/entities/user.entity';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (user) {
      const isPlatformAdmin = user.role === 'admin' || user.role === 'super_admin';
      if (isPlatformAdmin) {
        const rawHeader = request.headers?.['x-company-id'] || request.headers?.['X-Company-Id'];
        const headerCompanyId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
        const rawQuery = request.query?.companyId;
        const queryCompanyId = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
        const effectiveCompanyId = headerCompanyId || queryCompanyId;
        if (effectiveCompanyId && typeof effectiveCompanyId === 'string' && UUID_REGEX.test(effectiveCompanyId.trim())) {
          const cleanId = effectiveCompanyId.trim();
          user.companyId = cleanId;
          if (user.company) {
            user.company.id = cleanId;
          } else {
            user.company = { id: cleanId } as any;
          }
        }
      }
    }

    return data ? user?.[data] : user;
  },
);