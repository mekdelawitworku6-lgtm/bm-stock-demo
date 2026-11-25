import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBorrowingDto {
  @ApiPropertyOptional({ description: 'Total quantity returned so far', minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  quantityReturned?: number;

  @ApiPropertyOptional({ description: 'Note or reason' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Expected return date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  expectedReturnDate?: string;
}
