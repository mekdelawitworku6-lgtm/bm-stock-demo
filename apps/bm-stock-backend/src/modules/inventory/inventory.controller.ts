import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryTransactionDto } from './dto';
import { InventoryTransactionType } from './entities/inventory-transaction.entity';
import { PaginatedResult } from '@/common/interfaces';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { CurrentUser, Roles } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('Inventory Transactions')
@ApiBearerAuth('access-token')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjust')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE_EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a stock in/out/adjustment transaction' })
  @ApiBody({ type: CreateInventoryTransactionDto })
  @ApiResponse({ status: 201, description: 'Transaction created' })
  async create(
    @Body() dto: CreateInventoryTransactionDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.inventoryService.create(dto, currentUser);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List inventory transactions with filters' })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'shopId', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: InventoryTransactionType })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Transaction list' })
  async findAll(
    @Query() query: {
      productId?: string;
      warehouseId?: string;
      shopId?: string;
      companyId?: string;
      type?: InventoryTransactionType;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
    @CurrentUser() currentUser?: User,
  ): Promise<PaginatedResult<any>> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    if (!isPlatformAdmin && currentUser?.companyId) {
      query.companyId = currentUser.companyId;
    }
    return this.inventoryService.findAll(query);
  }

  @Get('purchases')
  @ApiOperation({ summary: 'List purchase (stock-in) transactions with filters and financial summary' })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'shopId', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Purchases list with financial summary' })
  async getPurchases(
    @Query() query: {
      productId?: string;
      warehouseId?: string;
      shopId?: string;
      companyId?: string;
      search?: string;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
    @CurrentUser() currentUser?: User,
  ) {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    if (!isPlatformAdmin && currentUser?.companyId) {
      query.companyId = currentUser.companyId;
    }
    return this.inventoryService.getPurchases(query);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get transaction history for a product' })
  @ApiResponse({ status: 200, description: 'Transaction history' })
  async findByProduct(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.inventoryService.findByProduct(productId);
  }
}
