import { Injectable, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SmsService } from '@/shared/sms/sms.service';
import { EmailService } from '@/shared/email/email.service';
import { CacheService } from '@/shared/cache/cache.service';

interface StoredOtp {
  phone: string;
  code: string;
  verificationId: string;
}

interface StoredEmailOtp {
  email: string;
  code: string;
  verificationId: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private static readonly OTP_TTL_MS = 5 * 60 * 1000;
  /** Maximum consecutive failed OTP verification attempts before lockout */
  private static readonly MAX_ATTEMPTS = 5;
  /** Maximum OTP send requests per phone per window */
  private static readonly MAX_SENDS = 5;
  /** Lockout window duration in milliseconds (10 minutes) */
  private static readonly LOCKOUT_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Send a 6-digit OTP to the provided phone number.
   * Codes are stored in Redis so they survive restarts and work across instances.
   */
  async sendOtp(to: string, customMessage?: string): Promise<{ verificationId: string; code?: string; smsSent: boolean; smsError?: string }> {
    const cleanedPhone = this.cleanPhone(to);

    // Check if this phone is currently locked out from too many failures
    await this.assertNotLockedOut(cleanedPhone);

    // Check if this phone has sent too many OTP requests recently (rate limit sends)
    await this.assertNotSendRateLimited(cleanedPhone);
    await this.recordSendAttempt(cleanedPhone);

    const { verificationId, code } = await this.storeOtp(cleanedPhone);

    this.logger.warn(`[OTP GENERATED] Phone: ${cleanedPhone} | CODE: ${code}`);

    let smsSent = false;
    let smsError: string | undefined;

    const message = customMessage && !customMessage.includes('{CODE}')
      ? customMessage
      : `Your BM Stock verification code is ${code}. Please use this code to verify. If you did not request this, please ignore this message.`;

    try {
      smsSent = await this.smsService.sendSmsOrThrow(cleanedPhone, message);
    } catch (error: any) {
      smsError = error?.message || String(error);
      this.logger.error(
        `[OTP SMS FAILED] Phone: ${cleanedPhone}, Error: ${smsError}. OTP Code ${code} remains active for testing.`,
      );
    }

    return { verificationId, code, smsSent, smsError };
  }

  /**
   * Verify the OTP code for the given phone number.
   * When `consume` is true (default) the code is deleted after a successful
   * check so it can only be used once. Pass `consume: false` when the code
   * needs to remain valid for a follow-up step (e.g. reset-password).
   *
   * Rate-limited: after 5 consecutive failures the phone is locked out
   * for 10 minutes (CWE-307 mitigation).
   */
  async verifyOtp(to: string, code: string, consume = true): Promise<boolean> {
    const cleanedPhone = this.cleanPhone(to);
    const trimmedCode = code.trim();

    // Check if this phone is currently locked out
    await this.assertNotLockedOut(cleanedPhone);

    const stored = await this.cacheService.get<StoredOtp>(this.otpCacheKey(cleanedPhone));
    if (stored?.phone === cleanedPhone && stored.code === trimmedCode) {
      if (consume) {
        await this.cacheService.del(this.otpCacheKey(cleanedPhone));
      }
      // Successful verification — reset the attempt counter
      await this.cacheService.del(this.attemptCacheKey(cleanedPhone));
      return true;
    }

    // Failed attempt — increment counter and potentially lock out
    await this.recordFailedAttempt(cleanedPhone);

    throw new BadRequestException('Invalid or expired OTP code.');
  }

  // ── Email OTP ──────────────────────────────────────────────────────

  /**
   * Send a 6-digit OTP to the provided email address via Brevo.
   * Codes are stored in Redis with the same TTL and rate-limiting
   * as phone OTPs.
   */
  async sendEmailOtp(email: string): Promise<{ verificationId: string; code: string; emailSent: boolean; emailError?: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Rate-limiting (reuse same helpers with email-specific cache keys)
    await this.assertNotLockedOutEmail(normalizedEmail);
    await this.assertNotSendRateLimitedEmail(normalizedEmail);
    await this.recordSendAttemptEmail(normalizedEmail);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = `email-otp-${randomUUID()}`;
    const payload: StoredEmailOtp = { email: normalizedEmail, code, verificationId };

    await this.cacheService.set(
      this.emailOtpCacheKey(normalizedEmail),
      payload,
      OtpService.OTP_TTL_MS,
    );

    this.logger.warn(`[EMAIL OTP GENERATED] Email: ${normalizedEmail} | CODE: ${code}`);

    let emailSent = false;
    let emailError: string | undefined;

    try {
      emailSent = await this.emailService.sendOtpEmail(normalizedEmail, code);
    } catch (error: any) {
      emailError = error?.message || String(error);
      this.logger.error(
        `[EMAIL OTP SEND FAILED] Email: ${normalizedEmail}, Error: ${emailError}. OTP Code ${code} remains active.`,
      );
    }

    return { verificationId, code, emailSent, emailError };
  }

  /**
   * Verify the OTP code for the given email address.
   */
  async verifyEmailOtp(email: string, code: string, consume = true): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    await this.assertNotLockedOutEmail(normalizedEmail);

    const stored = await this.cacheService.get<StoredEmailOtp>(this.emailOtpCacheKey(normalizedEmail));
    if (stored?.email === normalizedEmail && stored.code === trimmedCode) {
      if (consume) {
        await this.cacheService.del(this.emailOtpCacheKey(normalizedEmail));
      }
      await this.cacheService.del(this.emailAttemptCacheKey(normalizedEmail));
      return true;
    }

    await this.recordFailedAttemptEmail(normalizedEmail);
    throw new BadRequestException('Invalid or expired OTP code.');
  }

  // ── Email rate-limiting helpers ────────────────────────────────────

  private async assertNotLockedOutEmail(email: string): Promise<void> {
    const attempts = await this.cacheService.get<number>(this.emailAttemptCacheKey(email));
    if (attempts !== undefined && attempts >= OtpService.MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many failed OTP attempts. Please wait 10 minutes before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedAttemptEmail(email: string): Promise<void> {
    const key = this.emailAttemptCacheKey(email);
    const current = (await this.cacheService.get<number>(key)) ?? 0;
    await this.cacheService.set(key, current + 1, OtpService.LOCKOUT_TTL_MS);
  }

  private async assertNotSendRateLimitedEmail(email: string): Promise<void> {
    const key = this.emailSendRateLimitCacheKey(email);
    const count = (await this.cacheService.get<number>(key)) ?? 0;
    if (count >= OtpService.MAX_SENDS) {
      throw new HttpException(
        'Too many OTP requests for this email. Please wait 10 minutes before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordSendAttemptEmail(email: string): Promise<void> {
    const key = this.emailSendRateLimitCacheKey(email);
    const current = (await this.cacheService.get<number>(key)) ?? 0;
    await this.cacheService.set(key, current + 1, OtpService.LOCKOUT_TTL_MS);
  }

  private emailOtpCacheKey(email: string): string {
    return this.cacheService.generateKey('email_otp', email);
  }

  private emailAttemptCacheKey(email: string): string {
    return this.cacheService.generateKey('email_otp_attempts', email);
  }

  private emailSendRateLimitCacheKey(email: string): string {
    return this.cacheService.generateKey('email_otp_send_limit', email);
  }

  // ── Phone rate-limiting helpers ────────────────────────────────────

  /**
   * Throw 429 if the phone has exceeded
   * MAX_ATTEMPTS within the lockout window.
   */
  private async assertNotLockedOut(cleanedPhone: string): Promise<void> {
    const attempts = await this.cacheService.get<number>(this.attemptCacheKey(cleanedPhone));
    if (attempts !== undefined && attempts >= OtpService.MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many failed OTP attempts. Please wait 10 minutes before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Increment the per-phone failed-attempt counter.
   * The counter is stored with a TTL equal to the lockout window so it
   * automatically expires without requiring manual cleanup.
   */
  private async recordFailedAttempt(cleanedPhone: string): Promise<void> {
    const key = this.attemptCacheKey(cleanedPhone);
    const current = (await this.cacheService.get<number>(key)) ?? 0;
    await this.cacheService.set(key, current + 1, OtpService.LOCKOUT_TTL_MS);
  }

  private attemptCacheKey(cleanedPhone: string): string {
    return this.cacheService.generateKey('otp_attempts', cleanedPhone);
  }

  /**
   * Throw 429 if the phone has exceeded
   * MAX_SENDS within the rate limit window.
   */
  private async assertNotSendRateLimited(cleanedPhone: string): Promise<void> {
    const key = this.sendRateLimitCacheKey(cleanedPhone);
    const count = (await this.cacheService.get<number>(key)) ?? 0;
    if (count >= OtpService.MAX_SENDS) {
      throw new HttpException(
        'Too many OTP requests for this phone number. Please wait 10 minutes before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordSendAttempt(cleanedPhone: string): Promise<void> {
    const key = this.sendRateLimitCacheKey(cleanedPhone);
    const current = (await this.cacheService.get<number>(key)) ?? 0;
    await this.cacheService.set(key, current + 1, OtpService.LOCKOUT_TTL_MS);
  }

  private sendRateLimitCacheKey(cleanedPhone: string): string {
    return this.cacheService.generateKey('otp_send_limit', cleanedPhone);
  }

  // ── Existing private helpers ───────────────────────────────────────

  private async storeOtp(cleanedPhone: string): Promise<{ verificationId: string; code: string }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Opaque random ID without server timestamp to prevent timing leakage (Finding 5)
    const verificationId = `otp-${randomUUID()}`;
    const payload: StoredOtp = { phone: cleanedPhone, code, verificationId };

    await this.cacheService.set(
      this.otpCacheKey(cleanedPhone),
      payload,
      OtpService.OTP_TTL_MS,
    );

    return { verificationId, code };
  }

  private otpCacheKey(cleanedPhone: string): string {
    return this.cacheService.generateKey('otp', cleanedPhone);
  }

  private cleanPhone(phone: string): string {
    let p = phone.trim().replace(/[^\d]/g, '');
    if (p.startsWith('2510') && p.length === 13) {
      p = `251${p.substring(4)}`;
    } else if (p.startsWith('251') && p.length === 12) {
      return p;
    } else if (p.startsWith('0') && p.length === 10) {
      p = `251${p.substring(1)}`;
    } else if ((p.startsWith('9') || p.startsWith('7')) && p.length === 9) {
      p = `251${p}`;
    }
    return p;
  }
}


