import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Company } from '../../company/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Shop } from '../../shops/entities/shops.entity';
import { Product } from '../../products/entities/product.entity';

export enum BorrowingStatus {
  ACTIVE = 'active',
  PARTIALLY_RETURNED = 'partially_returned',
  FULLY_RETURNED = 'fully_returned',
}

@Entity('product_borrowings')
export class ProductBorrowing extends BaseEntity {
  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  productName: string;

  @Column({ name: 'product_category', type: 'varchar', length: 120, nullable: true })
  productCategory?: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'quantity_taken', type: 'int' })
  quantityTaken: number;

  @Column({ name: 'quantity_returned', type: 'int', default: 0 })
  quantityReturned: number;

  @Column({ name: 'seller_name', type: 'varchar', length: 255 })
  sellerName: string;

  @Column({ name: 'seller_phone', type: 'varchar', length: 30, nullable: true })
  sellerPhone?: string;

  @Column({ name: 'date_taken', type: 'date' })
  dateTaken: string;

  @Column({ name: 'expected_return_date', type: 'date', nullable: true })
  expectedReturnDate?: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastReturnReminderAt?: Date;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @ManyToOne(() => Warehouse, { nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Warehouse;

  @ManyToOne(() => Shop, { nullable: true })
  @JoinColumn({ name: 'shop_id' })
  shop?: Shop;

  @Column({ type: 'enum', enum: BorrowingStatus, default: BorrowingStatus.ACTIVE })
  status: BorrowingStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy?: User;
}
