import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ProductBorrowing,
  BorrowingStatus,
} from '../borrowing/entities/product-borrowing.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, UserStatus } from '@/common/enums';
import { NotificationService } from './notification.service';
import { NotificationType } from './entities/notification.entity';

@Injectable()
export class BorrowingReminderService {
  private readonly logger = new Logger(BorrowingReminderService.name);

  constructor(
    @InjectRepository(ProductBorrowing)
    private readonly borrowingRepo: Repository<ProductBorrowing>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationService: NotificationService,
  ) {}

  /** Daily scan for borrowed products whose return date has arrived or passed. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyReturnReminders(): Promise<void> {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayStr = startOfToday.toISOString().split('T')[0];

      const due = await this.borrowingRepo
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.company', 'company')
        .where('b.expected_return_date IS NOT NULL')
        .andWhere('b.expected_return_date <= :today', { today: todayStr })
        .andWhere('b.status != :fullyReturned', {
          fullyReturned: BorrowingStatus.FULLY_RETURNED,
        })
        .andWhere(
          '(b.lastReturnReminderAt IS NULL OR b.lastReturnReminderAt < :startOfToday)',
          { startOfToday: startOfToday.toISOString() },
        )
        .getMany();

      if (due.length === 0) return;

      for (const record of due) {
        await this.notifyRecord(record, startOfToday);
      }

      this.logger.log(
        `Borrowing return reminders sent for ${due.length} record(s)`,
      );
    } catch (error: any) {
      this.logger.error(
        `Borrowing return reminder scan failed: ${error?.message || error}`,
      );
    }
  }

  private async notifyRecord(record: ProductBorrowing, now: Date): Promise<void> {
    const companyId = record.company?.id;
    if (!companyId) return;

    const admins = await this.userRepository.find({
      where: {
        companyId,
        status: UserStatus.ACTIVE,
        role: In([UserRole.COMPANY_ADMIN, UserRole.ADMIN]),
      },
      select: ['id', 'phone', 'firstName', 'lastName'],
    });

    if (admins.length === 0) return;

    const remaining = Math.max(0, record.quantityTaken - record.quantityReturned);
    const message =
      `Borrowing due: "${record.productName}" (Qty: ${record.quantityTaken}, ` +
      `Returned: ${record.quantityReturned}, Remaining: ${remaining}) ` +
      `taken from ${record.sellerName} should be returned by ${record.expectedReturnDate}. Please follow up.`;

    for (const admin of admins) {
      await this.notificationService
        .sendEventNotification({
          type: NotificationType.BORROWING,
          title: 'Borrowing Return Reminder',
          message,
          userId: admin.id,
          companyId,
          metadata: {
            borrowingId: record.id,
            productName: record.productName,
            quantityTaken: record.quantityTaken,
            quantityReturned: record.quantityReturned,
            sellerName: record.sellerName,
            expectedReturnDate: record.expectedReturnDate,
            reminderType: 'borrowing_return',
          },
        })
        .catch((error: any) => {
          this.logger.error(
            `Failed to send borrowing reminder for ${record.id}: ${error?.message || error}`,
          );
        });
    }

    record.lastReturnReminderAt = now;
    await this.borrowingRepo.save(record);
  }
}