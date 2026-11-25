import { IsString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBankAccountDto {
  @ApiProperty({ description: 'Bank Name' })
  @IsString()
  bankName: string;

  @ApiProperty({ description: 'Account Number' })
  @IsString()
  accountNumber: string;

  @ApiPropertyOptional({ description: 'Account Holder Name' })
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiProperty({ description: 'Initial Balance' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  initialBalance: number;

  @ApiPropertyOptional({ description: 'Note' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Company ID' })
  @IsString()
  @IsUUID()
  @IsOptional()
  companyId?: string;
}
