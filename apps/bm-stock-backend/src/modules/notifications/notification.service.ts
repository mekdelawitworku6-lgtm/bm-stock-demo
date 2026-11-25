import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { FcmService } from './fcm.service';
import { SmsService } from '@/shared/sms/sms.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly fcmService: FcmService,
    private readonly smsService: SmsService,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(dto);
    const saved = await this.notificationRepository.save(notification);

    if (dto.userId) {
      this.fcmService
        .sendToUser(dto.userId, {
          title: dto.title,
          body: dto.message,
          data: {
            type: dto.type,
            notificationId: saved.id,
            companyId: dto.companyId || '',
          },
        })
        .catch(() => undefined);
    }

    return saved;
  }

  async registerToken(userId: string, token: string, deviceType?: string): Promise<boolean> {
    return this.fcmService.registerToken(userId, token, deviceType);
  }

  async unregisterToken(userId: string, token: string): Promise<boolean> {
    return this.fcmService.unregisterToken(userId, token);
  }

  async sendSms(to: string, message: string): Promise<boolean> {
    if (!to || to.trim().length === 0) return false;
    const sent = await this.smsService.sendNotificationSms(to.trim(), message);
    if (sent) {
      this.logger.log(`[GeezSMS SMS Sent] To: ${to.trim()}`);
    } else {
      this.logger.error(`[GeezSMS SMS Failed] To: ${to.trim()}`);
    }
    return sent;
  }

  async sendEventNotification(data: {
    type: NotificationType;
    title: string;
    message: string;
    userId: string;
    companyId?: string;
    phone?: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    this.logger.log(`sendEventNotification: type=${data.type}, userId=${data.userId} (in-app push notification)`);

    // All business and event notifications are delivered as in-app notifications and FCM push notifications.
    // SMS is strictly reserved for OTP verification and Account Approval texts.
    const notification = await this.create({
      type: data.type,
      title: data.title,
      message: data.message,
      userId: data.userId,
      companyId: data.companyId,
      metadata: data.metadata,
    });

    return notification;
  }

  async findAll(userId: string, limit = 50, offset = 0): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async createNotification(data: {
    type: NotificationType;
    title: string;
    message: string;
    userId: string;
    companyId?: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    return this.create(data);
  }
}
