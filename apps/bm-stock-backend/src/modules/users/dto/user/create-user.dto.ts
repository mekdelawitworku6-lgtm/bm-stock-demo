import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, MaxLength, IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../../common/enums';

export class CreateUserDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ example: '1234' })
  @IsNotEmpty()
  @MinLength(4)
  password: string;

  @ApiPropertyOptional({ example: '+251911234567' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'User role' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Company ID to assign user to' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Shop ID to assign user to' })
  @IsOptional()
  @IsUUID()
  shopId?: string;

  @ApiPropertyOptional({ description: 'Warehouse ID to assign user to' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Job title for employee record' })
  @IsOptional()
  @MaxLength(255)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Subscription plan ID' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ description: 'Subscription plan title' })
  @IsOptional()
  @MaxLength(100)
  planTitle?: string;

  @ApiPropertyOptional({ description: 'Subscription amount' })
  @IsOptional()
  @Type(() => Number)
  planAmount?: number;

  @ApiPropertyOptional({ description: 'Subscription period' })
  @IsOptional()
  @MaxLength(50)
  planPeriod?: string;

  @ApiPropertyOptional({ description: 'Number of companies the user will add' })
  @IsOptional()
  @Type(() => Number)
  numCompanies?: number;

  @ApiPropertyOptional({ description: 'Subscription payment method used (e.g. Telebirr, CBE)' })
  @IsOptional()
  @MaxLength(50)
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Subscription payment status' })
  @IsOptional()
  @MaxLength(50)
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Subscription payment reference number' })
  @IsOptional()
  @MaxLength(100)
  paymentRef?: string;

  @ApiPropertyOptional({ description: 'URL of the uploaded payment screenshot / proof' })
  @IsOptional()
  @IsString()
  paymentScreenshot?: string;

  @ApiPropertyOptional({ description: 'Fayda Digital ID (FIN)' })
  @IsOptional()
  @MaxLength(20)
  faydaId?: string;

  @ApiPropertyOptional({ description: 'Tax Identification Number (TIN)' })
  @IsOptional()
  @MaxLength(20)
  tin?: string;
}