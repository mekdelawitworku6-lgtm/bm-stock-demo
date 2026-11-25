import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Shop } from '../../shops/entities/shops.entity';

export enum TransferType {
  WAREHOUSE_TO_SHOP = 'warehouse_to_shop',
  SHOP_TO_WAREHOUSE = 'shop_to_warehouse',
}

export enum TransferStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('transfers')
export class Transfer extends BaseEntity {
  @Column({ type: 'enum', enum: TransferType })
  type: TransferType;

  @Column({ type: 'enum', enum: TransferStatus, default: TransferStatus.PENDING })
  status: TransferStatus;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Warehouse, { nullable: true, eager: true })
  @JoinColumn({ name: 'from_warehouse_id' })
  fromWarehouse?: Warehouse;

  @ManyToOne(() => Warehouse, { nullable: true, eager: true })
  @JoinColumn({ name: 'to_warehouse_id' })
  toWarehouse?: Warehouse;

  @ManyToOne(() => Shop, { nullable: true, eager: true })
  @JoinColumn({ name: 'from_shop_id' })
  fromShop?: Shop;

  @ManyToOne(() => Shop, { nullable: true, eager: true })
  @JoinColumn({ name: 'to_shop_id' })
  toShop?: Shop;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: User;
}
