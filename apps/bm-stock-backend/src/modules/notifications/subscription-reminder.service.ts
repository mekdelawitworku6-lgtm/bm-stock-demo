import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { UserRole, UserStatus, CompanyStatus } from '@/common/enums';
import { NotificationService } from './notification.service';
import { NotificationType } from './entities/notification.entity';
import {
  getSubscriptionReminderLead,
  isShortTestPlan,
  isTrialPlan,
} from '@/shared/subscription/subscription-period.util';

@Injectable()
export class SubscriptionReminderService {
  private readonly logger = new Logger(SubscriptionReminderService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly notificationService: NotificationService,
  ) {}

  /** Daily at midnight: sweep and deactivate expired subscriptions with zero data loss */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkAndDeactivateExpiredSubscriptions(): Promise<void> {
    await this.sweepExpiredSubscriptions();
  }

  /** Daily at 9 AM for trial/month/year plans. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyRenewalReminders(): Promise<void> {
    await this.sweepExpiredSubscriptions();
    await this.sendRenewalReminders();
  }

  /** Every minute for minute-based plans. */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendMinuteRenewalReminders(): Promise<void> {
    const owners = await this.userRepository.find({
      where: {
        status: UserStatus.ACTIVE,
        role: In([UserRole.COMPANY_ADMIN]),
        subscriptionExpiresAt: Not(IsNull()),
      },
    });

    let sent = 0;
    for (const owner of owners) {
      if (!isShortTestPlan(owner.planPeriod)) continue;

      try {
        const didSend = await this.maybeSendReminder(owner);
        if (didSend) sent++;
      } catch (err: any) {
        this.logger.error(`Minute subscription reminder failed for ${owner.id}: ${err?.message || err}`);
      }
    }

    if (sent > 0) {
      this.logger.log(`Minute subscription reminder scan complete. Sent: ${sent}`);
    }
  }

  private async sendRenewalReminders(): Promise<void> {
    const owners = await this.userRepository.find({
      where: {
        status: UserStatus.ACTIVE,
        role: In([UserRole.COMPANY_ADMIN]),
        subscriptionExpiresAt: Not(IsNull()),
      },
    });

    let sent = 0;
    for (const owner of owners) {
      if (isShortTestPlan(owner.planPeriod)) continue;

      try {
        const didSend = await this.maybeSendReminder(owner);
        if (didSend) sent++;
      } catch (err: any) {
        this.logger.error(`Subscription reminder failed for ${owner.id}: ${err?.message || err}`);
      }
    }

    if (sent > 0) {
      this.logger.log(`Subscription reminder scan complete. Sent: ${sent}`);
    }
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private truncateToMinute(date: Date): Date {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
  }

  private daysUntil(from: Date, to: Date): number {
    const ms = this.startOfDay(to).getTime() - this.startOfDay(from).getTime();
    return Math.round(ms / (24 * 60 * 60 * 1000));
  }

  private minutesUntil(from: Date, to: Date): number {
    const ms = this.truncateToMinute(to).getTime() - this.truncateToMinute(from).getTime();
    return Math.round(ms / (60 * 1000));
  }

  private alreadyRemindedForCurrentPeriod(user: User, lead: { unit: 'minutes' | 'days'; value: number }): boolean {
    if (!user.lastSubscriptionReminderAt || !user.subscriptionExpiresAt) return false;

    if (lead.unit === 'minutes') {
      return user.lastSubscriptionReminderAt >= (user.subscriptionStartDate || user.lastSubscriptionReminderAt);
    }

    const remindedAt = this.startOfDay(user.lastSubscriptionReminderAt);
    const expiresAt = this.startOfDay(user.subscriptionExpiresAt);
    const reminderWindowStart = new Date(expiresAt);
    reminderWindowStart.setDate(reminderWindowStart.getDate() - lead.value);

    return remindedAt >= reminderWindowStart;
  }

  private async notifyPlatformAdmins(owner: User, message: string): Promise<void> {
    const admins = await this.userRepository.find({
      where: { role: In([UserRole.ADMIN, UserRole.SUPER_ADMIN]), status: UserStatus.ACTIVE },
      select: ['id'],
    });

    await Promise.all(
      admins.map((admin) =>
        this.notificationService
          .create({
            type: NotificationType.INFO,
            title: 'Subscription Renewal Reminder',
            message: `[Admin alert] ${owner.firstName || ''} ${owner.lastName || ''} (${owner.email}): ${message}`,
            userId: admin.id,
            metadata: { reminderType: 'subscription_renewal_admin', ownerId: owner.id },
          })
          .catch(() => undefined),
      ),
    );
  }

  private async maybeSendReminder(owner: User): Promise<boolean> {
    if (!owner.subscriptionExpiresAt) return false;

    const now = new Date();
    if (owner.subscriptionExpiresAt <= now) return false;

    const lead = getSubscriptionReminderLead(owner.planPeriod);
    const timeLeft =
      lead.unit === 'minutes'
        ? this.minutesUntil(now, owner.subscriptionExpiresAt)
        : this.daysUntil(now, owner.subscriptionExpiresAt);

    const isMatch =
      lead.unit === 'minutes'
        ? timeLeft <= lead.value && timeLeft > 0
        : timeLeft === lead.value;

    if (!isMatch) return false;
    if (this.alreadyRemindedForCurrentPeriod(owner, lead)) return false;

    const expiryText = owner.subscriptionExpiresAt.toISOString();
    const plan = owner.planTitle || 'BM Stock';

    // Build the appropriate message based on whether this is a trial plan
    let message: string;
    if (isTrialPlan(owner.planPeriod)) {
      message =
        `[BM Stock] Your free trial phase is about to end! ` +
        `Your 14-day free trial expires on ${expiryText} (${timeLeft} days remaining). ` +
        `Subscribe to one of our premium plans to continue using BM Stock without interruption. ` +
        `Your data will be safely preserved.`;
    } else {
      const amount = owner.planAmount ? Number(owner.planAmount) : null;
      const amountPart = amount != null && amount > 0 ? ` Amount: ETB ${amount}.` : ' ';
      const timeLabel =
        lead.unit === 'minutes'
          ? `${timeLeft} minute${timeLeft === 1 ? '' : 's'}`
          : `${lead.value} days`;

      message =
        `[BM Stock] Your "${plan}" subscription expires at ${expiryText} (in ${timeLabel}).` +
        `${amountPart} Please renew now to avoid losing access for your company and staff.`;
    }

    const title = isTrialPlan(owner.planPeriod)
      ? 'Free Trial Ending Soon'
      : 'Subscription Renewal Reminder';

    await this.notificationService.sendEventNotification({
      type: NotificationType.INFO,
      title,
      message,
      userId: owner.id,
      companyId: owner.companyId,
      metadata: {
        subscriptionExpiresAt: expiryText,
        timeRemaining: timeLeft,
        timeUnit: lead.unit,
        reminderType: isTrialPlan(owner.planPeriod) ? 'trial_expiry_warning' : 'subscription_renewal',
      },
    });

    // Send SMS to ensure timely renewal / trial upgrade
    let smsSent = false;
    if (owner.phone?.trim()) {
      smsSent = await this.notificationService.sendSms(owner.phone, message);
    }

    if (!smsSent && owner.companyId) {
      const company = await this.companyRepository.findOne({ where: { id: owner.companyId } });
      if (company?.phoneNumber?.trim()) {
        smsSent = await this.notificationService.sendSms(company.phoneNumber, message);
      }
    }

    await this.notifyPlatformAdmins(owner, message);

    owner.lastSubscriptionReminderAt = now;
    await this.userRepository.save(owner);

    this.logger.log(
      `${isTrialPlan(owner.planPeriod) ? 'Trial expiry' : 'Subscription'} reminder sent to user ${owner.id} (SMS: ${smsSent ? 'yes' : 'no'}, lead: ${lead.value} ${lead.unit})`,
    );
    return true;
  }

  /**
   * Sweep expired subscriptions: set the company status to SUBSCRIPTION_EXPIRED
   * without deleting any data. This blocks access while preserving all records.
   */
  private async sweepExpiredSubscriptions(): Promise<void> {
    const now = new Date();

    // Find company admins whose subscription has expired
    const expiredOwners = await this.userRepository.find({
      where: {
        role: In([UserRole.COMPANY_ADMIN]),
        subscriptionExpiresAt: LessThan(now),
      },
      relations: ['company'],
    });

    let deactivated = 0;
    for (const owner of expiredOwners) {
      if (!owner.company) continue;
      if (owner.company.status === CompanyStatus.DEACTIVATED) continue; // Already manually deactivated
      if (owner.company.status === CompanyStatus.SUBSCRIPTION_EXPIRED) continue; // Already swept

      try {
        // Set company status to expired — NO data deletion
        owner.company.status = CompanyStatus.SUBSCRIPTION_EXPIRED;
        await this.companyRepository.save(owner.company);

        // Also mark the owner user as inactive so they can't bypass the company check
        if (owner.status === UserStatus.ACTIVE) {
          owner.status = UserStatus.INACTIVE;
          await this.userRepository.save(owner);
        }

        // Send a final SMS notifying the user their account is now deactivated
        const deactivationMsg =
          isTrialPlan(owner.planPeriod)
            ? `[BM Stock] Your 14-day free trial has ended. Your account has been deactivated but all your data is safely preserved. Subscribe to a premium plan to reactivate your account and continue using BM Stock.`
            : `[BM Stock] Your "${owner.planTitle || 'BM Stock'}" subscription has expired. Your account has been deactivated but all your data is safely preserved. Please renew your subscription to restore access.`;

        if (owner.phone?.trim()) {
          await this.notificationService.sendSms(owner.phone, deactivationMsg).catch(() => undefined);
        }

        await this.notificationService.sendEventNotification({
          type: NotificationType.INFO,
          title: isTrialPlan(owner.planPeriod) ? 'Free Trial Ended' : 'Subscription Expired',
          message: deactivationMsg,
          userId: owner.id,
          companyId: owner.companyId,
          metadata: {
            reminderType: isTrialPlan(owner.planPeriod) ? 'trial_expired' : 'subscription_expired',
            expiredAt: owner.subscriptionExpiresAt?.toISOString(),
          },
        }).catch(() => undefined);

        await this.notifyPlatformAdmins(owner, deactivationMsg);

        deactivated++;
        this.logger.warn(
          `Deactivated expired ${isTrialPlan(owner.planPeriod) ? 'trial' : 'subscription'} for company ${owner.company.id} (owner: ${owner.id}). Data preserved.`,
        );
      } catch (err: any) {
        this.logger.error(`Failed to deactivate expired subscription for company ${owner.company?.id}: ${err?.message || err}`);
      }
    }

    if (deactivated > 0) {
      this.logger.log(`Expired subscription sweep complete. Deactivated: ${deactivated}`);
    }
  }
}

