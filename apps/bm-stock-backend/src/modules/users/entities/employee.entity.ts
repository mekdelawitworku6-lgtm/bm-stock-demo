import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from './user.entity';
import { Shop } from '../../shops/entities/shops.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Company } from '../../company/entities/company.entity';
import { Commission } from '../../commission/entities/commission.entity';

@Entity('employees')
export class Employee extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 20 })
  phoneNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  baseCommissionRate: number;

  @Column({ length: 255, nullable: true })
  jobTitle?: string;

  @Column({ type: 'json', nullable: true })
  permissions?: Record<string, any>;

  /** Staff login method configured by admin: password or 4-digit pin */
  @Column({ length: 20, default: 'password' })
  authMethod: 'password' | 'pin';

  /** Hashed 4-digit PIN when authMethod is pin */
  @Column({ nullable: true, length: 255 })
  pin?: string;

  /** Plain-text credential for admin reference (password auth) */
  @Column({ nullable: true, length: 255 })
  assignedPassword?: string;

  /** Plain-text PIN for admin reference (pin auth) */
  @Column({ nullable: true, length: 20 })
  assignedPin?: string;

  @ManyToOne(() => User, user => user.employees)
  user: User;

  @ManyToOne(() => Company, company => company.employees)
  company: Company;

  @ManyToOne(() => Shop, shop => shop.employees)
  shop: Shop;

  @ManyToOne(() => Warehouse, warehouse => warehouse.employees)
  warehouse: Warehouse;

  @OneToMany(() => Commission, commission => commission.employee)
  commissions: Commission[];
}