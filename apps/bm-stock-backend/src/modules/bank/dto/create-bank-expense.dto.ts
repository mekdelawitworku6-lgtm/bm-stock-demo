import { IsString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBankExpenseDto {
  @ApiProperty({ description: 'Expense Amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Reason for the expense' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Bank Account ID' })
  @IsString()
  @IsUUID()
  @IsOptional()
  bankAccountId?: string;

  @ApiPropertyOptional({ description: 'Company ID' })
  @IsString()
  @IsUUID()
  @IsOptional()
  companyId?: string;
}
