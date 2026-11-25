import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { UserPurgeService } from './user-purge.service';
import { CacheService } from '@/shared/cache/cache.service';
import { UserRole } from '@/common/enums';
import { createMockUser } from '../../../../test/setup';

type QueryCall = [string, unknown[]];

describe('UserPurgeService', () => {
  let service: UserPurgeService;

  let manager: { query: jest.Mock };
  let dataSource: { query: jest.Mock; transaction: jest.Mock; lastRollback: boolean };
  let cacheService: { deletePattern: jest.Mock };

  const companyId = '11111111-1111-1111-1111-111111111111';
  const otherCompanyId = '22222222-2222-2222-2222-222222222222';
  const ownerId = '33333333-3333-3333-3333-333333333333';
  const uploadedFile = 'receipts/deadbeef.png';

  const sqlOf = (calls: QueryCall[]): string[] => calls.map(([sql]) => sql);

  const buildDataSource = (respond: (sql: string) => unknown[] = () => []) => {
    manager = { query: jest.fn(async (sql: string) => respond(sql)) };
    dataSource = {
      query: jest.fn(async () => [{ id: companyId }]),
      lastRollback: false,
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => {
        try {
          return await cb(manager);
        } catch (error) {
          dataSource.lastRollback = true;
          throw error;
        }
      }),
    };
  };

  const calls = (): QueryCall[] => manager.query.mock.calls as QueryCall[];

  beforeEach(async () => {
    buildDataSource();

    cacheService = { deletePattern: jest.fn().mockResolvedValue(1) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPurgeService,
        { provide: DataSource, useValue: dataSource },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<UserPurgeService>(UserPurgeService);
  });

  describe('findOwnedCompanyIds', () => {
    it('should only return companies created by the account', async () => {
      const ids = await service.findOwnedCompanyIds(ownerId);

      expect(dataSource.query).toHaveBeenCalledWith(
        'SELECT id FROM companies WHERE "createdById" = $1::uuid',
        [ownerId],
      );
      expect(ids).toEqual([companyId]);
    });
  });

  describe('assertDeletable', () => {
    it.each([UserRole.SUPER_ADMIN, UserRole.ADMIN])(
      'should block deleting a %s account',
      (role) => {
        expect(() => service.assertDeletable(createMockUser({ role }) as any)).toThrow(
          ForbiddenException,
        );
      },
    );

    it('should allow deleting a company admin', () => {
      expect(() =>
        service.assertDeletable(createMockUser({ role: UserRole.COMPANY_ADMIN }) as any),
      ).not.toThrow();
    });
  });

  describe('purgeMember', () => {
    it('should detach every user reference inside a single transaction', async () => {
      await service.purgeMember(ownerId);

      const statements = sqlOf(calls());
      expect(statements.some((s) => s.includes('commissions') && s.includes('"approvedBy"'))).toBe(true);
      expect(statements.some((s) => s.startsWith('DELETE FROM users'))).toBe(true);
      expect(statements.some((s) => s.includes('audit_logs'))).toBe(true);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('should not delete or detach any company row', async () => {
      await service.purgeMember(ownerId);

      const statements = sqlOf(calls());
      expect(statements.some((s) => s.startsWith('DELETE FROM companies'))).toBe(false);
      expect(statements.some((s) => s.includes('UPDATE companies'))).toBe(false);
    });

    it('should anonymize the user row instead of failing when FK constraints block deletion', async () => {
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('DELETE FROM users')) {
          const error: any = new Error('boom');
          error.code = '23503';
          throw error;
        }
        return [];
      });

      await service.purgeMember(ownerId);

      expect(dataSource.lastRollback).toBe(false);
      const statements = sqlOf(calls());
      expect(
        statements.some((s) => s.startsWith('UPDATE users SET') && s.includes('deleted-')),
      ).toBe(true);
    });

    it('should abort the whole transaction when a statement fails', async () => {
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.includes('"warehouseId" = NULL WHERE id')) {
          throw new Error('boom');
        }
        return [];
      });

      await expect(service.purgeMember(ownerId)).rejects.toThrow('boom');
      expect(dataSource.lastRollback).toBe(true);
    });
  });

  describe('purgeAccount', () => {
    const owner = createMockUser({
      id: ownerId,
      role: UserRole.COMPANY_ADMIN,
    }) as any;

    it('should fall back to member deletion when the account owns no company', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await service.purgeAccount(owner);

      expect(result).toEqual({ userId: ownerId, deletedCompanyIds: [], removedFileCount: 0 });
      expect(sqlOf(calls()).some((s) => s.startsWith('CREATE TEMP TABLE'))).toBe(false);
    });

    it('should refuse to purge a platform administrator', async () => {
      const admin = createMockUser({ id: ownerId, role: UserRole.SUPER_ADMIN }) as any;

      await expect(service.purgeAccount(admin)).rejects.toThrow(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should run the purge in dependency order inside one transaction', async () => {
      await service.purgeAccount(owner);

      const statements = sqlOf(calls());
      const indexOf = (needle: string) => statements.findIndex((s) => s.includes(needle));

      expect(indexOf('CREATE TEMP TABLE _pg_users')).toBeGreaterThanOrEqual(0);
      expect(indexOf('CREATE TEMP TABLE _pg_sales')).toBeLessThan(indexOf('DELETE FROM sales'));
      expect(indexOf('DELETE FROM sales')).toBeLessThan(indexOf('DELETE FROM customers'));
      expect(indexOf('DELETE FROM customers')).toBeLessThan(indexOf('DELETE FROM products'));
      expect(indexOf('DELETE FROM products')).toBeLessThan(indexOf('DELETE FROM shops'));
      expect(indexOf('DELETE FROM shops')).toBeLessThan(indexOf('DELETE FROM users'));
      expect(indexOf('DELETE FROM users')).toBeLessThan(indexOf('DELETE FROM companies'));
      const deleteStatements = statements.filter((s) => s.startsWith('DELETE FROM'));
      expect(deleteStatements[deleteStatements.length - 1]).toContain('DELETE FROM companies');
    });

    it('should scope every tenant statement to the owned company ids', async () => {
      await service.purgeAccount(owner);

      const tenantStatements = calls().filter(([sql]) => /companyId" = ANY/.test(sql));
      expect(tenantStatements.length).toBeGreaterThan(0);
      for (const [, args] of tenantStatements) {
        expect(args).toContainEqual([companyId]);
        expect(args).not.toContainEqual([otherCompanyId]);
      }
    });

    it('should never delete a company the account merely belongs to', async () => {
      await service.purgeAccount(owner);

      const companyDeletes = calls().filter(([sql]) => sql.startsWith('DELETE FROM companies'));
      expect(companyDeletes).toHaveLength(1);
      expect(companyDeletes[0][1]).toEqual([[companyId]]);
    });

    it('should anonymize audit logs instead of deleting them', async () => {
      await service.purgeAccount(owner);

      const statements = sqlOf(calls());
      expect(statements.some((s) => s.includes('UPDATE audit_logs') && s.includes('"newValues" = NULL'))).toBe(true);
      expect(statements.some((s) => s.startsWith('DELETE FROM audit_logs'))).toBe(false);
    });

    it('should preserve the shared plan and discount catalogue', async () => {
      await service.purgeAccount(owner);

      const statements = sqlOf(calls());
      expect(statements.some((s) => s.startsWith('DELETE FROM discounts'))).toBe(false);
      expect(statements.some((s) => s.startsWith('DELETE FROM plans'))).toBe(false);
    });

    it('should abort and roll back when a purge step fails', async () => {
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('DELETE FROM customers')) {
          const error: any = new Error('foreign key violation');
          error.code = '23503';
          throw error;
        }
        return [];
      });

      await expect(service.purgeAccount(owner)).rejects.toThrow('foreign key violation');
      expect(dataSource.lastRollback).toBe(true);
      expect(cacheService.deletePattern).not.toHaveBeenCalled();
    });

    it('should abort and roll back when tenant data survives the purge', async () => {
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM companies WHERE id = ANY')) {
          return [{ n: 2 }];
        }
        return [];
      });

      await expect(service.purgeAccount(owner)).rejects.toThrow(InternalServerErrorException);
      expect(dataSource.lastRollback).toBe(true);
      expect(cacheService.deletePattern).not.toHaveBeenCalled();
    });

    it('should abort when another company still references purged records', async () => {
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM credit_accounts x')) {
          return [{ n: 1 }];
        }
        return [];
      });

      await expect(service.purgeAccount(owner)).rejects.toThrow(/another company/);
      expect(dataSource.lastRollback).toBe(true);
    });

    it('should skip optional tables that do not exist in the schema', async () => {
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('DELETE FROM bank_expenses')) {
          const error: any = new Error('relation does not exist');
          error.code = '42P01';
          throw error;
        }
        return [];
      });

      await expect(service.purgeAccount(owner)).resolves.toMatchObject({ deletedCompanyIds: [companyId] });
    });

    it('should not swallow unexpected errors from optional tables', async () => {
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('DELETE FROM bank_expenses')) {
          const error: any = new Error('permission denied');
          error.code = '42501';
          throw error;
        }
        return [];
      });

      await expect(service.purgeAccount(owner)).rejects.toThrow('permission denied');
    });

    it('should delete uploaded files only after the transaction commits', async () => {
      const unlink = jest.spyOn(require('fs/promises'), 'unlink').mockResolvedValue(undefined);
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.includes('AS f FROM sales')) {
          return [{ f: `/uploads/${uploadedFile}` }];
        }
        return [];
      });

      const result = await service.purgeAccount(owner);

      expect(unlink).toHaveBeenCalledTimes(1);
      expect(result.removedFileCount).toBe(1);
      unlink.mockRestore();
    });

    it('should not delete files when the transaction rolls back', async () => {
      const unlink = jest.spyOn(require('fs/promises'), 'unlink').mockResolvedValue(undefined);
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('DELETE FROM companies')) {
          const error: any = new Error('cannot delete owner');
          error.code = '23503';
          throw error;
        }
        if (sql.includes('AS f FROM sales')) {
          return [{ f: `/uploads/${uploadedFile}` }];
        }
        return [];
      });

      await expect(service.purgeAccount(owner)).rejects.toThrow('cannot delete owner');
      expect(unlink).not.toHaveBeenCalled();
      unlink.mockRestore();
    });

    it('should ignore file paths that escape the uploads directory', async () => {
      const unlink = jest.spyOn(require('fs/promises'), 'unlink').mockResolvedValue(undefined);
      manager.query.mockImplementation(async (sql: string) => {
        if (sql.includes('AS f FROM sales')) {
          return [{ f: '/uploads/../../etc/passwd' }];
        }
        return [];
      });

      const result = await service.purgeAccount(owner);

      expect(unlink).not.toHaveBeenCalled();
      expect(result.removedFileCount).toBe(0);
      unlink.mockRestore();
    });

    it('should invalidate cached reports after the purge commits', async () => {
      await service.purgeAccount(owner);

      expect(cacheService.deletePattern).toHaveBeenCalled();
      const patterns = cacheService.deletePattern.mock.calls.map(([p]: [string]) => p);
      expect(patterns).toContain('sales:list*');
      expect(patterns).toContain('reports:dashboard:summary*');
    });
  });
});
