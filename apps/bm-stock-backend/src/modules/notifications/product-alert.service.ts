import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Product } from '../products/entities/product.entity';
import { Company } from '../company/entities/company.entity';
import { NotificationService } from './notification.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '@/common/enums';
import { NotificationType } from './entities/notification.entity';
import { SettingsService } from '../settings/settings.service';

const THROTTLE_MS = 24 * 60 * 60 * 1000;

export interface LowStockAlertContext {
  currentQuantity?: number;
  locationName?: string;
  companyId?: string;
}

@Injectable()
export class ProductAlertService {
  private readonly logger = new Logger(ProductAlertService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Send a low-stock SMS to company admin(s) when stock drops to or below the
   * minimum level. Throttled to one alert per product per 24h unless stock
   * freshly crosses below the threshold again.
   */
  async checkLowStock(
    product: Product,
    previousQuantity?: number | null,
    context?: LowStockAlertContext,
  ): Promise<void> {
    try {
      const companyId = context?.companyId ?? product.companyId;

      const notificationsEnabled = await this.settingsService.isFeatureEnabled(
        'enableLowStockNotifications',
        companyId,
      );
      if (!notificationsEnabled) return;

      if (!product?.trackStock) return;
      if (product.minStockLevel <= 0) return;

      const currentQty = context?.currentQuantity ?? product.stockQuantity;
      if (currentQty > product.minStockLevel) return;

      if (!companyId) return;

      const crossedBelow =
        previousQuantity != null && previousQuantity > product.minStockLevel;
      const lastAlert = product.lastLowStockAlertAt
        ? new Date(product.lastLowStockAlertAt).getTime()
        : 0;

      if (!crossedBelow && lastAlert > 0 && Date.now() - lastAlert < THROTTLE_MS) {
        return;
      }

      const locationPart = context?.locationName ? ` at ${context.locationName}` : '';
      const message = `Low stock alert: "${product.name}"${locationPart} has only ${currentQty} unit(s) left. Minimum level is ${product.minStockLevel}. Please restock.`;

      const sent = await this.notifyCompanyAdmins(companyId, 'Low Stock Alert', message, {
        productId: product.id,
        productName: product.name,
        currentStock: currentQty,
        minStockLevel: product.minStockLevel,
        location: context?.locationName,
      });

      if (sent) {
        product.lastLowStockAlertAt = new Date();
        await this.productRepository.save(product);
        this.logger.log(`Low-stock alert sent for product ${product.id}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process low-stock alert for product ${product?.id}: ${error.message}`,
      );
    }
  }

  /** Daily scan for products still below minimum stock — sends reminder SMS to admins. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async scanLowStockReminders(): Promise<void> {
    try {
      this.logger.log('Running daily low-stock reminder scan...');

      const products = await this.productRepository
        .createQueryBuilder('product')
        .where('product.trackStock = true')
        .andWhere('product.minStockLevel > 0')
        .andWhere('product.stockQuantity <= product.minStockLevel')
        .getMany();

      for (const product of products) {
        await this.checkLowStock(product);
      }
    } catch (error: any) {
      this.logger.error(`Daily low-stock scan failed: ${error.message}`);
    }
  }

  /**
   * Daily cron that sends the expiry reminder SMS to company admins on the
   * product's configured reminder date (if it hasn't already been sent).
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkExpiryReminders(): Promise<void> {
    this.logger.log('Running daily expiry reminder check...');
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const products = await this.productRepository
      .createQueryBuilder('product')
      .where('product.reminderDate IS NOT NULL')
      .andWhere('product.expiryDate IS NOT NULL')
      .getMany();

    for (const product of products) {
      try {
        const reminderDate = new Date(product.reminderDate);
        reminderDate.setHours(0, 0, 0, 0);
        const expiryDate = new Date(product.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);

        if (reminderDate.getTime() > now.getTime()) {
          await this.clearExpiryMarker(product);
          continue;
        }

        if (expiryDate.getTime() < now.getTime()) {
          continue;
        }

        const lastAlert = product.lastExpiryReminderAt
          ? new Date(product.lastExpiryReminderAt).getTime()
          : 0;
        if (lastAlert > 0 && now.getTime() - lastAlert < THROTTLE_MS) continue;

        const companyId = product.companyId;
        if (!companyId) continue;

        const expiryText = expiryDate.toISOString().split('T')[0];
        const message = `Expiry reminder: "${product.name}" expires on ${expiryText}. Please check your stock.`;

        const sent = await this.notifyCompanyAdmins(
          companyId,
          'Expiry Reminder',
          message,
          {
            productId: product.id,
            productName: product.name,
            expiryDate: expiryText,
          },
          NotificationType.INFO,
        );

        if (sent) {
          product.lastExpiryReminderAt = now;
          await this.productRepository.save(product);
          this.logger.log(`Expiry reminder sent for product ${product.id}`);
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to process expiry reminder for product ${product.id}: ${error.message}`,
        );
      }
    }
  }

  private async notifyCompanyAdmins(
    companyId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
    type: NotificationType = NotificationType.LOW_STOCK,
  ): Promise<boolean> {
    const admins = await this.userRepository.find({
      where: {
        companyId,
        role: In([UserRole.COMPANY_ADMIN, UserRole.ADMIN]),
      },
      select: ['id', 'phone', 'firstName', 'lastName'],
    });

    let anyDelivered = false;
    const smsPhones = new Set<string>();

    for (const admin of admins) {
      await this.notificationService.sendEventNotification({
        type,
        title,
        message,
        userId: admin.id,
        companyId,
        metadata,
      });
      anyDelivered = true;
    }

    return anyDelivered;
  }

  private async clearExpiryMarker(product: Product): Promise<void> {
    if (product.lastExpiryReminderAt) {
      product.lastExpiryReminderAt = null;
      await this.productRepository.save(product);
    }
  }

  private async getCompanyPhone(companyId?: string): Promise<string | null> {
    if (!companyId) return null;
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    return company?.phoneNumber || null;
  }
}
