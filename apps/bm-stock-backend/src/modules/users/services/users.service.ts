import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateUserDto } from '@/modules/users/dto/user/create-user.dto';
import { UpdateUserDto } from '@/modules/users/dto/user/update-user.dto';
import { AdminUpdateUserDto } from '@/modules/users/dto/user/admin-user-update.dto';
import { AssignUserDto } from '@/modules/users/dto/user/assign-user.dto';
import { User } from '../../users/entities/user.entity';
import { Employee } from '../../users/entities/employee.entity';
import { Company } from '@/modules/company/entities/company.entity';
import { Shop } from '@/modules/shops/entities/shops.entity';
import { Warehouse } from '@/modules/warehouse/entities/warehouse.entity';
import { UserRole, UserStatus, CompanyStatus } from '@/common/enums';
import { AdminUsersQueryDto } from '@/modules/users/dto/user/admin-users-query.dto';
import { Product } from '@/modules/products/entities/product.entity';
import { Sales } from '@/modules/sales/entities/sales.entity';
import { NotificationService } from '@/modules/notifications/notification.service';
import { NotificationType } from '@/modules/notifications/entities/notification.entity';
import { UserPurgeService } from './user-purge.service';
import { OtpService } from '@/modules/auth/otp.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { AuditAction } from '@/modules/audit-logs/entities/audit-log.entity';
import {
  addSubscriptionPeriod,
  getSubscriptionNextPaymentDate,
  isTrialPlan,
} from '@/shared/subscription/subscription-period.util';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Sales)
    private readonly salesRepository: Repository<Sales>,
    private readonly notificationService: NotificationService,
    private readonly userPurgeService: UserPurgeService,
    private readonly otpService: OtpService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async onModuleInit() {
    try {
      await this.usersRepository.query(`
        DO $$
        BEGIN
          ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END $$;
        ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_97672ac88f789774dd47f7c8be3";
        DROP INDEX IF EXISTS "IDX_97672ac88f789774dd47f7c8be";
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_unique" ON "users" ("email") WHERE "email" IS NOT NULL;
        UPDATE "users" 
        SET "email" = NULL 
        WHERE ("email" LIKE '%@bmstock.com' OR "email" LIKE '%@staff.bmstock.com' OR "email" LIKE '%@seed.bmstock.local');
      `);
      this.logger.log('Database schema ensured: email column is nullable, synthetic emails cleared');
    } catch (err: any) {
      this.logger.warn(`Could not ensure email column nullable or clear synthetic emails: ${err?.message || err}`);
    }
  }

  async findAll(query?: AdminUsersQueryDto): Promise<{ users: User[]; total: number }> {
    const { page = 1, limit = 10, role } = query || {};
    const skip = (page - 1) * limit;

    const [users, total] = await this.usersRepository.findAndCount({
      where: role ? { role } : undefined,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      select: [
        'id', 'email', 'firstName', 'lastName', 'role', 'status', 'isEmailVerified',
        'phone', 'companyId', 'createdAt', 'updatedAt',
        'planId', 'planTitle', 'planAmount', 'planPeriod', 'numCompanies',
        'paymentMethod', 'paymentStatus', 'paymentRef', 'paymentScreenshot',
        'subscriptionStartDate', 'subscriptionPaymentDate', 'subscriptionNextPaymentDate', 'subscriptionExpiresAt',
        'faydaId', 'tin', 'adminPermissions',
      ],
    });

    return { users, total };
  }

  async findPending(): Promise<User[]> {
    return this.usersRepository.find({
      where: { status: UserStatus.PENDING },
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'isEmailVerified', 'phone', 'createdAt', 'updatedAt', 'numCompanies', 'planId', 'planTitle', 'planAmount', 'planPeriod', 'paymentMethod', 'paymentStatus', 'paymentRef', 'paymentScreenshot'],
    });
  }

  async findApprovals(): Promise<User[]> {
    return this.usersRepository.find({
      where: {
        status: In([UserStatus.PENDING, UserStatus.ACTIVE, UserStatus.INACTIVE]),
        role: UserRole.COMPANY_ADMIN,
      },
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'isEmailVerified', 'phone', 'createdAt', 'updatedAt', 'numCompanies', 'planId', 'planTitle', 'planAmount', 'planPeriod', 'paymentMethod', 'paymentStatus', 'paymentRef', 'paymentScreenshot'],
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { id },
      select: [
        'id', 'email', 'firstName', 'lastName', 'role', 'status', 'isEmailVerified', 'phone',
        'companyId', 'createdAt', 'updatedAt',
        'planId', 'planTitle', 'planAmount', 'planPeriod', 'numCompanies',
        'paymentMethod', 'paymentStatus', 'paymentRef', 'paymentScreenshot',
        'subscriptionStartDate', 'subscriptionPaymentDate', 'subscriptionNextPaymentDate', 'subscriptionExpiresAt',
        'faydaId', 'tin', 'adminPermissions',
      ],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email?: string | null): Promise<User | null> {
    if (!email || !email.trim()) return null;
    return this.usersRepository.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findByEmailWithAssociations(email?: string | null): Promise<User | null> {
    if (!email || !email.trim()) return null;
    return this.usersRepository.findOne({ 
      where: { email: email.trim().toLowerCase() },
      relations: ['company', 'shop', 'warehouse'],
    });
  }

  async findByIdWithAssociations(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { id },
      relations: ['company', 'shop', 'warehouse'],
      select: [
        'id', 'email', 'firstName', 'lastName', 'role', 'status', 'isEmailVerified', 'phone',
        'companyId', 'shopId', 'warehouseId', 'numCompanies', 'createdAt', 'updatedAt',
        'planId', 'planTitle', 'planAmount', 'planPeriod', 'subscriptionExpiresAt',
        'subscriptionStartDate', 'subscriptionPaymentDate', 'subscriptionNextPaymentDate',
        'paymentStatus', 'paymentMethod', 'adminPermissions'
      ],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ 
      where: { phone },
      relations: ['company', 'shop', 'warehouse'],
    });
    if (user) return user;

    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length >= 7) {
      const targetSuffix = cleanDigits.slice(-9);
      const allUsers = await this.usersRepository.find({
        relations: ['company', 'shop', 'warehouse'],
      });
      const matchingUsers = allUsers.filter(u => {
        if (!u.phone) return false;
        const uDigits = u.phone.replace(/\D/g, '');
        return uDigits.endsWith(targetSuffix) || targetSuffix.endsWith(uDigits);
      });
      if (matchingUsers.length > 0) {
        const adminUser = matchingUsers.find(u => u.role === UserRole.COMPANY_ADMIN || u.role === UserRole.ADMIN || u.role === UserRole.SUPER_ADMIN);
        return adminUser || matchingUsers[0];
      }
    }
    return null;
  }

  async findMe(user: User): Promise<any> {
    const me = await this.usersRepository.findOne({
      where: { id: user.id },
      relations: ['company', 'shop', 'warehouse'],
      select: [
        'id', 'email', 'firstName', 'lastName', 'role', 'status', 'phone', 'isEmailVerified', 'lastLoginAt',
        'createdAt', 'updatedAt', 'companyId', 'shopId', 'warehouseId',
        'planId', 'planTitle', 'planAmount', 'planPeriod', 'numCompanies',
        'subscriptionStartDate', 'subscriptionPaymentDate', 'subscriptionNextPaymentDate', 'subscriptionExpiresAt',
        'adminPermissions',
      ],
    });
    if (!me) throw new NotFoundException('User not found');
    const employee = await this.findEmployeeByUserId(user.id);

    // Resolve effective IDs from employee relation (same logic as JWT strategy)
    const effectiveShopId = employee?.shop?.id || (employee as any)?.shopId || me.shop?.id || me.shopId;
    const effectiveWarehouseId = employee?.warehouse?.id || (employee as any)?.warehouseId || me.warehouse?.id || me.warehouseId;
    const effectiveCompanyId = employee?.company?.id || (employee as any)?.companyId || me.company?.id || me.companyId;

    // Serialize employee permissions properly
    let permissions = employee?.permissions || null;
    if (typeof permissions === 'string') {
      try { permissions = JSON.parse(permissions); } catch (_) { permissions = null; }
    }
    const branchPermissions = permissions?.branchPermissions || {};

    // Return a plain object so ClassSerializerInterceptor doesn't strip dynamic fields
    const { password: _pw, refreshToken: _rt, pin: _pin, employees: _emps, ...safeUser } = me as any;
    return {
      ...safeUser,
      companyId: effectiveCompanyId,
      shopId: effectiveShopId,
      warehouseId: effectiveWarehouseId,
      employeeId: employee?.id || null,
      hasPin: !!_pin,
      permissions,
      branchPermissions,
      employee: employee
        ? {
            id: employee.id,
            name: employee.name,
            jobTitle: employee.jobTitle,
            phoneNumber: employee.phoneNumber,
            shopId: employee.shop?.id || (employee as any)?.shopId,
            warehouseId: employee.warehouse?.id || (employee as any)?.warehouseId,
            companyId: employee.company?.id || (employee as any)?.companyId,
            permissions,
            branchPermissions,
          }
        : null,
      employees: employee
        ? [{
            id: employee.id,
            name: employee.name,
            jobTitle: employee.jobTitle,
            phoneNumber: employee.phoneNumber,
            shopId: employee.shop?.id || (employee as any)?.shopId,
            warehouseId: employee.warehouse?.id || (employee as any)?.warehouseId,
            companyId: employee.company?.id || (employee as any)?.companyId,
            permissions,
            branchPermissions,
          }]
        : [],
    };
  }

  async create(dto: CreateUserDto, currentUser?: User): Promise<User> {
  // Get the company for association
  let companyToAssociate: Company | null = null;
  
  // Role-based validation for Company Admins
  if (currentUser && currentUser.role === UserRole.COMPANY_ADMIN) {
    // Company Admin restrictions
    if (dto.role === UserRole.SUPER_ADMIN || dto.role === UserRole.COMPANY_ADMIN) {
      throw new ForbiddenException('Company Admin cannot create Super Admin or Company Admin users');
    }

    // Get company object if currentUser has companyId 
    let userCompany = currentUser.company;
    if (!userCompany && (currentUser as any).companyId) {
      userCompany = await this.companyRepository.findOne({ where: { id: (currentUser as any).companyId } });
    }

    // Force assignment to Company Admin's company
    if (!userCompany) {
      throw new ForbiddenException('Company Admin must be associated with a company');
    }
    
    companyToAssociate = userCompany;
    dto.companyId = userCompany.id;
    
    // If no role specified, default to USER
    if (!dto.role) {
      dto.role = UserRole.USER;
    }
    
    // Validate shop and warehouse belong to admin's company if specified
    if (dto.shopId) {
      const shop = await this.shopRepository.findOne({ 
        where: { id: dto.shopId },
        relations: ['company']
      });
      if (!shop || shop.company?.id !== userCompany.id) {
        throw new ForbiddenException('Shop must belong to your company');
      }
    }
    
    if (dto.warehouseId) {
      const warehouse = await this.warehouseRepository.findOne({ 
        where: { id: dto.warehouseId },
        relations: ['company']
      });
      if (!warehouse || warehouse.company?.id !== userCompany.id) {
        throw new ForbiddenException('Warehouse must belong to your company');
      }
    }
  } else if (dto.companyId) {
    // For Super Admin or when companyId is explicitly provided
    const company = await this.companyRepository.findOne({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('Company not found');
    companyToAssociate = company;
  }

  // Check if user exists with same email (if provided)
  if (dto.email && dto.email.trim()) {
    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ForbiddenException('User Exists!');
    }
  }

  // Check phone uniqueness if phone is provided
  if (dto.phone) {
    const existingPhoneUser = await this.findByPhone(dto.phone);
    if (existingPhoneUser) {
      throw new ForbiddenException('Phone number already registered');
    }
  }

  const userData: Partial<User> = {
    email: dto.email && dto.email.trim() ? dto.email.trim().toLowerCase() : null,
    firstName: dto.firstName,
    lastName: dto.lastName || '',
    password: dto.password,
    phone: dto.phone,
    role: dto.role || UserRole.USER, // Default to USER role if not specified
    status: (dto as any).status || UserStatus.PENDING,
    planId: (dto as any).planId,
    planTitle: (dto as any).planTitle,
    planAmount: (dto as any).planAmount,
    planPeriod: (dto as any).planPeriod,
    numCompanies: (dto as any).numCompanies,
    paymentMethod: (dto as any).paymentMethod,
    paymentStatus: (dto as any).paymentStatus,
    paymentRef: (dto as any).paymentRef,
    paymentScreenshot: (dto as any).paymentScreenshot,
    adminPermissions: (dto as any).adminPermissions || null,
  };

  // Assign company if we have one to associate
  if (companyToAssociate) {
    userData.company = companyToAssociate;
  }

  // Assign shop if provided
  if (dto.shopId) {
    const shop = await this.shopRepository.findOne({ where: { id: dto.shopId } });
    if (!shop) throw new NotFoundException('Shop not found');
    userData.shop = shop;
  }

  // Assign warehouse if provided
  if (dto.warehouseId) {
    const warehouse = await this.warehouseRepository.findOne({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    userData.warehouse = warehouse;
  }

  const user = this.usersRepository.create(userData);
  const savedUser = await this.usersRepository.save(user);

  // Auto-create Employee record if user is assigned to a company
  if (userData.company) {
    const employeeData = {
      name: `${savedUser.firstName} ${savedUser.lastName}`,
      phoneNumber: savedUser.phone || '',
      baseCommissionRate: 0, // Default commission rate
      user: savedUser,
      company: userData.company,
      shop: userData.shop || null,
      warehouse: userData.warehouse || null,
    };

    const employee = this.employeeRepository.create(employeeData);
    await this.employeeRepository.save(employee);
  }

  return savedUser;
}

  async update(id: string, dto: UpdateUserDto, currentUser: User): Promise<User> {
    // Users can only update their own profile unless they're admin
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Check phone uniqueness if phone is being updated
    if (dto.phone) {
      const existingPhoneUser = await this.findByPhone(dto.phone);
      if (existingPhoneUser && existingPhoneUser.id !== id) {
        throw new ForbiddenException('Phone number already registered');
      }
    }

    // Check email uniqueness if email is being updated
    if (dto.email && dto.email.trim()) {
      const existingEmailUser = await this.findByEmail(dto.email.trim());
      if (existingEmailUser && existingEmailUser.id !== id) {
        throw new ForbiddenException('Email address already registered');
      }
    }

    const safeDto: Record<string, any> = { ...dto };
    if (safeDto.email) {
      safeDto.email = safeDto.email.trim().toLowerCase();
    }

    // Handle password update
    if (safeDto.password) {
      // If user is updating their own password, verify currentPassword
      if (currentUser.id === id) {
        const currentPassword = (dto as any).currentPassword;
        if (!currentPassword) {
          throw new BadRequestException('Current password is required to change password');
        }
        const userWithPassword = await this.usersRepository.findOne({
          where: { id },
          select: ['id', 'password'],
        });
        if (!userWithPassword) {
          throw new NotFoundException('User not found');
        }
        let isCurrentValid = false;
        try {
          isCurrentValid = await bcrypt.compare(currentPassword, userWithPassword.password);
        } catch (_) {
          isCurrentValid = false;
        }
        if (!isCurrentValid && userWithPassword.password !== currentPassword) {
          throw new BadRequestException('Current password is incorrect');
        }
      }
      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12') || 12;
      safeDto.password = await bcrypt.hash(safeDto.password, rounds);
    } else {
      delete safeDto.password;
    }
    delete safeDto.currentPassword;

    // Non-platform admins cannot modify privileged fields under any circumstance (CWE-269 mitigation)
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      delete safeDto.role;
      delete safeDto.companyId;
      delete safeDto.status;
      delete safeDto.isEmailVerified;
      delete safeDto.subscriptionExpiresAt;
      delete safeDto.paymentStatus;
      delete safeDto.planId;
      delete safeDto.numCompanies;
    }

    await this.usersRepository.update(id, safeDto);
    return this.findById(id);
  }

  async adminUpdate(id: string, dto: AdminUpdateUserDto, adminUser: User): Promise<User> {
    if (adminUser.role !== UserRole.ADMIN && adminUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can perform this action');
    }

    const previousUser = await this.findById(id);

    // Only SUPER_ADMIN can assign SUPER_ADMIN role or modify a SUPER_ADMIN account
    if (adminUser.role !== UserRole.SUPER_ADMIN) {
      if (dto.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only a super admin can assign the super admin role');
      }
      if (previousUser.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Cannot modify a super admin account');
      }
    }

    await this.usersRepository.update(id, dto);
    let updatedUser = await this.findById(id);

    // Send SMS notification if user status changes from PENDING to ACTIVE
    if (previousUser.status === UserStatus.PENDING && updatedUser.status === UserStatus.ACTIVE) {
      const now = new Date();
      const expires = addSubscriptionPeriod(now, updatedUser.planPeriod);
      const nextPayment = getSubscriptionNextPaymentDate(expires, updatedUser.planPeriod);

      await this.usersRepository.update(id, {
        subscriptionStartDate: now,
        subscriptionPaymentDate: now,
        subscriptionExpiresAt: expires,
        subscriptionNextPaymentDate: nextPayment,
        paymentStatus: 'CONFIRMED',
        lastSubscriptionReminderAt: null,
      });
      updatedUser = await this.findById(id);

      try {
        this.notificationService
          .createNotification({
            type: NotificationType.INFO,
            title: 'Account Approved',
            message: `Congratulations! Your BM Stock account has been approved. You can now log in to the application.`,
            userId: updatedUser.id,
            companyId: updatedUser.companyId,
          })
          .catch(() => undefined);
      } catch (pushErr) {
        console.error('[Push Approval Notification Error]', pushErr);
      }

      if (updatedUser.phone) {
        try {
          const { default: axios } = await import('axios');
          const token = process.env.GEEZSMS_TOKEN;

          if (token) {
            let cleanedPhone = updatedUser.phone.trim().replace(/[^\d]/g, '');
            if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
              cleanedPhone = `251${cleanedPhone.substring(1)}`;
            }

            const message = `Congratulations! Your BM Stock account (${updatedUser.firstName || ''} ${updatedUser.lastName || ''}) has been approved by the Admin. You can now log in to the application.`;

            if (message.length <= 335) {
              const url = 'https://api.geezsms.com/api/v1/sms/send';
              const body: Record<string, any> = { token, phone: cleanedPhone, msg: message };
              const shortcodeId = process.env.GEEZSMS_SHORTCODE_ID;
              if (shortcodeId && shortcodeId.trim().length > 0) body.shortcode_id = shortcodeId.trim();

              await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
              });
            }
          }
        } catch (smsErr) {
          console.error('[SMS Approval Notification Error]', smsErr);
        }
      }
    }

    return updatedUser;
  }

  /** Count companies owned by a company admin account. */
  async countOwnedCompanies(userId: string): Promise<number> {
    return this.companyRepository.count({ where: { createdById: userId } });
  }

  /** Companies billed on subscription (limit vs registered, whichever is higher). */
  async resolveBillingCompanyCount(user: User): Promise<{
    numCompanies: number;
    ownedCompanies: number;
  }> {
    const ownedCompanies = await this.countOwnedCompanies(user.id);
    const numCompanies = Math.max(user.numCompanies ?? 1, ownedCompanies, 1);
    return { numCompanies, ownedCompanies };
  }

  /** Public renewal flow: expired company admin submits new plan + payment proof. */
  async submitSubscriptionRenewal(
    phoneOrUser: string | User,
    data: {
      planId?: string;
      planTitle?: string;
      planAmount?: number;
      planPeriod?: string;
      paymentMethod?: string;
      paymentRef?: string;
      paymentScreenshot?: string;
    },
    isVerified: boolean = false,
  ): Promise<User> {
    const user = typeof phoneOrUser === 'string'
      ? await this.findUserByPhone(phoneOrUser)
      : phoneOrUser;
    if (!user) {
      throw new NotFoundException('No account found with this phone number');
    }
    if (user.role !== UserRole.COMPANY_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only the company owner can renew the subscription');
    }

    const isTrial = isTrialPlan(data.planPeriod || data.planId);
    if (isTrial || isVerified) {
      const now = new Date();
      const planPeriod = isTrial ? 'trial' : (data.planPeriod || data.planId || '1_month');
      const expiresAt = addSubscriptionPeriod(now, planPeriod);
      const nextPayment = getSubscriptionNextPaymentDate(expiresAt, planPeriod);
      await this.usersRepository.update(user.id, {
        planId: data.planId,
        planTitle: data.planTitle || (isTrial ? 'Free Trial (14 Days)' : undefined),
        planAmount: isTrial ? 0 : data.planAmount,
        planPeriod: planPeriod,
        paymentMethod: data.paymentMethod,
        paymentRef: data.paymentRef || (isTrial ? `TRIAL_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` : undefined),
        paymentScreenshot: isVerified ? null : data.paymentScreenshot,
        paymentStatus: isTrial ? 'TRIAL' : 'CONFIRMED',
        status: UserStatus.ACTIVE,
        subscriptionStartDate: now,
        subscriptionExpiresAt: expiresAt,
        subscriptionNextPaymentDate: nextPayment,
      });
    } else {
      await this.usersRepository.update(user.id, {
        planId: data.planId,
        planTitle: data.planTitle,
        planAmount: data.planAmount,
        planPeriod: data.planPeriod,
        paymentMethod: data.paymentMethod,
        paymentRef: data.paymentRef,
        paymentScreenshot: data.paymentScreenshot,
        paymentStatus: 'PENDING',
        status: UserStatus.PENDING,
      });
    }

    if (user.companyId) {
      await this.companyRepository.update(user.companyId, {
        status: (isTrial || isVerified) ? CompanyStatus.ACTIVE : CompanyStatus.SUBSCRIPTION_EXPIRED,
      });
    }

    return this.findById(user.id);
  }

  private getPlanPeriodMonths(planPeriod?: string | null): number {
    if (!planPeriod) return 1;
    if (planPeriod.includes('6')) return 6;
    if (planPeriod.includes('year') || planPeriod.includes('12')) return 12;
    return 1;
  }

  async adminResetPassword(id: string, newPassword: string, adminUser: User): Promise<{ success: boolean }> {
    if (adminUser.role !== UserRole.ADMIN && adminUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can reset user passwords');
    }

    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.password = newPassword;
    await this.usersRepository.save(user);

    return { success: true };
  }

  async remove(id: string, currentUser: User, otp?: string, phone?: string): Promise<void> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('Only admins or account owners can delete users');
    }

    const user = await this.usersRepository.findOne({ where: { id }, relations: ['company'] });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCompanyAdmin = user.role === UserRole.COMPANY_ADMIN || currentUser.role === UserRole.COMPANY_ADMIN;
    const isSelfDeletion = currentUser.id === id;

    // Enforce OTP verification for company admin deleting their account
    if (isSelfDeletion && isCompanyAdmin) {
      if (!otp) {
        throw new BadRequestException('Verification code (OTP) is required to delete your Company Admin account.');
      }
      const verifyPhone = phone || user.phone;
      if (!verifyPhone) {
        throw new BadRequestException('A valid phone number is required for OTP verification.');
      }
      await this.otpService.verifyOtp(verifyPhone, otp, true);
    }

    // Capture company name and user info before deletion
    const companyName = user.company?.name || 'N/A';
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.phone || user.email || 'User';
    const targetPhone = phone || user.phone || 'N/A';

    // Record high-priority audit log for account deletion
    try {
      await this.auditLogsService.create({
        entityType: 'User',
        entityId: user.id,
        entityName: fullName,
        action: AuditAction.DELETE,
        module: 'account_deletion',
        description: `CRITICAL: Company Admin account permanently deleted: ${fullName} (${user.email}, Phone: ${targetPhone}, Company: ${companyName}) after successful phone OTP verification.`,
        oldValues: {
          id: user.id,
          email: user.email,
          phone: targetPhone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          companyId: user.companyId,
          companyName,
          verifiedViaOtp: true,
          deletedAt: new Date().toISOString(),
        },
        userName: fullName,
        userEmail: user.email,
        userRole: user.role,
        method: 'DELETE',
        endpoint: '/users/me',
      });
    } catch (err: any) {
      this.logger.error(`Failed to record account deletion audit log: ${err?.message || err}`);
    }

    let ownedCompanyIds = await this.userPurgeService.findOwnedCompanyIds(id);
    if (ownedCompanyIds.length === 0 && user.role === UserRole.COMPANY_ADMIN && user.companyId) {
      ownedCompanyIds = [user.companyId];
    }

    if (ownedCompanyIds.length > 0) {
      try {
        const result = await this.userPurgeService.purgeAccount(user);
        this.logger.log(
          `Deleted account ${id}: ${result.deletedCompanyIds.length} company/companies and ${result.removedFileCount} uploaded file(s) removed`,
        );
      } catch (purgeErr: any) {
        this.logger.error(`Full purge failed for user ${id}, falling back to member purge: ${purgeErr?.message || purgeErr}`);
        await this.userPurgeService.purgeMember(id).catch((e: any) => {
          this.logger.error(`Member purge fallback also failed for ${id}: ${e?.message || e}`);
          throw e;
        });
      }
      return;
    }

    // For standard members (employees/staff): null out references and purge member
    const mgr = this.usersRepository.manager;
    const nullUpdates: Array<[string, string]> = [
      ['audit_logs', 'user_id'],
      ['admin_audit_logs', 'user_id'],
      ['credit_payments', 'received_by'],
      ['inventory_transactions', 'performed_by'],
      ['payment_transactions', 'processed_by'],
      ['products', 'createdById'],
      ['sales', 'created_by'],
      ['shops', 'ownerId'],
      ['transfers', 'approved_by_id'],
      ['transfers', 'requested_by_id'],
      ['warehouses', 'managerId'],
      ['employees', 'userId'],
      ['product_borrowings', 'recorded_by_id'],
      ['companies', 'createdById'],
      ['notifications', 'userId'],
      ['device_tokens', 'userId'],
      ['company_limit_attempts', 'userId'],
      ['commissions', 'approvedBy'],
    ];
    for (const [table, column] of nullUpdates) {
      try {
        await mgr.query(`UPDATE "${table}" SET "${column}" = NULL WHERE "${column}" = $1`, [id]);
      } catch (_) {}
    }
    // Delete orphan user tokens and attempts
    try {
      await mgr.query('DELETE FROM device_tokens WHERE "userId" = $1', [id]);
      await mgr.query('DELETE FROM company_limit_attempts WHERE "userId" = $1', [id]);
      await mgr.query('DELETE FROM notifications WHERE "userId" = $1', [id]);
    } catch (_) {}

    await this.userPurgeService.purgeMember(id);
  }

  async toggleUserStatus(userId: string, currentUser: User): Promise<User> {
    if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.COMPANY_ADMIN && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can toggle user status');
    }

    const user = await this.findById(userId);
    user.status = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    
    return this.usersRepository.save(user);
  }

  async ensureUserHasCompany(user: User): Promise<User> {
    // 1. If user already has an associated employee record, the user MUST belong to the employee's company
    const employee = await this.employeeRepository.findOne({
      where: { user: { id: user.id } },
      relations: ['company', 'shop', 'warehouse'],
    });
    if (employee?.company) {
      if (user.companyId !== employee.company.id || !user.company) {
        user.company = employee.company;
        user.companyId = employee.company.id;
        if (employee.shop && !user.shopId) {
          user.shop = employee.shop;
          user.shopId = employee.shop.id;
        }
        if (employee.warehouse && !user.warehouseId) {
          user.warehouse = employee.warehouse;
          user.warehouseId = employee.warehouse.id;
        }
        await this.usersRepository.save(user);
      }
      return user;
    }

    if (user.company) return user;

    // Never auto-create a company for regular staff/employees (only company_admin / super_admin / admin)
    if (user.role !== UserRole.COMPANY_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return user;
    }

    const companyName = `${user.firstName} ${user.lastName}'s Company`;
    const company = this.companyRepository.create({ name: companyName, address: '' });
    const savedCompany = await this.companyRepository.save(company);

    user.company = savedCompany;
    user.companyId = savedCompany.id;
    await this.usersRepository.save(user);

    // Backfill orphaned records
    await this.employeeRepository
      .createQueryBuilder()
      .update(Employee)
      .set({ company: savedCompany as any })
      .where('companyId IS NULL')
      .execute();

    await this.shopRepository
      .createQueryBuilder()
      .update(Shop)
      .set({ company: savedCompany as any })
      .where('companyId IS NULL')
      .execute();

    await this.warehouseRepository
      .createQueryBuilder()
      .update(Warehouse)
      .set({ company: savedCompany as any })
      .where('companyId IS NULL')
      .execute();

    return this.findByIdWithAssociations(user.id);
  }

  /**
   * Bulk assign users to company/shop/warehouse
   */
  async bulkAssignUsers(userIds: string[], assignmentData: AssignUserDto, currentUser: User): Promise<User[]> {
    // Authorization check
    if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.COMPANY_ADMIN) {
      throw new ForbiddenException('Only admins can perform bulk assignments');
    }

    const users = await this.usersRepository.find({
      where: { id: In(userIds) },
      relations: ['company', 'shop', 'warehouse']
    });

    if (users.length === 0) {
      throw new NotFoundException('No users found');
    }

    // Company Admin can only assign users within their company
    if (currentUser.role === UserRole.COMPANY_ADMIN) {
      assignmentData.companyId = currentUser.company?.id;
      
      // Validate shop/warehouse belong to admin's company
      if (assignmentData.shopId) {
        const shop = await this.shopRepository.findOne({ 
          where: { id: assignmentData.shopId },
          relations: ['company']
        });
        if (!shop || shop.company?.id !== currentUser.company?.id) {
          throw new ForbiddenException('Shop must belong to your company');
        }
      }
      
      if (assignmentData.warehouseId) {
        const warehouse = await this.warehouseRepository.findOne({ 
          where: { id: assignmentData.warehouseId },
          relations: ['company']
        });
        if (!warehouse || warehouse.company?.id !== currentUser.company?.id) {
          throw new ForbiddenException('Warehouse must belong to your company');
        }
      }
    }

    const updatedUsers: User[] = [];

    for (const user of users) {
      // Apply bulk assignments
      await this.assignUser(user.id, assignmentData, currentUser);
      
      // Reload user with new associations
      const updatedUser = await this.findByIdWithAssociations(user.id);
      updatedUsers.push(updatedUser);
    }

    return updatedUsers;
  }

  /**
   * Get user activity log (placeholder for now - would integrate with audit system)
   */
  async getUserActivityLog(userId: string, currentUser: User): Promise<any[]> {
    // Authorization check
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        currentUser.role !== UserRole.COMPANY_ADMIN && 
        currentUser.id !== userId) {
      throw new ForbiddenException('Access denied to user activity log');
    }

    const user = await this.findById(userId);
    
    // This would integrate with a proper audit/activity tracking system
    // For now, return basic user information changes
    return [
      {
        id: '1',
        action: 'USER_CREATED',
        timestamp: user.createdAt,
        details: `User ${user.fullName} was created`,
        performedBy: 'system'
      },
      {
        id: '2', 
        action: 'LAST_LOGIN',
        timestamp: user.lastLoginAt || user.createdAt,
        details: `User ${user.fullName} last logged in`,
        performedBy: user.id
      }
      // Additional activity would come from audit logs, login history, etc.
    ];
  }

  /**
   * Get comprehensive user statistics by company
   */
  async getCompanyUserStats(companyId: string, currentUser: User): Promise<any> {
    // Authorization check
    if (currentUser.role === UserRole.COMPANY_ADMIN && currentUser.company?.id !== companyId) {
      throw new ForbiddenException('Access denied to company statistics');
    }

    const users = await this.usersRepository.find({
      where: { company: { id: companyId } },
      relations: ['employees']
    });

    const employees = await this.employeeRepository.find({
      where: { company: { id: companyId } },
      relations: ['user', 'shop', 'warehouse']
    });

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === UserStatus.ACTIVE).length,
      inactiveUsers: users.filter(u => u.status === UserStatus.INACTIVE).length,
      pendingUsers: users.filter(u => u.status === UserStatus.PENDING).length,
      usersByRole: {
        [UserRole.SUPER_ADMIN]: users.filter(u => u.role === UserRole.SUPER_ADMIN).length,
        [UserRole.COMPANY_ADMIN]: users.filter(u => u.role === UserRole.COMPANY_ADMIN).length,
        [UserRole.MANAGER]: users.filter(u => u.role === UserRole.MANAGER).length,
        [UserRole.USER]: users.filter(u => u.role === UserRole.USER).length,
      },
      employees: {
        total: employees.length,
        withShopAssignment: employees.filter(e => e.shop).length,
        withWarehouseAssignment: employees.filter(e => e.warehouse).length,
        averageCommissionRate: employees.reduce((sum, e) => sum + e.baseCommissionRate, 0) / (employees.length || 1)
      }
    };

    return stats;
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    admins: number;
    users: number;
  }> {
    const [total, active, inactive, admins, users] = await Promise.all([
      this.usersRepository.count(),
      this.usersRepository.count({ where: { status: UserStatus.ACTIVE } }),
      this.usersRepository.count({ where: { status: UserStatus.INACTIVE } }),
      this.usersRepository.count({ where: { role: UserRole.ADMIN } }),
      this.usersRepository.count({ where: { role: UserRole.USER } }),
    ]);

    return { total, active, inactive, admins, users };
  }

  async getAdminReports() {
    const now = new Date();

    const [
      totalCompanies,
      activeCompanies,
      totalProducts,
      totalWarehouses,
      totalShops,
      totalStaff,
    ] = await Promise.all([
      this.companyRepository.count(),
      this.companyRepository.count({ where: { status: CompanyStatus.ACTIVE as any } }),
      this.productRepository.count(),
      this.warehouseRepository.count(),
      this.shopRepository.count(),
      this.usersRepository.count({ where: { role: In([
        UserRole.COMPANY_ADMIN,
        UserRole.MANAGER,
        UserRole.SHOP_EMPLOYEE,
        UserRole.WAREHOUSE_EMPLOYEE,
      ] as any) } }),
    ]);

    const saleStats = await this.salesRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.warehouse', 'warehouse')
      .leftJoin('sale.shop', 'shop')
      .select([
        'COUNT(sale.id) AS "totalSales"',
        'COALESCE(SUM(sale.totalAmount), 0) AS "totalRevenue"',
        'COALESCE(AVG(sale.totalAmount), 0) AS "averageSaleAmount"',
        'COALESCE(SUM(sale.taxAmount), 0) AS "totalTax"',
        'COALESCE(SUM(sale.discountAmount), 0) AS "totalDiscount"',
      ])
      .where('sale.status != :cancelled', { cancelled: 'cancelled' })
      .getRawOne();

    const creditStats = await this.salesRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.warehouse', 'warehouse')
      .leftJoin('sale.shop', 'shop')
      .select([
        'COALESCE(SUM(sale.remainingBalance), 0) AS "totalOutstandingCredit"',
        'COUNT(CASE WHEN sale.paymentType = \'credit\' AND sale.remainingBalance > 0 THEN 1 END) AS "creditSaleCount"',
      ])
      .where('sale.status != :cancelled', { cancelled: 'cancelled' })
      .getRawOne();

    const stockValueResult = await this.productRepository
      .createQueryBuilder('product')
      .select('COALESCE(SUM(product.stockQuantity * product.price), 0)', 'totalStockValue')
      .getRawOne();

    const lowStockCount = await this.productRepository
      .createQueryBuilder('product')
      .where('product.trackStock = true')
      .andWhere('product.stockQuantity <= product.minStockLevel')
      .getCount();

    const expiredCount = await this.productRepository
      .createQueryBuilder('product')
      .where('product.expiryDate IS NOT NULL')
      .andWhere('product.expiryDate < :today', { today: now })
      .getCount();

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyTrend = await this.salesRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.warehouse', 'warehouse')
      .leftJoin('sale.shop', 'shop')
      .select([
        "to_char(sale.saleDate, 'YYYY-MM-DD') AS day",
        'COUNT(sale.id) AS "salesCount"',
        'COALESCE(SUM(sale.totalAmount), 0) AS revenue',
      ])
      .where('sale.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('sale.saleDate >= :from', { from: thirtyDaysAgo })
      .andWhere('sale.saleDate <= :to', { to: now })
      .groupBy('day')
      .orderBy('day')
      .getRawMany();

    const topCompanies = await this.salesRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.warehouse', 'warehouse')
      .leftJoin('sale.shop', 'shop')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany')
      .select([
        'COALESCE(wCompany.id, sCompany.id) AS "companyId"',
        'COALESCE(wCompany.name, sCompany.name) AS "companyName"',
        'COUNT(sale.id) AS "salesCount"',
        'COALESCE(SUM(sale.totalAmount), 0) AS revenue',
      ])
      .where('sale.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('COALESCE(wCompany.id, sCompany.id) IS NOT NULL')
      .groupBy('COALESCE(wCompany.id, sCompany.id)')
      .addGroupBy('COALESCE(wCompany.name, sCompany.name)')
      .orderBy('revenue', 'DESC')
      .limit(10)
      .getRawMany();

    const monthlyTrend = await this.salesRepository
      .createQueryBuilder('sale')
      .select([
        "to_char(sale.saleDate, 'YYYY-MM') AS month",
        'COUNT(sale.id) AS "salesCount"',
        'COALESCE(SUM(sale.totalAmount), 0) AS revenue',
      ])
      .where('sale.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('sale.saleDate >= :from', { from: new Date(now.getFullYear(), now.getMonth() - 11, 1) })
      .andWhere('sale.saleDate <= :to', { to: now })
      .groupBy('month')
      .orderBy('month')
      .getRawMany();

    return {
      summary: {
        totalCompanies,
        activeCompanies,
        totalProducts,
        totalWarehouses,
        totalShops,
        totalStaff,
        totalSales: Number(saleStats?.totalSales || 0),
        totalRevenue: Number(saleStats?.totalRevenue || 0),
        averageSaleAmount: Number(saleStats?.averageSaleAmount || 0),
        totalTax: Number(saleStats?.totalTax || 0),
        totalDiscount: Number(saleStats?.totalDiscount || 0),
        totalOutstandingCredit: Number(creditStats?.totalOutstandingCredit || 0),
        creditSaleCount: Number(creditStats?.creditSaleCount || 0),
        totalStockValue: Number(stockValueResult?.totalStockValue || 0),
        lowStockCount,
        expiredCount,
      },
      dailyTrend: dailyTrend.map((r) => ({
        day: r.day,
        salesCount: Number(r.salesCount),
        revenue: Number(r.revenue),
      })),
      monthlyTrend: monthlyTrend.map((r) => ({
        month: r.month,
        salesCount: Number(r.salesCount),
        revenue: Number(r.revenue),
      })),
      topCompanies: topCompanies.map((r) => ({
        companyId: r.companyId,
        companyName: r.companyName,
        salesCount: Number(r.salesCount),
        revenue: Number(r.revenue),
      })),
    };
  }

  async assignUser(userId: string, assignDto: AssignUserDto, currentUser: User): Promise<User> {
    // Only super admin can assign company admins, company admins can assign within their company
    if (assignDto.role === UserRole.COMPANY_ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can assign company admins');
    }

    if (currentUser.role === UserRole.COMPANY_ADMIN && assignDto.companyId !== currentUser.company?.id) {
      throw new ForbiddenException('Company admin can only assign users within their company');
    }

    const user = await this.findById(userId);
    const updateData: Partial<User> = {};

    if (assignDto.companyId) {
      const company = await this.companyRepository.findOne({ where: { id: assignDto.companyId } });
      if (!company) throw new NotFoundException('Company not found');
      updateData.company = company;
    }

    if (assignDto.shopId) {
      const shop = await this.shopRepository.findOne({ where: { id: assignDto.shopId } });
      if (!shop) throw new NotFoundException('Shop not found');
      updateData.shop = shop;
    }

    if (assignDto.warehouseId) {
      const warehouse = await this.warehouseRepository.findOne({ where: { id: assignDto.warehouseId } });
      if (!warehouse) throw new NotFoundException('Warehouse not found');
      updateData.warehouse = warehouse;
    }

    if (assignDto.role) {
      updateData.role = assignDto.role;
    }

    await this.usersRepository.update(userId, updateData);
    
    // Handle Employee record creation/update if company is assigned
    if (updateData.company) {
      const existingEmployee = await this.employeeRepository.findOne({
        where: { user: { id: userId } }
      });
      
      if (existingEmployee) {
        // Update existing employee
        existingEmployee.company = updateData.company;
        if (updateData.shop) existingEmployee.shop = updateData.shop;
        if (updateData.warehouse) existingEmployee.warehouse = updateData.warehouse;
        await this.employeeRepository.save(existingEmployee);
      } else {
        // Create new employee record
        const employeeData = {
          name: `${user.firstName} ${user.lastName}`,
          phoneNumber: user.phone || '',
          baseCommissionRate: 0,
          jobTitle: null,
          user: user,
          company: updateData.company,
          shop: updateData.shop || null,
          warehouse: updateData.warehouse || null,
        };
        
        const employee = this.employeeRepository.create(employeeData);
        await this.employeeRepository.save(employee);
      }
    }
    
    return this.findByIdWithAssociations(userId);
  }

  async getCompanyUsers(companyId: string, currentUser: User): Promise<any[]> {
    if (currentUser.role !== UserRole.SUPER_ADMIN && (currentUser as any).companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    const employees = await this.employeeRepository.find({
      where: { company: { id: companyId } },
      relations: ['user', 'company', 'shop', 'warehouse'],
    });

    return employees.map(employee => ({
      id: employee.user.id,
      email: employee.user.email,
      firstName: employee.user.firstName,
      lastName: employee.user.lastName,
      role: employee.user.role,
      status: employee.user.status,
      createdAt: employee.user.createdAt,
      employee: {
        id: employee.id,
        name: employee.name,
        phoneNumber: employee.phoneNumber,
        jobTitle: employee.jobTitle,
        baseCommissionRate: employee.baseCommissionRate
      }
    }));
  }

  async getShopUsers(shopId: string, currentUser: User): Promise<User[]> {
    // Authorization check
    if (currentUser.role === UserRole.COMPANY_ADMIN && (!currentUser.company || !currentUser.shop || currentUser.shop.id !== shopId)) {
      throw new ForbiddenException('Company admin can only access users within their shop');
    }

    return this.usersRepository.find({
      where: { shop: { id: shopId } },
      relations: ['company', 'shop', 'warehouse', 'employees'],
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'phone', 'createdAt', 'updatedAt'],
    });
  }

  async getWarehouseUsers(warehouseId: string, currentUser: User): Promise<User[]> {
    // Authorization check
    if (currentUser.role === UserRole.COMPANY_ADMIN && (!currentUser.company || !currentUser.warehouse || currentUser.warehouse.id !== warehouseId)) {
      throw new ForbiddenException('Company admin can only access users within their warehouse');
    }

    return this.usersRepository.find({
      where: { warehouse: { id: warehouseId } },
      relations: ['company', 'shop', 'warehouse', 'employees'],
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'phone', 'createdAt', 'updatedAt'],
    });
  }

  async findEmployeeByUserId(userId: string): Promise<any> {
    const employee = await this.employeeRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user', 'company', 'shop', 'warehouse']
    });
    return employee;
  }

  async findUserByPhone(phone: string): Promise<User | null> {
    return this.findByPhone(phone);
  }

  async saveUser(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }
}