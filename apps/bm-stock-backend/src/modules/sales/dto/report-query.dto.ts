import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  CUSTOM = 'custom',
  ALL = 'all',
}

export enum ReportLocationType {
  SHOP = 'shop',
  WAREHOUSE = 'warehouse',
}

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'Report period', enum: ReportPeriod, default: ReportPeriod.MONTH })
  @IsEnum(ReportPeriod)
  @IsOptional()
  period?: ReportPeriod = ReportPeriod.MONTH;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD) for custom period' })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD) for custom period' })
  @IsString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by product ID' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by seller (user) ID' })
  @IsUUID()
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Filter by shop or warehouse ID' })
  @IsUUID()
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Location type', enum: ReportLocationType })
  @IsEnum(ReportLocationType)
  @IsOptional()
  locationType?: ReportLocationType;

  @ApiPropertyOptional({ description: 'Company ID filter' })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Max sales returned', default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit?: number = 50;
}
