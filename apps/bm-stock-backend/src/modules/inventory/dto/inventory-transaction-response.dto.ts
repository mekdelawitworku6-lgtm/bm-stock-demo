import { ApiProperty } from '@nestjs/swagger';
import { InventoryTransactionType } from '../entities/inventory-transaction.entity';

export class InventoryTransactionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: InventoryTransactionType }) type: InventoryTransactionType;
  @ApiProperty() quantity: number;
  @ApiProperty({ required: false }) previousQuantity?: number;
  @ApiProperty({ required: false }) newQuantity?: number;
  @ApiProperty({ required: false }) reason?: string;
  @ApiProperty({ required: false }) referenceNumber?: string;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty({ required: false }) performedById?: string;
  @ApiProperty({ required: false }) performedByName?: string;
  @ApiProperty({ required: false }) warehouseId?: string;
  @ApiProperty({ required: false }) warehouseName?: string;
  @ApiProperty({ required: false }) shopId?: string;
  @ApiProperty({ required: false }) shopName?: string;
  @ApiProperty() createdAt: Date;
}
