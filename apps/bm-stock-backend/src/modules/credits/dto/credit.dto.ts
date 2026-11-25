import { IsString, IsNumber, IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCreditAccountDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Total amount owed' })
  @IsNumber({ maxDecimalPlaces: 2 })
  totalOwed: number;

  @ApiPropertyOptional({ description: 'Interest rate (percentage)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  interestRate?: number;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Linked sale ID' })
  @IsString()
  @IsUUID()
  @IsOptional()
  saleId?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCreditAccountDto {
  @ApiPropertyOptional({ description: 'Total amount owed' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  totalOwed?: number;

  @ApiPropertyOptional({ description: 'Interest rate' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  interestRate?: number;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateCreditPaymentDto {
  @ApiProperty({ description: 'Payment amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @ApiProperty({ description: 'Payment method', example: 'cash' })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Reference number' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
