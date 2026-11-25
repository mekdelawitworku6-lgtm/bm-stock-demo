import { IsString, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryTransactionType } from '../entities/inventory-transaction.entity';

export class CreateInventoryTransactionDto {
  @ApiProperty({ description: 'Transaction type', enum: InventoryTransactionType })
  @IsEnum(InventoryTransactionType)
  type: InventoryTransactionType;

  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Quantity (positive for in, negative for out)' })
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ description: 'Warehouse ID' })
  @IsString()
  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Shop ID' })
  @IsString()
  @IsUUID()
  @IsOptional()
  shopId?: string;

  @ApiPropertyOptional({ description: 'Reason for transaction' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Reference number' })
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Unit cost for purchase' })
  @IsNumber()
  @IsOptional()
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsString()
  @IsOptional()
  supplierId?: string;
}
