import { ApiProperty } from '@nestjs/swagger';

export class InventorySummaryDto {
  @ApiProperty() totalProducts: number;
  @ApiProperty() totalStockValue: number;
  @ApiProperty() lowStockItems: number;
  @ApiProperty() expiredItems: number;
}

export class SalesSummaryDto {
  @ApiProperty() totalSales: number;
  @ApiProperty() totalRevenue: number;
  @ApiProperty() averageSaleAmount: number;
  @ApiProperty() totalCustomers: number;
}

export class ExpenseSummaryDto {
  @ApiProperty() totalExpenses: number;
  @ApiProperty() totalAmount: number;
}

export class DashboardMetadataDto {
  @ApiProperty() generatedAt: string;
  @ApiProperty() periodStart: string;
  @ApiProperty() periodEnd: string;
  @ApiProperty() filters: { format: string; period: string };
}

export class DashboardSummaryResponseDto {
  @ApiProperty() metadata: DashboardMetadataDto;
  @ApiProperty() inventory: InventorySummaryDto;
  @ApiProperty() sales: SalesSummaryDto;
  @ApiProperty() expenses: ExpenseSummaryDto;
}
