import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class RenewSubscriptionDto {
  @ApiPropertyOptional({ example: '+251912345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'admin@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'plan-uuid' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 'For 1 Month' })
  @IsOptional()
  @IsString()
  planTitle?: string;

  @ApiPropertyOptional({ example: 399 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  planAmount?: number;

  @ApiPropertyOptional({ example: '1_month' })
  @IsOptional()
  @IsString()
  planPeriod?: string;

  @ApiPropertyOptional({ example: 'Telebirr' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'GS1786539884633' })
  @IsOptional()
  @IsString()
  paymentRef?: string;

  @ApiPropertyOptional({ example: '/uploads/payment-proofs/abc.png' })
  @IsOptional()
  @IsString()
  paymentScreenshot?: string;
}
