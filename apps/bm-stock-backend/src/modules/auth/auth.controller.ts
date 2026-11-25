import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { CompanyService } from '../company/company.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, AdminCreateUserDto } from './dto/register.dto';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { CheckPhoneDto } from './dto/check-phone.dto';
import { CheckRegistrationDto } from './dto/check-registration.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AdminForgotPasswordDto, AdminVerifyOtpDto, AdminResetPasswordDto } from './dto/admin-forgot-password.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { VerifyReceiptActivateDto } from './dto/verify-receipt-activate.dto';
import { StaffFirstLoginDto, CAdminFirstLoginDto, PinUnlockDto, BiometricUnlockDto, ChangeAdminPinDto, SetAdminPinDto } from './dto/pin-auth.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { User } from '../users/entities/user.entity';
import { UserRole } from '@/common/enums';
import { isTrialPlan } from '@/shared/subscription/subscription-period.util';
import { Throttle } from '@nestjs/throttler';

/**
 * Validates actual binary file headers (magic bytes) to ensure only valid images or PDFs
 * are accepted, independent of client-controlled MIME or file extension (CWE-434 mitigation).
 */
export function detectAllowedImage(buffer: Buffer): { ext: string; mime: string } | null {
  if (!buffer || buffer.length < 8) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }
  // WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }
  // PDF: %PDF-
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { ext: '.pdf', mime: 'application/pdf' };
  }
  return null;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
    private readonly companyService: CompanyService,
  ) {}

  @Public()
  @Get('company-lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public: lookup a company by name (for staff first-time sign-in)' })
  @ApiResponse({ status: 200, description: 'Company found' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async companyLookup(@Query('name') name: string) {
    return this.companyService.lookupByName(name);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('staff-first-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff first-time login with company name, company password, and assigned PIN' })
  @ApiResponse({ status: 200, description: 'Staff login successful' })
  @ApiResponse({ status: 401, description: 'Invalid company password or staff PIN' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async staffFirstLogin(@Body() dto: StaffFirstLoginDto) {
    return this.authService.staffFirstLogin(dto);
  }

  @Public()
  @Post('cadmin-first-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Company Admin first-time login with email, password, and optional PIN' })
  @ApiResponse({ status: 200, description: 'Admin login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async cadminFirstLogin(@Body() dto: CAdminFirstLoginDto) {
    return this.authService.cadminFirstLogin(dto);
  }

  @Public()
  @Post('pin-unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quick 4-digit PIN unlock for returning devices' })
  @ApiResponse({ status: 200, description: 'PIN unlock successful' })
  @ApiResponse({ status: 401, description: 'Invalid PIN' })
  async pinUnlock(@Body() dto: PinUnlockDto) {
    return this.authService.pinUnlock(dto);
  }

  @Public()
  @Post('biometric-unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fingerprint / Biometric unlock for returning devices' })
  @ApiResponse({ status: 200, description: 'Biometric unlock successful' })
  @ApiResponse({ status: 401, description: 'Biometric authentication failed or expired' })
  async biometricUnlock(@Body() dto: BiometricUnlockDto) {
    return this.authService.biometricUnlock(dto);
  }

  @Post('change-admin-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change Company Admin 4-digit PIN' })
  @ApiResponse({ status: 200, description: 'PIN changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changeAdminPin(
    @CurrentUser() user: User,
    @Body() dto: ChangeAdminPinDto,
  ) {
    return this.authService.changeAdminPin(user.id, dto);
  }

  @Post('set-admin-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set 4-digit PIN for authenticated Company Admin' })
  @ApiResponse({ status: 200, description: 'PIN set successfully' })
  async setAdminPin(
    @CurrentUser() user: User,
    @Body() dto: SetAdminPinDto,
  ) {
    return this.authService.setAdminPin(user.id, dto.pin);
  }

  @Public()
  @Get('staff-auth-method')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get staff login method (password or PIN) for a phone number' })
  @ApiResponse({ status: 404, description: 'Phone number is not registered' })
  async getStaffAuthMethod(@Query('phone') phone: string) {
    return this.authService.getStaffAuthMethod(phone);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    const { password, ...userWithoutPassword } = user;
    const isTrial = isTrialPlan(user.planPeriod || registerDto.planPeriod || registerDto.planId);
    return {
      success: true,
      isTrial,
      message: isTrial
        ? 'Free trial activated! You have 14 days of full access.'
        : 'User registered successfully and is pending admin approval',
      user: userWithoutPassword,
    };
  }

  @Public()
  @Post('upload-payment-proof')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload a subscription payment screenshot / proof (before login)' })
  @ApiResponse({ status: 201, description: 'Screenshot uploaded successfully' })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max limit
  }))
  async uploadPaymentProof(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) throw new BadRequestException('No file uploaded');

    // Validate file content via magic bytes (CWE-434 mitigation)
    const detected = detectAllowedImage(file.buffer);
    if (!detected) {
      throw new BadRequestException('Invalid file type: content does not match allowed image formats (JPEG, PNG, WebP, PDF).');
    }

    const dir = join(process.cwd(), 'uploads', 'payment-proofs');
    mkdirSync(dir, { recursive: true });
    // Use the verified extension from magic bytes, never the client-supplied extension
    const filename = `${randomUUID()}${detected.ext}`;
    writeFileSync(join(dir, filename), file.buffer);

    return { success: true, url: `/uploads/payment-proofs/${filename}` };
  }

  @Public()
  @Get('renewal-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview renewal pricing for an expired company admin (by phone)' })
  async getRenewalPreview(@Query('phone') phone: string) {
    return this.authService.getRenewalPreview(phone);
  }

  @Public()
  @Post('renew-subscription')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renew or upgrade a subscription plan (company admin)' })
  @ApiResponse({ status: 200, description: 'Renewal submitted — awaiting admin approval' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async renewSubscription(@Body() dto: RenewSubscriptionDto, @CurrentUser() currentUser?: User) {
    return this.authService.renewSubscription(dto, currentUser);
  }

  @Public()
  @Post('verify-receipt-activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify payment receipt and instantly activate a pending account' })
  @ApiResponse({ status: 200, description: 'Receipt verified and account activated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid receipt or verification failed' })
  @ApiResponse({ status: 404, description: 'No account found for phone number' })
  async verifyReceiptAndActivate(@Body() dto: VerifyReceiptActivateDto) {
    return this.authService.verifyReceiptAndActivate(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP via AfroMessage SMS' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid phone number or SMS delivery failure' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    const result = await this.otpService.sendOtp(sendOtpDto.phone);
    const isDevOrFallback = process.env.OTP_DEV_MODE === 'true' || process.env.NODE_ENV === 'development' || !result.smsSent;
    return {
      success: true,
      message: result.smsError ? `OTP code generated (${result.smsError})` : 'OTP sent successfully',
      verificationId: result.verificationId,
      ...(isDevOrFallback ? { code: result.code } : {}),
      ...(result.smsError ? { smsError: result.smsError } : {}),
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('check-phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if a phone number is already registered (used before sending OTP on signup)' })
  @ApiResponse({ status: 200, description: 'Phone number is available' })
  @ApiResponse({ status: 409, description: 'An account with this phone number already exists' })
  async checkPhone(@Body() checkPhoneDto: CheckPhoneDto) {
    const exists = await this.authService.phoneExists(checkPhoneDto.phone);
    if (exists) {
      throw new ConflictException('An account with this phone number already exists. Please log in instead.');
    }
    return { success: true, available: true, message: 'Phone number is available' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('check-registration')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pre-registration check: validates phone and optional email are available (called before OTP)' })
  @ApiResponse({ status: 200, description: 'Phone and email are available' })
  @ApiResponse({ status: 409, description: 'Account with this phone number or email already exists' })
  async checkRegistration(@Body() dto: CheckRegistrationDto) {
    const phoneExists = await this.authService.phoneExists(dto.phone);
    if (phoneExists) {
      throw new ConflictException('An account with this phone number already exists. Please log in instead.');
    }
    if (dto.email && dto.email.trim()) {
      const emailExists = await this.authService.emailExists(dto.email.trim());
      if (emailExists) {
        throw new ConflictException('An account with this email address already exists. Please log in instead.');
      }
    }
    return { success: true, available: true, message: 'Phone and email are available' };
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code from AfroMessage' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    // Verify without consuming so the code stays valid for the reset-password step.
    await this.otpService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.code, false);
    return {
      success: true,
      message: 'OTP verified successfully',
      verified: true,
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password after OTP verification' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 401, description: 'No account found with this phone number' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    // First verify the OTP
    await this.otpService.verifyOtp(resetPasswordDto.phone, resetPasswordDto.code);
    // Then reset the password
    await this.authService.resetPassword(resetPasswordDto.phone, resetPasswordDto.newPassword);
    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  @Public()
  @Post('admin-forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to admin email for password reset (via Brevo)' })
  @ApiResponse({ status: 200, description: 'OTP sent to admin email' })
  @ApiResponse({ status: 404, description: 'No admin account found with this email' })
  async adminForgotPassword(@Body() dto: AdminForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();

    // Verify the email belongs to an admin user
    const exists = await this.authService.adminEmailExists(email);
    if (!exists) {
      throw new NotFoundException('No active admin account found with this email address.');
    }

    const result = await this.otpService.sendEmailOtp(email);

    const isDev = process.env.OTP_DEV_MODE === 'true' || process.env.NODE_ENV === 'development' || !result.emailSent;
    return {
      success: true,
      message: result.emailError
        ? `OTP code generated (email delivery issue: ${result.emailError})`
        : 'A verification code has been sent to your email address.',
      verificationId: result.verificationId,
      ...(isDev ? { code: result.code } : {}),
      ...(result.emailError ? { emailError: result.emailError } : {}),
    };
  }

  @Public()
  @Post('admin-verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email OTP code (admin portal forgot password)' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async adminVerifyOtp(@Body() dto: AdminVerifyOtpDto) {
    await this.otpService.verifyEmailOtp(dto.email, dto.code, false);
    return {
      success: true,
      message: 'OTP verified successfully',
      verified: true,
    };
  }

  @Public()
  @Post('admin-reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset admin password after email OTP verification' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 404, description: 'No admin account found' })
  async adminResetPassword(@Body() dto: AdminResetPasswordDto) {
    // Verify and consume the OTP
    await this.otpService.verifyEmailOtp(dto.email, dto.code, true);
    // Reset the password
    await this.authService.adminResetPasswordByEmail(dto.email, dto.newPassword);
    return {
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    };
  }

  @Post('admin/create-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Admin create user' })
  @ApiResponse({ status: 201, description: 'User created successfully by admin' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async adminCreateUser(
    @Body() adminCreateUserDto: AdminCreateUserDto,
    @CurrentUser() adminUser: User,
  ) {
    if (!adminUser || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(adminUser.role)) {
      throw new Error('Forbidden - Admin access required');
    }
    const user = await this.authService.adminCreateUser(adminCreateUserDto, adminUser);
    const { password, ...userWithoutPassword } = user;
    return { 
      success: true,
      message: 'User created successfully',
      user: userWithoutPassword 
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
