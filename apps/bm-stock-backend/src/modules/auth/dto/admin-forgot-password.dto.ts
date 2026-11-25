import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminForgotPasswordDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Admin email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;
}

export class AdminVerifyOtpDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Admin email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code sent to email' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code: string;
}

export class AdminResetPasswordDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Admin email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code sent to email' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code: string;

  @ApiProperty({ example: 'NewSecurePassword123', description: 'New password (4-32 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(32)
  newPassword: string;
}
