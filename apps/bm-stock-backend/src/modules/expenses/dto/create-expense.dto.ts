import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({ description: 'Name of the item, goods or service purchased' })
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiPropertyOptional({ description: 'Expense category (e.g. Supplies, Fuel)' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Quantity purchased', default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Cost per unit in ETB', default: 0, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Total expense amount in ETB', minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalCost?: number;

  @ApiPropertyOptional({ description: 'Supplier or vendor name' })
  @IsString()
  @IsOptional()
  supplierName?: string;

  @ApiPropertyOptional({ description: 'Receipt or reference number' })
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Warehouse ID' })
  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Shop ID' })
  @IsUUID()
  @IsOptional()
  shopId?: string;

  @ApiPropertyOptional({ description: 'Company ID (platform admins only)' })
  @IsUUID()
  @IsOptional()
  companyId?: string;
}
