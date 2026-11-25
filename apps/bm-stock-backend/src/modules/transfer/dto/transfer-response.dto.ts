import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransferType, TransferStatus } from '../entities/transfer.entity';

export class TransferResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TransferType }) type: TransferType;
  @ApiProperty({ enum: TransferStatus }) status: TransferStatus;
  @ApiProperty() quantity: number;
  @ApiPropertyOptional() note?: string;
  @ApiPropertyOptional() rejectionReason?: string;

  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty() productSku: string;

  @ApiPropertyOptional() fromWarehouseId?: string;
  @ApiPropertyOptional() fromWarehouseName?: string;
  @ApiPropertyOptional() toWarehouseId?: string;
  @ApiPropertyOptional() toWarehouseName?: string;
  @ApiPropertyOptional() fromShopId?: string;
  @ApiPropertyOptional() fromShopName?: string;
  @ApiPropertyOptional() toShopId?: string;
  @ApiPropertyOptional() toShopName?: string;

  @ApiProperty() requestedById: string;
  @ApiProperty() requestedByName: string;
  @ApiPropertyOptional() approvedById?: string;
  @ApiPropertyOptional() approvedByName?: string;

  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
