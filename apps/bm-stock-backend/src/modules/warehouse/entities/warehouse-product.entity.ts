import { Entity, ManyToOne, Column, Unique, Index } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Warehouse } from './warehouse.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('warehouse_products')
@Unique(['warehouse', 'product'])
@Index(['warehouse'])
@Index(['product'])
export class WarehouseProduct extends BaseEntity {
  @ManyToOne(() => Warehouse, warehouse => warehouse.products)
  warehouse: Warehouse;

  @Column({ name: 'warehouseId', nullable: true })
  warehouseId?: string;

  @ManyToOne(() => Product, product => product.warehouseProducts)
  product: Product;

  @Column({ name: 'productId', nullable: true })
  productId?: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'int', default: 0 })
  minStockLevel: number;
  
  @Column({ type: 'int', default: 0 })
  salesQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  salesRevenue: number;

  @Column({ type: 'date', nullable: true })
  lastSaleDate?: Date;
}