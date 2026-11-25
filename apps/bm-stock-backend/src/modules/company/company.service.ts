import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ILike, Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CompanyLimitAttempt } from './entities/company-limit-attempt.entity';
import { CreateCompanyDto, UpdateCompanyDto, CompanyQueryDto, CompanyResponseDto, RequestLimitUpgradeDto } from './dto';
import { PaginatedResult } from '../../common/interfaces';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, CompanyStatus, AccountStatus, UserStatus } from '../../common/enums';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { PlansService } from '../plans/plans.service';
import { SmsService } from '@/shared/sms/sms.service';

import { OnModuleInit } from '@nestjs/common';

@Injectable()
export class CompanyService implements OnModuleInit {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyLimitAttempt)
    private readonly limitAttemptRepository: Repository<CompanyLimitAttempt>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    private readonly notificationService: NotificationService,
    private readonly plansService: PlansService,
    private readonly smsService: SmsService,
  ) {}

  async onModuleInit() {
    // Cleanup any invalid companies created by legacy plan title names
    const invalidNames = [
      '1 Year Unlimited License',
      'Subscription Plan Upgrade',
      '1_year',
      'For 1 Year',
      'For 1 Month',
      'For 6 Months',
      '1 Year',
      '6 Months',
      '1 Month',
    ];
    for (const name of invalidNames) {
      const companies = await this.companyRepository.find({ where: { name } });
      for (const comp of companies) {
        await this.companyRepository.remove(comp).catch(() => undefined);
      }
    }
  }

  /**
   * Public lookup: find a company by exact name (case-insensitive).
   * Used by staff first-time sign-in to identify their company.
   */
  async lookupByName(name: string): Promise<{ id: string; name: string }> {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new BadRequestException('Company name is required');
    }
    let company = await this.companyRepository.findOne({
      where: { name: ILike(trimmed) },
    });
    if (!company) {
      // Try prefix/substring match if exact match wasn't found
      const candidates = await this.companyRepository.find({
        where: { name: ILike(`%${trimmed}%`) },
        take: 2,
      });
      if (candidates.length === 1) {
        company = candidates[0];
      }
    }
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return { id: company.id, name: company.name };
  }

  async create(createCompanyDto: CreateCompanyDto, currentUser?: User): Promise<CompanyResponseDto> {
    const existingCompany = await this.companyRepository.findOne({ where: { name: createCompanyDto.name } });
    if (existingCompany) {
      throw new ConflictException('Company with this name already exists');
    }

    // Enforce the user's company limit (set at signup) for non-admin users
    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      const limit = currentUser.numCompanies;
      if (limit != null && limit > 0) {
        const ownedCompanies = await this.companyRepository.find({
          where: [
            { createdById: currentUser.id },
            ...(currentUser.companyId ? [{ id: currentUser.companyId }] : []),
          ],
          select: ['id', 'name'],
        });
        const uniqueCompanies = Array.from(new Map(ownedCompanies.map((c) => [c.id, c])).values());
        const ownedCount = uniqueCompanies.length;

        if (ownedCount >= limit) {
          // Record the attempt as a BREACH with complete user, plan, and company context
          await this.limitAttemptRepository.save(
            this.limitAttemptRepository.create({
              userId: currentUser.id,
              companyName: createCompanyDto.name,
              companyNames: [createCompanyDto.name],
              status: 'PENDING',
              kind: 'breach',
              planId: currentUser.planId || undefined,
              planTitle: currentUser.planTitle || undefined,
              planAmount: currentUser.planAmount ? Number(currentUser.planAmount) : undefined,
              metadata: {
                kind: 'company_limit_breach',
                companyName: createCompanyDto.name,
                limit,
                ownedCount,
                existingCompanies: uniqueCompanies.map((c) => c.name),
                userFullName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
                userPhone: currentUser.phone,
                userEmail: currentUser.email,
              },
            }),
          );

          const detailedMsg = `You have reached your company limit of ${limit} (you are currently managing ${ownedCount} of ${limit} allowed companies: ${uniqueCompanies.map((c) => `"${c.name}"`).join(', ') || 'none'}). To add "${createCompanyDto.name}", please submit a company upgrade request with a subscription plan from the More section of the app or contact your administrator.`;

          // Notify the user that they breached their limit and how to request properly
          await this.notificationService.create({
            type: NotificationType.PAYMENT,
            title: 'Company limit reached',
            message: detailedMsg,
            userId: currentUser.id,
            companyId: currentUser.companyId,
            metadata: { kind: 'company_limit_breach', companyName: createCompanyDto.name, limit, ownedCount },
          }).catch(() => undefined);

          throw new ForbiddenException(detailedMsg);
        }
      }
    }

    const { warehouseIds, ...companyData } = createCompanyDto;
    const company = this.companyRepository.create({
      ...companyData,
      address: companyData.address?.trim() || 'Not specified',
      createdById: currentUser?.id,
    });
    const savedCompany = await this.companyRepository.save(company);

    if (warehouseIds && warehouseIds.length > 0) {
      const warehouses = await this.warehouseRepository.findBy({ id: In(warehouseIds) });
      if (warehouses.length !== warehouseIds.length) {
        throw new NotFoundException('One or more warehouses not found');
      }
      
      for (const warehouse of warehouses) {
        warehouse.company = savedCompany;
        await this.warehouseRepository.save(warehouse);
      }
    } else {
      // Auto-create a default warehouse for this company so each company has its own isolated stores
      const defaultWarehouse = this.warehouseRepository.create({
        name: savedCompany.name,
        location: savedCompany.address || '',
        company: savedCompany,
      });
      await this.warehouseRepository.save(defaultWarehouse);
    }

    const companyWithWarehouses = await this.companyRepository.findOne({ 
      where: { id: savedCompany.id }, 
      relations: ['warehouses'] 
    });
    return this.mapToResponseDto(companyWithWarehouses || savedCompany);
  }

  /**
   * Records a PROPER company limit request: the user explicitly asks for more
   * companies (from the More section), selects a payment plan, and the request
   * is queued for admin approval.
   */
  async requestLimitUpgrade(
    dto: RequestLimitUpgradeDto,
    currentUser: User,
  ): Promise<{ success: boolean; requestId: string }> {
    const names = [...new Set((dto.companyNames || []).map((n) => (n || '').trim()).filter((n) => n.length > 0))];
    if (names.length === 0) {
      throw new BadRequestException('At least one company name is required');
    }

    const plan = await this.plansService.findOneById(dto.planId);
    if (!plan) {
      throw new NotFoundException('Selected plan not found');
    }

    const attempt = await this.limitAttemptRepository.save(
      this.limitAttemptRepository.create({
        userId: currentUser.id,
        companyName: names[0],
        companyNames: names,
        status: 'PENDING',
        kind: 'request',
        planId: plan.id,
        planTitle: plan.title,
        planAmount: plan.amount != null ? Number(plan.amount) : undefined,
        paymentMethod: dto.paymentMethod,
        paymentRef: dto.paymentRef,
        screenshotUrl: dto.screenshotUrl,
      }),
    );

    const list = names.map((n) => `"${n}"`).join(', ');
    this.notificationService.create({
      type: NotificationType.PAYMENT,
      title: 'Company request submitted for approval',
      message: `Your request to add ${list} on the "${plan.title}" plan has been submitted to the admin for approval. We will notify you once it is approved.`,
      userId: currentUser.id,
      companyId: currentUser.companyId,
      metadata: { kind: 'company_limit_request', companyNames: names, planId: plan.id, planTitle: plan.title },
    }).catch(() => undefined);

    return { success: true, requestId: attempt.id };
  }

  async findAll(query: CompanyQueryDto, currentUser?: User): Promise<PaginatedResult<CompanyResponseDto>> {
    const { search, accountStatus, ownerRole, page = 1, limit = 100 } = query;
    const queryBuilder = this.companyRepository.createQueryBuilder('company')
      .leftJoinAndSelect('company.warehouses', 'warehouses')
      .leftJoinAndSelect('company.shops', 'shops')
      .leftJoinAndSelect('company.employees', 'employees')
      .leftJoinAndSelect('employees.user', 'user')
      .leftJoinAndSelect('company.users', 'users')
      .leftJoinAndSelect('company.createdBy', 'createdBy')
      .orderBy('company.createdAt', 'DESC');

    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      queryBuilder.andWhere(
        '(company.createdById = :userId OR company.id = :companyId OR user.id = :userId)',
        { userId: currentUser.id, companyId: currentUser.companyId || '' }
      );
    }

    if (
      ownerRole &&
      currentUser &&
      (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN)
    ) {
      queryBuilder.andWhere('createdBy.role = :ownerRole', { ownerRole });
    }

    if (search) {
      queryBuilder.andWhere('(company.name LIKE :search OR company.address LIKE :search)', { search: `%${search}%` });
    }

    const skip = (page - 1) * limit;
    const [companies, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    let data = companies.map((c) => {
      const dto = this.mapToResponseDto(c);
      if (currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN)) {
        return this.enrichForAdmin(dto, c);
      }
      return dto;
    });

    if (accountStatus && currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN)) {
      data = data.filter((c) => c.accountStatus === accountStatus);
    }

    return {
      data,
      total: accountStatus ? data.length : total,
      page,
      limit,
      totalPages: Math.ceil((accountStatus ? data.length : total) / limit),
    };
  }

  async getAdminDetail(id: string, currentUser: User): Promise<CompanyResponseDto> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can view company admin details');
    }

    const company = await this.companyRepository.findOne({
      where: { id },
      relations: ['warehouses', 'shops', 'employees', 'employees.user', 'users', 'createdBy'],
    });
    if (!company) throw new NotFoundException('Company not found');

    const dto = this.mapToResponseDto(company);
    const enriched = this.enrichForAdmin(dto, company);

    const owner = this.resolveOwner(company);
    if (owner) {
      enriched.createdBy = {
        ...enriched.createdBy,
        id: owner.id,
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email,
        phone: owner.phone,
        numCompanies: owner.numCompanies ?? null,
        faydaId: owner.faydaId,
        tin: owner.tin,
      };
      enriched.subscription = this.buildSubscriptionSummary(owner);
      enriched.paymentHistory = await this.buildPaymentHistory(owner);
    }

    await this.syncCompanyStatusFromAccount(company, owner);
    enriched.status = company.status;
    enriched.accountStatus = this.resolveAccountStatus(company, owner);

    return enriched;
  }

  async deactivateCompany(id: string, currentUser: User): Promise<CompanyResponseDto> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can deactivate companies');
    }

    const company = await this.companyRepository.findOne({
      where: { id },
      relations: ['users', 'createdBy'],
    });
    if (!company) throw new NotFoundException('Company not found');

    company.status = CompanyStatus.DEACTIVATED;
    await this.companyRepository.save(company);

    const owner = this.resolveOwner(company);
    const userIds = (company.users || []).map((u) => u.id);
    if (userIds.length > 0) {
      await this.userRepository.update(userIds, { status: UserStatus.INACTIVE });
    } else if (owner) {
      await this.userRepository.update(owner.id, { status: UserStatus.INACTIVE });
    }

    return this.getAdminDetail(id, currentUser);
  }

  async reactivateCompany(id: string, currentUser: User): Promise<CompanyResponseDto> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can reactivate companies');
    }

    const company = await this.companyRepository.findOne({
      where: { id },
      relations: ['users', 'createdBy'],
    });
    if (!company) throw new NotFoundException('Company not found');

    const owner = this.resolveOwner(company);
    const accountStatus = this.resolveAccountStatus(
      { ...company, status: CompanyStatus.ACTIVE },
      owner,
    );

    company.status =
      accountStatus === 'subscription_expired'
        ? CompanyStatus.SUBSCRIPTION_EXPIRED
        : CompanyStatus.ACTIVE;
    await this.companyRepository.save(company);

    if (owner && accountStatus === 'active') {
      await this.userRepository.update(owner.id, { status: UserStatus.ACTIVE });
    }

    return this.getAdminDetail(id, currentUser);
  }

  private resolveOwner(company: Company): User | null {
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

  private buildSubscriptionSummary(owner: User) {
    return {
      planId: owner.planId,
      planTitle: owner.planTitle,
      planAmount: owner.planAmount != null ? Number(owner.planAmount) : null,
      planPeriod: owner.planPeriod,
      paymentStatus: owner.paymentStatus,
      paymentMethod: owner.paymentMethod,
      paymentRef: owner.paymentRef,
      paymentScreenshot: owner.paymentScreenshot,
      subscriptionStartDate: owner.subscriptionStartDate,
      subscriptionPaymentDate: owner.subscriptionPaymentDate,
      subscriptionNextPaymentDate: owner.subscriptionNextPaymentDate,
      subscriptionExpiresAt: owner.subscriptionExpiresAt,
    };
  }

  private async buildPaymentHistory(owner: User) {
    const history: Array<{
      id: string;
      type: string;
      description?: string;
      amount?: number;
      method?: string;
      reference?: string;
      status?: string;
      paidAt?: Date;
    }> = [];

    if (owner.planTitle || owner.paymentRef || owner.subscriptionPaymentDate) {
      history.push({
        id: `sub-${owner.id}`,
        type: 'subscription',
        description: owner.planTitle ? `Subscription: ${owner.planTitle}` : 'Initial subscription',
        amount: owner.planAmount != null ? Number(owner.planAmount) : undefined,
        method: owner.paymentMethod,
        reference: owner.paymentRef,
        status: owner.paymentStatus,
        paidAt: owner.subscriptionPaymentDate || owner.createdAt,
      });
    }

    const attempts = await this.limitAttemptRepository.find({
      where: { userId: owner.id, kind: 'request' },
      order: { createdAt: 'DESC' },
    });

    for (const attempt of attempts) {
      if (!attempt.planTitle && attempt.planAmount == null) continue;
      history.push({
        id: attempt.id,
        type: 'company_limit_upgrade',
        description: `Company limit request (${attempt.status})`,
        amount: attempt.planAmount != null ? Number(attempt.planAmount) : undefined,
        method: undefined,
        reference: undefined,
        status: attempt.status,
        paidAt: attempt.createdAt,
      });
    }

    return history.sort((a, b) => {
      const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  private countStaffAccounts(company: Company): number {
    return (company.users || []).filter(
      (u) =>
        u.role !== UserRole.COMPANY_ADMIN &&
        u.role !== UserRole.ADMIN &&
        u.role !== UserRole.SUPER_ADMIN,
    ).length;
  }

  private enrichForAdmin(dto: CompanyResponseDto, company: Company): CompanyResponseDto {
    const owner = this.resolveOwner(company);
    const storesCount = (company.shops?.length || 0) + (company.warehouses?.length || 0);
    const staffCount = this.countStaffAccounts(company);
    const accountStatus = this.resolveAccountStatus(company, owner);

    return {
      ...dto,
      status: company.status,
      accountStatus,
      storesCount,
      staffCount,
      subscription: owner ? this.buildSubscriptionSummary(owner) : undefined,
      createdBy: owner
        ? {
            id: owner.id,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email,
            phone: owner.phone,
            numCompanies: owner.numCompanies ?? null,
            faydaId: owner.faydaId,
            tin: owner.tin,
          }
        : dto.createdBy,
    };
  }

  private async syncCompanyStatusFromAccount(company: Company, owner?: User | null): Promise<void> {
    if (company.status === CompanyStatus.DEACTIVATED) return;

    const accountStatus = this.resolveAccountStatus(company, owner);
    const nextStatus =
      accountStatus === 'subscription_expired'
        ? CompanyStatus.SUBSCRIPTION_EXPIRED
        : CompanyStatus.ACTIVE;

    if (company.status !== nextStatus) {
      company.status = nextStatus;
      await this.companyRepository.save(company);
    }
  }

  async findOne(id: string, currentUser?: User): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ 
      where: { id }, 
      relations: ['warehouses', 'shops', 'employees', 'employees.user', 'users', 'createdBy'] 
    });
    if (!company) throw new NotFoundException('Company not found');

    // Tenant authorization check (Finding 6, CWE-639 IDOR mitigation)
    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      const isOwner = company.createdById === currentUser.id;
      const isCurrentCompany = company.id === currentUser.companyId;
      const isMember = (company.users || []).some(u => u.id === currentUser.id) ||
                       (company.employees || []).some(e => e.user?.id === currentUser.id || (e as any).userId === currentUser.id);
      if (!isOwner && !isCurrentCompany && !isMember) {
        throw new NotFoundException('Company not found');
      }
    }

    return this.mapToResponseDto(company);
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto, currentUser?: User): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id }, relations: ['createdBy'] });
    if (!company) throw new NotFoundException('Company not found');

    // Only platform admin or the company's owner/company_admin can update company details
    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      const isOwner = company.createdById === currentUser.id;
      const isCompanyAdmin = currentUser.role === UserRole.COMPANY_ADMIN && company.id === currentUser.companyId;
      if (!isOwner && !isCompanyAdmin) {
        throw new NotFoundException('Company not found');
      }
    }

    Object.assign(company, updateCompanyDto);
    const updatedCompany = await this.companyRepository.save(company);
    return this.mapToResponseDto(updatedCompany);
  }

  async remove(id: string, currentUser?: User): Promise<void> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    // Only platform admin or company owner can remove the company
    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      if (company.createdById !== currentUser.id) {
        throw new NotFoundException('Company not found');
      }
    }

    const result = await this.companyRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Company not found');
  }

  async addWarehouses(companyId: string, warehouseIds: string[], currentUser?: User): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['warehouses'] });
    if (!company) throw new NotFoundException('Company not found');

    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      if (company.createdById !== currentUser.id && company.id !== currentUser.companyId) {
        throw new NotFoundException('Company not found');
      }
    }

    const warehouses = await this.warehouseRepository.findBy({ id: In(warehouseIds) });
    if (!warehouses || warehouses.length === 0) throw new NotFoundException('Warehouse not found');

    for (const warehouse of warehouses) {
      warehouse.company = company;
      await this.warehouseRepository.save(warehouse);
    }
    const updatedCompany = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['warehouses'] });
    return this.mapToResponseDto(updatedCompany || company);
  }

  async getWarehouses(companyId: string, currentUser?: User): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['warehouses'] });
    if (!company) throw new NotFoundException('Company not found');

    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      if (company.createdById !== currentUser.id && company.id !== currentUser.companyId) {
        throw new NotFoundException('Company not found');
      }
    }

    return this.mapToResponseDto(company);
  }

  async addShops(companyId: string, shopIds: string[], currentUser?: User): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['shops'] });
    if (!company) throw new NotFoundException('Company not found');

    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      if (company.createdById !== currentUser.id && company.id !== currentUser.companyId) {
        throw new NotFoundException('Company not found');
      }
    }

    const shops = await this.shopRepository.findBy({ id: In(shopIds) });
    if (!shops || shops.length === 0) throw new NotFoundException('Shop not found');

    for (const shop of shops) {
      shop.company = company;
      await this.shopRepository.save(shop);
    }
    
    const updatedCompany = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['shops'] });
    return this.mapToResponseDto(updatedCompany || company);
  }

  async getShops(companyId: string, currentUser?: User): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['shops'] });
    if (!company) throw new NotFoundException('Company not found');

    if (currentUser && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      if (company.createdById !== currentUser.id && company.id !== currentUser.companyId) {
        throw new NotFoundException('Company not found');
      }
    }

    return this.mapToResponseDto(company);
  }

  async findLimitAttempts(currentUser: User): Promise<any[]> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can view company limit attempts');
    }
    const attempts = await this.limitAttemptRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const userCompanyCounts = new Map<string, number>();
    const userCompanyNames = new Map<string, string[]>();
    for (const a of attempts) {
      if (a.userId && !userCompanyCounts.has(a.userId)) {
        const userComps = await this.companyRepository.find({
          where: [
            { createdById: a.userId },
            ...(a.user?.companyId ? [{ id: a.user.companyId }] : []),
          ],
          select: ['id', 'name'],
        });
        const unique = Array.from(new Map(userComps.map((c) => [c.id, c])).values());
        userCompanyCounts.set(a.userId, unique.length);
        userCompanyNames.set(a.userId, unique.map((c) => c.name));
      }
    }

    return attempts.map(a => ({
      id: a.id,
      userId: a.userId,
      companyName: a.companyName,
      companyNames: a.companyNames && a.companyNames.length > 0 ? a.companyNames : [a.companyName],
      kind: a.kind,
      status: a.status,
      attemptedAt: a.createdAt,
      planId: a.planId ?? a.user?.planId ?? null,
      planTitle: a.planTitle ?? a.user?.planTitle ?? (a.metadata?.planTitle || 'Standard'),
      planAmount: a.planAmount != null ? Number(a.planAmount) : (a.user?.planAmount != null ? Number(a.user.planAmount) : null),
      paymentMethod: a.paymentMethod ?? a.user?.paymentMethod ?? null,
      paymentRef: a.paymentRef ?? a.user?.paymentRef ?? null,
      screenshotUrl: a.screenshotUrl ?? a.user?.paymentScreenshot ?? null,
      metadata: a.metadata ?? null,
      userFullName: a.user
        ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim()
        : (a.metadata?.userFullName || 'Unknown User'),
      userEmail: a.user?.email || a.metadata?.userEmail || null,
      userPhone: a.user?.phone || a.metadata?.userPhone || null,
      numCompanies: a.user?.numCompanies ?? a.metadata?.limit ?? 1,
      currentCompaniesCount: a.userId ? (userCompanyCounts.get(a.userId) ?? (a.metadata?.ownedCount || 0)) : 0,
      existingCompanyNames: a.userId ? (userCompanyNames.get(a.userId) ?? []) : [],
    }));
  }

  async resolveLimitAttempt(id: string, currentUser: User): Promise<{ success: boolean }> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can resolve company limit attempts');
    }
    const attempt = await this.limitAttemptRepository.findOne({ where: { id } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    attempt.status = 'RESOLVED';
    await this.limitAttemptRepository.save(attempt);
    return { success: true };
  }

  async approveLimitAttempt(id: string, numCompanies?: number): Promise<{ success: boolean; numCompanies: number }> {
    const attempt = await this.limitAttemptRepository.findOne({ where: { id } });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const user = await this.userRepository.findOne({ where: { id: attempt.userId } });
    if (!user) throw new NotFoundException('User not found');

    const currentLimit = user.numCompanies ?? 0;
    const newLimit = numCompanies ?? currentLimit + 1;
    if (newLimit <= 0) {
      throw new ForbiddenException('New company allowance must be at least 1');
    }

    user.numCompanies = newLimit;
    await this.userRepository.save(user);

    attempt.status = 'APPROVED';
    await this.limitAttemptRepository.save(attempt);

    const names = attempt.companyNames && attempt.companyNames.length > 0 ? attempt.companyNames : [attempt.companyName];
    
    const isPlanTitleName = (name: string) => {
      const lower = name.toLowerCase();
      return lower.includes('license') || lower.includes('subscription') || lower.includes('1 year') || lower.includes('plan upgrade');
    };

    // Automatically create real requested companies (excluding plan titles) so they appear in dropdown
    const validNames = names.filter((n) => n && n.trim() && !isPlanTitleName(n.trim()));
    for (const name of validNames) {
      const trimmedName = name.trim();
      const existing = await this.companyRepository.findOne({ where: { name: trimmedName } });
      if (!existing) {
        const company = this.companyRepository.create({
          name: trimmedName,
          address: 'Not specified',
          phoneNumber: user.phone || undefined,
          createdById: user.id,
          status: CompanyStatus.ACTIVE,
        });
        const savedCompany = await this.companyRepository.save(company);

        // Create default warehouse/store for the new company
        const warehouse = this.warehouseRepository.create({
          name: trimmedName,
          location: '',
          company: savedCompany,
        });
        await this.warehouseRepository.save(warehouse);
      }
    }

    const list = names.map((n) => `"${n}"`).join(', ');
    this.notificationService.create({
      type: NotificationType.INFO,
      title: 'Company request approved',
      message: `Your request to add ${list} has been approved. Your company allowance is now ${newLimit}. The new company is now available in your companies dropdown.`,
      userId: user.id,
      companyId: user.companyId,
      metadata: { kind: 'company_limit_approved', companyNames: names, numCompanies: newLimit },
    }).catch(() => undefined);

    // Notify the user by SMS as well (best-effort, non-blocking)
    if (user.phone) {
      this.smsService
        .sendNotificationSms(user.phone, `Your request to add ${list} has been approved. The new company is now available in your BM Stock app companies dropdown.`)
        .catch(() => undefined);
    }

    return { success: true, numCompanies: newLimit };
  }

  async rejectLimitAttempt(id: string): Promise<{ success: boolean }> {
    const attempt = await this.limitAttemptRepository.findOne({ where: { id } });
    if (!attempt) throw new NotFoundException('Attempt not found');

    attempt.status = 'REJECTED';
    await this.limitAttemptRepository.save(attempt);

    const user = await this.userRepository.findOne({ where: { id: attempt.userId } });
    if (user) {
      const names = attempt.companyNames && attempt.companyNames.length > 0 ? attempt.companyNames : [attempt.companyName];
      const list = names.map((n) => `"${n}"`).join(', ');
      this.notificationService.create({
        type: NotificationType.PAYMENT,
        title: 'Company request not approved',
        message: `Your request to add ${list} was not approved because it is beyond your current plan. Please complete your payment / plan upgrade so we can approve it.`,
        userId: user.id,
        companyId: user.companyId,
        metadata: { kind: 'company_limit_rejected', companyNames: names },
      }).catch(() => undefined);
    }

    return { success: true };
  }

  private mapToResponseDto(company: Company): CompanyResponseDto {
    return {
      id: company.id,
      name: company.name,
      address: company.address,
      phoneNumber: company.phoneNumber,
      email: company.email,
      description: company.description,
      status: company.status,
      createdBy: company.createdBy ? {
        id: company.createdBy.id,
        firstName: company.createdBy.firstName,
        lastName: company.createdBy.lastName,
        email: company.createdBy.email,
        phone: company.createdBy.phone,
        numCompanies: company.createdBy.numCompanies ?? null,
        faydaId: company.createdBy.faydaId,
        tin: company.createdBy.tin,
      } : null,
      warehouses: company.warehouses ? company.warehouses.map(warehouse => ({
        id: warehouse.id,
        name: warehouse.name })) : [],
      shops: company.shops ? company.shops.map(shop => ({
        id: shop.id,
        name: shop.name
      })) : [],
      employees: company.employees ? company.employees.map(employee => ({
        id: employee.id,
        name: employee.name,
        phoneNumber: employee.phoneNumber,
        jobTitle: employee.jobTitle,
baseCommissionRate: employee.baseCommissionRate,
        userId: employee.user?.id,
        userName: employee.user ? `${employee.user.firstName} ${employee.user.lastName}` : null,
        userEmail: employee.user?.email,
      })) : [],
      users: company.users ? company.users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      })) : [],
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}