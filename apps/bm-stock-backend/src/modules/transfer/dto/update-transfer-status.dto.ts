import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransferStatus } from '../entities/transfer.entity';

export class UpdateTransferStatusDto {
  @ApiProperty({ enum: [TransferStatus.APPROVED, TransferStatus.REJECTED, TransferStatus.CANCELLED] })
  @IsEnum([TransferStatus.APPROVED, TransferStatus.REJECTED, TransferStatus.CANCELLED])
  status: TransferStatus;

  @ApiPropertyOptional({ description: 'Rejection reason (required if status is rejected)' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
