import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { CompanyStatus, AccountStatus } from '@/common/enums/company-status.enum';
import { UserRole } from '@/common/enums';

export enum AccountBlockCode {
  COMPANY_DEACTIVATED = 'COMPANY_DEACTIVATED',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
}

@Injectable()
export class AccountAccessService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** Platform admins are not tied to a single company subscription. */
  private isPlatformAdmin(user: User): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }

  private resolveOwner(company: Company, ownerFromDb?: User | null): User | null {
    if (ownerFromDb) return ownerFromDb;
    if (company.createdBy) return company.createdBy;
    const users = company.users || [];
    return users.find((u) => u.role === UserRole.COMPANY_ADMIN) || users[0] || null;
  }

  private resolveAccountStatus(company: Company, owner?: User | null): AccountStatus {
    if (company.status === CompanyStatus.DEACTIVATED) return 'deactivated';
    if (owner?.subscriptionExpiresAt && new Date(owner.subscriptionExpiresAt) < new Date()) {
      return 'subscription_expired';
    }
    return 'active';
  }

  private async syncCompanyStatus(company: Company, owner?: User | null): Promise<Company> {
    if (company.status === CompanyStatus.DEACTIVATED) return company;

    const accountStatus = this.resolveAccountStatus(company, owner);
    const nextStatus =
      accountStatus === 'subscription_expired'
        ? CompanyStatus.SUBSCRIPTION_EXPIRED
        : CompanyStatus.ACTIVE;

    if (company.status !== nextStatus) {
      company.status = nextStatus;
      await this.companyRepository.save(company);
    }
    return company;
  }

  async getCompanyAccessContext(user: User): Promise<{
    company: Company | null;
    owner: User | null;
    accountStatus: AccountStatus;
  }> {
    if (this.isPlatformAdmin(user)) {
      return { company: null, owner: null, accountStatus: 'active' };
    }

    const companyId = user.company?.id ?? (user as any).companyId;
    if (!companyId) {
      return { company: null, owner: null, accountStatus: 'active' };
    }

    const company = await this.companyRepository.findOne({
      where: { id: companyId },
      relations: ['createdBy', 'users'],
    });
    if (!company) {
      return { company: null, owner: null, accountStatus: 'active' };
    }

    let owner = this.resolveOwner(company);
    if (owner && !owner.subscriptionExpiresAt) {
      owner = await this.userRepository.findOne({ where: { id: owner.id } });
    }

    const synced = await this.syncCompanyStatus(company, owner);
    const accountStatus = this.resolveAccountStatus(synced, owner);

    return { company: synced, owner, accountStatus };
  }

  async assertCanAccess(user: User, useUnauthorized = false): Promise<void> {
    const { accountStatus } = await this.getCompanyAccessContext(user);
    if (accountStatus === 'active') return;

    const status = useUnauthorized ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN;
    const payload =
      accountStatus === 'deactivated'
        ? {
            statusCode: status,
            message:
              'Your company account has been deactivated by an administrator. Please contact support to restore access.',
            errorCode: AccountBlockCode.COMPANY_DEACTIVATED,
          }
        : {
            statusCode: status,
            message:
              'Your subscription has expired. Please renew your plan to continue using BM Stock.',
            errorCode: AccountBlockCode.SUBSCRIPTION_EXPIRED,
          };

    throw new HttpException(payload, status);
  }
}
