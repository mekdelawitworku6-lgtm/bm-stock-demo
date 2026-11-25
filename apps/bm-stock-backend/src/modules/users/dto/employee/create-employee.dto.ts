import { IsString, IsOptional, IsNumber, MinLength, MaxLength, IsObject, IsEnum, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@/common/enums';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Employee name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Phone number (10-digit Ethiopian mobile number, numbers only)' })
  @IsString()
  @Matches(/^(0[79]\d{8}|[79]\d{8}|\+?251[79]\d{8})$/, {
    message: 'Phone number must be a valid 10-digit Ethiopian number (e.g. 09xxxxxxxx or 07xxxxxxxx, numbers only)',
  })
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Password for staff login', minLength: 6, maxLength: 128 })
  @IsString()
  @IsOptional()
  @MinLength(6)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: 'Role for the linked staff user account', enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Base commission rate' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  baseCommissionRate?: number;

  @ApiPropertyOptional({ description: 'Base commission type: percent or fixed', enum: ['percent', 'fixed'] })
  @IsString()
  @IsOptional()
  baseCommissionType?: string;

  @ApiPropertyOptional({ description: 'Job title' })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'User ID (auto-created if not provided)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Company ID' })
  @IsString()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Shop ID' })
  @IsString()
  @IsOptional()
  shopId?: string;

  @ApiPropertyOptional({ description: 'Warehouse ID' })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Module access permissions' })
  @IsObject()
  @IsOptional()
  modulePermissions?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Branch access permissions' })
  @IsObject()
  @IsOptional()
  branchPermissions?: Record<string, any>;

  @ApiPropertyOptional({ description: 'General permissions JSON' })
  @IsObject()
  @IsOptional()
  permissions?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Staff login method', enum: ['password', 'pin'] })
  @IsIn(['password', 'pin'])
  @IsOptional()
  authMethod?: 'password' | 'pin';

  @ApiPropertyOptional({ description: '4-digit PIN when authMethod is pin' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin?: string;
}