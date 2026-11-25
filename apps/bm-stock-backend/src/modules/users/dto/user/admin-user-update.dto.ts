

import { IsEnum, IsOptional, IsString, IsBoolean, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../../../../common/enums';
import { UpdateUserDto } from './update-user.dto';

export class AdminUpdateUserDto extends UpdateUserDto {
  @ApiPropertyOptional({ 
    enum: UserRole,
    description: 'User role (admin only)' 
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ 
    enum: UserStatus,
    description: 'User status (admin only)' 
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ 
    description: 'Email verification status (admin only)' 
  })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({ 
    description: 'Admin portal permissions for sub-admin users',
    example: ['dashboard', 'users', 'companies'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adminPermissions?: string[];
}