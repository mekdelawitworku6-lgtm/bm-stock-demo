import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlanDto {
  @ApiProperty({ description: 'Plan title', example: 'For 1 Month' })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'Formatted price label', example: '399' })
  @IsString()
  @MaxLength(20)
  price: string;

  @ApiProperty({ description: 'Numeric amount in ETB', example: 399 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Plan period identifier', example: '1_month' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  period?: string;

  @ApiProperty({ description: 'Plan features list', type: [String] })
  @IsArray()
  @IsString({ each: true })
  features: string[];

  @ApiPropertyOptional({ description: 'Extra hidden benefits count', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  moreCount?: number;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the plan is visible in the app', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class UpdatePlanDto extends CreatePlanDto {}

export class PlanResponseDto {
  @ApiProperty({ description: 'Plan ID' })
  id: string;

  @ApiProperty({ description: 'Plan title' })
  title: string;

  @ApiProperty({ description: 'Formatted price label' })
  price: string;

  @ApiProperty({ description: 'Numeric amount in ETB' })
  amount: number;

  @ApiPropertyOptional({ description: 'Plan period identifier' })
  period?: string;

  @ApiProperty({ description: 'Plan features list', type: [String] })
  features: string[];

  @ApiProperty({ description: 'Extra hidden benefits count' })
  moreCount: number;

  @ApiProperty({ description: 'Display order' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether the plan is visible in the app' })
  isActive: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}
