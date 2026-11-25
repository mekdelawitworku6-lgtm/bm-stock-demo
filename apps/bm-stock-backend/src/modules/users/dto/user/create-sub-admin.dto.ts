import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, MaxLength, IsOptional, IsArray, IsString } from 'class-validator';

export class CreateSubAdminDto {
  @ApiProperty({ example: 'subadmin@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '+251911234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: ['dashboard', 'users', 'companies', 'pending_approvals'],
    description: 'Admin portal permissions for this sub-admin',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adminPermissions?: string[];
}

export class UpdateSubAdminDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'subadmin@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+251911234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: ['dashboard', 'users', 'companies'],
    description: 'Updated admin portal permissions',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adminPermissions?: string[];
}

export class UpdateSubAdminPermissionsDto {
  @ApiProperty({
    example: ['dashboard', 'users', 'companies', 'pending_approvals'],
    description: 'Full list of admin portal permissions to set',
  })
  @IsArray()
  @IsString({ each: true })
  adminPermissions: string[];
}
