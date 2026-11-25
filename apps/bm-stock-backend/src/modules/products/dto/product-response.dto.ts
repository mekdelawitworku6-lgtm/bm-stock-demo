
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, ProductStatus, CommissionType } from '../enums';

export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ProductType })
  type: ProductType;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  sku: string;

  @ApiPropertyOptional()
  barcode?: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  cost: number;

  @ApiPropertyOptional()
  expiryDate?: Date;

  @ApiProperty({ enum: ProductStatus })
  status: ProductStatus;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty()
  taxRate: number;

  @ApiProperty({ description: 'Commission rate (value depend on type: % if percent, ETB if fixed)' })
  commissionRate: number;

  @ApiProperty({ enum: CommissionType, description: 'Commission type: percent or fixed' })
  commissionType: CommissionType;

  @ApiProperty()
  trackStock: boolean;

  @ApiProperty()
  profitMargin: number;

  @ApiProperty()
  isExpired: boolean;

  @ApiProperty({ description: 'Current stock quantity' })
  stockQuantity: number;

  @ApiProperty({ description: 'Minimum stock level' })
  minStockLevel: number;

  @ApiPropertyOptional({ description: 'Exact date on which the expiry reminder SMS is sent' })
  reminderDate?: Date;

  @ApiPropertyOptional({ description: 'Supplier ID for this product' })
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Supplier name for this product' })
  supplierName?: string;

  @ApiPropertyOptional({ description: 'Warehouses and Shops location breakdown' })
  locations?: Array<{ id?: string; name: string; location?: string; quantity: number; type: string }>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
