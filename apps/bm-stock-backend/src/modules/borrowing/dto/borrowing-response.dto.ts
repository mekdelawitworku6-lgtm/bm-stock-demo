import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BorrowingStatus } from '../entities/product-borrowing.entity';

export class BorrowingResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() productName: string;
  @ApiPropertyOptional() productCategory?: string;
  @ApiPropertyOptional() productId?: string;
  @ApiProperty() quantityTaken: number;
  @ApiProperty() quantityReturned: number;
  @ApiProperty() remainingQuantity: number;
  @ApiProperty() sellerName: string;
  @ApiPropertyOptional() sellerPhone?: string;
  @ApiProperty() dateTaken: string;
  @ApiPropertyOptional() expectedReturnDate?: string;
  @ApiPropertyOptional() note?: string;
  @ApiPropertyOptional() warehouseId?: string;
  @ApiPropertyOptional() warehouseName?: string;
  @ApiPropertyOptional() shopId?: string;
  @ApiPropertyOptional() shopName?: string;
  @ApiProperty({ enum: BorrowingStatus }) status: BorrowingStatus;
  @ApiPropertyOptional() recordedByName?: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}
