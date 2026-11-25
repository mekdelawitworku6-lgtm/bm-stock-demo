import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { ProductAlertService } from './product-alert.service';
import { SubscriptionReminderService } from './subscription-reminder.service';
import { BorrowingReminderService } from './borrowing-reminder.service';
import { DailyReminderService } from './daily-reminder.service';
import { FcmService } from './fcm.service';
import { Product } from '../products/entities/product.entity';
import { Company } from '../company/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { ProductBorrowing } from '../borrowing/entities/product-borrowing.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      DeviceToken,
      Product,
      Company,
      User,
      ProductBorrowing,
    ]),
    SettingsModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    ProductAlertService,
    SubscriptionReminderService,
    BorrowingReminderService,
    DailyReminderService,
    FcmService,
  ],
  exports: [
    NotificationService,
    ProductAlertService,
    SubscriptionReminderService,
    BorrowingReminderService,
    DailyReminderService,
    FcmService,
    TypeOrmModule,
  ],
})
export class NotificationsModule {}
