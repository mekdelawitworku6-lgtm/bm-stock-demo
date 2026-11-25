import { ApiProperty } from '@nestjs/swagger';

export class ShopResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  @ApiProperty({ description: 'Shop name' })
  name: string;

  @ApiProperty({ description: 'Location' })
  location?: string;

  @ApiProperty({ description: 'Warehouse name' })
  warehouseName: string;

  @ApiProperty({ description: 'Company name' })
  companyName: string;

  @ApiProperty({ description: 'Units in stock' })
  unitsInStock: number;

  @ApiProperty({ description: 'Units stored in warehouse' })
  unitsStored: number;

  @ApiProperty({ description: 'Manager name' })
  managerName?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated date' })
  updatedAt: Date;
}