import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Company } from '../../company/entities/company.entity';

@Entity('bank_accounts')
export class BankAccount extends BaseEntity {
  @Column({ length: 255 })
  bankName: string;

  @Column({ length: 255 })
  accountNumber: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  initialBalance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  currentBalance: number;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  company?: Company;
}
