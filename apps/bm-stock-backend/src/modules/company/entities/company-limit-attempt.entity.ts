import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('company_limit_attempts')
export class CompanyLimitAttempt extends BaseEntity {
  @Index()
  @Column()
  userId: string;

  @Column({ length: 255 })
  companyName: string;

  @Column({ type: 'json', nullable: true })
  companyNames?: string[];

  @Column({ length: 20, default: 'PENDING' })
  status: string;

  @Column({ length: 20, default: 'breach' })
  kind: string;

  @Column({ length: 100, nullable: true })
  planId?: string;

  @Column({ length: 100, nullable: true })
  planTitle?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  planAmount?: number;

  @Column({ length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ length: 100, nullable: true })
  paymentRef?: string;

  @Column({ type: 'text', nullable: true })
  screenshotUrl?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;
}
