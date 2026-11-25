import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '@/modules/users/services/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, AdminCreateUserDto } from './dto/register.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { User } from '@/modules/users/entities/user.entity';
import { Employee } from '@/modules/users/entities/employee.entity';
import { Company } from '@/modules/company/entities/company.entity';
import { Warehouse } from '@/modules/warehouse/entities/warehouse.entity';
import { UserRole, UserStatus, CompanyStatus } from '@/common/enums';
import { AccountAccessService } from '@/modules/company/account-access.service';
import { PlansService } from '@/modules/plans/plans.service';
import { StaffFirstLoginDto, CAdminFirstLoginDto, PinUnlockDto, BiometricUnlockDto, ChangeAdminPinDto } from './dto/pin-auth.dto';
import { UsedReceipt } from './entities/used-receipt.entity';
import { ReceiptVerificationService } from '../receipt/receipt-verification.service';
import { VerifyReceiptActivateDto } from './dto/verify-receipt-activate.dto';
import * as bcrypt from 'bcrypt';
import {
  isTrialPlan,
  isLargeBusinessPlan,
  addSubscriptionPeriod,
  getSubscriptionNextPaymentDate,
} from '@/shared/subscription/subscription-period.util';

function isGenericPaymentRef(ref?: string | null): boolean {
  if (!ref) return true;
  const lower = ref.trim().toLowerCase();
  return (
    lower === 'free_trial' ||
    lower === 'trial' ||
    lower.startsWith('free_trial') ||
    lower.startsWith('trial_') ||
    lower === 'appstore_reviewer' ||
    lower === 'none' ||
    lower === 'n/a' ||
    lower === 'free'
  );
}

import { OnModuleInit } from '@nestjs/common';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly accountAccessService: AccountAccessService,
    private readonly plansService: PlansService,
    private readonly receiptVerificationService: ReceiptVerificationService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(UsedReceipt)
    private readonly usedReceiptRepository: Repository<UsedReceipt>,
  ) {}

  async onModuleInit() {
    const reviewerPhone = '+251911000999';
    let user = await this.usersService.findUserByPhone(reviewerPhone);
    if (!user) {
      const hashedPassword = await bcrypt.hash('AppReview2026!', 10);
      const company = this.companyRepository.create({
        name: 'BM Enterprise Demo Store',
        address: 'Addis Ababa, Ethiopia',
        phoneNumber: reviewerPhone,
        status: CompanyStatus.ACTIVE,
      });
      const savedCompany = await this.companyRepository.save(company);

      const warehouse = this.warehouseRepository.create({
        name: 'Main Demo Warehouse',
        location: 'Addis Ababa',
        company: savedCompany,
      });
      const savedWarehouse = await this.warehouseRepository.save(warehouse);

      user = await this.usersService.create({
        password: hashedPassword,
        firstName: 'Apple',
        lastName: 'Reviewer',
        phone: reviewerPhone,
        companyId: savedCompany.id,
        warehouseId: savedWarehouse.id,
        role: UserRole.COMPANY_ADMIN,
        planId: 'large',
        planTitle: 'Large Business',
        planAmount: 15999,
        planPeriod: 'large',
        numCompanies: 3,
        paymentStatus: 'CONFIRMED',
        paymentRef: 'APPSTORE_REVIEWER',
      });

      user.status = UserStatus.ACTIVE;
      user.isEmailVerified = true;
      await this.usersService.saveUser(user);

      savedCompany.createdById = user.id;
      await this.companyRepository.save(savedCompany);
    } else {
      let needsUpdate = false;
      if (user.status !== UserStatus.ACTIVE || !user.isEmailVerified) {
        user.status = UserStatus.ACTIVE;
        user.isEmailVerified = true;
        needsUpdate = true;
      }
      const isHashed = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
      let matches = false;
      if (isHashed) {
        try {
          matches = await bcrypt.compare('AppReview2026!', user.password);
        } catch (_) {
          matches = false;
        }
      }
      if (!matches) {
        user.password = await bcrypt.hash('AppReview2026!', 10);
        needsUpdate = true;
      }
      if (needsUpdate) {
        await this.usersService.saveUser(user);
      }
    }
  }

  async validateUser(emailOrPhone: string, password: string): Promise<User> {
    let user = await this.usersService.findByPhone(emailOrPhone);
    if (!user) {
      user = await this.usersService.findByEmailWithAssociations(emailOrPhone);
    }
    if (!user) {
      const userByPhone = await this.usersService.findUserByPhone(emailOrPhone);
      if (userByPhone) {
        user = userByPhone;
      }
    }
    if (!user) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Your account is pending admin approval. Please wait for an admin to approve your account.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Your account is inactive or blocked. Please contact support.');
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (_) {
      isPasswordValid = false;
    }
    // Self-heal plain text password in legacy seed rows
    if (!isPasswordValid && user.password === password) {
      isPasswordValid = true;
      try {
        user.password = await bcrypt.hash(password, 10);
        await this.usersService.saveUser(user);
      } catch (_) {}
    }

    if (isPasswordValid) {
      await this.accountAccessService.assertCanAccess(user, false);
      return user;
    }

    // Allow 4-digit PIN login for staff when admin configured PIN auth
    if (/^\d{4}$/.test(password)) {
      const employee = await this.usersService.findEmployeeByUserId(user.id);
      if (employee?.authMethod === 'pin' && employee.pin) {
        let pinValid = false;
        try {
          pinValid = await bcrypt.compare(password, employee.pin);
        } catch (_) {
          pinValid = false;
        }
        if (!pinValid && employee.pin === password) {
          pinValid = true;
        }
        if (pinValid) {
          await this.accountAccessService.assertCanAccess(user, false);
          return user;
        }
      }
    }

    throw new UnauthorizedException('Invalid phone number or password');
  }

  private async buildAuthResponse(user: User, employee?: Employee | null) {
    if (!employee) {
      employee = await this.usersService.findEmployeeByUserId(user.id);
    }

    if (employee?.company) {
      user.company = employee.company;
      user.companyId = employee.company.id;
    } else if (!user.company) {
      user = await this.usersService.ensureUserHasCompany(user);
    }

    const employeeNameParts = employee?.name ? employee.name.trim().split(/\s+/) : [];
    const effectiveFirstName = employee?.name ? (employeeNameParts[0] || user.firstName) : user.firstName;
    const effectiveLastName = employee?.name ? (employeeNameParts.slice(1).join(' ') || '') : user.lastName;

    const effectiveCompanyId = employee?.company?.id || user.company?.id;
    const effectiveShopId = employee?.shop?.id || user.shop?.id || user.shopId;
    const effectiveWarehouseId = employee?.warehouse?.id || user.warehouse?.id || user.warehouseId;

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      firstName: effectiveFirstName,
      lastName: effectiveLastName,
      companyId: effectiveCompanyId,
      shopId: effectiveShopId,
      warehouseId: effectiveWarehouseId,
      employeeId: employee?.id
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
    });

    const { password: _, pin: __, ...userWithoutPassword } = user as any;

    let effectivePlanId = user.planId;
    let effectivePlanTitle = user.planTitle;
    let effectivePlanAmount = user.planAmount;
    let effectivePlanPeriod = user.planPeriod;

    if (!effectivePlanPeriod && effectiveCompanyId) {
      const comp = await this.companyRepository.findOne({
        where: { id: effectiveCompanyId },
        relations: ['createdBy'],
      });
      if (comp?.createdBy) {
        effectivePlanId = effectivePlanId || comp.createdBy.planId;
        effectivePlanTitle = effectivePlanTitle || comp.createdBy.planTitle;
        effectivePlanAmount = effectivePlanAmount || comp.createdBy.planAmount;
        effectivePlanPeriod = effectivePlanPeriod || comp.createdBy.planPeriod;
      }
    }

    const serializedPerms = this.serializePermissions(employee?.permissions);
    const branchPermissions = serializedPerms?.branchPermissions || {};

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        ...userWithoutPassword,
        planId: effectivePlanId,
        planTitle: effectivePlanTitle,
        planAmount: effectivePlanAmount,
        planPeriod: effectivePlanPeriod,
        firstName: effectiveFirstName,
        lastName: effectiveLastName,
        employeeName: employee?.name,
        companyId: effectiveCompanyId,
        shopId: effectiveShopId,
        warehouseId: effectiveWarehouseId,
        employeeId: employee?.id || null,
        hasPin: !!(user as any).pin,
        permissions: serializedPerms,
        branchPermissions,
        employee: employee
          ? {
              id: employee.id,
              name: employee.name,
              jobTitle: employee.jobTitle,
              role: employee.user?.role,
              companyId: effectiveCompanyId,
              shopId: effectiveShopId,
              warehouseId: effectiveWarehouseId,
              permissions: serializedPerms,
              branchPermissions,
            }
          : null,
        employees: employee
          ? [{
              id: employee.id,
              name: employee.name,
              jobTitle: employee.jobTitle,
              role: employee.user?.role,
              companyId: effectiveCompanyId,
              shopId: effectiveShopId,
              warehouseId: effectiveWarehouseId,
              permissions: serializedPerms,
              branchPermissions,
            }]
          : [],
      },
      routing: {
        companyId: effectiveCompanyId,
        shopId: effectiveShopId,
        warehouseId: effectiveWarehouseId
      }
    };
  }

  async login(loginDto: LoginDto) {
    const identifier = (loginDto.email || loginDto.phone)?.trim();
    if (!identifier) {
      throw new BadRequestException('Phone number or email is required');
    }
    const user = await this.validateUser(identifier, loginDto.password);
    return this.buildAuthResponse(user);
  }

  async staffFirstLogin(dto: StaffFirstLoginDto) {
    const trimmedName = dto.companyName.trim();
    const company = await this.companyRepository.createQueryBuilder('company')
      .where('LOWER(company.name) = LOWER(:name)', { name: trimmedName })
      .getOne();

    if (!company) {
      throw new NotFoundException('Company not found. Please verify the company name.');
    }

    // Find company admin
    let admin: User | null = null;
    if (company.createdById) {
      admin = await this.userRepository.findOne({ where: { id: company.createdById } });
    }
    if (!admin) {
      admin = await this.userRepository.findOne({
        where: { companyId: company.id, role: UserRole.COMPANY_ADMIN },
        order: { createdAt: 'ASC' },
      });
    }
    if (!admin) {
      throw new UnauthorizedException('No company administrator found for this company.');
    }

    if (!dto.companyPassword) {
      throw new UnauthorizedException('Company password is required.');
    }
    const isCompanyPassValid = await bcrypt.compare(dto.companyPassword, admin.password);
    if (!isCompanyPassValid) {
      throw new UnauthorizedException('Invalid company password.');
    }

    // Helper to normalize phone numbers for accurate matching
    const normalizePhone = (phoneStr?: string): string => {
      if (!phoneStr) return '';
      let cleaned = phoneStr.replace(/\D/g, '');
      if (cleaned.startsWith('251')) {
        cleaned = '0' + cleaned.slice(3);
      } else if (/^[79]\d{8}$/.test(cleaned)) {
        cleaned = '0' + cleaned;
      }
      return cleaned;
    };

    // Find all employees in this company
    const employees = await this.employeeRepository.find({
      where: { company: { id: company.id } },
      relations: ['user', 'company', 'shop', 'warehouse'],
    });

    let matchedEmployee: Employee | null = null;
    const targetPhone = normalizePhone(dto.phone);

    if (targetPhone) {
      // Differentiate by phone number: filter candidates belonging to this company
      const candidateEmployees = employees.filter((emp) => {
        const empPhone = normalizePhone(emp.phoneNumber);
        const userPhone = normalizePhone(emp.user?.phone);
        return empPhone === targetPhone || userPhone === targetPhone;
      });

      if (candidateEmployees.length === 0) {
        throw new NotFoundException(`No staff member found with phone number ${dto.phone} in this company.`);
      }

      for (const emp of candidateEmployees) {
        let isMatch = false;
        if (emp.pin && await bcrypt.compare(dto.pin, emp.pin)) {
          isMatch = true;
        } else if (emp.assignedPin && emp.assignedPin === dto.pin) {
          isMatch = true;
        }
        if (isMatch) {
          matchedEmployee = emp;
          break;
        }
      }

      if (!matchedEmployee) {
        throw new UnauthorizedException('Invalid PIN for this staff member. Please check your assigned 4-digit PIN.');
      }
    } else {
      // When phone is not provided, match across all employees, but guard against ambiguous duplicate PINs!
      const matchingEmployees: Employee[] = [];
      for (const emp of employees) {
        let isMatch = false;
        if (emp.pin && await bcrypt.compare(dto.pin, emp.pin)) {
          isMatch = true;
        } else if (emp.assignedPin && emp.assignedPin === dto.pin) {
          isMatch = true;
        }
        if (isMatch) {
          matchingEmployees.push(emp);
        }
      }

      if (matchingEmployees.length === 0) {
        throw new UnauthorizedException('Invalid staff PIN. Please check your assigned 4-digit PIN.');
      }

      if (matchingEmployees.length > 1) {
        throw new UnauthorizedException('Multiple staff members share this PIN. Please enter your staff phone number to differentiate your account.');
      }

      matchedEmployee = matchingEmployees[0];
    }

    const user = matchedEmployee.user;
    if (!user) {
      throw new UnauthorizedException('No account user found for this employee.');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Your staff account is pending admin approval.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Your staff account is inactive or blocked. Please contact your company admin.');
    }

    await this.accountAccessService.assertCanAccess(user, false);
    return this.buildAuthResponse(user, matchedEmployee);
  }

  async cadminFirstLogin(dto: CAdminFirstLoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    if (user.role !== UserRole.COMPANY_ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('This sign-in is for Company Admins only. Staff members must use the Staff tab.');
    }

    if (dto.pin) {
      if (!/^\d{4}$/.test(dto.pin)) {
        throw new BadRequestException('PIN must be exactly 4 digits');
      }
      const rounds = parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12'));
      user.pin = await bcrypt.hash(dto.pin, rounds);
      await this.userRepository.save(user);
    }

    return this.buildAuthResponse(user);
  }

  async pinUnlock(dto: PinUnlockDto) {
    if (!/^\d{4}$/.test(dto.pin)) {
      throw new BadRequestException('PIN must be exactly 4 digits');
    }

    if (dto.role === 'admin') {
      const user = await this.userRepository.findOne({
        where: { id: dto.accountId },
        relations: ['company', 'shop', 'warehouse'],
      });
      if (!user) {
        throw new UnauthorizedException('Admin account not found on this device.');
      }
      if (!user.pin) {
        const rounds = parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12'));
        user.pin = await bcrypt.hash(dto.pin, rounds);
        await this.userRepository.save(user);
      } else {
        const isPinValid = await bcrypt.compare(dto.pin, user.pin);
        if (!isPinValid) {
          throw new UnauthorizedException('Incorrect PIN. Please try again.');
        }
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Your account is inactive or blocked.');
      }
      await this.accountAccessService.assertCanAccess(user, false);
      return this.buildAuthResponse(user);
    } else {
      const employee = await this.employeeRepository.findOne({
        where: { id: dto.accountId },
        relations: ['user', 'company', 'shop', 'warehouse'],
      });
      if (!employee) {
        throw new UnauthorizedException('Staff profile not found on this device.');
      }
      let isPinValid = false;
      if (employee.pin) {
        isPinValid = await bcrypt.compare(dto.pin, employee.pin);
      }
      if (!isPinValid && employee.assignedPin) {
        isPinValid = employee.assignedPin === dto.pin;
      }
      if (!isPinValid) {
        throw new UnauthorizedException('Incorrect PIN. Please try again.');
      }
      const user = await this.userRepository.findOne({
        where: { id: employee.user.id },
        relations: ['company', 'shop', 'warehouse'],
      });
      if (!user) {
        throw new UnauthorizedException('User account not found for this staff member.');
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Your staff account is inactive or blocked.');
      }
      await this.accountAccessService.assertCanAccess(user, false);
      return this.buildAuthResponse(user, employee);
    }
  }

  async biometricUnlock(dto: BiometricUnlockDto) {
    if (dto.role === 'admin') {
      const user = await this.userRepository.findOne({
        where: { id: dto.accountId },
        relations: ['company', 'shop', 'warehouse'],
      });
      if (!user) {
        throw new UnauthorizedException('Admin account not found on this device.');
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Your account is inactive or blocked.');
      }

      if (!dto.refreshToken && !dto.pin) {
        throw new UnauthorizedException('Biometric token or credential is required.');
      }

      if (dto.refreshToken) {
        try {
          const payload = this.jwtService.verify(dto.refreshToken, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
          });
          if (payload.sub !== user.id) {
            throw new UnauthorizedException('Device session does not match this account.');
          }
        } catch (e) {
          throw new UnauthorizedException('Biometric session expired. Please sign in with your credentials.');
        }
      } else if (dto.pin) {
        if (!user.pin || !(await bcrypt.compare(dto.pin, user.pin))) {
          throw new UnauthorizedException('Invalid authentication credentials.');
        }
      }

      await this.accountAccessService.assertCanAccess(user, false);
      return this.buildAuthResponse(user);
    } else {
      const employee = await this.employeeRepository.findOne({
        where: { id: dto.accountId },
        relations: ['user', 'company', 'shop', 'warehouse'],
      });
      if (!employee) {
        throw new UnauthorizedException('Staff profile not found on this device.');
      }
      const user = await this.userRepository.findOne({
        where: { id: employee.user?.id },
        relations: ['company', 'shop', 'warehouse'],
      });
      if (!user) {
        throw new UnauthorizedException('User account not found for this staff member.');
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Your staff account is inactive or blocked.');
      }

      if (!dto.refreshToken && !dto.pin) {
        throw new UnauthorizedException('Biometric token or credential is required.');
      }

      if (dto.refreshToken) {
        try {
          const payload = this.jwtService.verify(dto.refreshToken, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
          });
          if (payload.sub !== user.id) {
            throw new UnauthorizedException('Device session does not match this account.');
          }
        } catch (e) {
          throw new UnauthorizedException('Biometric session expired. Please sign in with your credentials.');
        }
      } else if (dto.pin) {
        let isPinValid = false;
        if (employee.pin) {
          isPinValid = await bcrypt.compare(dto.pin, employee.pin);
        }
        if (!isPinValid && employee.assignedPin) {
          isPinValid = employee.assignedPin === dto.pin;
        }
        if (!isPinValid) {
          throw new UnauthorizedException('Invalid authentication credentials.');
        }
      }

      await this.accountAccessService.assertCanAccess(user, false);
      return this.buildAuthResponse(user, employee);
    }
  }

  async changeAdminPin(userId: string, dto: ChangeAdminPinDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (!/^\d{4}$/.test(dto.newPin)) {
      throw new BadRequestException('New PIN must be exactly 4 digits.');
    }
    const rounds = parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12'));
    user.pin = await bcrypt.hash(dto.newPin, rounds);
    await this.userRepository.save(user);
    return { success: true, message: 'Security PIN updated successfully.' };
  }

  async setAdminPin(userId: string, newPin: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (!/^\d{4}$/.test(newPin)) {
      throw new BadRequestException('New PIN must be exactly 4 digits.');
    }
    const rounds = parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12'));
    user.pin = await bcrypt.hash(newPin, rounds);
    await this.userRepository.save(user);
    return { success: true, message: 'Security PIN set successfully.' };
  }

  /**
   * Serialize a staff employee's permissions for the app.
   * The Settings module is enabled by default so staff can access the
   * Settings screen unless the admin explicitly configured permissions
   * (in which case those choices are respected as-is).
   */
  private serializePermissions(perms: Record<string, any> | null | undefined): Record<string, any> | null {
    if (perms == null) {
      return { modulePermissions: { Settings: 'view' } };
    }
    let parsedPerms: any = perms;
    if (typeof perms === 'string') {
      try {
        parsedPerms = JSON.parse(perms);
      } catch (_) {
        return { modulePermissions: { Settings: 'view' } };
      }
    }
    if (!parsedPerms || typeof parsedPerms !== 'object') {
      return { modulePermissions: { Settings: 'view' } };
    }
    const modules = parsedPerms.modulePermissions || {};
    const hasModules = typeof modules === 'object' && Object.keys(modules).length > 0;
    return {
      ...parsedPerms,
      modulePermissions: hasModules ? modules : { Settings: 'view' },
    };
  }

  async getStaffAuthMethod(phone: string): Promise<{ authMethod: 'password' | 'pin' }> {
    const user = await this.usersService.findUserByPhone(phone);
    if (!user) {
      throw new NotFoundException('This phone number is not registered. Please sign up first.');
    }
    const employee = await this.usersService.findEmployeeByUserId(user.id);
    if (employee?.authMethod === 'pin') {
      return { authMethod: 'pin' };
    }
    return { authMethod: 'password' };
  }

  async register(registerDto: RegisterDto): Promise<User> {
    const cleanPhone = registerDto.phone ? registerDto.phone.replace(/\D/g, '') : '';

    const firstName = registerDto.firstName || registerDto.companyName || 'Business';
    const lastName = registerDto.lastName || '';

    const email = registerDto.email?.trim() || null;

    const existingUser = (email ? await this.usersService.findByEmail(email) : null) || 
                         (registerDto.phone ? await this.usersService.findUserByPhone(registerDto.phone) : null);
    const isTrial = isTrialPlan(registerDto.planPeriod || registerDto.planId) || registerDto.planAmount === 0 || registerDto.planId === 'trial';
    if (existingUser) {
      if (existingUser.status === UserStatus.PENDING && isTrial) {
        const now = new Date();
        const expiresAt = addSubscriptionPeriod(now, 'trial');
        const nextPayment = getSubscriptionNextPaymentDate(expiresAt, 'trial');
        existingUser.status = UserStatus.ACTIVE;
        existingUser.paymentStatus = 'CONFIRMED';
        existingUser.planPeriod = 'trial';
        existingUser.planTitle = registerDto.planTitle || 'Free Trial (14 Days)';
        existingUser.planAmount = 0;
        existingUser.subscriptionStartDate = now;
        existingUser.subscriptionExpiresAt = expiresAt;
        existingUser.subscriptionNextPaymentDate = nextPayment;
        existingUser.isEmailVerified = true;
        if (registerDto.password) {
          existingUser.password = await bcrypt.hash(
            registerDto.password,
            parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12')),
          );
        }
        await this.usersService.saveUser(existingUser);
        if (existingUser.company) {
          existingUser.company.status = CompanyStatus.ACTIVE;
          await this.companyRepository.save(existingUser.company);
        }
        return existingUser;
      }
      throw new ConflictException('Account with this phone number already exists. Please log in instead.');
    }

    if (registerDto.phone) {
      const existingPhoneUser = await this.usersService.findByPhone(registerDto.phone);
      if (existingPhoneUser) {
        if (existingPhoneUser.status === UserStatus.PENDING && isTrial) {
          const now = new Date();
          const expiresAt = addSubscriptionPeriod(now, 'trial');
          const nextPayment = getSubscriptionNextPaymentDate(expiresAt, 'trial');
          existingPhoneUser.status = UserStatus.ACTIVE;
          existingPhoneUser.paymentStatus = 'CONFIRMED';
          existingPhoneUser.planPeriod = 'trial';
          existingPhoneUser.planTitle = registerDto.planTitle || 'Free Trial (14 Days)';
          existingPhoneUser.planAmount = 0;
          existingPhoneUser.subscriptionStartDate = now;
          existingPhoneUser.subscriptionExpiresAt = expiresAt;
          existingPhoneUser.subscriptionNextPaymentDate = nextPayment;
          existingPhoneUser.isEmailVerified = true;
          if (registerDto.password) {
            existingPhoneUser.password = await bcrypt.hash(
              registerDto.password,
              parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12')),
            );
          }
          await this.usersService.saveUser(existingPhoneUser);
          if (existingPhoneUser.company) {
            existingPhoneUser.company.status = CompanyStatus.ACTIVE;
            await this.companyRepository.save(existingPhoneUser.company);
          }
          return existingPhoneUser;
        }
        throw new ConflictException('Phone number already registered');
      }
    }

    if (registerDto.planId && !isTrialPlan(registerDto.planPeriod || registerDto.planId)) {
      const plan = await this.plansService.findBillableById(registerDto.planId);
      const isLarge = isLargeBusinessPlan(registerDto.planPeriod || registerDto.planId || plan.period || plan.title);
      const numCompanies = isLarge ? Math.max(registerDto.numCompanies ?? 1, 1) : 1;
      const expectedTotal = Number(plan.amount) * numCompanies;
      if (registerDto.planAmount != null && Number(registerDto.planAmount) !== expectedTotal) {
        throw new BadRequestException(
          `Payment amount must be ETB ${expectedTotal} (${numCompanies} ${numCompanies === 1 ? 'company' : 'companies'} × ETB ${plan.amount}).`,
        );
      }
    }

    // Check if receipt has already been used by another user (Finding 7, CWE-345)
    const paymentRefCandidate = registerDto.paymentRef?.trim();
    const receiptUrlCandidate = registerDto.receiptUrl?.trim();
    if (!isTrial && (paymentRefCandidate || receiptUrlCandidate)) {
      const candidates = [paymentRefCandidate, receiptUrlCandidate]
        .filter(Boolean)
        .filter((c) => !isGenericPaymentRef(c)) as string[];
      for (const cand of candidates) {
        const alreadyUsed = await this.usedReceiptRepository.findOne({
          where: [
            { reference: cand },
            { receiptUrl: cand },
          ],
        });
        if (alreadyUsed) {
          throw new ConflictException('This receipt has already been used and cannot be reused.');
        }
      }
    }

    if (!isTrial && paymentRefCandidate && !isGenericPaymentRef(paymentRefCandidate)) {
      const existingUserWithRef = await this.userRepository.findOne({
        where: { paymentRef: paymentRefCandidate },
      });
      if (existingUserWithRef) {
        throw new ConflictException('This payment reference has already been used by another account.');
      }
    }

    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12')),
    );

    // Create company for the new user - pending by default for paid plans
    const ownerDisplayName = [firstName, lastName].filter(Boolean).join(' ');
    const companyName = registerDto.companyName || (ownerDisplayName ? `${ownerDisplayName}'s Company` : 'My Company');
    const company = this.companyRepository.create({
      name: companyName,
      address: registerDto.address || '',
      phoneNumber: registerDto.phone,
      status: isTrial ? CompanyStatus.ACTIVE : CompanyStatus.SUBSCRIPTION_EXPIRED,
    });
    const savedCompany = await this.companyRepository.save(company);

    // Create default store/warehouse using company name
    const warehouse = this.warehouseRepository.create({
      name: companyName,
      location: '',
      company: savedCompany,
    });
    const savedWarehouse = await this.warehouseRepository.save(warehouse);

    // Server-side lookup of plan price (never trust client planAmount - Finding 7, CWE-345)
    let serverPlanAmount = 0;
    let serverPlanTitle = registerDto.planTitle;
    if (registerDto.planId) {
      try {
        const plan = await this.plansService.findBillableById(registerDto.planId);
        if (plan) {
          const isLarge = isLargeBusinessPlan(registerDto.planPeriod || registerDto.planId || plan.period || plan.title);
          const numCompanies = isLarge ? Math.max(registerDto.numCompanies ?? 1, 1) : 1;
          serverPlanAmount = Number(plan.amount) * numCompanies;
          serverPlanTitle = plan.title;
        }
      } catch {
        // Fallback gracefully
      }
    }

    // Verify payment reference against Telebirr/CBE API if provided (Finding 7, CWE-345)
    let receiptVerified = false;
    if (!isTrial && (paymentRefCandidate || receiptUrlCandidate)) {
      const bankId = (registerDto.paymentMethod || 'cbe').toLowerCase().includes('telebirr') ? 'telebirr' : 'cbe';
      try {
        const verifyResult = await this.receiptVerificationService.verify({
          bank: bankId,
          reference: paymentRefCandidate || receiptUrlCandidate,
          receiptUrl: receiptUrlCandidate,
          phoneNumber: registerDto.phone,
        });

        if (verifyResult && verifyResult.valid) {
          if (verifyResult.amount != null && serverPlanAmount > 0 && Number(verifyResult.amount) < serverPlanAmount) {
            throw new BadRequestException(
              `Receipt amount (${verifyResult.amount} ETB) is less than required plan amount (${serverPlanAmount} ETB).`,
            );
          }
          receiptVerified = true;
          try {
            await this.usedReceiptRepository.save(
              this.usedReceiptRepository.create({
                reference: verifyResult.reference || paymentRefCandidate || receiptUrlCandidate!,
                bank: verifyResult.bank || bankId,
                amount: verifyResult.amount,
                payerName: verifyResult.senderName,
                receiptUrl: verifyResult.receiptUrl || receiptUrlCandidate,
                usedByPhone: registerDto.phone,
                purpose: 'SUBSCRIPTION_SIGNUP',
              }),
            );
          } catch (_) {}
        }
      } catch (err: any) {
        if (err instanceof BadRequestException || err instanceof ConflictException) {
          throw err;
        }
      }
    }

    const savedUser = await this.usersService.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: registerDto.phone,
      companyId: savedCompany.id,
      warehouseId: savedWarehouse.id,
      role: UserRole.COMPANY_ADMIN,
      planId: registerDto.planId,
      planTitle: serverPlanTitle || registerDto.planTitle,
      planAmount: isTrial ? 0 : serverPlanAmount,
      planPeriod: registerDto.planPeriod,
      numCompanies: (registerDto.planId && isLargeBusinessPlan(registerDto.planPeriod || registerDto.planId || serverPlanTitle))
        ? Math.max(registerDto.numCompanies ?? 1, 1)
        : 1,
      paymentMethod: registerDto.paymentMethod,
      // Force paymentStatus server-side; NEVER trust client-supplied paymentStatus (CWE-345 mitigation)
      paymentStatus: isTrial ? 'TRIAL' : (receiptVerified ? 'CONFIRMED' : 'PENDING'),
      paymentRef: isTrial ? `TRIAL_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` : registerDto.paymentRef,
      paymentScreenshot: registerDto.paymentScreenshot,
      faydaId: registerDto.faydaId,
      tin: registerDto.tinNumber,
    });

    savedCompany.createdById = savedUser.id;
    await this.companyRepository.save(savedCompany);

    if (isTrial || receiptVerified) {
      // Activated only if trial or verified against provider
      const now = new Date();
      const planPeriod = registerDto.planPeriod || registerDto.planId || '1_month';
      const expiresAt = addSubscriptionPeriod(now, isTrial ? 'trial' : planPeriod);
      const nextPayment = getSubscriptionNextPaymentDate(expiresAt, isTrial ? 'trial' : planPeriod);
      savedUser.status = UserStatus.ACTIVE;
      savedUser.paymentStatus = isTrial ? 'TRIAL' : 'CONFIRMED';
      savedUser.subscriptionStartDate = now;
      savedUser.subscriptionExpiresAt = expiresAt;
      savedUser.subscriptionNextPaymentDate = nextPayment;
      savedUser.isEmailVerified = true;

      // Activate company
      savedCompany.status = CompanyStatus.ACTIVE;
      await this.companyRepository.save(savedCompany);
    } else {
      // All unverified paid plans MUST remain PENDING until receipt is verified or admin approves (CWE-345)
      savedUser.status = UserStatus.PENDING;
      savedUser.paymentStatus = 'PENDING';
      savedUser.isEmailVerified = true;
      savedCompany.status = CompanyStatus.SUBSCRIPTION_EXPIRED;
      await this.companyRepository.save(savedCompany);
    }
    await this.usersService.saveUser(savedUser);

    return savedUser;
  }

  async adminCreateUser(adminCreateUserDto: AdminCreateUserDto, adminUser: User): Promise<User> {
    if (adminUser.role !== UserRole.ADMIN && adminUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can create users');
    }

    const existingUser = await this.usersService.findByEmail(adminCreateUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      adminCreateUserDto.password,
      parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12')),
    );

    const userData = {
      ...adminCreateUserDto,
      password: hashedPassword,
      role: adminCreateUserDto.role || UserRole.USER,
      status: UserStatus.ACTIVE,
      isEmailVerified: adminCreateUserDto.skipEmailVerification || false,
    };

    return this.usersService.create(userData);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      let user = await this.usersService.findByIdWithAssociations(payload.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Auto-create company if missing (handles existing users from before the fix)
      if (!user.company) {
        user = await this.usersService.ensureUserHasCompany(user);
      }

      await this.accountAccessService.assertCanAccess(user, true);

      const employee = await this.usersService.findEmployeeByUserId(user.id);
      
      const newPayload = { 
        sub: user.id, 
        email: user.email, 
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.company?.id,
        shopId: user.shop?.id,
        warehouseId: user.warehouse?.id,
        employeeId: employee?.id
      };

      return {
        success: true,
        accessToken: this.jwtService.sign(newPayload),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async resetPassword(phone: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findUserByPhone(phone);
    if (!user) {
      throw new UnauthorizedException('No account found with this phone number');
    }

    // Set new password (the entity @BeforeUpdate hook will hash it automatically)
    user.password = newPassword;
    await this.usersService.saveUser(user);
  }

  async phoneExists(phone: string): Promise<boolean> {
    const user = await this.usersService.findUserByPhone(phone);
    return !!user;
  }

  async emailExists(email: string): Promise<boolean> {
    const user = await this.usersService.findByEmail(email);
    return !!user;
  }

  /**
   * Reset an admin user's password by email (used by the admin portal
   * forgot-password flow after OTP verification).
   */
  async adminResetPasswordByEmail(email: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findByEmailWithAssociations(email.trim().toLowerCase());
    if (!user) {
      throw new NotFoundException('No admin account found with this email address');
    }

    const role = String(user.role || '').toLowerCase().replace(/[-_ ]/g, '');
    if (role !== 'admin' && role !== 'superadmin') {
      throw new ForbiddenException('Password reset via email is only available for admin accounts.');
    }

    user.password = newPassword;
    await this.usersService.saveUser(user);
  }

  /**
   * Check if an active admin/superadmin account exists with this email address.
   */
  async adminEmailExists(email: string): Promise<boolean> {
    const user = await this.usersService.findByEmailWithAssociations(email.trim().toLowerCase());
    if (!user) return false;
    const role = String(user.role || '').toLowerCase().replace(/[-_ ]/g, '');
    return role === 'admin' || role === 'superadmin';
  }


  async renewSubscription(dto: RenewSubscriptionDto, currentUser?: User) {
    let user: User | null = null;
    const phoneInput = dto.phone?.trim();
    if (phoneInput) {
      user = await this.usersService.findUserByPhone(phoneInput);
      if (!user && phoneInput.includes('@')) {
        user = await this.usersService.findByEmailWithAssociations(phoneInput).catch(() => null);
      }
    }
    if (!user && (dto as any).email && (dto as any).email.trim()) {
      user = await this.usersService.findByEmailWithAssociations((dto as any).email.trim()).catch(() => null);
    }
    if (!user && currentUser) {
      user = await this.usersService.findById(currentUser.id).catch(() => currentUser);
    }

    if (!user) {
      throw new NotFoundException('No account found for subscription renewal');
    }
    if (user.role !== UserRole.COMPANY_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only the company owner or admin can renew the subscription');
    }

    const { numCompanies } = await this.usersService.resolveBillingCompanyCount(user);

    if (dto.planId) {
      try {
        const plan = await this.plansService.findBillableById(dto.planId);
        if (plan) {
          const expectedTotal = Number(plan.amount) * numCompanies;
          // Always enforce server-calculated planAmount (Finding 4, CWE-345)
          dto.planAmount = expectedTotal;
          dto.planTitle = plan.title;
        }
      } catch {
        // Proceed gracefully if plan resolution fallback
      }
    }

    // Check duplicate payment reference across accounts (Finding 7, CWE-345)
    let renewalVerified = false;
    if (dto.paymentRef && !isGenericPaymentRef(dto.paymentRef)) {
      const trimmedRef = dto.paymentRef.trim();
      const alreadyUsed = await this.usedReceiptRepository.findOne({ where: { reference: trimmedRef } });
      if (alreadyUsed && alreadyUsed.usedByUserId && alreadyUsed.usedByUserId !== user.id) {
        throw new ConflictException('This payment reference has already been used by another account.');
      }
      const existingUserWithRef = await this.userRepository.findOne({ where: { paymentRef: trimmedRef } });
      if (existingUserWithRef && existingUserWithRef.id !== user.id) {
        throw new ConflictException('This payment reference has already been used by another account.');
      }

      // Verify payment reference against Telebirr/CBE API (Finding 7, CWE-345)
      const bankId = (dto.paymentMethod || 'cbe').toLowerCase().includes('telebirr') ? 'telebirr' : 'cbe';
      try {
        const verifyResult = await this.receiptVerificationService.verify({
          bank: bankId,
          reference: trimmedRef,
          phoneNumber: user.phone || dto.phone,
        });
        if (verifyResult && verifyResult.valid) {
          if (verifyResult.amount != null && dto.planAmount && Number(verifyResult.amount) < Number(dto.planAmount)) {
            throw new BadRequestException(
              `Receipt amount (${verifyResult.amount} ETB) is less than required renewal amount (${dto.planAmount} ETB).`,
            );
          }
          renewalVerified = true;
          try {
            await this.usedReceiptRepository.save(
              this.usedReceiptRepository.create({
                reference: verifyResult.reference || trimmedRef,
                bank: verifyResult.bank || bankId,
                amount: verifyResult.amount,
                payerName: verifyResult.senderName,
                usedByPhone: user.phone,
                usedByUserId: user.id,
                purpose: 'SUBSCRIPTION_RENEWAL',
              }),
            );
          } catch (_) {}
        }
      } catch (err: any) {
        if (err instanceof BadRequestException || err instanceof ConflictException) {
          throw err;
        }
      }
    }

    const updatedUser = await this.usersService.submitSubscriptionRenewal(
      user,
      {
        planId: dto.planId,
        planTitle: dto.planTitle,
        planAmount: dto.planAmount,
        planPeriod: dto.planPeriod,
        paymentMethod: dto.paymentMethod,
        paymentRef: dto.paymentRef,
        paymentScreenshot: dto.paymentScreenshot,
      },
      renewalVerified,
    );

    const { password, ...userWithoutPassword } = updatedUser;
    return {
      success: true,
      message: renewalVerified
        ? 'Subscription renewal verified and activated successfully!'
        : 'Subscription renewal submitted successfully. Our team will verify your payment and notify you once approved.',
      user: userWithoutPassword,
      numCompanies,
      verified: renewalVerified,
    };
  }

  async getRenewalPreview(phone: string) {
    const rawInput = (phone || '').trim();
    let user = await this.usersService.findUserByPhone(rawInput);
    if (!user && rawInput.includes('@')) {
      user = await this.usersService.findByEmailWithAssociations(rawInput).catch(() => null);
    }
    if (!user) {
      throw new NotFoundException('No account found with this phone number');
    }

    const canRenew = user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    let owner = user;

    if (!canRenew) {
      const ctx = await this.accountAccessService.getCompanyAccessContext(user);
      owner = ctx.owner ?? user;
    }

    const expired =
      !owner?.subscriptionExpiresAt ||
      new Date(owner.subscriptionExpiresAt) < new Date();

    const billingOwner = canRenew ? user : owner!;
    const { numCompanies, ownedCompanies } =
      await this.usersService.resolveBillingCompanyCount(billingOwner);

    const publicPlans = await this.plansService.findAllPublic();
    const plans = publicPlans.map((p) => {
      const baseAmount = Number(p.amount) || 0;
      return {
        id: p.id,
        title: p.title,
        period: p.period,
        baseAmount,
        totalAmount: baseAmount * numCompanies,
        numCompanies,
      };
    });

    return {
      success: true,
      subscriptionExpired: expired,
      canRenew,
      numCompanies,
      ownedCompanies,
      planTitle: owner?.planTitle,
      subscriptionExpiresAt: owner?.subscriptionExpiresAt,
      plans,
    };
  }

  async verifyReceiptAndActivate(dto: VerifyReceiptActivateDto) {
    const rawPhone = dto.phone ? dto.phone.trim() : '';
    if (!rawPhone) {
      throw new BadRequestException('Phone number is required.');
    }

    // Lookup user by phone
    const cleanDigits = rawPhone.replace(/\D/g, '');
    let user = await this.usersService.findUserByPhone(rawPhone);
    if (!user && cleanDigits) {
      user = await this.usersService.findUserByPhone(cleanDigits);
      if (!user) {
        user = await this.usersService.findUserByPhone(`+251${cleanDigits.replace(/^0+|^251/, '')}`);
      }
      if (!user) {
        user = await this.usersService.findUserByPhone(`0${cleanDigits.replace(/^0+|^251/, '')}`);
      }
    }

    if (!user) {
      throw new NotFoundException('No account found for this phone number. Please register first.');
    }

    if (user.status === UserStatus.ACTIVE && user.paymentStatus === 'CONFIRMED') {
      return {
        success: true,
        message: 'Account is already active! Please sign in with your phone and password.',
        alreadyActive: true,
      };
    }

    const bankId = (dto.bank || 'cbe').toLowerCase().trim();
    let receiptResult: any;

    if (dto.imageBase64) {
      try {
        const matches = dto.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const base64Data = matches ? matches[2] : dto.imageBase64;
        const mimeType = matches ? matches[1] : 'image/png';
        const buffer = Buffer.from(base64Data, 'base64');
        receiptResult = await this.receiptVerificationService.verifyByImage(
          buffer,
          'receipt.png',
          mimeType,
          bankId,
          dto.reference || dto.receiptUrl || dto.link,
        );
      } catch (err: any) {
        throw new BadRequestException(err?.message || 'Invalid screenshot image format.');
      }
    } else {
      const refOrUrl = dto.receiptUrl || dto.link || dto.reference;
      if (!refOrUrl) {
        throw new BadRequestException('Please provide a receipt URL, link, or reference number.');
      }
      receiptResult = await this.receiptVerificationService.verify({
        bank: bankId,
        reference: refOrUrl,
        receiptUrl: dto.receiptUrl || dto.link,
        suffix: dto.suffix,
        phoneNumber: rawPhone,
      });
    }

    if (!receiptResult || !receiptResult.valid) {
      throw new BadRequestException(
        receiptResult?.message || 'Receipt could not be verified. Please check the receipt link/reference number or upload a clear screenshot.'
      );
    }

    // Check if receipt was already used by another user
    const refKey = receiptResult.reference || dto.reference || dto.receiptUrl || dto.link;
    if (refKey) {
      const alreadyUsed = await this.usedReceiptRepository.findOne({ where: { reference: refKey } });
      if (alreadyUsed && alreadyUsed.usedByUserId && alreadyUsed.usedByUserId !== user.id) {
        throw new ConflictException('This receipt has already been used to activate another account.');
      }
    }

    // Activate the user & subscription
    const planPeriod = user.planPeriod || user.planId || '1_month';
    const now = new Date();
    const expiresAt = addSubscriptionPeriod(now, planPeriod);
    const nextPayment = getSubscriptionNextPaymentDate(expiresAt, planPeriod);

    user.status = UserStatus.ACTIVE;
    user.paymentStatus = 'CONFIRMED';
    user.paymentRef = refKey || user.paymentRef;
    user.subscriptionStartDate = now;
    user.subscriptionExpiresAt = expiresAt;
    user.subscriptionNextPaymentDate = nextPayment;
    user.isEmailVerified = true;
    await this.userRepository.save(user);

    if (user.company) {
      user.company.status = CompanyStatus.ACTIVE;
      await this.companyRepository.save(user.company);
    }

    // Record used receipt
    if (refKey) {
      try {
        const usedReceipt = this.usedReceiptRepository.create({
          reference: refKey,
          bank: receiptResult.bank || bankId,
          amount: receiptResult.amount,
          payerName: receiptResult.senderName,
          receiptUrl: receiptResult.receiptUrl || dto.receiptUrl || dto.link,
          usedByPhone: user.phone,
          usedByUserId: user.id,
          purpose: 'SIGNUP_VERIFICATION',
        });
        await this.usedReceiptRepository.save(usedReceipt);
      } catch (_) {}
    }

    return {
      success: true,
      message: 'Payment receipt verified successfully! Your account is now active. Please sign in below.',
      receipt: receiptResult,
    };
  }
}