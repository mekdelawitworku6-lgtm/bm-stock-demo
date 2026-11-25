import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisCacheModule } from './shared/cache/cache.module';
import { LoggerModule } from './shared/logger/logger.module';
import { SmsModule } from './shared/sms/sms.module';
import { EmailModule } from './shared/email/email.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import * as config from './config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { CustomerModule } from './modules/customer/customer.module';
import { CompanyModule } from './modules/company/company.module';
import { ShopsModule } from '@/modules/shops/shops.module';
import { SalesModule } from '@/modules/sales/sales.module';
import { CommissionModule } from '@/modules/commission/commission.module';
import { CollectionsModule } from '@/modules/collections/collections.module';
import { SettingsModule } from '@/modules/settings/settings.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';
import { InventoryModule } from '@/modules/inventory/inventory.module';
import { CreditsModule } from '@/modules/credits/credits.module';
import { ReceiptModule } from '@/modules/receipt/receipt.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { TransferModule } from '@/modules/transfer/transfer.module';
import { BankModule } from '@/modules/bank/bank.module';
import { ExpensesModule } from '@/modules/expenses/expenses.module';
import { PlansModule } from '@/modules/plans/plans.module';
import { BorrowingModule } from '@/modules/borrowing/borrowing.module';
import { IssueReportsModule } from '@/modules/issue-reports/issue-reports.module';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { AuditLogsInterceptor } from '@/modules/audit-logs/audit-logs.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [
        config.appConfig,
        config.databaseConfig,
        config.jwtConfig,
        config.redisConfig,
        config.swaggerConfig,
      ],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    DatabaseModule,
    RedisCacheModule,
    LoggerModule,
    SmsModule,
    EmailModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    WarehouseModule,
    CustomerModule,
    CompanyModule,
    ShopsModule,
    SalesModule,
    CommissionModule,
    CollectionsModule,
    SettingsModule,
    DashboardModule,
    InventoryModule,
    CreditsModule,
    ReceiptModule,
    NotificationsModule,
    TransferModule,
    BankModule,
    ExpensesModule,
    PlansModule,
    BorrowingModule,
    IssueReportsModule,
    AuditLogsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogsInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
