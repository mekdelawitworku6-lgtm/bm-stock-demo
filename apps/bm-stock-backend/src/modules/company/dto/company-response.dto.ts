import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CompanyOwnerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  numCompanies?: number;

  @ApiPropertyOptional()
  faydaId?: string;

  @ApiPropertyOptional()
  tin?: string;
}

export class CompanySubscriptionDto {
  @ApiPropertyOptional()
  planId?: string;

  @ApiPropertyOptional()
  planTitle?: string;

  @ApiPropertyOptional()
  planAmount?: number;

  @ApiPropertyOptional()
  planPeriod?: string;

  @ApiPropertyOptional()
  paymentStatus?: string;

  @ApiPropertyOptional()
  paymentMethod?: string;

  @ApiPropertyOptional()
  paymentRef?: string;

  @ApiPropertyOptional()
  paymentScreenshot?: string;

  @ApiPropertyOptional()
  subscriptionStartDate?: Date;

  @ApiPropertyOptional()
  subscriptionPaymentDate?: Date;

  @ApiPropertyOptional()
  subscriptionNextPaymentDate?: Date;

  @ApiPropertyOptional()
  subscriptionExpiresAt?: Date;
}

export class PaymentHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  amount?: number;

  @ApiPropertyOptional()
  method?: string;

  @ApiPropertyOptional()
  reference?: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  paidAt?: Date;
}

export class CompanyResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  @ApiProperty({ description: 'Company name' })
  name: string;

  @ApiProperty({ description: 'Company address' })
  address: string;

  @ApiProperty({ description: 'Company phone number', required: false })
  phoneNumber?: string;

  @ApiProperty({ description: 'Company email', required: false })
  email?: string;

  @ApiProperty({ description: 'Company description', required: false })
  description?: string;

  @ApiPropertyOptional({ description: 'Company account status' })
  status?: string;

  @ApiPropertyOptional({ description: 'Computed account status for admin display' })
  accountStatus?: string;

  @ApiPropertyOptional({ description: 'Number of stores (shops + warehouses)' })
  storesCount?: number;

  @ApiPropertyOptional({ description: 'Number of staff user accounts' })
  staffCount?: number;

  @ApiPropertyOptional({ description: 'Subscription summary' })
  subscription?: CompanySubscriptionDto;

  @ApiPropertyOptional({ description: 'Payment history' })
  paymentHistory?: PaymentHistoryItemDto[];

  @ApiProperty({ description: 'User who created/owns this company', required: false })
  createdBy?: CompanyOwnerDto;

  @ApiProperty({ description: 'Warehouses associated with the company' })
  warehouses?: { id: string; name: string }[];

  @ApiProperty({ description: 'Shops associated with the company' })
  shops?: { id: string; name: string }[];

  @ApiProperty({ description: 'Employees associated with the company' })
  employees?: {
    id: string;
    name: string;
    phoneNumber: string;
    jobTitle?: string;
    baseCommissionRate?: number;
    userId?: string;
    userName?: string;
    userEmail?: string;
  }[];

  @ApiProperty({ description: 'Users (staff accounts) associated with the company' })
  users?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    createdAt: Date;
  }[];

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated date' })
  updatedAt: Date;
}
