import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { CreditsService } from './credits.service';
import { ReceiptService } from '../receipt/receipt.service';
import { CreateCreditAccountDto, UpdateCreditAccountDto, CreateCreditPaymentDto } from './dto';
import { PaginatedResult } from '@/common/interfaces';
import { JwtAuthGuard } from '@/common/guards';
import { CurrentUser } from '@/common/decorators';

@ApiTags('Credits')
@ApiBearerAuth('access-token')
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly receiptService: ReceiptService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a credit account' })
  @ApiBody({ type: CreateCreditAccountDto })
  @ApiResponse({ status: 201, description: 'Credit account created' })
  async create(
    @Body() dto: CreateCreditAccountDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.creditsService.create(dto, currentUser?.id, currentUser?.companyId);
  }

  @Get()
  @ApiOperation({ summary: 'List credit accounts' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of credit accounts' })
  async findAll(
    @Query() query: { search?: string; status?: string; page?: number; limit?: number },
    @CurrentUser() currentUser: any,
  ): Promise<PaginatedResult<any>> {
    return this.creditsService.findAll(query, currentUser?.companyId);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Get overdue credit accounts' })
  @ApiResponse({ status: 200, description: 'Overdue accounts' })
  async getOverdue(@CurrentUser() currentUser: any) {
    return this.creditsService.getOverdue(currentUser?.companyId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get credit stats/reports' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Credit stats' })
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() currentUser?: any,
  ) {
    return this.creditsService.getStats({ startDate, endDate }, currentUser?.companyId);
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Get credits for a specific customer' })
  @ApiResponse({ status: 200, description: 'Customer credits' })
  async getCustomerCredits(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.creditsService.getCustomerCredits(customerId);
  }

  @Post('calculate-interest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate and apply interest to all active credit accounts' })
  @ApiResponse({ status: 200, description: 'Interest calculated' })
  async calculateInterest(@CurrentUser() currentUser: any) {
    return this.creditsService.calculateInterest(currentUser?.companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a credit account by ID' })
  @ApiResponse({ status: 200, description: 'Credit account details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a credit account' })
  @ApiBody({ type: UpdateCreditAccountDto })
  @ApiResponse({ status: 200, description: 'Credit account updated' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCreditAccountDto) {
    return this.creditsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a credit account' })
  @ApiResponse({ status: 204, description: 'Credit account deleted' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.remove(id);
  }

  @Get(':creditAccountId/payments')
  @ApiOperation({ summary: 'Get payments for a credit account' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Payment history' })
  async getPayments(
    @Param('creditAccountId', ParseUUIDPipe) creditAccountId: string,
    @Query() query: { page?: number; limit?: number },
  ): Promise<PaginatedResult<any>> {
    return this.creditsService.getPayments(creditAccountId, query);
  }

  @Post(':creditAccountId/payments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a payment against a credit account' })
  @ApiBody({ type: CreateCreditPaymentDto })
  @ApiResponse({ status: 201, description: 'Payment recorded' })
  async createPayment(
    @Param('creditAccountId', ParseUUIDPipe) creditAccountId: string,
    @Body() dto: CreateCreditPaymentDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.creditsService.createPayment(creditAccountId, dto, currentUser?.id);
  }

  @Get(':creditAccountId/transactions')
  @ApiOperation({ summary: 'Get transaction history for a credit account' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Transaction history' })
  async getTransactions(
    @Param('creditAccountId', ParseUUIDPipe) creditAccountId: string,
    @Query() query: { page?: number; limit?: number; startDate?: string; endDate?: string },
  ): Promise<PaginatedResult<any>> {
    return this.creditsService.getTransactions(creditAccountId, query);
  }

  @Get(':creditId/statement/pdf')
  @ApiOperation({ summary: 'Download credit statement as HTML for PDF rendering' })
  @ApiResponse({ status: 200, description: 'Statement HTML' })
  async downloadCreditStatementPDF(@Param('creditId', ParseUUIDPipe) creditId: string) {
    return this.receiptService.generateCreditStatement(creditId);
  }

  @Get(':creditId/payments/:paymentId/receipt/pdf')
  @ApiOperation({ summary: 'Download payment receipt as HTML for PDF rendering' })
  @ApiResponse({ status: 200, description: 'Receipt HTML' })
  async downloadPaymentReceiptPDF(
    @Param('creditId', ParseUUIDPipe) creditId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.receiptService.generatePaymentReceipt(creditId, paymentId);
  }
}
