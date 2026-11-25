import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: '1234', minLength: 4 })
  @IsString()
  @MinLength(4)
  password: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'My Company' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: '+251911234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '1_month', description: 'Selected subscription plan ID' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 'For 1 Month', description: 'Selected subscription plan title' })
  @IsOptional()
  @IsString()
  planTitle?: string;

  @ApiPropertyOptional({ example: 399, description: 'Subscription amount to pay' })
  @IsOptional()
  @IsNumber()
  planAmount?: number;

  @ApiPropertyOptional({ example: '1_month', description: 'Subscription period' })
  @IsOptional()
  @IsString()
  planPeriod?: string;

  @ApiPropertyOptional({ example: 3, description: 'Number of companies the user will add' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  numCompanies?: number;

  @ApiPropertyOptional({ example: 'Telebirr', description: 'Subscription payment method used' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;


  @ApiPropertyOptional({ example: 'GS171234567890', description: 'Subscription payment reference number' })
  @IsOptional()
  @IsString()
  paymentRef?: string;

  @ApiPropertyOptional({ example: '/uploads/payment-proofs/abc.png', description: 'URL of the uploaded payment screenshot / proof' })
  @IsOptional()
  @IsString()
  paymentScreenshot?: string;

  @ApiPropertyOptional({ example: '123456789012', description: 'Fayda Digital ID (FIN)' })
  @IsOptional()
  @IsString()
  faydaId?: string;

  @ApiPropertyOptional({ example: '1234567890', description: 'Tax Identification Number (TIN)' })
  @IsOptional()
  @IsString()
  tinNumber?: string;

  @ApiPropertyOptional({ example: 'Bole, Addis Ababa', description: 'Business address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Retail Store', description: 'Business sector' })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the subscription payment receipt was verified via verify.et' })
  @IsOptional()
  @IsBoolean()
  receiptVerified?: boolean;

  @ApiPropertyOptional({ example: 'https://mbreciept.cbe.com.et/...', description: 'Receipt verification link or URL' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional({ example: 'PENDING', description: 'Client-supplied payment status hint (ignored server-side; server always determines this autonomously)' })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiPropertyOptional({ example: 'otp-xxx' })
  @IsOptional()
  @IsString()
  verificationId?: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  code?: string;
}

export class AdminCreateUserDto extends RegisterDto {
  @ApiPropertyOptional({ 
    enum: UserRole, 
    example: UserRole.USER,
    description: 'User role (only admins can set this)' 
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ 
    example: true,
    description: 'Skip email verification (admin only)' 
  })
  @IsOptional()
  skipEmailVerification?: boolean;
}
