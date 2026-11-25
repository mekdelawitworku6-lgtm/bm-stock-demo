import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { getPlanLimits } from '@/shared/subscription/subscription-plans.util';

@Injectable()
export class LargePlanGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    const limits = getPlanLimits(user);
    if (limits.tier !== 'large' && limits.tier !== 'trial') {
      throw new ForbiddenException(
        `This feature is exclusive to the Large Business plan (15,999 ETB) and Free Trial. Your current plan is ${limits.title}. Please upgrade to access this feature.`
      );
    }

    return true;
  }
}
