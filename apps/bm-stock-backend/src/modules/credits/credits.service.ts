import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { CreditAccount, CreditPayment, CreditTransaction, CreditStatus } from './entities/credit.entity';
import { Customer } from '../customer/entities/customer.entity';
import { User } from '../users/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { CreateCreditAccountDto, UpdateCreditAccountDto, CreateCreditPaymentDto } from './dto';
import { PaginatedResult } from '@/common/interfaces';
import { CacheService } from '@/shared/cache/cache.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { UserRole } from '../../common/enums';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    @InjectRepository(CreditAccount)
    private readonly creditAccountRepository: Repository<CreditAccount>,
    @InjectRepository(CreditPayment)
    private readonly creditPaymentRepository: Repository<CreditPayment>,
    @InjectRepository(CreditTransaction)
    private readonly creditTransactionRepository: Repository<CreditTransaction>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateCreditAccountDto, userId?: string, companyId?: string): Promise<any> {
    const customer = await this.customerRepository.findOne({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const account = this.creditAccountRepository.create({
      customer,
      totalOwed: dto.totalOwed,
      totalPaid: 0,
      interestRate: dto.interestRate || 0,
      accruedInterest: 0,
      status: CreditStatus.ACTIVE,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      notes: dto.notes,
      company: companyId ? { id: companyId } as Company : null,
    });

    const saved = await this.creditAccountRepository.save(account);

    // Record initial charge transaction
    const tx = this.creditTransactionRepository.create({
      type: 'charge',
      amount: dto.totalOwed,
      balanceBefore: 0,
      balanceAfter: dto.totalOwed,
      description: `Initial credit: ${dto.totalOwed}`,
      creditAccount: saved,
    });
    await this.creditTransactionRepository.save(tx);

    this.logger.log(`Credit account created for customer ${dto.customerId}: ${saved.id}`);

    // Send CREDIT notification
    await this.notifyCreditCreated(saved, userId, companyId);

    return this.toResponseDto(saved);
  }

  async findAll(query: { search?: string; status?: string; page?: number; limit?: number }, companyId?: string): Promise<PaginatedResult<any>> {
    const { search, status, page = 1, limit = 20 } = query;
    const qb = this.creditAccountRepository.createQueryBuilder('ca')
      .leftJoinAndSelect('ca.customer', 'customer')
      .leftJoinAndSelect('ca.linkedSale', 'sale');

    if (companyId) {
      qb.andWhere('ca.company_id = :companyId', { companyId });
    }
    if (search) {
      qb.andWhere('customer.name ILIKE :search', { search: `%${search}%` });
    }
    if (status) {
      qb.andWhere('ca.status = :status', { status });
    }

    qb.orderBy('ca.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [accounts, total] = await qb.getManyAndCount();

    return {
      data: accounts.map(a => this.toResponseDto(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<any> {
    const account = await this.creditAccountRepository.findOne({
      where: { id },
      relations: ['customer', 'linkedSale', 'payments', 'payments.receivedBy', 'transactions'],
    });
    if (!account) throw new NotFoundException('Credit account not found');
    return this.toResponseDto(account);
  }

  async update(id: string, dto: UpdateCreditAccountDto): Promise<any> {
    const account = await this.creditAccountRepository.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Credit account not found');

    if (dto.totalOwed !== undefined) account.totalOwed = dto.totalOwed;
    if (dto.interestRate !== undefined) account.interestRate = dto.interestRate;
    if (dto.dueDate !== undefined) account.dueDate = new Date(dto.dueDate);
    if (dto.status !== undefined) account.status = dto.status as CreditStatus;
    if (dto.notes !== undefined) account.notes = dto.notes;

    const saved = await this.creditAccountRepository.save(account);
    return this.toResponseDto(saved);
  }

  async remove(id: string): Promise<void> {
    const account = await this.creditAccountRepository.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Credit account not found');
    await this.creditAccountRepository.delete(id);
  }

  async createPayment(creditAccountId: string, dto: CreateCreditPaymentDto, userId?: string): Promise<any> {
    const account = await this.creditAccountRepository.findOne({
      where: { id: creditAccountId },
      relations: ['customer'],
    });
    if (!account) throw new NotFoundException('Credit account not found');

    if (dto.amount <= 0) throw new BadRequestException('Payment amount must be positive');
    if (dto.amount > account.outstandingBalance) {
      throw new BadRequestException(`Payment amount (${dto.amount}) exceeds outstanding balance (${account.outstandingBalance})`);
    }

    const payment = this.creditPaymentRepository.create({
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
      notes: dto.notes,
      creditAccount: account,
      receivedBy: userId ? { id: userId } as User : null,
    });
    await this.creditPaymentRepository.save(payment);

    // Update account
    const prevBalance = account.outstandingBalance;
    account.totalPaid += dto.amount;
    account.lastPaymentDate = new Date();
    if (account.outstandingBalance <= 0) {
      account.status = CreditStatus.PAID;
    }
    await this.creditAccountRepository.save(account);

    // Record transaction
    const tx = this.creditTransactionRepository.create({
      type: 'payment',
      amount: dto.amount,
      balanceBefore: prevBalance,
      balanceAfter: account.outstandingBalance,
      description: `Payment of ${dto.amount} via ${dto.paymentMethod}`,
      creditAccount: account,
    });
    await this.creditTransactionRepository.save(tx);

    this.logger.log(`Payment of ${dto.amount} recorded for credit ${creditAccountId}`);

    // Send PAYMENT notification for credit payment
    await this.notifyCreditPayment(account, dto);

    return this.toResponseDto(payment);
  }

  async getPayments(creditAccountId: string, query: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = query;
    const [payments, total] = await this.creditPaymentRepository.findAndCount({
      where: { creditAccount: { id: creditAccountId } },
      relations: ['receivedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        reference: p.reference,
        notes: p.notes,
        receivedById: p.receivedBy?.id,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTransactions(creditAccountId: string, query: { page?: number; limit?: number; startDate?: string; endDate?: string }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 50, startDate, endDate } = query;
    const qb = this.creditTransactionRepository.createQueryBuilder('tx')
      .where('tx.credit_account_id = :creditAccountId', { creditAccountId });

    if (startDate) qb.andWhere('tx.createdAt >= :startDate', { startDate: new Date(startDate) });
    if (endDate) qb.andWhere('tx.createdAt <= :endDate', { endDate: new Date(endDate) });

    qb.orderBy('tx.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [txs, total] = await qb.getManyAndCount();

    return {
      data: txs.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        description: tx.description,
        createdAt: tx.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(query: { startDate?: string; endDate?: string }, companyId?: string): Promise<any> {
    const qb = this.creditAccountRepository.createQueryBuilder('ca')
      .leftJoinAndSelect('ca.customer', 'customer');

    if (companyId) qb.andWhere('ca.company_id = :companyId', { companyId });

    const result = await qb
      .select([
        'COUNT(ca.id) as "totalAccounts"',
        'COALESCE(SUM(ca."totalOwed"), 0) as "totalOwed"',
        'COALESCE(SUM(ca."totalPaid"), 0) as "totalPaid"',
        'COALESCE(SUM(ca."accruedInterest"), 0) as "totalInterest"',
      ])
      .getRawOne();

    const overdueResult = await qb
      .clone()
      .andWhere('ca.status = :status', { status: CreditStatus.OVERDUE })
      .getCount();

    return {
      totalAccounts: parseInt(result?.totalAccounts) || 0,
      totalOwed: parseFloat(result?.totalOwed) || 0,
      totalPaid: parseFloat(result?.totalPaid) || 0,
      totalInterest: parseFloat(result?.totalInterest) || 0,
      totalOutstanding: (parseFloat(result?.totalOwed) || 0) - (parseFloat(result?.totalPaid) || 0),
      overdueCount: overdueResult,
    };
  }

  async getOverdue(companyId?: string): Promise<any[]> {
    const qb = this.creditAccountRepository.createQueryBuilder('ca')
      .leftJoinAndSelect('ca.customer', 'customer')
      .where('ca.status = :status', { status: CreditStatus.OVERDUE });

    if (companyId) qb.andWhere('ca.company_id = :companyId', { companyId });

    const accounts = await qb.getMany();
    return accounts.map(a => this.toResponseDto(a));
  }

  async getCustomerCredits(customerId: string): Promise<any[]> {
    const accounts = await this.creditAccountRepository.find({
      where: { customer: { id: customerId } },
      relations: ['customer', 'linkedSale'],
      order: { createdAt: 'DESC' },
    });
    return accounts.map(a => this.toResponseDto(a));
  }

  async calculateInterest(companyId?: string): Promise<{ updated: number; totalInterest: number }> {
    const accounts = await this.creditAccountRepository.find({
      where: { status: CreditStatus.ACTIVE, interestRate: MoreThan(0) },
    });

    let totalInterest = 0;
    for (const account of accounts) {
      if (!account.interestRate || account.interestRate <= 0) continue;
      if (account.outstandingBalance <= 0) continue;

      const monthlyInterest = (account.outstandingBalance * account.interestRate) / 100 / 12;
      account.accruedInterest += monthlyInterest;
      totalInterest += monthlyInterest;

      const tx = this.creditTransactionRepository.create({
        type: 'interest',
        amount: monthlyInterest,
        balanceBefore: account.outstandingBalance,
        balanceAfter: account.outstandingBalance + account.accruedInterest,
        description: `Monthly interest at ${account.interestRate}%`,
        creditAccount: account,
      });
      await this.creditTransactionRepository.save(tx);
    }

    if (accounts.length > 0) {
      await this.creditAccountRepository.save(accounts);
    }

    return { updated: accounts.length, totalInterest };
  }

  private async notifyCreditCreated(account: CreditAccount, userId?: string, companyId?: string): Promise<void> {
    try {
      const effectiveCompanyId = companyId || account.company?.id;
      if (!effectiveCompanyId) return;

      const users = await this.userRepository.find({
        where: { companyId: effectiveCompanyId, role: UserRole.COMPANY_ADMIN },
      });

      for (const user of users) {
        await this.notificationService.sendEventNotification({
          type: NotificationType.CREDIT,
          title: 'Credit Account Created',
          message: `Credit of ${account.totalOwed} opened for ${account.customer?.name || 'Unknown'}`,
          userId: user.id,
          companyId: effectiveCompanyId,
          metadata: {
            creditAccountId: account.id,
            customerName: account.customer?.name,
            totalOwed: account.totalOwed,
            dueDate: account.dueDate,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send CREDIT notification', error);
    }
  }

  private async notifyCreditPayment(account: CreditAccount, dto: CreateCreditPaymentDto): Promise<void> {
    try {
      const companyId = account.company?.id;
      if (!companyId) return;

      const users = await this.userRepository.find({
        where: { companyId, role: UserRole.COMPANY_ADMIN },
      });

      for (const user of users) {
        await this.notificationService.sendEventNotification({
          type: NotificationType.PAYMENT,
          title: 'Credit Payment Received',
          message: `Payment of ${dto.amount} received for ${account.customer?.name || 'Unknown'}. Outstanding: ${account.outstandingBalance}`,
          userId: user.id,
          companyId,
          metadata: {
            creditAccountId: account.id,
            customerName: account.customer?.name,
            amount: dto.amount,
            outstandingBalance: account.outstandingBalance,
            paymentMethod: dto.paymentMethod,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send PAYMENT notification for credit', error);
    }
  }

  private toResponseDto(account: CreditAccount | CreditPayment): any {
    if ('totalOwed' in account) {
      const a = account as CreditAccount;
      return {
        id: a.id,
        customerId: a.customer?.id,
        customerName: a.customer?.name,
        totalOwed: a.totalOwed,
        totalPaid: a.totalPaid,
        outstandingBalance: a.outstandingBalance,
        interestRate: a.interestRate,
        accruedInterest: a.accruedInterest,
        status: a.status,
        dueDate: a.dueDate,
        lastPaymentDate: a.lastPaymentDate,
        notes: a.notes,
        linkedSaleId: a.linkedSale?.id,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    }
    const p = account as CreditPayment;
    return {
      id: p.id,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      reference: p.reference,
      notes: p.notes,
      receivedById: p.receivedBy?.id,
      createdAt: p.createdAt,
    };
  }
}
