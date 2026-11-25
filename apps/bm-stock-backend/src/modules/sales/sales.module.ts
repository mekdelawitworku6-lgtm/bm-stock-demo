import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { DiscountController } from './discount.controller';
import { DiscountService } from './discount.service';
import { Sales } from './entities/sales.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Product } from '../products/entities/product.entity';
import { SaleItem } from './entities/sales-item.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Discount } from './entities/discount.entity';
import { Shop } from '../shops/entities/shops.entity';
import { User } from '../users/entities/user.entity';
import { Employee } from '../users/entities/employee.entity';
import { Settings } from '../settings/entities/settings.entity';
import { CommissionModule } from '../commission/commission.module';
import { RedisCacheModule } from '@/shared/cache/cache.module';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { ReceiptModule } from '../receipt/receipt.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sales,
      Customer,
      Warehouse,
      Product,
      SaleItem,
      PaymentTransaction,
      AuditLog,
      Discount,
      Shop,
      User,
      Employee,
      Settings,
      WarehouseProduct,
      ShopProduct,
    ]),
    CommissionModule,
    RedisCacheModule,
    ReceiptModule,
    NotificationsModule,
  ],
  controllers: [SalesController, DiscountController],
  providers: [SalesService, DiscountService],
  exports: [SalesService, DiscountService],
})
export class SalesModule {}
