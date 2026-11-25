import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransferType } from '../entities/transfer.entity';

export class CreateTransferDto {
  @ApiProperty({ enum: TransferType, description: 'Type of transfer' })
  @IsEnum(TransferType)
  @IsNotEmpty()
  type: TransferType;

  @ApiProperty({ description: 'Product ID to transfer' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ description: 'Source warehouse ID (for warehouse_to_shop)' })
  @IsUUID()
  @IsOptional()
  fromWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Destination warehouse ID (for shop_to_warehouse)' })
  @IsUUID()
  @IsOptional()
  toWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Source shop ID (for shop_to_warehouse)' })
  @IsUUID()
  @IsOptional()
  fromShopId?: string;

  @ApiPropertyOptional({ description: 'Destination shop ID (for warehouse_to_shop)' })
  @IsUUID()
  @IsOptional()
  toShopId?: string;

  @ApiProperty({ description: 'Quantity to transfer', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({ description: 'Transfer note' })
  @IsString()
  @IsOptional()
  note?: string;
}
