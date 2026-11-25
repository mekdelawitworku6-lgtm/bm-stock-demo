import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { CreditAccount, CreditPayment, CreditTransaction } from './entities/credit.entity';
import { Customer } from '../customer/entities/customer.entity';
import { RedisCacheModule } from '@/shared/cache/cache.module';
import { ReceiptModule } from '../receipt/receipt.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditAccount, CreditPayment, CreditTransaction, Customer, User]),
    RedisCacheModule,
    ReceiptModule,
    NotificationsModule,
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
