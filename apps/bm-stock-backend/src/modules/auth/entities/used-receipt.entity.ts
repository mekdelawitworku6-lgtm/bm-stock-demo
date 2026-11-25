import { Entity, Column, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../database/entities/base.entity';

@Entity('used_receipts')
export class UsedReceipt extends BaseEntity {
  @ApiProperty({ description: 'Receipt reference number or unique receipt link' })
  @Index({ unique: true })
  @Column({ unique: true, length: 255 })
  reference: string;

  @ApiPropertyOptional({ description: 'Bank or wallet ID (e.g. cbe, telebirr, boa, awash)' })
  @Column({ nullable: true, length: 100 })
  bank?: string;

  @ApiPropertyOptional({ description: 'Receipt transaction amount' })
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @ApiPropertyOptional({ description: 'Sender / Payer full name from receipt' })
  @Column({ nullable: true, length: 255 })
  payerName?: string;

  @ApiPropertyOptional({ description: 'Receiver account or name from receipt' })
  @Column({ nullable: true, length: 255 })
  receiverInfo?: string;

  @ApiPropertyOptional({ description: 'Original receipt URL or verification link' })
  @Column({ nullable: true, length: 500 })
  receiptUrl?: string;

  @ApiPropertyOptional({ description: 'Phone number of the registered user who used this receipt' })
  @Column({ nullable: true, length: 30 })
  usedByPhone?: string;

  @ApiPropertyOptional({ description: 'User ID of the account activated with this receipt' })
  @Column({ nullable: true, length: 100 })
  usedByUserId?: string;

  @ApiPropertyOptional({ description: 'Purpose of receipt use (SUBSCRIPTION_SIGNUP, SUBSCRIPTION_RENEWAL)' })
  @Column({ default: 'SUBSCRIPTION_SIGNUP', length: 100 })
  purpose: string;
}
