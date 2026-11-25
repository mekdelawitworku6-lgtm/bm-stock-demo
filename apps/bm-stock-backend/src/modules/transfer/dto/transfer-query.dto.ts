import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransferStatus, TransferType } from '../entities/transfer.entity';

export class TransferQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 10 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;

  @ApiPropertyOptional({ enum: TransferStatus })
  @IsEnum(TransferStatus)
  @IsOptional()
  status?: TransferStatus;

  @ApiPropertyOptional({ enum: TransferType })
  @IsEnum(TransferType)
  @IsOptional()
  type?: TransferType;

  @ApiPropertyOptional({ description: 'Branch (shop) ID to filter by' })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
