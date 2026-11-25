import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { unlink } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { CACHE_KEYS } from '@/common/constants/cache.constant';
import { UserRole } from '@/common/enums';
import { CacheService } from '@/shared/cache/cache.service';
import { User } from '../entities/user.entity';

export interface PurgeResult {
  userId: string;
  deletedCompanyIds: string[];
  removedFileCount: number;
}

interface PurgeContext {
  userId: string;
  companyIds: string[];
}

interface PurgeStep {
  label: string;
  sql: string;
  args: (ctx: PurgeContext) => unknown[];
  optional?: boolean;
}

const MISSING_SCHEMA_CODES = new Set(['42P01', '42703', '42704', '3F000', '42P07']);
const SKIP_CODES = new Set([...MISSING_SCHEMA_CODES, '23503', '23502']);

const PLATFORM_ADMIN_ROLES = new Set<string>([UserRole.SUPER_ADMIN, UserRole.ADMIN]);

@Injectable()
export class UserPurgeService {
  private readonly logger = new Logger(UserPurgeService.name);
  private readonly uploadsDir = resolve(process.cwd(), 'uploads');

  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {}

  async findOwnedCompanyIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      'SELECT id FROM companies WHERE "createdById" = $1::uuid',
      [userId],
    );
    const ids = rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) {
      const userRows = await this.dataSource.query(
        'SELECT "companyId" FROM users WHERE id = $1::uuid AND role = $2',
        [userId, UserRole.COMPANY_ADMIN],
      );
      if (userRows.length > 0 && userRows[0].companyId) {
        return [userRows[0].companyId];
      }
    }
    return ids;
  }

  assertDeletable(target: User): void {
    if (PLATFORM_ADMIN_ROLES.has(target.role)) {
      throw new ForbiddenException(
        'Platform administrator accounts cannot be deleted from the app',
      );
    }
  }

  async purgeMember(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const steps: PurgeStep[] = [
        {
          label: 'users.shopId',
          sql: 'UPDATE users SET "shopId" = NULL WHERE id = $1::uuid',
          args: () => [userId],
        },
        {
          label: 'users.warehouseId',
          sql: 'UPDATE users SET "warehouseId" = NULL WHERE id = $1::uuid',
          args: () => [userId],
        },
        {
          label: 'audit_logs.user_id',
          sql: 'UPDATE audit_logs SET "user_id" = NULL WHERE "user_id" = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'admin_audit_logs.user_id',
          sql: 'UPDATE admin_audit_logs SET "user_id" = NULL WHERE "user_id" = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'credit_payments.received_by',
          sql: 'UPDATE credit_payments SET received_by = NULL WHERE received_by = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'inventory_transactions.performed_by',
          sql: 'UPDATE inventory_transactions SET performed_by = NULL WHERE performed_by = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'payment_transactions.processed_by',
          sql: 'UPDATE payment_transactions SET processed_by = NULL WHERE processed_by = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'products.createdById',
          sql: 'UPDATE products SET "createdById" = NULL WHERE "createdById" = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'sales.created_by',
          sql: 'UPDATE sales SET created_by = NULL WHERE created_by = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'shops.ownerId',
          sql: 'UPDATE shops SET "ownerId" = NULL WHERE "ownerId" = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'transfers.approved_by_id',
          sql: 'UPDATE transfers SET approved_by_id = NULL WHERE approved_by_id = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'transfers.requested_by_id',
          sql: 'UPDATE transfers SET requested_by_id = NULL WHERE requested_by_id = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'warehouses.managerId',
          sql: 'UPDATE warehouses SET "managerId" = NULL WHERE "managerId" = $1::uuid',
          args: () => [userId],
        },
        {
          label: 'employees.userId',
          sql: 'UPDATE employees SET "userId" = NULL WHERE "userId" = $1::uuid',
          args: () => [userId],
        },
        {
          label: 'commissions.approvedBy',
          sql: 'UPDATE commissions SET "approvedBy" = NULL WHERE "approvedBy" = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'product_borrowings.recorded_by_id',
          sql: 'UPDATE product_borrowings SET recorded_by_id = NULL WHERE recorded_by_id = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'notifications.userId',
          sql: 'DELETE FROM notifications WHERE "userId" = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'device_tokens.userId',
          sql: 'DELETE FROM device_tokens WHERE "userId" = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'company_limit_attempts.userId',
          sql: 'DELETE FROM company_limit_attempts WHERE "userId" = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'users.companyId',
          sql: 'UPDATE users SET "companyId" = NULL WHERE id = $1::uuid',
          args: () => [userId],
          optional: true,
        },
        {
          label: 'users',
          sql: 'DELETE FROM users WHERE id = $1::uuid',
          args: () => [userId],
          optional: true,
        },
      ];

      for (const step of steps) {
        await this.run(manager, step, { userId, companyIds: [] });
      }

      // Final delete: if FK constraints still block it, anonymize the row instead of failing
      try {
        await manager.query('DELETE FROM users WHERE id = $1::uuid', [userId]);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === '23503') {
          this.logger.warn(`User ${userId} still referenced by FK constraints; anonymizing instead of deleting`);
          await manager.query(
            `UPDATE users SET
              email = 'deleted-' || id || '@deleted.local',
              "firstName" = 'Deleted',
              "lastName" = 'User',
              phone = NULL,
              password = 'deleted',
              avatar = NULL,
              "refreshToken" = NULL,
              pin = NULL,
              "companyId" = NULL,
              "shopId" = NULL,
              "warehouseId" = NULL,
              "paymentScreenshot" = NULL,
              status = 'INACTIVE'
            WHERE id = $1::uuid`,
            [userId],
          );
        } else {
          throw error;
        }
      }
    });
  }

  async purgeAccount(target: User): Promise<PurgeResult> {
    this.assertDeletable(target);

    const companyIds = await this.findOwnedCompanyIds(target.id);
    if (companyIds.length === 0) {
      await this.purgeMember(target.id);
      return { userId: target.id, deletedCompanyIds: [], removedFileCount: 0 };
    }

    const ctx: PurgeContext = { userId: target.id, companyIds };
    const files = await this.dataSource.transaction(async (manager) => {
      const catalogue = await this.snapshotCatalogue(manager);
      const { captures, deletes } = this.buildSteps();
      for (const step of captures) {
        await this.run(manager, step, ctx);
      }
      await this.assertNoCrossTenantBlockers(manager, ctx);
      for (const step of deletes) {
        await this.run(manager, step, ctx);
      }
      await this.verify(manager, ctx, catalogue);
      return await this.collectFiles(manager, ctx);
    });

    const removedFileCount = await this.removeFiles(files);
    await this.invalidateCaches();

    this.logger.log(
      `Account purge committed for user ${target.id}: ${companyIds.length} company/companies, ${removedFileCount} file(s) removed`,
    );

    return { userId: target.id, deletedCompanyIds: companyIds, removedFileCount };
  }

  private buildSteps(): { captures: PurgeStep[]; deletes: PurgeStep[] } {
    const captures: PurgeStep[] = [
      {
        label: 'capture users',
        sql: `CREATE TEMP TABLE _pg_users ON COMMIT DROP AS
SELECT u.id,
       lower(btrim(u.email)) AS email_key,
       NULLIF(regexp_replace(btrim(u.phone), '\\D', '', 'g'), '') AS phone_key,
       lower(regexp_replace(btrim(concat_ws(' ', u."firstName", u."lastName")), '\\s+', ' ', 'g')) AS name_key
FROM users u
WHERE u."companyId" = ANY($2::uuid[]) OR u.id = $1::uuid`,
        args: (c) => [c.userId, c.companyIds],
      },
      {
        label: 'capture companies',
        sql: `CREATE TEMP TABLE _pg_companies ON COMMIT DROP AS
SELECT c.id, lower(btrim(c.name)) AS name_key FROM companies c WHERE c.id = ANY($1::uuid[])`,
        args: (c) => [c.companyIds],
      },
      {
        label: 'capture warehouses',
        sql: 'CREATE TEMP TABLE _pg_warehouses ON COMMIT DROP AS SELECT w.id FROM warehouses w WHERE w."companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
      },
      {
        label: 'capture shops',
        sql: 'CREATE TEMP TABLE _pg_shops ON COMMIT DROP AS SELECT s.id FROM shops s WHERE s."companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
      },
      {
        label: 'capture branches',
        sql: 'CREATE TEMP TABLE _pg_branches ON COMMIT DROP AS SELECT b.id FROM branches b WHERE b."companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'capture employees',
        sql: `CREATE TEMP TABLE _pg_employees ON COMMIT DROP AS
SELECT e.id FROM employees e
WHERE e."companyId" = ANY($2::uuid[])
   OR e."userId" IN (SELECT u.id FROM users u WHERE u."companyId" = ANY($2::uuid[]) OR u.id = $1::uuid)`,
        args: (c) => [c.userId, c.companyIds],
      },
      {
        label: 'capture products',
        sql: 'CREATE TEMP TABLE _pg_products ON COMMIT DROP AS SELECT p.id FROM products p WHERE p."companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'capture customers',
        sql: 'CREATE TEMP TABLE _pg_customers ON COMMIT DROP AS SELECT c.id FROM customers c WHERE c."companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
      },
      {
        label: 'capture suppliers',
        sql: 'CREATE TEMP TABLE _pg_suppliers ON COMMIT DROP AS SELECT s.id FROM suppliers s WHERE s."companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'capture product groups',
        sql: 'CREATE TEMP TABLE _pg_product_groups ON COMMIT DROP AS SELECT g.id FROM product_groups g WHERE g."companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'capture sales',
        sql: `CREATE TEMP TABLE _pg_sales ON COMMIT DROP AS
SELECT s.id FROM sales s
WHERE s."warehouseId" IN (SELECT id FROM _pg_warehouses)
   OR s.shop_id      IN (SELECT id FROM _pg_shops)
   OR s.branch_id    IN (SELECT id FROM _pg_branches)
   OR s.created_by   IN (SELECT id FROM _pg_users)`,
        args: () => [],
      },
      {
        label: 'capture credit accounts',
        sql: `CREATE TEMP TABLE _pg_credit_accounts ON COMMIT DROP AS
SELECT ca.id FROM credit_accounts ca
WHERE ca.company_id = ANY($1::uuid[])
   OR ca.customer_id IN (SELECT id FROM _pg_customers)
   OR ca.sale_id     IN (SELECT id FROM _pg_sales)`,
        args: (c) => [c.companyIds],
        optional: true,
      },
    ];

    const deletes: PurgeStep[] = [
      {
        label: 'detach users from locations',
        sql: 'UPDATE users SET "shopId" = NULL WHERE "shopId" IN (SELECT id FROM _pg_shops)',
        args: () => [],
      },
      {
        label: 'detach users from warehouses',
        sql: 'UPDATE users SET "warehouseId" = NULL WHERE "warehouseId" IN (SELECT id FROM _pg_warehouses)',
        args: () => [],
      },
      {
        label: 'repair cross-tenant warehouse_products',
        sql: 'UPDATE warehouse_products SET "productId" = NULL WHERE "productId" IN (SELECT id FROM _pg_products) AND "warehouseId" NOT IN (SELECT id FROM _pg_warehouses)',
        args: () => [],
        optional: true,
      },
      {
        label: 'repair cross-tenant shop_products',
        sql: 'UPDATE shop_products SET "productId" = NULL WHERE "productId" IN (SELECT id FROM _pg_products) AND "shopId" NOT IN (SELECT id FROM _pg_shops)',
        args: () => [],
        optional: true,
      },
      {
        label: 'repair cross-tenant sales_items',
        sql: 'UPDATE sales_items SET product_id = NULL WHERE product_id IN (SELECT id FROM _pg_products) AND sales_id NOT IN (SELECT id FROM _pg_sales)',
        args: () => [],
        optional: true,
      },
      {
        label: 'repair cross-tenant commissions (productId)',
        sql: 'UPDATE commissions SET "productId" = NULL WHERE "productId" IN (SELECT id FROM _pg_products) AND "saleId" NOT IN (SELECT id FROM _pg_sales) AND "employeeId" NOT IN (SELECT id FROM _pg_employees)',
        args: () => [],
        optional: true,
      },
      {
        label: 'repair cross-tenant commissions (saleId)',
        sql: 'UPDATE commissions SET "saleId" = NULL WHERE "saleId" IN (SELECT id FROM _pg_sales) AND "productId" NOT IN (SELECT id FROM _pg_products) AND "employeeId" NOT IN (SELECT id FROM _pg_employees)',
        args: () => [],
        optional: true,
      },
      {
        label: 'repair cross-tenant commissions (employeeId)',
        sql: 'UPDATE commissions SET "employeeId" = NULL WHERE "employeeId" IN (SELECT id FROM _pg_employees) AND "saleId" NOT IN (SELECT id FROM _pg_sales) AND "productId" NOT IN (SELECT id FROM _pg_products)',
        args: () => [],
        optional: true,
      },
      {
        label: 'repair cross-tenant credit_accounts',
        sql: 'UPDATE credit_accounts SET sale_id = NULL WHERE sale_id IN (SELECT id FROM _pg_sales) AND (company_id IS NULL OR company_id <> ALL($1::uuid[]))',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete payment_transactions',
        sql: 'DELETE FROM payment_transactions WHERE sale_id IN (SELECT id FROM _pg_sales)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete credit_payments',
        sql: 'DELETE FROM credit_payments WHERE credit_account_id IN (SELECT id FROM _pg_credit_accounts)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete credit_transactions',
        sql: 'DELETE FROM credit_transactions WHERE credit_account_id IN (SELECT id FROM _pg_credit_accounts)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete sales_items',
        sql: 'DELETE FROM sales_items WHERE sales_id IN (SELECT id FROM _pg_sales)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete commissions',
        sql: `DELETE FROM commissions
WHERE "saleId" IN (SELECT id FROM _pg_sales)
   OR "productId" IN (SELECT id FROM _pg_products)
   OR "employeeId" IN (SELECT id FROM _pg_employees)`,
        args: () => [],
        optional: true,
      },
      {
        label: 'anonymize audit_logs',
        sql: `UPDATE audit_logs
SET "user_id" = NULL, "ipAddress" = NULL, "userAgent" = NULL,
    "oldValues" = NULL, "newValues" = NULL, "description" = NULL
WHERE "user_id" IN (SELECT id FROM _pg_users)
   OR "entityId" IN (SELECT id FROM _pg_sales)
   OR "entityId" IN (SELECT id FROM _pg_users)`,
        args: () => [],
        optional: true,
      },
      {
        label: 'delete credit_accounts',
        sql: `DELETE FROM credit_accounts
WHERE company_id = ANY($1::uuid[])
   OR customer_id IN (SELECT id FROM _pg_customers)
   OR sale_id     IN (SELECT id FROM _pg_sales)`,
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete sales',
        sql: `DELETE FROM sales
WHERE "warehouseId" IN (SELECT id FROM _pg_warehouses)
   OR shop_id      IN (SELECT id FROM _pg_shops)
   OR branch_id    IN (SELECT id FROM _pg_branches)
   OR created_by   IN (SELECT id FROM _pg_users)`,
        args: () => [],
      },
      {
        label: 'delete inventory_transactions',
        sql: `DELETE FROM inventory_transactions
WHERE product_id   IN (SELECT id FROM _pg_products)
   OR warehouse_id IN (SELECT id FROM _pg_warehouses)
   OR shop_id      IN (SELECT id FROM _pg_shops)`,
        args: () => [],
        optional: true,
      },
      {
        label: 'delete transfers',
        sql: `DELETE FROM transfers
WHERE from_warehouse_id IN (SELECT id FROM _pg_warehouses)
   OR to_warehouse_id   IN (SELECT id FROM _pg_warehouses)
   OR from_shop_id      IN (SELECT id FROM _pg_shops)
   OR to_shop_id        IN (SELECT id FROM _pg_shops)
   OR product_id        IN (SELECT id FROM _pg_products)
   OR requested_by_id   IN (SELECT id FROM _pg_users)`,
        args: () => [],
        optional: true,
      },
      {
        label: 'delete product_borrowings',
        sql: 'DELETE FROM product_borrowings WHERE company_id = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete device_tokens',
        sql: 'DELETE FROM device_tokens WHERE "userId" IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete notifications',
        sql: 'DELETE FROM notifications WHERE "userId" IN (SELECT id FROM _pg_users) OR "companyId" = ANY($1::text[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete company_limit_attempts',
        sql: 'DELETE FROM company_limit_attempts WHERE "userId" IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete bank_expenses',
        sql: `DELETE FROM bank_expenses
WHERE "companyId" = ANY($1::uuid[])
   OR "bankAccountId" IN (SELECT ba.id FROM bank_accounts ba WHERE ba."companyId" = ANY($1::uuid[]))`,
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete bank_accounts',
        sql: 'DELETE FROM bank_accounts WHERE "companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete employees',
        sql: 'DELETE FROM employees WHERE "companyId" = ANY($1::uuid[]) OR "userId" IN (SELECT id FROM _pg_users)',
        args: (c) => [c.companyIds],
      },
      {
        label: 'delete warehouse_products',
        sql: 'DELETE FROM warehouse_products WHERE "warehouseId" IN (SELECT id FROM _pg_warehouses)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete shop_products',
        sql: 'DELETE FROM shop_products WHERE "shopId" IN (SELECT id FROM _pg_shops)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete product_group_products',
        sql: 'DELETE FROM product_group_products WHERE group_id IN (SELECT id FROM _pg_product_groups) OR product_id IN (SELECT id FROM _pg_products)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete discount_products',
        sql: 'DELETE FROM discount_products WHERE product_id IN (SELECT id FROM _pg_products)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete discount_customers',
        sql: 'DELETE FROM discount_customers WHERE customer_id IN (SELECT id FROM _pg_customers)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete customers',
        sql: 'DELETE FROM customers WHERE "companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
      },
      {
        label: 'delete products',
        sql: 'DELETE FROM products WHERE "companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete shops',
        sql: 'DELETE FROM shops WHERE "companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
      },
      {
        label: 'delete warehouses',
        sql: 'DELETE FROM warehouses WHERE "companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
      },
      {
        label: 'delete branches',
        sql: 'DELETE FROM branches WHERE "companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete suppliers',
        sql: 'DELETE FROM suppliers WHERE "companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'delete product_groups',
        sql: 'DELETE FROM product_groups WHERE "companyId" = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
        optional: true,
      },
      {
        label: 'detach products.createdById',
        sql: 'UPDATE products SET "createdById" = NULL WHERE "createdById" IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach shops.ownerId',
        sql: 'UPDATE shops SET "ownerId" = NULL WHERE "ownerId" IN (SELECT id FROM _pg_users)',
        args: () => [],
      },
      {
        label: 'detach warehouses.managerId',
        sql: 'UPDATE warehouses SET "managerId" = NULL WHERE "managerId" IN (SELECT id FROM _pg_users)',
        args: () => [],
      },
      {
        label: 'detach sales.created_by',
        sql: 'UPDATE sales SET created_by = NULL WHERE created_by IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach payment_transactions.processed_by',
        sql: 'UPDATE payment_transactions SET processed_by = NULL WHERE processed_by IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach commissions.approvedBy',
        sql: 'UPDATE commissions SET "approvedBy" = NULL WHERE "approvedBy" IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach credit_payments.received_by',
        sql: 'UPDATE credit_payments SET received_by = NULL WHERE received_by IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach inventory_transactions.performed_by',
        sql: 'UPDATE inventory_transactions SET performed_by = NULL WHERE performed_by IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach employees.userId',
        sql: 'UPDATE employees SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _pg_users)',
        args: () => [],
      },
      {
        label: 'detach transfers.requested_by_id',
        sql: 'UPDATE transfers SET requested_by_id = NULL WHERE requested_by_id IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach transfers.approved_by_id',
        sql: 'UPDATE transfers SET approved_by_id = NULL WHERE approved_by_id IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach product_borrowings.recorded_by_id',
        sql: 'UPDATE product_borrowings SET recorded_by_id = NULL WHERE recorded_by_id IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'detach companies.createdById',
        sql: 'UPDATE companies SET "createdById" = NULL WHERE "createdById" IN (SELECT id FROM _pg_users)',
        args: () => [],
        optional: true,
      },
      {
        label: 'delete users',
        sql: 'DELETE FROM users WHERE "companyId" = ANY($2::uuid[]) OR id = $1::uuid',
        args: (c) => [c.userId, c.companyIds],
      },
      {
        label: 'anonymize issue_reports',
        sql: `UPDATE issue_reports
SET "userPhone" = NULL, "userEmail" = NULL, "userName" = NULL, "companyName" = NULL
WHERE lower(btrim("userEmail")) IN (SELECT email_key FROM _pg_users WHERE email_key IS NOT NULL)
   OR NULLIF(regexp_replace(btrim("userPhone"), '\\D', '', 'g'), '')
      IN (SELECT phone_key FROM _pg_users WHERE phone_key IS NOT NULL)
   OR lower(regexp_replace(btrim("userName"), '\\s+', ' ', 'g'))
      IN (SELECT name_key FROM _pg_users WHERE name_key IS NOT NULL)
   OR lower(btrim("companyName")) IN (SELECT name_key FROM _pg_companies WHERE name_key IS NOT NULL)`,
        args: () => [],
        optional: true,
      },
      {
        label: 'scrub global settings',
        sql: `UPDATE settings SET "companyName" = NULL, "companyPhone" = NULL, "companyEmail" = NULL, "companyLogo" = NULL
WHERE lower(btrim("companyName")) IN (SELECT name_key FROM _pg_companies WHERE name_key IS NOT NULL)
   OR lower(btrim("companyEmail")) IN (SELECT email_key FROM _pg_users WHERE email_key IS NOT NULL)`,
        args: () => [],
        optional: true,
      },
      {
        label: 'delete companies',
        sql: 'DELETE FROM companies WHERE id = ANY($1::uuid[])',
        args: (c) => [c.companyIds],
      },
    ];

    return { captures, deletes };
  }

  private async run(manager: EntityManager, step: PurgeStep, ctx: PurgeContext): Promise<void> {
    try {
      await manager.query(step.sql, step.args(ctx));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (step.optional && code && SKIP_CODES.has(code)) {
        this.logger.warn(`Purge step "${step.label}" skipped: ${code}`);
        return;
      }
      throw error;
    }
  }

  private async snapshotCatalogue(manager: EntityManager): Promise<{ plans: number; discounts: number }> {
    try {
      const rows = await manager.query(
        'SELECT (SELECT count(*) FROM plans) AS plans, (SELECT count(*) FROM discounts) AS discounts',
      );
      return { plans: Number(rows[0]?.plans ?? 0), discounts: Number(rows[0]?.discounts ?? 0) };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code && MISSING_SCHEMA_CODES.has(code)) {
        return { plans: -1, discounts: -1 };
      }
      throw error;
    }
  }

  private async assertNoCrossTenantBlockers(manager: EntityManager, ctx: PurgeContext): Promise<void> {
    const checks: Array<[string, string, unknown[]]> = [
      [
        'inventory_transactions.product_id',
        `SELECT count(*)::int AS n FROM inventory_transactions x
WHERE x.product_id IN (SELECT id FROM _pg_products)
  AND NOT (x.warehouse_id IN (SELECT id FROM _pg_warehouses) OR x.shop_id IN (SELECT id FROM _pg_shops))`,
        [],
      ],
      [
        'transfers.product_id',
        `SELECT count(*)::int AS n FROM transfers x
WHERE x.product_id IN (SELECT id FROM _pg_products)
  AND NOT (x.from_warehouse_id IN (SELECT id FROM _pg_warehouses) OR x.to_warehouse_id IN (SELECT id FROM _pg_warehouses)
        OR x.from_shop_id IN (SELECT id FROM _pg_shops) OR x.to_shop_id IN (SELECT id FROM _pg_shops))`,
        [],
      ],
      [
        'credit_accounts.customer_id',
        `SELECT count(*)::int AS n FROM credit_accounts x
WHERE x.customer_id IN (SELECT id FROM _pg_customers) AND (x.company_id IS NULL OR x.company_id <> ALL($1::uuid[]))`,
        [ctx.companyIds],
      ],
      [
        'transfers.requested_by_id',
        `SELECT count(*)::int AS n FROM transfers x
WHERE x.requested_by_id IN (SELECT id FROM _pg_users)
  AND NOT (x.from_warehouse_id IN (SELECT id FROM _pg_warehouses) OR x.to_warehouse_id IN (SELECT id FROM _pg_warehouses)
        OR x.from_shop_id IN (SELECT id FROM _pg_shops) OR x.to_shop_id IN (SELECT id FROM _pg_shops))`,
        [],
      ],
    ];

    for (const [label, sql, args] of checks) {
      try {
        const rows = await manager.query(sql, args);
        const n = Number(rows?.[0]?.n ?? 0);
        if (n > 0) {
          throw new InternalServerErrorException(
            `Account deletion aborted: ${n} record(s) in ${label} belong to another company. Contact support to resolve the reference first.`,
          );
        }
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code && MISSING_SCHEMA_CODES.has(code)) continue;
        throw error;
      }
    }
  }

  private async verify(
    manager: EntityManager,
    ctx: PurgeContext,
    catalogue: { plans: number; discounts: number },
  ): Promise<void> {
    await this.assertEmpty(
      manager,
      [
        ['companies', 'SELECT count(*)::int AS n FROM companies WHERE id = ANY($1::uuid[])', [ctx.companyIds]],
        [
          'users',
          'SELECT count(*)::int AS n FROM users WHERE "companyId" = ANY($1::uuid[]) OR id = $2::uuid',
          [ctx.companyIds, ctx.userId],
        ],
        ['employees', 'SELECT count(*)::int AS n FROM employees WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['warehouses', 'SELECT count(*)::int AS n FROM warehouses WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['shops', 'SELECT count(*)::int AS n FROM shops WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['customers', 'SELECT count(*)::int AS n FROM customers WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['products', 'SELECT count(*)::int AS n FROM products WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['suppliers', 'SELECT count(*)::int AS n FROM suppliers WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['branches', 'SELECT count(*)::int AS n FROM branches WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['product_groups', 'SELECT count(*)::int AS n FROM product_groups WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['bank_accounts', 'SELECT count(*)::int AS n FROM bank_accounts WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['bank_expenses', 'SELECT count(*)::int AS n FROM bank_expenses WHERE "companyId" = ANY($1::uuid[])', [ctx.companyIds]],
        ['credit_accounts', 'SELECT count(*)::int AS n FROM credit_accounts WHERE company_id = ANY($1::uuid[])', [ctx.companyIds]],
        ['product_borrowings', 'SELECT count(*)::int AS n FROM product_borrowings WHERE company_id = ANY($1::uuid[])', [ctx.companyIds]],
        ['device_tokens', 'SELECT count(*)::int AS n FROM device_tokens WHERE "userId" IN (SELECT id FROM _pg_users)', []],
        [
          'notifications',
          'SELECT count(*)::int AS n FROM notifications WHERE "companyId" = ANY($1::text[]) OR "userId" IN (SELECT id FROM _pg_users)',
          [ctx.companyIds],
        ],
        ['company_limit_attempts', 'SELECT count(*)::int AS n FROM company_limit_attempts WHERE "userId" IN (SELECT id FROM _pg_users)', []],
        ['sales', 'SELECT count(*)::int AS n FROM sales x JOIN _pg_sales s ON s.id = x.id', []],
      ] as Array<[string, string, unknown[]]>,
    );

    await this.assertEmpty(
      manager,
      [
        ['sales_items', `SELECT count(*)::int AS n FROM sales_items x WHERE x.sales_id IN (SELECT id FROM _pg_sales)`, []],
        ['payment_transactions', `SELECT count(*)::int AS n FROM payment_transactions x WHERE x.sale_id IN (SELECT id FROM _pg_sales)`, []],
        ['credit_payments', `SELECT count(*)::int AS n FROM credit_payments x WHERE x.credit_account_id IN (SELECT id FROM _pg_credit_accounts)`, []],
        ['credit_transactions', `SELECT count(*)::int AS n FROM credit_transactions x WHERE x.credit_account_id IN (SELECT id FROM _pg_credit_accounts)`, []],
        [
          'inventory_transactions',
          `SELECT count(*)::int AS n FROM inventory_transactions x
WHERE x.product_id IN (SELECT id FROM _pg_products) OR x.warehouse_id IN (SELECT id FROM _pg_warehouses) OR x.shop_id IN (SELECT id FROM _pg_shops)`,
          [],
        ],
        [
          'transfers',
          `SELECT count(*)::int AS n FROM transfers x
WHERE x.from_warehouse_id IN (SELECT id FROM _pg_warehouses) OR x.to_warehouse_id IN (SELECT id FROM _pg_warehouses)
   OR x.from_shop_id IN (SELECT id FROM _pg_shops) OR x.to_shop_id IN (SELECT id FROM _pg_shops)`,
          [],
        ],
        ['warehouse_products', `SELECT count(*)::int AS n FROM warehouse_products x WHERE x."warehouseId" IN (SELECT id FROM _pg_warehouses)`, []],
        ['shop_products', `SELECT count(*)::int AS n FROM shop_products x WHERE x."shopId" IN (SELECT id FROM _pg_shops)`, []],
        [
          'product_group_products',
          `SELECT count(*)::int AS n FROM product_group_products x WHERE x.group_id IN (SELECT id FROM _pg_product_groups) OR x.product_id IN (SELECT id FROM _pg_products)`,
          [],
        ],
        ['discount_products', `SELECT count(*)::int AS n FROM discount_products x WHERE x.product_id IN (SELECT id FROM _pg_products)`, []],
        ['discount_customers', `SELECT count(*)::int AS n FROM discount_customers x WHERE x.customer_id IN (SELECT id FROM _pg_customers)`, []],
      ] as Array<[string, string, unknown[]]>,
    );

    await this.assertEmpty(
      manager,
      [
        [
          'audit_logs still holding PII',
          `SELECT count(*)::int AS n FROM audit_logs
WHERE ("user_id" IN (SELECT id FROM _pg_users) OR "entityId" IN (SELECT id FROM _pg_users) OR "entityId" IN (SELECT id FROM _pg_sales))
  AND ("user_id" IS NOT NULL OR "ipAddress" IS NOT NULL OR "userAgent" IS NOT NULL OR "oldValues" IS NOT NULL OR "newValues" IS NOT NULL OR "description" IS NOT NULL)`,
          [],
        ],
        [
          'issue_reports still holding PII',
          `SELECT count(*)::int AS n FROM issue_reports
WHERE (lower(btrim("userEmail")) IN (SELECT email_key FROM _pg_users WHERE email_key IS NOT NULL)
    OR NULLIF(regexp_replace(btrim("userPhone"), '\\D', '', 'g'), '') IN (SELECT phone_key FROM _pg_users WHERE phone_key IS NOT NULL)
    OR lower(regexp_replace(btrim("userName"), '\\s+', ' ', 'g')) IN (SELECT name_key FROM _pg_users WHERE name_key IS NOT NULL)
    OR lower(btrim("companyName")) IN (SELECT name_key FROM _pg_companies WHERE name_key IS NOT NULL))
  AND ("userPhone" IS NOT NULL OR "userEmail" IS NOT NULL OR "userName" IS NOT NULL OR "companyName" IS NOT NULL)`,
          [],
        ],
        [
          'dangling user references',
          `SELECT
 (SELECT count(*) FROM commissions x WHERE x."approvedBy" IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM products x WHERE x."createdById" IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM shops x WHERE x."ownerId" IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM warehouses x WHERE x."managerId" IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM sales x WHERE x.created_by IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM payment_transactions x WHERE x.processed_by IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM credit_payments x WHERE x.received_by IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM inventory_transactions x WHERE x.performed_by IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM employees x WHERE x."userId" IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM product_borrowings x WHERE x.recorded_by_id IN (SELECT id FROM _pg_users))::int
+(SELECT count(*) FROM companies x WHERE x."createdById" IN (SELECT id FROM _pg_users))::int AS n`,
          [],
        ],
      ] as Array<[string, string, unknown[]]>,
      true,
    );

    if (catalogue.plans >= 0) {
      const after = await this.snapshotCatalogue(manager);
      if (after.plans !== catalogue.plans || after.discounts !== catalogue.discounts) {
        throw new InternalServerErrorException(
          'Account deletion aborted: the shared plan or discount catalogue was modified',
        );
      }
    }
  }

  private async assertEmpty(
    manager: EntityManager,
    checks: Array<[string, string, unknown[]]>,
    tolerant = false,
  ): Promise<void> {
    for (const [label, sql, args] of checks) {
      try {
        const rows = await manager.query(sql, args);
        const n = Number(rows?.[0]?.n ?? 0);
        if (n > 0) {
          throw new InternalServerErrorException(
            `Account deletion aborted: ${n} record(s) still present in ${label}`,
          );
        }
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (tolerant && code && MISSING_SCHEMA_CODES.has(code)) continue;
        throw error;
      }
    }
  }

  private async collectFiles(manager: EntityManager, ctx: PurgeContext): Promise<string[]> {
    const found: string[] = [];
    const queries: Array<[string, unknown[]]> = [
      [`SELECT "receiptImageUrl" AS f FROM sales WHERE "warehouseId" IN (SELECT id FROM _pg_warehouses) OR shop_id IN (SELECT id FROM _pg_shops)`, []],
      [`SELECT "imageUrl" AS f FROM products WHERE "companyId" = ANY($1::uuid[])`, [ctx.companyIds]],
      [`SELECT "paymentScreenshot" AS f FROM users WHERE "companyId" = ANY($1::uuid[]) OR id = $2::uuid`, [ctx.companyIds, ctx.userId]],
      [`SELECT "companyLogo" AS f FROM settings`, []],
    ];

    for (const [sql, args] of queries) {
      try {
        const rows = await manager.query(sql, args);
        for (const row of rows as Array<{ f: string | null }>) {
          if (row.f) found.push(row.f);
        }
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code && MISSING_SCHEMA_CODES.has(code)) continue;
        throw error;
      }
    }

    return Array.from(new Set(found));
  }

  private async removeFiles(urls: string[]): Promise<number> {
    let removed = 0;
    for (const url of urls) {
      const target = this.resolveUploadPath(url);
      if (!target) continue;
      try {
        await unlink(target);
        removed += 1;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'ENOENT') {
          this.logger.warn(`Could not remove upload ${url}: ${(error as Error).message}`);
        }
      }
    }
    return removed;
  }

  private resolveUploadPath(url: string): string | null {
    const withoutQuery = url.split(/[?#]/)[0];
    let decoded: string;
    try {
      decoded = decodeURIComponent(withoutQuery);
    } catch {
      return null;
    }
    if (decoded.includes('\0')) return null;
    const relative = decoded.replace(/^\/+/, '');
    if (!relative.startsWith('uploads/')) return null;
    const target = resolve(join(this.uploadsDir, relative.slice('uploads/'.length)));
    if (target === this.uploadsDir || !target.startsWith(this.uploadsDir + sep)) return null;
    return target;
  }

  private async invalidateCaches(): Promise<void> {
    const patterns = [
      `${CACHE_KEYS.SALES_LIST}*`,
      `${CACHE_KEYS.SALE_DETAIL}*`,
      `${CACHE_KEYS.PRODUCTS_LIST}*`,
      `${CACHE_KEYS.PRODUCT_DETAIL}*`,
      `${CACHE_KEYS.SHOPS_LIST}*`,
      `${CACHE_KEYS.SHOP_DETAIL}*`,
      `${CACHE_KEYS.WAREHOUSES_LIST}*`,
      `${CACHE_KEYS.WAREHOUSE_DETAIL}*`,
      `${CACHE_KEYS.EMPLOYEE_LIST}*`,
      `${CACHE_KEYS.EMPLOYEE_DETAIL}*`,
      `${CACHE_KEYS.USER_PROFILE}*`,
      `${CACHE_KEYS.USER_PERMISSIONS}*`,
      `${CACHE_KEYS.GRAND_REPORT}*`,
      `${CACHE_KEYS.INVENTORY_REPORT}*`,
      `${CACHE_KEYS.SALES_REPORT}*`,
      `${CACHE_KEYS.DASHBOARD_SUMMARY}*`,
      `${CACHE_KEYS.SETTINGS}*`,
      `${CACHE_KEYS.COMPANY_SETTINGS}*`,
      `${CACHE_KEYS.SYSTEM_SETTINGS}*`,
    ];
    for (const pattern of patterns) {
      await this.cacheService.deletePattern(pattern);
    }
  }
}
