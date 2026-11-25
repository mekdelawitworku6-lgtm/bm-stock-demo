import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BankService } from './bank.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateBankExpenseDto } from './dto/create-bank-expense.dto';
import { AddBalanceDto } from './dto/add-balance.dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { CurrentUser, Roles } from '@/common/decorators';
import { UserRole } from '@/common/enums';

@ApiTags('Bank')
@Controller('bank')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Post('accounts')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create a new bank account' })
  @ApiResponse({ status: 201, description: 'Bank account created successfully' })
  async createAccount(
    @Body() dto: CreateBankAccountDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.bankService.createAccount(dto, currentUser);
  }

  @Post('add-balance')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Add balance to a bank account' })
  @ApiResponse({ status: 201, description: 'Balance added successfully' })
  async addBalance(
    @Body() dto: AddBalanceDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.bankService.addBalance(dto, currentUser);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'Get all bank accounts' })
  async findAllAccounts(
    @Query('companyId') companyId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.bankService.findAllAccounts(currentUser, companyId);
  }

  @Post('expenses')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new expense' })
  @ApiResponse({ status: 201, description: 'Expense created successfully' })
  async createExpense(
    @Body() dto: CreateBankExpenseDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.bankService.createExpense(dto, currentUser);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Get all expenses' })
  async findAllExpenses(
    @Query('companyId') companyId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.bankService.findAllExpenses(currentUser, companyId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get financial summary straight from Postgres' })
  async getSummary(
    @Query('companyId') companyId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.bankService.getSummary(currentUser, companyId);
  }
}
