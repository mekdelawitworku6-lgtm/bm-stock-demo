import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { SmsService } from '@/shared/sms/sms.service';
import { HttpStatus, BadRequestException } from '@nestjs/common';
import { CacheService } from '@/shared/cache/cache.service';

describe('OtpService', () => {
  let service: OtpService;
  let smsService: jest.Mocked<SmsService>;

  beforeEach(async () => {
    const memoryCache = new Map<string, any>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: SmsService,
          useValue: {
            sendOtp: jest.fn().mockResolvedValue({ success: true }),
            sendSmsOrThrow: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn((k: string) => Promise.resolve(memoryCache.get(k) || null)),
            set: jest.fn((k: string, v: any) => { memoryCache.set(k, v); return Promise.resolve(); }),
            del: jest.fn((k: string) => { memoryCache.delete(k); return Promise.resolve(); }),
            generateKey: jest.fn((...args) => args.join(':')),
          },
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    smsService = module.get(SmsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendOtp', () => {
    it('should generate a random verificationId without timestamp leakage', async () => {
      const phone = '0911223344';
      const result = await service.sendOtp(phone);

      expect(result).toBeDefined();
      expect(result.verificationId).toBeDefined();
      // Should match otp-<uuid>
      expect(result.verificationId).toMatch(/^otp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(result.verificationId).not.toContain(':');
    });

    it('should rate-limit send requests after 5 attempts', async () => {
      const phone = '0922334455';

      for (let i = 0; i < 5; i++) {
        await service.sendOtp(phone);
      }

      await expect(service.sendOtp(phone)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.TOO_MANY_REQUESTS,
        })
      );
    });
  });

  describe('verifyOtp', () => {
    it('should lock out after 5 consecutive failed verification attempts', async () => {
      const phone = '0933445566';
      await service.sendOtp(phone);

      for (let i = 0; i < 5; i++) {
        await expect(service.verifyOtp(phone, '000000')).rejects.toThrow(BadRequestException);
      }

      // 6th attempt should throw 429 Too Many Requests
      await expect(service.verifyOtp(phone, '000000')).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.TOO_MANY_REQUESTS,
        })
      );
    });

    it('should succeed with valid OTP', async () => {
      const phone = '0944556677';
      const sendResult = await service.sendOtp(phone);

      const isValid = await service.verifyOtp(phone, sendResult.code!);
      expect(isValid).toBe(true);
    });
  });
});

