import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBorrowingDto {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiPropertyOptional({ description: 'Product type or category' })
  @IsString()
  @IsOptional()
  productCategory?: string;

  @ApiPropertyOptional({ description: 'Linked catalog product ID' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiProperty({ description: 'Quantity taken', minimum: 1 })
  @IsInt()
  @Min(1)
  quantityTaken: number;

  @ApiProperty({ description: 'Seller or person borrowed from' })
  @IsString()
  @IsNotEmpty()
  sellerName: string;

  @ApiPropertyOptional({ description: 'Seller contact phone' })
  @IsString()
  @IsOptional()
  sellerPhone?: string;

  @ApiProperty({ description: 'Date the product was taken (YYYY-MM-DD)' })
  @IsDateString()
  dateTaken: string;

  @ApiPropertyOptional({ description: 'Expected return date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  expectedReturnDate?: string;

  @ApiPropertyOptional({ description: 'Note or reason' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Receiving warehouse ID' })
  @ValidateIf((o) => !o.shopId)
  @IsUUID()
  @IsNotEmpty()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Receiving shop ID' })
  @ValidateIf((o) => !o.warehouseId)
  @IsUUID()
  @IsNotEmpty()
  shopId?: string;
}
