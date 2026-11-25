import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@/modules/users/services/users.service';
import { AccountAccessService } from '@/modules/company/account-access.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private accountAccessService: AccountAccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    let user: Awaited<ReturnType<UsersService['findByIdWithAssociations']>> | null = null;
    try {
      user = await this.usersService.findByIdWithAssociations(payload.sub);
    } catch {
      user = null;
    }
    if (!user) {
      throw new UnauthorizedException('Session expired, please log in again');
    }
    // Auto-create company for existing admin users who don't have one, or sync employee company
    user = await this.usersService.ensureUserHasCompany(user);
    await this.accountAccessService.assertCanAccess(user, true);

    // If staff user, resolve employee relation so company, shop, warehouse are accurate
    const employee = await this.usersService.findEmployeeByUserId(user.id);
    const effectiveCompanyId = employee?.company?.id || user.company?.id || payload.companyId;
    const effectiveShopId = employee?.shop?.id || user.shop?.id || payload.shopId;
    const effectiveWarehouseId = employee?.warehouse?.id || user.warehouse?.id || payload.warehouseId;
    const effectiveEmployeeId = employee?.id || payload.employeeId;

    return {
      ...user,
      companyId: effectiveCompanyId,
      shopId: effectiveShopId,
      warehouseId: effectiveWarehouseId,
      employeeId: effectiveEmployeeId,
      employee,
    };
  }
}