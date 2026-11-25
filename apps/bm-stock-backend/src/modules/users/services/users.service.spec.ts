import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserPurgeService } from './user-purge.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Employee } from '../entities/employee.entity';
import { Company } from '../../company/entities/company.entity';
import { Shop } from '../../shops/entities/shops.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Product } from '../../products/entities/product.entity';
import { Sales } from '../../sales/entities/sales.entity';
import { NotificationService } from '../../notifications/notification.service';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { createMockRepository, mockUser, createMockPaginationResult, createMockUser } from '../../../../test/setup';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UserRole } from '../../../common/enums';
import { OtpService } from '../../auth/otp.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;
  let purgeService: { findOwnedCompanyIds: jest.Mock; purgeMember: jest.Mock; purgeAccount: jest.Mock };

  const mockUsers = [
    mockUser,
    {
      ...mockUser,
      id: '2',
      email: 'user2@example.com',
      firstName: 'User',
      lastName: 'Two',
    },
  ];

  beforeEach(async () => {
    purgeService = {
      findOwnedCompanyIds: jest.fn().mockResolvedValue([]),
      purgeMember: jest.fn().mockResolvedValue(undefined),
      purgeAccount: jest.fn().mockResolvedValue({
        userId: '2',
        deletedCompanyIds: ['c1'],
        removedFileCount: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserPurgeService, useValue: purgeService },
        { provide: NotificationService, useValue: { createNotification: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(Employee), useValue: createMockRepository() },
        { provide: getRepositoryToken(Company), useValue: createMockRepository() },
        { provide: getRepositoryToken(Shop), useValue: createMockRepository() },
        { provide: getRepositoryToken(Warehouse), useValue: createMockRepository() },
        { provide: getRepositoryToken(Product), useValue: createMockRepository() },
        { provide: getRepositoryToken(Sales), useValue: createMockRepository() },
        { provide: OtpService, useValue: { verifyOtp: jest.fn().mockResolvedValue(true) } },
        { provide: AuditLogsService, useValue: { create: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserDto = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };
      const newUser = { ...mockUser, ...createUserDto };

      repository.create.mockReturnValue(newUser as any);
      repository.save.mockResolvedValue(newUser as any);

      const result = await service.create(createUserDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
          role: UserRole.USER,
        }),
      );
      expect(repository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual(newUser);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const query = Object.assign(new PaginationDto(), { page: 1, limit: 10 });
      const expectedResult = { users: mockUsers, total: mockUsers.length };

      repository.findAndCount.mockResolvedValue([mockUsers as any[], mockUsers.length]);

      const result = await service.findAll(query);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
        select: [
          'id', 'email', 'firstName', 'lastName', 'role', 'status', 'isEmailVerified',
          'phone', 'companyId', 'createdAt', 'updatedAt',
          'planId', 'planTitle', 'planAmount', 'planPeriod', 'numCompanies',
          'paymentMethod', 'paymentStatus', 'paymentRef', 'paymentScreenshot',
          'subscriptionStartDate', 'subscriptionPaymentDate', 'subscriptionNextPaymentDate', 'subscriptionExpiresAt',
          'faydaId', 'tin',
        ],
        where: undefined,
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      repository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.findById('1');

      expect(repository.findOne).toHaveBeenCalledWith({ 
        where: { id: '1' },
        select: [
          'id', 'email', 'firstName', 'lastName', 'role', 'status', 'isEmailVerified', 'phone',
          'companyId', 'createdAt', 'updatedAt',
          'planId', 'planTitle', 'planAmount', 'planPeriod', 'numCompanies',
          'paymentMethod', 'paymentStatus', 'paymentRef', 'paymentScreenshot',
          'subscriptionStartDate', 'subscriptionPaymentDate', 'subscriptionNextPaymentDate', 'subscriptionExpiresAt',
          'faydaId', 'tin',
        ],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      repository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.findByEmail('test@example.com');

      expect(repository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const updateDto = { firstName: 'Updated', lastName: 'Name' };
      const updatedUser = { ...mockUser, ...updateDto };

      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.findOne.mockResolvedValue(updatedUser as any);

      const currentUser = createMockUser({ id: '1' });
      const result = await service.update('1', updateDto, currentUser);

      expect(repository.update).toHaveBeenCalledWith('1', updateDto);
      expect(repository.findOne).toHaveBeenCalledWith({ 
        where: { id: '1' },
        select: [
          'id', 'email', 'firstName', 'lastName', 'role', 'status', 'isEmailVerified', 'phone',
          'companyId', 'createdAt', 'updatedAt',
          'planId', 'planTitle', 'planAmount', 'planPeriod', 'numCompanies',
          'paymentMethod', 'paymentStatus', 'paymentRef', 'paymentScreenshot',
          'subscriptionStartDate', 'subscriptionPaymentDate', 'subscriptionNextPaymentDate', 'subscriptionExpiresAt',
          'faydaId', 'tin',
        ],
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw ForbiddenException if user tries to update another user', async () => {
      const currentUser = createMockUser({ id: '1', role: UserRole.USER });
      
      await expect(service.update('2', {}, currentUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    const admin = createMockUser({ id: '1', role: UserRole.ADMIN });

    it('should purge only the user when the account owns no company', async () => {
      repository.findOne.mockResolvedValue(createMockUser({ id: '2' }) as any);
      purgeService.findOwnedCompanyIds.mockResolvedValue([]);

      await service.remove('2', admin);

      expect(purgeService.purgeMember).toHaveBeenCalledWith('2');
      expect(purgeService.purgeAccount).not.toHaveBeenCalled();
    });

    it('should purge the whole tenant when the account owns companies', async () => {
      const owner = createMockUser({ id: '2', role: UserRole.COMPANY_ADMIN });
      repository.findOne.mockResolvedValue(owner as any);
      purgeService.findOwnedCompanyIds.mockResolvedValue(['c1', 'c2']);

      await service.remove('2', admin);

      expect(purgeService.purgeAccount).toHaveBeenCalledWith(owner);
      expect(purgeService.purgeMember).not.toHaveBeenCalled();
    });

    it('should let an account owner delete their own account', async () => {
      const owner = createMockUser({ id: '2', role: UserRole.COMPANY_ADMIN });
      repository.findOne.mockResolvedValue(owner as any);
      purgeService.findOwnedCompanyIds.mockResolvedValue(['c1']);

      await service.remove('2', owner, '123456', '+251911000000');

      expect(purgeService.purgeAccount).toHaveBeenCalledWith(owner);
    });

    it('should throw ForbiddenException when deleting another user as a normal user', async () => {
      const currentUser = createMockUser({ id: '1', role: UserRole.USER });

      await expect(service.remove('2', currentUser)).rejects.toThrow(ForbiddenException);
      expect(purgeService.purgeAccount).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent', admin)).rejects.toThrow(NotFoundException);
    });
  });

});
