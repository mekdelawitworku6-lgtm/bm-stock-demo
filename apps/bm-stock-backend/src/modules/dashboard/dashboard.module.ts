import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Sales } from '../sales/entities/sales.entity';
import { Product } from '../products/entities/product.entity';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { RedisCacheModule } from '@/shared/cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sales, Product, WarehouseProduct, ShopProduct,
      Customer, Warehouse, Shop,
    ]),
    RedisCacheModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
