import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transfer } from './entities/transfer.entity';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { Product } from '../products/entities/product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RedisCacheModule } from '@/shared/cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transfer, Product, Warehouse, Shop,
      WarehouseProduct, ShopProduct, InventoryTransaction, User,
    ]),
    NotificationsModule,
    RedisCacheModule,
  ],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
