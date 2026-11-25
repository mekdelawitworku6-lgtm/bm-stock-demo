import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, IsOptional, IsIn } from 'class-validator';

export class StaffFirstLoginDto {
  @ApiProperty({ description: 'Name of the company', example: 'Gelagle Trading' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ description: 'Master company password set by C Admin on registration', example: 'CompanyPass123' })
  @IsString()
  @IsNotEmpty({ message: 'Company password is required' })
  companyPassword: string;

  @ApiPropertyOptional({ description: 'Staff phone number or identifier to differentiate staff member', example: '0912345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Assigned 4-digit PIN for staff member', example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

export class CAdminFirstLoginDto {
  @ApiProperty({ description: 'Phone number or registered account identifier', example: '0911234567' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Password created during registration', example: 'AdminPass123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: 'Personal 4-digit PIN to set or verify', example: '1234' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin?: string;
}

export class PinUnlockDto {
  @ApiProperty({ description: 'User role', enum: ['admin', 'staff'], example: 'admin' })
  @IsString()
  @IsIn(['admin', 'staff'])
  role: 'admin' | 'staff';

  @ApiProperty({ description: 'Account or Employee identifier stored on device', example: 'uuid-1234' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: '4-digit PIN for quick unlock', example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

export class BiometricUnlockDto {
  @ApiProperty({ description: 'User role', enum: ['admin', 'staff'], example: 'admin' })
  @IsString()
  @IsIn(['admin', 'staff'])
  role: 'admin' | 'staff';

  @ApiProperty({ description: 'Account or Employee identifier stored on device', example: 'uuid-1234' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiPropertyOptional({ description: 'Device refresh token passed after biometric verification' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Optional 4-digit PIN fallback', example: '1234' })
  @IsOptional()
  @IsString()
  pin?: string;
}

export class ChangeAdminPinDto {
  @ApiProperty({ description: 'Current password for verification', example: 'AdminPass123' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'New 4-digit PIN', example: '5678' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'New PIN must be exactly 4 digits' })
  newPin: string;
}

export class SetAdminPinDto {
  @ApiProperty({ description: '4-digit security PIN', example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

