import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { User } from '../users/entities/user.entity';
import { UserRole, UserStatus } from '@/common/enums';
import { NotificationService } from './notification.service';
import { NotificationType } from './entities/notification.entity';

@Injectable()
export class DailyReminderService {
  private readonly logger = new Logger(DailyReminderService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationService: NotificationService,
  ) {}

  /** Every day at 4:30 PM send a push reminder to active company admins. */
  @Cron('30 16 * * *')
  async sendDailySaleReminder(): Promise<void> {
    try {
      const owners = await this.userRepository.find({
        where: {
          status: UserStatus.ACTIVE,
          role: In([UserRole.COMPANY_ADMIN]),
        },
      });

      let sent = 0;
      for (const owner of owners) {
        try {
          await this.notificationService.sendEventNotification({
            type: NotificationType.INFO,
            title: 'Did You Sell Today?',
            message: 'Did you sale anything today?',
            userId: owner.id,
            companyId: owner.companyId,
            metadata: { reminderType: 'daily_sale_reminder' },
          });
          sent++;
        } catch (error: any) {
          this.logger.error(
            `Daily sale reminder failed for ${owner.id}: ${error?.message || error}`,
          );
        }
      }

      if (sent > 0) {
        this.logger.log(`Daily sale reminder sent to ${sent} user(s)`);
      }
    } catch (error: any) {
      this.logger.error(`Daily sale reminder scan failed: ${error?.message || error}`);
    }
  }
}