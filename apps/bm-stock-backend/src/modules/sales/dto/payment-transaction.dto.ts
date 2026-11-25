import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentType, TransactionType } from '../enums';

export class CreatePaymentTransactionDto {
  @ApiPropertyOptional({ description: 'Sale ID' })
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiProperty({ description: 'Amount' })
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Payment method', enum: PaymentType })
  @IsEnum(PaymentType)
  paymentMethod: PaymentType;

  @ApiPropertyOptional({ description: 'Transaction type', enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional({ description: 'Transaction reference' })
  @IsString()
  @IsOptional()
  transactionReference?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Payment details (JSON)' })
  @IsOptional()
  paymentDetails?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Processed by user ID' })
  @IsOptional()
  @IsString()
  processedBy?: string;
}

export class PaymentTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: PaymentType })
  paymentMethod: PaymentType;

  @ApiProperty({ enum: TransactionType })
  transactionType: TransactionType;

  @ApiProperty()
  transactionReference?: string;

  @ApiProperty()
  notes?: string;

  @ApiProperty()
  transactionDate: Date;

  @ApiProperty()
  paymentDetails?: Record<string, any>;

  @ApiProperty()
  isSuccessful: boolean;

  @ApiProperty()
  failureReason?: string;

  @ApiProperty()
  saleId: string;

  @ApiProperty()
  processedBy: string;

  @ApiPropertyOptional()
  processedByName?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
