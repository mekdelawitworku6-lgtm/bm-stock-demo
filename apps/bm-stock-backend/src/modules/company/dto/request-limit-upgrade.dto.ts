import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RequestLimitUpgradeDto {
  @ApiProperty({
    description: 'Company names the user wants to add beyond their current limit',
    example: ['Addis Store', 'Bahir Dar Shop'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  companyNames: string[];

  @ApiProperty({ description: 'Selected payment plan id', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({ description: 'Selected payment method (Telebirr or CBE)', example: 'Telebirr' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Payment reference code', example: 'GS12345678' })
  @IsOptional()
  @IsString()
  paymentRef?: string;

  @ApiPropertyOptional({ description: 'Uploaded payment screenshot proof URL' })
  @IsOptional()
  @IsString()
  screenshotUrl?: string;
}

