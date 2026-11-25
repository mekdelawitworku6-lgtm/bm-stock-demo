import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus, Patch, UseGuards, BadRequestException, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { Response } from 'express';
import { SalesService } from './sales.service';
import { ReceiptService } from '../receipt/receipt.service';
import { detectAllowedImage } from '../auth/auth.controller';
import { CreateSaleDto, UpdateSaleDto, SaleQueryDto, SaleResponseDto, ReportQueryDto } from './dto';
import { QuickSaleDto } from './dto/quick-sale.dto';
import { CreatePaymentTransactionDto, PaymentTransactionResponseDto } from './dto/payment-transaction.dto';
import { PaginatedResult } from '@/common/interfaces';
import { SaleStatus, TransactionType } from './enums';
import { JwtAuthGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('Sales')
@ApiBearerAuth('access-token')
@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly receiptService: ReceiptService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new sale' })
  @ApiBody({ type: CreateSaleDto })
  @ApiResponse({ status: 201, description: 'Sale created successfully', type: SaleResponseDto })
  async create(
    @Body() createSaleDto: CreateSaleDto,
    @CurrentUser() currentUser: any
  ): Promise<SaleResponseDto> {
    // Auto-set createdBy from current user
    createSaleDto.createdBy = currentUser.id;
    
    // Auto-set warehouse/shop from JWT if not provided
    if (!createSaleDto.warehouseId && currentUser.warehouseId) {
      createSaleDto.warehouseId = currentUser.warehouseId;
    }
    if (!createSaleDto.shopId && currentUser.shopId) {
      createSaleDto.shopId = currentUser.shopId;
    }
    
    return this.salesService.create(createSaleDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sales with filtering' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: SaleStatus })
  @ApiResponse({ status: 200, description: 'List of sales', type: [SaleResponseDto] })
  async findAll(@Query() query: SaleQueryDto, @CurrentUser() currentUser: any): Promise<PaginatedResult<SaleResponseDto>> {
    return this.salesService.findAll(query, currentUser);
  }

  @Get('reports/daily')
  @ApiOperation({ summary: 'Get daily sales report' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Daily sales report' })
  async getDailySalesReport(
    @Query('date') date?: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() currentUser?: any,
  ) {
    return this.salesService.getDailySalesReport(date, currentUser, companyId);
  }

  @Get('reports/monthly')
  @ApiOperation({ summary: 'Get monthly sales report' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Monthly sales report' })
  async getMonthlySalesReport(
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('companyId') companyId?: string,
    @CurrentUser() currentUser?: any,
  ) {
    return this.salesService.getMonthlySalesReport(year, month, currentUser, companyId);
  }

  @Get('reports/analytics')
  @ApiOperation({ summary: 'Get filtered analytics reports (by period, product, customer, location)' })
  @ApiResponse({ status: 200, description: 'Filtered analytics report' })
  async getAnalytics(
    @Query() query: ReportQueryDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.salesService.getAnalytics(query, currentUser);
  }

  @Get('search/customer-by-phone')
  @ApiOperation({ summary: 'Find customer by phone number for sales' })
  @ApiQuery({ name: 'phone', type: String, description: 'Customer phone number' })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findCustomerByPhone(@Query('phone') phone: string, @CurrentUser() currentUser: any) {
    return this.salesService.findCustomerByPhone(phone, currentUser);
  }

  @Post('upload-receipt')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a sale receipt / transaction screenshot' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) throw new BadRequestException('No file uploaded');

    const detected = detectAllowedImage(file.buffer);
    if (!detected) {
      throw new BadRequestException('Invalid file type: content does not match allowed image formats (JPEG, PNG, WebP, PDF).');
    }

    const dir = join(process.cwd(), 'uploads', 'receipts');
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}${detected.ext}`;
    writeFileSync(join(dir, filename), file.buffer);

    return { url: `/uploads/receipts/${filename}` };
  }

  @Get('user-info')
  @ApiOperation({ summary: 'Get current user warehouse/shop info from token' })
  @ApiResponse({ status: 200, description: 'User info retrieved' })
  async getUserInfo(@CurrentUser() user: User) {
    return this.salesService.getUserInfo(user.id);
  }

  @Get('inventory/:productId/:locationId')
  @ApiOperation({ summary: 'Get real-time inventory levels for a product at specific location' })
  @ApiResponse({ status: 200, description: 'Inventory levels retrieved' })
  async getInventoryLevels(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('type') locationType: 'warehouse' | 'shop',
    @CurrentUser() currentUser: any
  ) {
    return this.salesService.getInventoryLevels(productId, locationId, locationType, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sale by ID' })
  @ApiResponse({ status: 200, description: 'Sale details', type: SaleResponseDto })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: any): Promise<SaleResponseDto> {
    return this.salesService.findOne(id, currentUser);
  }

  @Post(':id/payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply a payment to a credit sale' })
  @ApiBody({ type: CreatePaymentTransactionDto })
  @ApiResponse({ status: 201, description: 'Payment recorded', type: PaymentTransactionResponseDto })
  async applyPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() paymentDto: CreatePaymentTransactionDto,
    @CurrentUser() currentUser: User,
  ): Promise<PaymentTransactionResponseDto> {
    paymentDto.saleId = id;
    if (!paymentDto.transactionType) {
      paymentDto.transactionType = TransactionType.SALE;
    }
    paymentDto.processedBy = currentUser?.id;
    return this.salesService.applyPayment(id, paymentDto, currentUser);
  }

  @Get(':id/payment-history')
  @ApiOperation({ summary: 'Get payment history for a sale' })
  @ApiResponse({ status: 200, description: 'Payment history', type: [PaymentTransactionResponseDto] })
  async getPaymentHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<PaymentTransactionResponseDto[]> {
    return this.salesService.getPaymentHistory(id, currentUser);
  }

  @Post(':id/reminder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a payment reminder for an outstanding credit sale' })
  @ApiResponse({ status: 200, description: 'Reminder sent' })
  async sendReminder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.salesService.sendPaymentReminder(id, currentUser);
  }

  @Post('quick-sale')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a sale using phone number lookup and JWT token info' })
  @ApiBody({ type: QuickSaleDto })
  @ApiResponse({ status: 201, description: 'Sale created successfully' })
  async createQuickSale(
    @Body() saleData: QuickSaleDto,
    @CurrentUser() currentUser: any
  ) {
    // 1. Find customer by phone number
    const customer = await this.salesService.findCustomerByPhone(saleData.customerPhone);
    
    // 2. Get warehouse/shop from JWT token
    const warehouseId = currentUser.warehouseId;
    const shopId = currentUser.shopId;
    const employeeId = currentUser.employeeId;
    
    if (!warehouseId) {
      throw new BadRequestException('User must be assigned to a warehouse to create sales');
    }
    
    // 3. Get employee info from JWT token
    const userInfo = await this.salesService.getUserInfo(currentUser.id);
    
    // 4. Create the sale with all gathered information
    const createSaleDto: CreateSaleDto = {
      customerId: customer.id,
      warehouseId: warehouseId,
      shopId: shopId,
      items: saleData.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      paymentType: saleData.paymentType as any,
      note: saleData.note,
      createdBy: currentUser.id,
      saleDate: new Date()
    };
    
    const sale = await this.salesService.create(createSaleDto, currentUser);
    
    return {
      success: true,
      message: 'Sale created successfully using JWT token info',
      data: {
        sale,
        customer,
        employee: userInfo.employee,
        warehouse: userInfo.warehouse,
        shop: userInfo.shop,
        tokenInfo: {
          userId: currentUser.id,
          warehouseId: currentUser.warehouseId,
          shopId: currentUser.shopId,
          employeeId: currentUser.employeeId,
          companyId: currentUser.companyId
        }
      }
    };
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Get sale receipt as HTML (for PDF rendering on frontend)' })
  @ApiResponse({ status: 200, description: 'Receipt HTML' })
  async getReceipt(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: any) {
    return this.receiptService.generateSaleReceipt(id, currentUser);
  }
}
