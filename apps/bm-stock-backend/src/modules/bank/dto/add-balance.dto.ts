import { IsString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddBalanceDto {
  @ApiProperty({ description: 'Bank Account ID' })
  @IsString()
  @IsUUID()
  bankAccountId: string;

  @ApiProperty({ description: 'Amount to add' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Note / Reason' })
  @IsString()
  @IsOptional()
  note?: string;
}
