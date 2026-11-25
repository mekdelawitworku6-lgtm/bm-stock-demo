import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { AdminAuditLog, AuditAction } from './entities/audit-log.entity';

export interface CreateAuditLogDto {
  entityType: string;
  entityId?: string;
  entityName?: string;
  action: AuditAction;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  module?: string;
  method?: string;
  endpoint?: string;
}

export interface AuditLogQueryDto {
  page?: number;
  limit?: number;
  userId?: string;
  role?: string;
  entityType?: string;
  action?: string;
  module?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class AuditLogsService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepository: Repository<AdminAuditLog>,
  ) {}

  async onModuleInit() {
    try {
      // 1. Ensure entityId column supports non-UUID identifiers (e.g. barcodes, SKUs, slugs)
      await this.auditLogRepository.query(`
        ALTER TABLE admin_audit_logs ALTER COLUMN "entityId" TYPE character varying(255);
      `);
    } catch {
      // Column may already be varchar(255)
    }

    try {
      // 2. Comprehensive multi-entity backfill for all existing system actions
      // Backfill User registrations & creations
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          u."createdAt",
          u."createdAt",
          'User',
          u.id::text,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email),
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email), ' registered as ', u.role::text),
          u."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email),
          u.email,
          u.role::text,
          'users',
          'POST'
        FROM users u
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'User' AND "entityId" = u.id::text AND action = 'create'
        );
      `);

      // Backfill User logins from lastLoginAt
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          u."lastLoginAt",
          u."lastLoginAt",
          'Auth',
          u.id::text,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email),
          'login'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email), ' logged in successfully'),
          u."lastLoginAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email),
          u.email,
          u.role::text,
          'auth',
          'POST'
        FROM users u
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE u."lastLoginAt" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM admin_audit_logs 
            WHERE "entityType" = 'Auth' AND user_id = u.id AND action = 'login' AND timestamp = u."lastLoginAt"
          );
      `);

      // Backfill Companies
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          c."createdAt",
          c."createdAt",
          'Company',
          c.id::text,
          c.name,
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Admin'), ' created company \'', c.name, '\''),
          c."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Company Admin'),
          u.email,
          COALESCE(u.role::text, 'company_admin'),
          'company',
          'POST'
        FROM companies c
        LEFT JOIN users u ON c."createdById" = u.id
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Company' AND "entityId" = c.id::text
        );
      `);

      // Backfill Warehouses
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          w."createdAt",
          w."createdAt",
          'Warehouse',
          w.id::text,
          w.name,
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Admin'), ' created warehouse \'', w.name, '\''),
          w."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Admin'),
          u.email,
          COALESCE(u.role::text, 'company_admin'),
          'warehouse',
          'POST'
        FROM warehouses w
        LEFT JOIN users u ON w."managerId" = u.id OR u.id = (SELECT "createdById" FROM companies WHERE id = w."companyId" LIMIT 1)
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Warehouse' AND "entityId" = w.id::text
        );
      `);

      // Backfill Shops
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          s."createdAt",
          s."createdAt",
          'Shop',
          s.id::text,
          s.name,
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Admin'), ' created shop \'', s.name, '\''),
          s."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Admin'),
          u.email,
          COALESCE(u.role::text, 'company_admin'),
          'shops',
          'POST'
        FROM shops s
        LEFT JOIN users u ON s."ownerId" = u.id OR u.id = (SELECT "createdById" FROM companies WHERE id = s."companyId" LIMIT 1)
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Shop' AND "entityId" = s.id::text
        );
      `);

      // Backfill Products
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          p."createdAt",
          p."createdAt",
          'Product',
          p.id::text,
          p.name,
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Admin'), ' created product \'', p.name, '\''),
          p."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Admin'),
          u.email,
          COALESCE(u.role::text, 'company_admin'),
          'products',
          'POST'
        FROM products p
        LEFT JOIN users u ON p."createdById" = u.id OR u.id = (SELECT "createdById" FROM companies WHERE id = p."companyId" LIMIT 1)
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Product' AND "entityId" = p.id::text
        );
      `);

      // Backfill Customers
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          c."createdAt",
          c."createdAt",
          'Customer',
          c.id::text,
          c.name,
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User'), ' added customer \'', c.name, '\''),
          c."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User'),
          u.email,
          COALESCE(u.role::text, 'user'),
          'customer',
          'POST'
        FROM customers c
        LEFT JOIN users u ON u.id = (SELECT "createdById" FROM companies WHERE id = c."companyId" LIMIT 1)
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Customer' AND "entityId" = c.id::text
        );
      `);

      // Backfill Employees
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          emp."createdAt",
          emp."createdAt",
          'Employee',
          emp.id::text,
          emp.name,
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(adminU."firstName", ' ', adminU."lastName")), ''), adminU.email, 'Company Admin'), ' added staff employee \'', emp.name, '\' (', COALESCE(emp."jobTitle", 'Staff'), ')'),
          emp."createdAt",
          adminU.id,
          COALESCE(NULLIF(TRIM(CONCAT(adminU."firstName", ' ', adminU."lastName")), ''), adminU.email, 'Company Admin'),
          adminU.email,
          COALESCE(adminU.role::text, 'company_admin'),
          'users',
          'POST'
        FROM employees emp
        LEFT JOIN users adminU ON adminU.id = (SELECT "createdById" FROM companies WHERE id = emp."companyId" LIMIT 1)
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Employee' AND "entityId" = emp.id::text
        );
      `);

      // Backfill Transfers
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          t."createdAt",
          t."createdAt",
          'Transfer',
          t.id::text,
          CONCAT('Transfer of ', t.quantity, ' items'),
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User'), ' initiated transfer of ', t.quantity, ' units (Status: ', t.status, ')'),
          t."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User'),
          u.email,
          COALESCE(u.role::text, 'user'),
          'transfer',
          'POST'
        FROM transfers t
        LEFT JOIN users u ON t.requested_by_id = u.id OR t.approved_by_id = u.id
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Transfer' AND "entityId" = t.id::text
        );
      `);

      // Backfill Product Borrowings
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          b."createdAt",
          b."createdAt",
          'Borrowing',
          b.id::text,
          b.product_name,
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User'), ' recorded borrowing of ', b.quantity_taken, ' units of ', b.product_name),
          b."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User'),
          u.email,
          COALESCE(u.role::text, 'user'),
          'borrowing',
          'POST'
        FROM product_borrowings b
        LEFT JOIN users u ON b.recorded_by_id = u.id
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Borrowing' AND "entityId" = b.id::text
        );
      `);

      // Backfill Inventory Transactions
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          it."createdAt",
          it."createdAt",
          'Inventory',
          it.id::text,
          CONCAT(it.type, ' (', it.quantity, ')'),
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Staff'), ' performed ', it.type, ' of ', it.quantity, ' items'),
          it."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Staff'),
          u.email,
          COALESCE(u.role::text, 'user'),
          'inventory',
          'POST'
        FROM inventory_transactions it
        LEFT JOIN users u ON it.performed_by = u.id
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Inventory' AND "entityId" = it.id::text
        );
      `);

      // Backfill Sales from sales table
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          s."createdAt",
          s."createdAt",
          'Sale',
          s.id::text,
          COALESCE(s."invoiceNumber", CONCAT('Sale #', s.id::text)),
          'create'::admin_audit_logs_action_enum,
          CONCAT(
            COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Staff User'),
            ' completed sale ',
            COALESCE(s."invoiceNumber", ''),
            ' (Amount: ',
            s."totalAmount"::text,
            ' ETB, Payment: ',
            s."paymentType"::text,
            ')'
          ),
          s."createdAt",
          u.id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'Staff User'),
          u.email,
          COALESCE(u.role::text, 'user'),
          'sales',
          'POST'
        FROM sales s
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'Sale' AND "entityId" = s.id::text
        );
      `);

      // Backfill from existing audit_logs table (e.g. historical sales actions)
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          al."createdAt",
          al."createdAt",
          al."entityType",
          al."entityId"::text,
          CONCAT(al."entityType", ' ', COALESCE(al."entityId"::text, '')),
          al.action::text::admin_audit_logs_action_enum,
          COALESCE(
            al.description,
            CONCAT(COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User'), ' performed ', al.action, ' on ', al."entityType")
          ),
          al.timestamp,
          al.user_id,
          COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User'),
          u.email,
          COALESCE(u.role::text, 'user'),
          LOWER(al."entityType"),
          'POST'
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = al."entityType" AND "entityId" = al."entityId"::text AND action = al.action::text::admin_audit_logs_action_enum
        );
      `);

      // Backfill Issue Reports (table stores userName/userEmail directly, no FK)
      await this.auditLogRepository.query(`
        INSERT INTO admin_audit_logs (
          id, "createdAt", "updatedAt", "entityType", "entityId", "entityName", 
          action, description, timestamp, user_id, "userName", "userEmail", "userRole", module, method
        )
        SELECT 
          gen_random_uuid(),
          ir."createdAt",
          ir."createdAt",
          'IssueReport',
          ir.id::text,
          ir.title,
          'create'::admin_audit_logs_action_enum,
          CONCAT(COALESCE(ir."userName", ir."userEmail", 'User'), ' submitted issue report: ', ir.title),
          ir."createdAt",
          u.id,
          COALESCE(ir."userName", NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), u.email, 'User'),
          COALESCE(ir."userEmail", u.email),
          COALESCE(u.role::text, 'user'),
          'issue-reports',
          'POST'
        FROM issue_reports ir
        LEFT JOIN users u ON ir."userEmail" = u.email
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_audit_logs 
          WHERE "entityType" = 'IssueReport' AND "entityId" = ir.id::text
        );
      `);

      // 3. Fix missing user details where user_id is matched
      await this.auditLogRepository.query(`
        UPDATE admin_audit_logs a
        SET 
          "userName" = COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, a."userName"),
          "userEmail" = COALESCE(u.email, a."userEmail"),
          "userRole" = COALESCE(u.role::text, a."userRole")
        FROM users u
        LEFT JOIN employees e ON e."userId" = u.id
        WHERE a.user_id = u.id;
      `);

      this.logger.log('Audit logs system initialized with complete multi-user history.');
    } catch (err: any) {
      this.logger.warn(`Audit backfill notice: ${err?.message || err}`);
    }
  }

  /**
   * Create an audit log entry safely
   */
  async create(dto: CreateAuditLogDto): Promise<AdminAuditLog> {
    try {
      let validUserId = dto.userId;
      if (validUserId) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(validUserId)) {
          validUserId = undefined;
        } else {
          // Verify user exists in users table to prevent FK constraint failure
          try {
            const userExists = await this.auditLogRepository.query(
              `SELECT 1 FROM users WHERE id = $1 LIMIT 1`,
              [validUserId]
            );
            if (!userExists || userExists.length === 0) {
              validUserId = undefined;
            }
          } catch {
            validUserId = undefined;
          }
        }
      }

      const auditLog = this.auditLogRepository.create({
        ...dto,
        userId: validUserId,
        timestamp: new Date(),
      });
      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.warn(`Failed to create audit log: ${error?.message || error}`);
      return null;
    }
  }

  /**
   * Find all audit logs with pagination, filtering, and search
   */
  async findAll(query: AuditLogQueryDto): Promise<{
    data: AdminAuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 25,
      userId,
      role,
      entityType,
      action,
      module: moduleName,
      search,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
    } = query;

    const qb = this.auditLogRepository.createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user');

    if (userId && userId !== 'ALL') {
      qb.andWhere('audit.user_id = :userId', { userId });
    }

    if (role && role !== 'ALL') {
      if (role === 'user' || role === 'staff') {
        qb.andWhere('(audit.userRole IN (:...userRoles) OR audit.userRole ILIKE :userPattern)', {
          userRoles: ['user', 'staff', 'shop_employee', 'warehouse_employee'],
          userPattern: '%staff%',
        });
      } else if (role === 'company_admin') {
        qb.andWhere('audit.userRole ILIKE :cadmin', { cadmin: '%company_admin%' });
      } else if (role === 'super_admin') {
        qb.andWhere('audit.userRole ILIKE :sadmin', { sadmin: '%super_admin%' });
      } else {
        qb.andWhere('audit.userRole ILIKE :role', { role: `%${role}%` });
      }
    }

    if (entityType && entityType !== 'ALL') {
      qb.andWhere('LOWER(audit.entityType) = :entityType', { entityType: entityType.toLowerCase() });
    }

    if (action && action !== 'ALL') {
      qb.andWhere('LOWER(audit.action) = :action', { action: action.toLowerCase() });
    }

    if (moduleName && moduleName !== 'ALL') {
      qb.andWhere('LOWER(audit.module) = :moduleName', { moduleName: moduleName.toLowerCase() });
    }

    if (startDate && endDate) {
      qb.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate + 'T23:59:59.999Z'),
      });
    } else if (startDate) {
      qb.andWhere('audit.timestamp >= :startDate', { startDate: new Date(startDate) });
    } else if (endDate) {
      qb.andWhere('audit.timestamp <= :endDate', { endDate: new Date(endDate + 'T23:59:59.999Z') });
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(audit.description ILIKE :term OR audit.userName ILIKE :term OR audit.userEmail ILIKE :term OR audit.entityName ILIKE :term OR audit.entityType ILIKE :term OR audit.module ILIKE :term OR audit.userRole ILIKE :term OR audit.endpoint ILIKE :term)',
        { term },
      );
    }

    // Sorting
    const allowedSortFields = ['timestamp', 'action', 'entityType', 'userName', 'createdAt', 'module'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';
    qb.orderBy(`audit.${safeSortBy}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single audit log by ID
   */
  async findOne(id: string): Promise<AdminAuditLog> {
    return this.auditLogRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  /**
   * Get audit log summary stats
   */
  async getStats(): Promise<{
    totalLogs: number;
    todayLogs: number;
    uniqueUsers: number;
    actionBreakdown: Record<string, number>;
    moduleBreakdown: Record<string, number>;
    userBreakdown: Array<{ name: string; email: string; role: string; count: number }>;
    recentActivity: AdminAuditLog[];
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, uniqueUsersResult, actionBreakdown, moduleBreakdown, userBreakdown, recentActivity] = await Promise.all([
      this.auditLogRepository.count(),
      this.auditLogRepository.count({
        where: { timestamp: MoreThanOrEqual(todayStart) },
      }),
      this.auditLogRepository
        .createQueryBuilder('audit')
        .select('COUNT(DISTINCT audit.user_id)', 'count')
        .where('audit.user_id IS NOT NULL')
        .getRawOne(),
      this.auditLogRepository
        .createQueryBuilder('audit')
        .select('audit.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.action')
        .getRawMany(),
      this.auditLogRepository
        .createQueryBuilder('audit')
        .select('audit.module', 'module')
        .addSelect('COUNT(*)', 'count')
        .where('audit.module IS NOT NULL')
        .groupBy('audit.module')
        .getRawMany(),
      this.auditLogRepository
        .createQueryBuilder('audit')
        .select('COALESCE(audit.userName, \'Unknown\')', 'name')
        .addSelect('COALESCE(audit.userEmail, \'\')', 'email')
        .addSelect('COALESCE(audit.userRole, \'user\')', 'role')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.userName')
        .addGroupBy('audit.userEmail')
        .addGroupBy('audit.userRole')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
      this.auditLogRepository.find({
        order: { timestamp: 'DESC' },
        take: 10,
        relations: ['user'],
      }),
    ]);

    return {
      totalLogs,
      todayLogs,
      uniqueUsers: parseInt(uniqueUsersResult?.count || '0'),
      actionBreakdown: actionBreakdown.reduce((acc, item) => {
        acc[item.action] = parseInt(item.count);
        return acc;
      }, {} as Record<string, number>),
      moduleBreakdown: moduleBreakdown.reduce((acc, item) => {
        acc[item.module || 'unknown'] = parseInt(item.count);
        return acc;
      }, {} as Record<string, number>),
      userBreakdown: userBreakdown.map((u) => ({
        name: u.name,
        email: u.email,
        role: u.role,
        count: parseInt(u.count),
      })),
      recentActivity,
    };
  }

  /**
   * Get all users for filtering
   */
  async getUsers(): Promise<Array<{ id: string; name: string; email: string; role: string; actionCount: number }>> {
    const raw = await this.auditLogRepository.query(`
      SELECT 
        u.id, 
        COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), e.name, u.email, 'User') as name,
        COALESCE(u.email, e."phoneNumber", '') as email,
        CASE 
          WHEN u.role = 'user' AND e."jobTitle" IS NOT NULL AND e."jobTitle" != '' THEN e."jobTitle"
          WHEN u.role = 'user' THEN 'Staff'
          ELSE u.role::text 
        END as role,
        COUNT(a.id)::int as "actionCount"
      FROM users u
      LEFT JOIN employees e ON e."userId" = u.id
      LEFT JOIN admin_audit_logs a ON a.user_id = u.id
      GROUP BY u.id, u."firstName", u."lastName", e.name, e."phoneNumber", e."jobTitle", u.email, u.role
      ORDER BY "actionCount" DESC, name ASC;
    `);
    return raw;
  }

  /**
   * Get all audit logs for a specific user
   */
  async findByUser(userId: string, query: AuditLogQueryDto): Promise<{
    data: AdminAuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.findAll({ ...query, userId });
  }

  /**
   * Export audit logs with filters up to 10000 records
   */
  async export(query: AuditLogQueryDto): Promise<AdminAuditLog[]> {
    const result = await this.findAll({
      ...query,
      page: 1,
      limit: Math.min(query.limit || 5000, 10000),
    });
    return result.data;
  }

  /**
   * Get all distinct entity types in the system
   */
  async getEntityTypes(): Promise<string[]> {
    const result = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('DISTINCT audit.entityType', 'entityType')
      .where('audit.entityType IS NOT NULL')
      .getRawMany();
    return result.map(r => r.entityType).filter(Boolean);
  }

  /**
   * Get all distinct modules in the system
   */
  async getModules(): Promise<string[]> {
    const result = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('DISTINCT audit.module', 'module')
      .where('audit.module IS NOT NULL')
      .getRawMany();
    return result.map(r => r.module).filter(Boolean);
  }
}
