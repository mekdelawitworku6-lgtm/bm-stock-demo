import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/services/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountAccessService } from '@/modules/company/account-access.service';
import { PlansService } from '@/modules/plans/plans.service';
import { ReceiptVerificationService } from '../receipt/receipt-verification.service';
import { Company } from '@/modules/company/entities/company.entity';
import { Warehouse } from '@/modules/warehouse/entities/warehouse.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Employee } from '@/modules/users/entities/employee.entity';
import { UsedReceipt } from './entities/used-receipt.entity';
import { createMockRepository, mockUser } from '../../../test/setup';
import { UserRole } from '@/common/enums';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByEmailWithAssociations: jest.fn(),
            findByPhone: jest.fn(),
            findUserByPhone: jest.fn().mockResolvedValue(null),
            findEmployeeByUserId: jest.fn().mockResolvedValue(null),
            findById: jest.fn(),
            findByIdWithAssociations: jest.fn(),
            ensureUserHasCompany: jest.fn((u) => Promise.resolve(u)),
            create: jest.fn(),
            saveUser: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config = {
                'JWT_REFRESH_SECRET': 'refresh-secret',
                'JWT_REFRESH_EXPIRES_IN': '7d',
                'BCRYPT_ROUNDS': '12',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: AccountAccessService,
          useValue: {
            assertCanAccess: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PlansService,
          useValue: {
            findBillableById: jest.fn(),
          },
        },
        {
          provide: ReceiptVerificationService,
          useValue: {
            verifyReceipt: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Warehouse),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(UsedReceipt),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      
      usersService.findByEmailWithAssociations.mockResolvedValue(mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser(email, password);

      expect(usersService.findByEmailWithAssociations).toHaveBeenCalledWith(email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';
      
      usersService.findByEmailWithAssociations.mockResolvedValue(null);

      await expect(service.validateUser(email, password)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      
      usersService.findByEmailWithAssociations.mockResolvedValue(mockUser as any);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.validateUser(email, password)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      const loginDto = { email: 'test@example.com', password: 'password123' };
      const expectedTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };
      
      usersService.findByEmailWithAssociations.mockResolvedValue(mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign
        .mockReturnValueOnce(expectedTokens.accessToken)
        .mockReturnValueOnce(expectedTokens.refreshToken);

      const result = await service.login(loginDto);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe(expectedTokens.accessToken);
      expect(result.refreshToken).toBe(expectedTokens.refreshToken);
      expect(result.user).toBeDefined();
    });

    it('should allow login using phone field', async () => {
      const loginDto = { phone: '+251954068503', password: 'SuperAdmin2026!' };
      const expectedTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      usersService.findByPhone.mockResolvedValue(mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign
        .mockReturnValueOnce(expectedTokens.accessToken)
        .mockReturnValueOnce(expectedTokens.refreshToken);

      const result = await service.login(loginDto);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe(expectedTokens.accessToken);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto = { email: 'test@example.com', password: 'wrongpassword' };
      
      usersService.findByEmailWithAssociations.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create a new company admin user with pending payment', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };
      const hashedPassword = 'hashed-password';
      const newUser = { ...mockUser, ...registerDto, password: hashedPassword, role: UserRole.COMPANY_ADMIN };
      
      usersService.findByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);
      const companyRepo = (service as any).companyRepository;
      const warehouseRepo = (service as any).warehouseRepository;
      companyRepo.save.mockResolvedValue({ id: 'comp-1' });
      warehouseRepo.save.mockResolvedValue({ id: 'wh-1' });
      usersService.create.mockResolvedValue(newUser as any);

      const result = await service.register(registerDto as any);

      expect(usersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(usersService.create).toHaveBeenCalledWith(expect.objectContaining({
        email: registerDto.email,
        password: hashedPassword,
        role: UserRole.COMPANY_ADMIN,
        paymentStatus: 'PENDING',
      }));
      expect(result).toEqual(newUser);
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Existing',
        lastName: 'User',
      };
      
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(service.register(registerDto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens for valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const payload = { sub: '1', email: 'test@example.com' };
      const newAccessToken = 'new-access-token';
      
      jwtService.verify.mockReturnValue(payload);
      usersService.findByIdWithAssociations.mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValue(newAccessToken);

      const result = await service.refreshToken(refreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'refresh-secret',
      });
      expect(usersService.findByIdWithAssociations).toHaveBeenCalledWith(payload.sub);
      expect(result).toEqual({ success: true, accessToken: newAccessToken });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';
      
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });
});
