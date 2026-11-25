import { Entity, Column, OneToMany, BeforeInsert, BeforeUpdate, ManyToOne, JoinColumn } from 'typeorm';
import { CustomerStatus } from '../enums/customer-status.enum';
import { BaseEntity } from '../../../database/entities';
import { Company } from '../../company/entities/company.entity';
// import { CustomerStatus } from './enums/customer-status.enum';
// import { Order } from '../orders/entities/order.entity';
// import { Sale } from '../sales/entities/sale.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 10, nullable: true })
  phoneNumber: string | null;

  @Column({ length: 255, nullable: true })
  address?: string;

  @Column({ type: 'enum', enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  status: CustomerStatus;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'companyId' })
  company?: Company;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // @Column({ type: 'int', default: 0 })
  // loyaltyPoints: number;

  // @OneToMany(() => Order, order => order.customer)
  // orders: Order[];

  // @OneToMany(() => Sale, sale => sale.customer)
  // sales: Sale[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizePhone() {
    if (this.phoneNumber === '') {
      this.phoneNumber = null;
    }
    if (this.phoneNumber) {
      this.phoneNumber = this.phoneNumber.replace(/\D/g, '').trim();
    }
  }
}