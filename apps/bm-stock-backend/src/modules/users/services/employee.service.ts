import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto, EmployeeResponseDto } from '../dto/employee';
import { User } from '../entities/user.entity';
import { Shop } from '../../shops/entities/shops.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Company } from '../../company/entities/company.entity';
import { Sales } from '../../sales/entities/sales.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { PaginatedResult } from '@/common/interfaces';
import { CACHE_KEYS } from '@/common/constants';
import { UserRole, UserStatus } from '@/common/enums';
import * as bcrypt from 'bcrypt';
import { assertStaffLimit } from '@/shared/subscription/subscription-plans.util';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly cacheService: CacheService,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto, currentUser?: any): Promise<EmployeeResponseDto> {
    const { userId, shopId, warehouseId, companyId, name, phoneNumber, password, baseCommissionRate, jobTitle, role, authMethod, pin } = createEmployeeDto;
    
    let normalizedPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';
    if (normalizedPhone.startsWith('251')) {
      normalizedPhone = '0' + normalizedPhone.slice(3);
    } else if (/^[79]\d{8}$/.test(normalizedPhone)) {
      normalizedPhone = '0' + normalizedPhone;
    }
    const phoneToUse = normalizedPhone || phoneNumber;

    let user: User | null = null;

    // If a userId is explicitly provided, look it up
    if (userId) {
      user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
    }

    // Auto-assign company from current user if company admin
    let company: Company | null = null;
    if (companyId) {
      company = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['createdBy'] });
      if (!company) throw new NotFoundException('Company not found');
    } else if (currentUser?.companyId) {
      company = await this.companyRepository.findOne({ where: { id: currentUser.companyId }, relations: ['createdBy'] });
    }

    // Enforce plan staff limits BEFORE creating user (exclude company owner/admin)
    if (company) {
      const qb = this.employeeRepository
        .createQueryBuilder('employee')
        .leftJoin('employee.user', 'user')
        .where('employee.company.id = :companyId', { companyId: company.id });

      if (company.createdById) {
        qb.andWhere('(user.id IS NULL OR user.id != :createdById)', { createdById: company.createdById });
      }
      qb.andWhere('(user.role IS NULL OR user.role NOT IN (:...adminRoles))', {
        adminRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY_ADMIN],
      });

      const currentStaffCount = await qb.getCount();
      const planUser = currentUser || company.createdBy;
      assertStaffLimit(planUser, currentStaffCount);
    }

    // If a password is provided, auto-create (or reuse) a User that staff can log in with
    const resolvedAuthMethod = authMethod === 'pin' ? 'pin' : 'password';
    const staffPassword = password ?? (resolvedAuthMethod === 'pin' ? this.generateRandomPassword() : undefined);

    if (staffPassword && !user) {
      // Reuse existing user if one already exists for this phone
      const existingUser = await this.userRepository.findOne({ where: { phone: phoneToUse } });

      if (existingUser) {
        // Update the password on the existing user
        existingUser.password = staffPassword;
        existingUser.status = UserStatus.ACTIVE;
        if (role) existingUser.role = role;
        const nameParts = name.trim().split(/\s+/);
        if (nameParts[0]) existingUser.firstName = nameParts[0];
        if (nameParts.length > 1) existingUser.lastName = nameParts.slice(1).join(' ');
        if (company) {
          existingUser.company = company;
          existingUser.companyId = company.id;
        }
        user = await this.userRepository.save(existingUser);
      } else {
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        const newUser = this.userRepository.create({
          firstName,
          lastName,
          phone: phoneToUse,
          password: staffPassword,
          role: role || UserRole.USER,
          status: UserStatus.ACTIVE,
          isEmailVerified: false,
          ...(company ? { company, companyId: company.id } : {}),
        });
        user = await this.userRepository.save(newUser);
      }
    } else if (user && company) {
      // Link company to the existing staff user
      user.company = company;
      user.companyId = company.id;
      await this.userRepository.save(user);
    }
    
    let shop: Shop | null = null;
    if (shopId) {
      shop = await this.shopRepository.findOne({ where: { id: shopId } });
      if (!shop) throw new NotFoundException('Shop not found');
    }
    
    let warehouse: Warehouse | null = null;
    if (warehouseId) {
      warehouse = await this.warehouseRepository.findOne({ where: { id: warehouseId } });
      if (!warehouse) throw new NotFoundException('Warehouse not found');
    }

    const roleStr = String(createEmployeeDto.role || '').toLowerCase().trim();
    const jobTitleStr = String(createEmployeeDto.jobTitle || '').toLowerCase().trim();
    const isAdminRole =
      roleStr === 'company_admin' ||
      roleStr === 'admin' ||
      roleStr === 'super_admin' ||
      jobTitleStr === 'admin';

    let initialPermissions = this.buildInitialPermissions(createEmployeeDto);
    if (isAdminRole && company && (!initialPermissions.branchPermissions || Object.keys(initialPermissions.branchPermissions).length === 0)) {
      const companyShops = await this.shopRepository.find({ where: { company: { id: company.id } } });
      const companyWarehouses = await this.warehouseRepository.find({ where: { company: { id: company.id } } });
      const bPerms: Record<string, any> = {};
      companyShops.forEach((s) => { bPerms[s.id] = { shop: true, warehouse: false }; });
      companyWarehouses.forEach((w) => { bPerms[w.id] = { shop: false, warehouse: true }; });
      initialPermissions.branchPermissions = bPerms;
    }

    const employee = this.employeeRepository.create({
      name,
      phoneNumber: phoneToUse,
      baseCommissionRate: baseCommissionRate || 0,
      jobTitle,
      authMethod: resolvedAuthMethod,
      ...(resolvedAuthMethod === 'pin' && pin ? { pin: await this.hashPin(pin), assignedPin: pin } : {}),
      ...(resolvedAuthMethod === 'password' && password ? { assignedPassword: password } : {}),
      ...(user ? { user } : {}),
      ...(company ? { company } : {}),
      ...(shop ? { shop } : {}),
      ...(warehouse ? { warehouse } : {}),
      permissions: this.mergeBranchAssignment(
        initialPermissions,
        shop?.id,
        warehouse?.id,
      ),
    });
    
    const savedEmployee = await this.employeeRepository.save(employee);

    if (user) {
      await this.syncUserLocation(user, shop, warehouse);
    }

    const employeeWithRelations = await this.employeeRepository.findOne({
      where: { id: savedEmployee.id },
      relations: ['user', 'shop', 'warehouse', 'company']
    });
    await this.invalidateEmployeeCache();
    return this.mapToResponseDto(employeeWithRelations || savedEmployee, 0);
  }

  async findAll(query: EmployeeQueryDto, currentUser: any): Promise<PaginatedResult<EmployeeResponseDto>> {
    const companyId = query.companyId || currentUser?.companyId;
    if (!companyId) {
      return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    }

    const cacheKey = this.cacheService.generateKey(CACHE_KEYS.EMPLOYEE_LIST, companyId, JSON.stringify(query));
    const cached = await this.cacheService.get<PaginatedResult<EmployeeResponseDto>>(cacheKey);
    if (cached) return cached;

    const queryBuilder = this.createQueryBuilder();
    queryBuilder.andWhere('company.id = :companyId', { companyId });
    this.applyFilters(queryBuilder, query);

    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [employees, total] = await queryBuilder.getManyAndCount();

    const userIds = employees.map(e => e.user?.id).filter(Boolean);
    const salesMap = new Map<string, number>();
    if (userIds.length > 0) {
      const salesRepository = this.employeeRepository.manager.getRepository(Sales);
      const salesAmounts = await salesRepository
        .createQueryBuilder('sale')
        .select('sale.created_by', 'userId')
        .addSelect('SUM(sale.totalAmount)', 'sum')
        .where('sale.created_by IN (:...userIds)', { userIds })
        .groupBy('sale.created_by')
        .getRawMany();
      
      salesAmounts.forEach(row => {
        salesMap.set(row.userId, Number(row.sum) || 0);
      });
    }

    const result = {
      data: employees.map(employee => this.mapToResponseDto(employee, salesMap.get(employee.user?.id) || 0)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result, 300000);
    return result;
  }

  async findOne(id: string, currentUser: any): Promise<EmployeeResponseDto> {
    const employee = await this.employeeRepository.findOne({
      where: { id },
      relations: ['user', 'shop', 'warehouse', 'company'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (currentUser?.companyId && employee.company?.id !== currentUser.companyId) {
      throw new NotFoundException('Employee not found');
    }

    let salesAmount = 0;
    if (employee.user) {
      const salesRepository = this.employeeRepository.manager.getRepository(Sales);
      const saleResult = await salesRepository
        .createQueryBuilder('sale')
        .select('SUM(sale.totalAmount)', 'sum')
        .where('sale.created_by = :userId', { userId: employee.user.id })
        .getRawOne();
      salesAmount = Number(saleResult?.sum) || 0;
    }

    return this.mapToResponseDto(employee, salesAmount);
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto, currentUser: any): Promise<EmployeeResponseDto> {
    const employee = await this.employeeRepository.findOne({
      where: { id },
      relations: ['user', 'shop', 'warehouse', 'company'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (currentUser?.companyId && employee.company?.id !== currentUser.companyId) {
      throw new NotFoundException('Employee not found');
    }

    if (updateEmployeeDto.phoneNumber) {
      let norm = updateEmployeeDto.phoneNumber.replace(/\D/g, '');
      if (norm.startsWith('251')) {
        norm = '0' + norm.slice(3);
      } else if (/^[79]\d{8}$/.test(norm)) {
        norm = '0' + norm;
      }
      updateEmployeeDto.phoneNumber = norm;
    }

    // If employee name is updated, sync user firstName and lastName
    if (updateEmployeeDto.name) {
      employee.name = updateEmployeeDto.name;
      if (employee.user) {
        const nameParts = updateEmployeeDto.name.trim().split(/\s+/);
        employee.user.firstName = nameParts[0] || updateEmployeeDto.name;
        employee.user.lastName = nameParts.slice(1).join(' ');
        await this.userRepository.save(employee.user);
      }
    }

    // If a new password or role or phone is provided, update or create the linked user's account
    if (updateEmployeeDto.phoneNumber && employee.user) {
      employee.user.phone = updateEmployeeDto.phoneNumber;
      await this.userRepository.save(employee.user);
    }

    if (updateEmployeeDto.password || updateEmployeeDto.role) {
      if (employee.user) {
        if (updateEmployeeDto.password) employee.user.password = updateEmployeeDto.password;
        if (updateEmployeeDto.role) employee.user.role = updateEmployeeDto.role;
        employee.user.status = UserStatus.ACTIVE;
        await this.userRepository.save(employee.user);
      } else if (updateEmployeeDto.password) {
        const phone = updateEmployeeDto.phoneNumber || employee.phoneNumber;

        const existingUser = await this.userRepository.findOne({ where: { phone } });

        if (existingUser) {
          existingUser.password = updateEmployeeDto.password;
          existingUser.status = UserStatus.ACTIVE;
          if (updateEmployeeDto.role) existingUser.role = updateEmployeeDto.role;
          if (employee.company && !existingUser.companyId) {
            existingUser.companyId = employee.company.id;
          }
          employee.user = await this.userRepository.save(existingUser);
        } else {
          const empName = updateEmployeeDto.name || employee.name;
          const nameParts = empName.trim().split(/\s+/);
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');

          const newUser = this.userRepository.create({
            firstName,
            lastName,
            phone: phone,
            password: updateEmployeeDto.password,
            role: updateEmployeeDto.role || UserRole.USER,
            status: UserStatus.ACTIVE,
            isEmailVerified: false,
            ...(employee.company ? { company: employee.company } : {}),
          });
          employee.user = await this.userRepository.save(newUser);
        }
      }
    }

    // Preserve existing associations from employee before modification
    const existingShop = employee.shop;
    const existingWarehouse = employee.warehouse;
    const existingUser = employee.user;

    // Process and merge permissions payload if provided
    if (updateEmployeeDto.modulePermissions || updateEmployeeDto.branchPermissions || updateEmployeeDto.permissions || updateEmployeeDto.baseCommissionType) {
      let currentPerms = employee.permissions;
      if (typeof currentPerms === 'string') {
        try { currentPerms = JSON.parse(currentPerms); } catch (_) { currentPerms = {}; }
      }
      let incomingBranchPerms = updateEmployeeDto.branchPermissions;
      if (typeof incomingBranchPerms === 'string') {
        try { incomingBranchPerms = JSON.parse(incomingBranchPerms); } catch (_) { incomingBranchPerms = {}; }
      }
      let incomingPerms = updateEmployeeDto.permissions;
      if (typeof incomingPerms === 'string') {
        try { incomingPerms = JSON.parse(incomingPerms); } catch (_) { incomingPerms = {}; }
      }

      employee.permissions = {
        ...(currentPerms || {}),
        ...(incomingPerms || {}),
        ...(updateEmployeeDto.modulePermissions ? { modulePermissions: updateEmployeeDto.modulePermissions } : {}),
        ...(incomingBranchPerms ? { branchPermissions: incomingBranchPerms } : {}),
        ...(updateEmployeeDto.baseCommissionType ? { baseCommissionType: updateEmployeeDto.baseCommissionType } : {}),
      };
    }

    const empCommType = updateEmployeeDto.baseCommissionType || (employee.permissions as any)?.baseCommissionType || 'percent';
    const empCommRate = updateEmployeeDto.baseCommissionRate !== undefined ? updateEmployeeDto.baseCommissionRate : Number(employee.baseCommissionRate);
    if (empCommType === 'percent' && empCommRate > 100) {
      throw new BadRequestException('Base percentage commission rate cannot exceed 100%');
    }

    if (updateEmployeeDto.password) {
      employee.assignedPassword = updateEmployeeDto.password;
      employee.assignedPin = null;
    }
    if (updateEmployeeDto.pin) {
      employee.assignedPin = updateEmployeeDto.pin;
      employee.assignedPassword = null;
    } else if (updateEmployeeDto.authMethod === 'password') {
      employee.assignedPin = null;
    }

    if (updateEmployeeDto.authMethod) {
      employee.authMethod = updateEmployeeDto.authMethod;
    }
    if (updateEmployeeDto.pin) {
      employee.pin = await this.hashPin(updateEmployeeDto.pin);
      employee.authMethod = 'pin';
    } else if (updateEmployeeDto.authMethod === 'password') {
      employee.pin = null;
    }

    let activeShop = existingShop;
    let activeWarehouse = existingWarehouse;

    if (updateEmployeeDto.shopId !== undefined) {
      if (updateEmployeeDto.shopId) {
        const shop = await this.shopRepository.findOne({ where: { id: updateEmployeeDto.shopId } });
        if (!shop) throw new NotFoundException('Shop not found');
        employee.shop = shop;
        employee.warehouse = null;
        activeShop = shop;
        activeWarehouse = null;
      } else {
        employee.shop = null;
        activeShop = null;
      }
    }

    if (updateEmployeeDto.warehouseId !== undefined) {
      if (updateEmployeeDto.warehouseId) {
        const warehouse = await this.warehouseRepository.findOne({ where: { id: updateEmployeeDto.warehouseId } });
        if (!warehouse) throw new NotFoundException('Warehouse not found');
        employee.warehouse = warehouse;
        employee.shop = null;
        activeWarehouse = warehouse;
        activeShop = null;
      } else {
        employee.warehouse = null;
        activeWarehouse = null;
      }
    }

    // Strip non-column fields from the employee entity update
    const { password: _password, role: _role, modulePermissions: _mp, branchPermissions: _bp, permissions: _p, shopId: _shopId, warehouseId: _whId, authMethod: _am, pin: _pin, baseCommissionType: _bct, ...employeeData } = updateEmployeeDto as any;
    Object.assign(employee, employeeData);

    // Merge primary assigned shop / warehouse into branchPermissions
    if (activeShop || activeWarehouse) {
      employee.permissions = this.mergeBranchAssignment(
        employee.permissions || {},
        activeShop?.id ?? null,
        activeWarehouse?.id ?? null,
      );
    }

    const updatedEmployee = await this.employeeRepository.save(employee);
    updatedEmployee.shop = activeShop;
    updatedEmployee.warehouse = activeWarehouse;

    const userToSync = employee.user || existingUser;
    if (userToSync) {
      if (employee.company && userToSync.companyId !== employee.company.id) {
        userToSync.company = employee.company;
        userToSync.companyId = employee.company.id;
      }
      await this.syncUserLocation(userToSync, activeShop, activeWarehouse);
    }
    
    let salesAmount = 0;
    if (updatedEmployee.user) {
      const salesRepository = this.employeeRepository.manager.getRepository(Sales);
      const saleResult = await salesRepository
        .createQueryBuilder('sale')
        .select('SUM(sale.totalAmount)', 'sum')
        .where('sale.created_by = :userId', { userId: updatedEmployee.user.id })
        .getRawOne();
      salesAmount = Number(saleResult?.sum) || 0;
    }

    await this.invalidateEmployeeCache();
    await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.EMPLOYEE_DETAIL, id));
    return this.mapToResponseDto(updatedEmployee, salesAmount);
  }

  async remove(id: string, currentUser: any): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { id },
      relations: ['company'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (currentUser?.companyId && employee.company?.id !== currentUser.companyId) {
      throw new NotFoundException('Employee not found');
    }
    await this.employeeRepository.softDelete(id);
    await this.invalidateEmployeeCache();
    await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.EMPLOYEE_DETAIL, id));
  }

  private createQueryBuilder(): SelectQueryBuilder<Employee> {
    return this.employeeRepository.createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.shop', 'shop')
      .leftJoinAndSelect('employee.warehouse', 'warehouse')
      .leftJoinAndSelect('employee.company', 'company');
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Employee>, query: EmployeeQueryDto): void {
    if (query.search) {
      queryBuilder.andWhere('employee.name ILIKE :search OR user.fullName ILIKE :search OR shop.name ILIKE :search', { search: `%${query.search}%` });
    }
    queryBuilder.orderBy('employee.createdAt', 'DESC');
  }

  private mapToResponseDto(employee: Employee, salesAmount = 0): EmployeeResponseDto {
    const isOwner = !!employee.user?.id && !!employee.company?.createdById && employee.user.id === employee.company.createdById;
    let perms = employee.permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch (_) { perms = undefined; }
    }

    return {
      id: employee.id,
      companyId: employee.company?.id,
      name: employee.name,
      phoneNumber: employee.phoneNumber,
      baseCommissionRate: Number(employee.baseCommissionRate) || 0,
      baseCommissionType: (perms as any)?.baseCommissionType || 'percent',
      salesAmount: salesAmount,
      jobTitle: employee.jobTitle,
      role: employee.user?.role,
      userId: employee.user?.id,
      userFullName: employee.name,
      shopName: employee.shop?.name || '',
      warehouseName: employee.warehouse?.name || '',
      shopId: employee.shop?.id,
      warehouseId: employee.warehouse?.id,
      authMethod: employee.authMethod || 'password',
      assignedPassword: employee.assignedPassword || undefined,
      assignedPin: employee.assignedPin || undefined,
      permissions: perms || undefined,
      branchPermissions: perms?.branchPermissions || undefined,
      isOwner,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  private mergeBranchAssignment(
    permissions: Record<string, any>,
    shopId?: string | null,
    warehouseId?: string | null,
  ): Record<string, any> {
    const result = { ...permissions };
    const branchPermissions = { ...(result.branchPermissions || {}) };

    if (shopId) {
      branchPermissions[shopId] = { shop: true, warehouse: false };
    } else if (warehouseId) {
      branchPermissions[warehouseId] = { shop: false, warehouse: true };
    }

    result.branchPermissions = branchPermissions;
    return result;
  }

  private async syncUserLocation(user: User, shop: Shop | null | undefined, warehouse: Warehouse | null | undefined): Promise<void> {
    if (shop) {
      user.shopId = shop.id;
      user.warehouseId = null;
    } else if (warehouse) {
      user.warehouseId = warehouse.id;
      user.shopId = null;
    } else {
      user.shopId = null;
      user.warehouseId = null;
    }
    await this.userRepository.save(user);
  }

  private buildInitialPermissions(dto: {
    permissions?: Record<string, any>;
    modulePermissions?: Record<string, string>;
    branchPermissions?: Record<string, any>;
    role?: UserRole;
    jobTitle?: string;
  }): Record<string, any> {
    if (dto.permissions) {
      return dto.permissions;
    }

    const roleStr = String(dto.role || '').toLowerCase().trim();
    const jobTitleStr = String(dto.jobTitle || '').toLowerCase().trim();
    const isAdminRole =
      roleStr === 'company_admin' ||
      roleStr === 'admin' ||
      roleStr === 'super_admin' ||
      jobTitleStr === 'admin';

    if (isAdminRole) {
      const allModules: Record<string, string> = {
        'Stock In': 'edit',
        'Stock Out': 'edit',
        'Warehouse': 'view',
        'Shop/Store': 'view',
        'Branch': 'view',
        'Add Store': 'edit',
        'Add Shop': 'edit',
        'View Sales': 'view',
        'Create Sale': 'edit',
        'Edit Sale': 'edit',
        'View Credit': 'view',
        'Receive Credit Payment': 'edit',
        'View Products': 'view',
        'Add Product': 'edit',
        'Edit Product': 'edit',
        'Delete Product': 'edit',
        'Staff Management': 'edit',
        'Commission': 'edit',
        'Reports': 'view',
        'Settings': 'view',
        'Branch Transfers': 'edit',
        'Companies': 'edit',
        'Bank Accounts': 'edit',
        // CamelCase variants for web & API clients:
        'stockIn': 'edit',
        'stockOut': 'edit',
        'warehouse': 'view',
        'shopStore': 'view',
        'branch': 'view',
        'addStore': 'edit',
        'addShop': 'edit',
        'viewSales': 'view',
        'createSale': 'edit',
        'editSale': 'edit',
        'viewCredit': 'view',
        'receiveCreditPayment': 'edit',
        'viewProducts': 'view',
        'addProduct': 'edit',
        'editProduct': 'edit',
        'deleteProduct': 'edit',
        'staffManagement': 'edit',
        'commission': 'edit',
        'reports': 'view',
        'settings': 'view',
        'branchTransfers': 'edit',
        'companies': 'edit',
        'bankAccounts': 'edit',
      };
      return {
        modulePermissions: dto.modulePermissions ? { ...allModules, ...dto.modulePermissions } : allModules,
        ...(dto.branchPermissions ? { branchPermissions: dto.branchPermissions } : {}),
      };
    }

    const modulePermissions = dto.modulePermissions ?? { Settings: 'view' };
    const result: Record<string, any> = { modulePermissions };

    if (dto.branchPermissions) {
      result.branchPermissions = dto.branchPermissions;
    }

    return result;
  }

  private async hashPin(pin: string): Promise<string> {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    return bcrypt.hash(pin, rounds);
  }

  private generateRandomPassword(): string {
    return `pw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async invalidateEmployeeCache(): Promise<void> {
    const deletedCount = await this.cacheService.deletePattern(`${CACHE_KEYS.EMPLOYEE_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSES_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.SHOPS_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
    this.logger.debug(`Cleared ${deletedCount} employee cache entries and branch list caches`);
  }
}