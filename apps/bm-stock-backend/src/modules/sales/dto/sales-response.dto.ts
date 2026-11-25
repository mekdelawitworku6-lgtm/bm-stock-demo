import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PaymentType, SaleStatus } from '../enums';



export class SaleItemResponseDto {

  @ApiProperty()

  id: string;



  @ApiProperty()

  productId: string;



  @ApiProperty()

  productName: string;



  @ApiPropertyOptional()

  brand?: string;



  @ApiProperty()

  quantity: number;



  @ApiProperty()

  unitPrice: number;



  @ApiProperty()

  total: number;

}



export class SaleResponseDto {

  @ApiProperty({ description: 'Unique identifier' })

  id: string;



  @ApiPropertyOptional({ description: 'Invoice number' })

  invoiceNumber?: string;



  @ApiProperty({ description: 'Total amount' })

  totalAmount: number;



  @ApiProperty({ description: 'Tax amount' })

  taxAmount: number;



  @ApiPropertyOptional({ description: 'Subtotal before tax/discount' })

  subtotal?: number;



  @ApiPropertyOptional({ description: 'Discount amount' })

  discountAmount?: number;



  @ApiProperty({ description: 'Advance payment' })

  advancePayment: number;



  @ApiProperty({ description: 'Amount paid so far (advance + payments)' })

  amountPaid: number;



  @ApiProperty({ description: 'Remaining balance' })

  remainingBalance: number;



  @ApiProperty({ description: 'Sale date' })

  saleDate: Date;



  @ApiPropertyOptional({ description: 'Due date for credit sales' })

  dueDate?: Date;



  @ApiPropertyOptional({ description: 'Payment reminder date for credit sales' })

  reminderDate?: Date;



  @ApiProperty({ description: 'Payment type' })

  paymentType: PaymentType;



  @ApiProperty({ description: 'Status' })

  status: SaleStatus;



  @ApiPropertyOptional({ description: 'Note' })

  note?: string;



  @ApiPropertyOptional({ description: 'URL of the uploaded receipt / transaction screenshot' })

  receiptImageUrl?: string;



  @ApiPropertyOptional({ description: 'Customer ID' })

  customerId?: string;



  @ApiProperty({ description: 'Customer name' })

  customerName: string;



  @ApiPropertyOptional({ description: 'Customer phone number' })

  customerPhone?: string;



  @ApiProperty({ description: 'Warehouse name' })

  warehouseName: string;



  @ApiPropertyOptional({ description: 'Shop name' })

  shopName?: string;



  @ApiPropertyOptional({ description: 'Salesperson name' })

  salespersonName?: string;



  @ApiPropertyOptional({ description: 'Line items', type: [SaleItemResponseDto] })

  items?: SaleItemResponseDto[];



  @ApiPropertyOptional({ description: 'Amount paid on last payment' })
  lastPaymentAmount?: number;

  @ApiPropertyOptional({ description: 'Date of last payment' })
  lastPaymentDate?: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated date' })
  updatedAt: Date;
}

