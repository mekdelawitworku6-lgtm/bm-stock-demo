import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { Sales } from '../../sales/entities/sales.entity';
import { User } from '../../users/entities/user.entity';
import { Company } from '../../company/entities/company.entity';

export enum CreditStatus {
  ACTIVE = 'active',
  PAID = 'paid',
  OVERDUE = 'overdue',
  WRITTEN_OFF = 'written_off',
}

@Entity('credit_accounts')
export class CreditAccount extends BaseEntity {
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalOwed: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPaid: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  interestRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  accruedInterest: number;

  @Column({ type: 'enum', enum: CreditStatus, default: CreditStatus.ACTIVE })
  status: CreditStatus;

  @Column({ type: 'date', nullable: true })
  dueDate?: Date;

  @Column({ type: 'date', nullable: true })
  lastPaymentDate?: Date;

  @Column({ length: 255, nullable: true })
  notes?: string;

  @ManyToOne(() => Customer, customer => customer.id, { eager: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Sales, { nullable: true })
  @JoinColumn({ name: 'sale_id' })
  linkedSale?: Sales;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @OneToMany(() => CreditPayment, payment => payment.creditAccount)
  payments: CreditPayment[];

  @OneToMany(() => CreditTransaction, transaction => transaction.creditAccount)
  transactions: CreditTransaction[];

  get outstandingBalance(): number {
    return this.totalOwed - this.totalPaid + this.accruedInterest;
  }
}

@Entity('credit_payments')
export class CreditPayment extends BaseEntity {
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ length: 50, default: 'cash' })
  paymentMethod: string;

  @Column({ length: 100, nullable: true })
  reference?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => CreditAccount, account => account.payments)
  @JoinColumn({ name: 'credit_account_id' })
  creditAccount: CreditAccount;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by' })
  receivedBy?: User;
}

@Entity('credit_transactions')
export class CreditTransaction extends BaseEntity {
  @Column({ length: 50 })
  type: string; // 'charge', 'payment', 'interest', 'adjustment'

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balanceBefore: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balanceAfter: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => CreditAccount, account => account.transactions)
  @JoinColumn({ name: 'credit_account_id' })
  creditAccount: CreditAccount;
}
