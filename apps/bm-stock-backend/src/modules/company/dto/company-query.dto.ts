import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@/common/enums';

export class CompanyQueryDto {
  @ApiPropertyOptional({ description: 'Search term' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by account status',
    enum: ['active', 'deactivated', 'subscription_expired'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'deactivated', 'subscription_expired'])
  accountStatus?: string;

  @ApiPropertyOptional({
    description: 'Only return companies owned by users with this role',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole)
  ownerRole?: UserRole;

  @ApiPropertyOptional({ description: 'Limit' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  readonly limit?: number;

  @ApiPropertyOptional({ description: 'Page' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  readonly page?: number;
}

