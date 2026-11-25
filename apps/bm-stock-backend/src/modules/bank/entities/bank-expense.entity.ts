import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { BankAccount } from './bank-account.entity';
import { Company } from '../../company/entities/company.entity';

@Entity('bank_expenses')
export class BankExpense extends BaseEntity {
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  @ManyToOne(() => BankAccount, { nullable: true, onDelete: 'SET NULL' })
  bankAccount?: BankAccount;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  company?: Company;
}
