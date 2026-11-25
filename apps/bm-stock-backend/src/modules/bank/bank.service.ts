import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankAccount } from './entities/bank-account.entity';
import { BankExpense } from './entities/bank-expense.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateBankExpenseDto } from './dto/create-bank-expense.dto';
import { AddBalanceDto } from './dto/add-balance.dto';
import { Sales } from '../sales/entities/sales.entity';
import { SaleStatus } from '../sales/enums';
import { UserRole } from '@/common/enums';

@Injectable()
export class BankService {
  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountRepository: Repository<BankAccount>,
    @InjectRepository(BankExpense)
    private readonly bankExpenseRepository: Repository<BankExpense>,
    @InjectRepository(Sales)
    private readonly salesRepository: Repository<Sales>,
  ) {}

  async createAccount(dto: CreateBankAccountDto, currentUser?: any): Promise<BankAccount> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const companyId = isPlatformAdmin
      ? dto.companyId || currentUser?.companyId
      : currentUser?.companyId;

    if (!companyId) {
      throw new BadRequestException('Company association is required to create a bank account');
    }

    const account = this.bankAccountRepository.create({
      bankName: dto.bankName,
      accountNumber: dto.accountNumber,
      initialBalance: dto.initialBalance,
      currentBalance: dto.initialBalance,
      note: dto.note,
      company: { id: companyId } as any,
    });
    return this.bankAccountRepository.save(account);
  }

  async addBalance(dto: AddBalanceDto, currentUser?: any): Promise<BankAccount> {
    const account = await this.bankAccountRepository.findOne({
      where: { id: dto.bankAccountId },
      relations: ['company'],
    });
    if (!account) {
      throw new NotFoundException('Bank account not found');
    }

    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
    const accountCompanyId = account.company?.id || (account as any).companyId;

    if (!isPlatformAdmin && userCompanyId && accountCompanyId && accountCompanyId !== userCompanyId) {
      throw new ForbiddenException('You do not have permission to modify this bank account');
    }

    const newBalance = Number(account.currentBalance) + Number(dto.amount);
    await this.bankAccountRepository.update(account.id, { currentBalance: newBalance });
    return this.bankAccountRepository.findOne({ where: { id: dto.bankAccountId }, relations: ['company'] });
  }

  async findAllAccounts(currentUser?: any, companyId?: string): Promise<BankAccount[]> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const effectiveCompanyId = isPlatformAdmin ? (companyId || currentUser?.companyId) : currentUser?.companyId;
    const qb = this.bankAccountRepository.createQueryBuilder('account')
      .leftJoin('account.company', 'company');
    if (effectiveCompanyId) {
      qb.where('company.id = :companyId', { companyId: effectiveCompanyId });
    }
    qb.orderBy('account.createdAt', 'DESC');
    return qb.getMany();
  }

  async createExpense(dto: CreateBankExpenseDto, currentUser?: any): Promise<BankExpense> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const companyId = isPlatformAdmin
      ? dto.companyId || currentUser?.companyId
      : currentUser?.companyId;

    if (!companyId) {
      throw new BadRequestException('Company association is required to create an expense');
    }

    let targetAccount: BankAccount | null = null;
    if (dto.bankAccountId) {
      targetAccount = await this.bankAccountRepository.findOne({
        where: { id: dto.bankAccountId },
        relations: ['company'],
      });
      if (!targetAccount) {
        throw new NotFoundException('Bank account not found');
      }
      const accountCompanyId = targetAccount.company?.id || (targetAccount as any).companyId;
      if (!isPlatformAdmin && accountCompanyId && accountCompanyId !== companyId) {
        throw new ForbiddenException('Bank account does not belong to your company');
      }
    } else {
      const accounts = await this.bankAccountRepository.find({
        where: { company: { id: companyId } },
        order: { createdAt: 'DESC' },
        take: 1,
      });
      targetAccount = accounts[0] || null;
    }

    const expense = this.bankExpenseRepository.create({
      amount: Number(dto.amount),
      reason: dto.reason,
      bankAccount: targetAccount || undefined,
      company: { id: companyId } as any,
    });
    const savedExpense = await this.bankExpenseRepository.save(expense);

    if (targetAccount) {
      const newBal = Math.max(0, Number(targetAccount.currentBalance) - Number(dto.amount));
      await this.bankAccountRepository.update(targetAccount.id, { currentBalance: newBal });
    }

    return savedExpense;
  }

  async findAllExpenses(currentUser?: any, companyId?: string): Promise<BankExpense[]> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const effectiveCompanyId = isPlatformAdmin ? (companyId || currentUser?.companyId) : currentUser?.companyId;
    const qb = this.bankExpenseRepository.createQueryBuilder('expense')
      .leftJoinAndSelect('expense.bankAccount', 'bankAccount')
      .leftJoin('expense.company', 'company');
    if (effectiveCompanyId) {
      qb.where('company.id = :companyId', { companyId: effectiveCompanyId });
    }
    qb.orderBy('expense.createdAt', 'DESC');
    return qb.getMany();
  }

  async getSummary(currentUser?: any, companyId?: string): Promise<any> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const effectiveCompanyId = isPlatformAdmin ? (companyId || currentUser?.companyId) : currentUser?.companyId;

    // Aggregate Sales from Postgres
    const salesQb = this.salesRepository.createQueryBuilder('sales')
      .leftJoin('sales.warehouse', 'warehouse')
      .leftJoin('sales.shop', 'shop')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany')
      .select([
        'COUNT(sales.id) as "totalSalesCount"',
        'SUM(sales.totalAmount) as "totalRevenue"',
        'SUM(sales.subtotal) as "productSalesRevenue"'
      ])
      .where('sales.status != :cancelledStatus', { cancelledStatus: SaleStatus.CANCELLED });

    if (effectiveCompanyId) {
      salesQb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId: effectiveCompanyId });
    }

    const salesResult = await salesQb.getRawOne();
    const totalRevenue = parseFloat(salesResult?.totalRevenue || salesResult?.totalrevenue || '0') || 0;
    const productSalesRevenue = parseFloat(salesResult?.productSalesRevenue || salesResult?.productsalesrevenue || '0') || 0;

    // Aggregate Expenses from Postgres
    const expenseQb = this.bankExpenseRepository.createQueryBuilder('expense')
      .leftJoin('expense.company', 'company')
      .select('SUM(expense.amount)', 'totalExpenses');
    if (effectiveCompanyId) {
      expenseQb.where('company.id = :companyId', { companyId: effectiveCompanyId });
    }
    const expenseResult = await expenseQb.getRawOne();
    let totalExpenses = parseFloat(expenseResult?.totalExpenses || expenseResult?.totalexpenses || '0') || 0;

    const recordedExpenseQb = this.bankExpenseRepository.manager
      .getRepository(Expense)
      .createQueryBuilder('recordedExpense')
      .leftJoin('recordedExpense.company', 'company')
      .select('SUM(recordedExpense.totalCost)', 'totalExpenses');
    if (effectiveCompanyId) {
      recordedExpenseQb.where('company.id = :companyId', { companyId: effectiveCompanyId });
    }
    const recordedExpenseResult = await recordedExpenseQb.getRawOne();
    totalExpenses += parseFloat(recordedExpenseResult?.totalExpenses || recordedExpenseResult?.totalexpenses || '0') || 0;

    const commission = totalRevenue > 0 ? Math.round(totalRevenue * 0.05 * 100) / 100 : 0;
    const netProfit = totalRevenue - totalExpenses - commission;

    return {
      todaySales: totalRevenue,
      productSales: productSalesRevenue > 0 ? productSalesRevenue : totalRevenue,
      totalExpenses,
      commission,
      netProfit,
    };
  }
}
