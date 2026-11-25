import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { DeviceToken } from './entities/device-token.entity';

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: App | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  private normalizePrivateKey(key: string): string {
    return key.replace(/\\n/g, '\n');
  }

  private init(): void {
    if (this.app) return;

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKeyBase64 = this.configService.get<string>('FIREBASE_PRIVATE_KEY_BASE64');
    const privateKeyRaw = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');

    const parseCredential = (raw: string): Record<string, any> | null => {
      try {
        const parsed = JSON.parse(raw) as Record<string, any>;
        if (parsed.private_key && typeof parsed.private_key === 'string') {
          parsed.private_key = this.normalizePrivateKey(parsed.private_key);
        }
        return parsed;
      } catch {
        return null;
      }
    };

    if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
      const credential = parseCredential(serviceAccountJson.trim());
      if (credential) {
        try {
          this.app = initializeApp({ credential: cert(credential) });
          this.logger.log('Firebase Admin SDK initialized for FCM (service account JSON).');
          return;
        } catch (error: any) {
          this.logger.error(`Failed to initialize Firebase Admin SDK: ${error?.message || error}`);
        }
      }
    }

    if (!projectId || !clientEmail || (!privateKeyBase64 && !privateKeyRaw)) {
      this.logger.warn('Firebase credentials not configured; FCM push notifications disabled.');
      return;
    }

    try {
      const decoded = privateKeyBase64
        ? Buffer.from(privateKeyBase64, 'base64').toString('utf8').trim()
        : (privateKeyRaw || '').trim();

      const credentialOptions = decoded.startsWith('{')
        ? parseCredential(decoded)
        : {
            projectId,
            clientEmail,
            privateKey: this.normalizePrivateKey(decoded),
          };

      if (!credentialOptions) {
        throw new Error('Invalid Firebase credential payload');
      }

      this.app = initializeApp({
        credential: cert(credentialOptions),
      });
      this.logger.log('Firebase Admin SDK initialized for FCM.');
    } catch (error: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${error?.message || error}`);
      this.app = null;
    }
  }

  async registerToken(userId: string, token: string, deviceType = 'android'): Promise<boolean> {
    if (!token || token.trim().length === 0) return false;
    try {
      const existing = await this.deviceTokenRepository.findOne({ where: { token } });
      if (existing) {
        if (existing.userId !== userId || existing.deviceType !== deviceType) {
          existing.userId = userId;
          existing.deviceType = deviceType;
          await this.deviceTokenRepository.save(existing);
        }
        return true;
      }
      await this.deviceTokenRepository.save(
        this.deviceTokenRepository.create({ userId, token, deviceType }),
      );
      this.logger.log(`FCM token registered for user ${userId} (${deviceType})`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to register FCM token: ${error?.message || error}`);
      return false;
    }
  }

  async unregisterToken(userId: string, token: string): Promise<boolean> {
    try {
      const result = await this.deviceTokenRepository.delete({ token, userId });
      return (result.affected ?? 0) > 0;
    } catch (error: any) {
      this.logger.error(`Failed to unregister FCM token: ${error?.message || error}`);
      return false;
    }
  }

  async getTokensForUser(userId: string): Promise<string[]> {
    try {
      const tokens = await this.deviceTokenRepository.find({
        where: { userId },
        select: ['token'],
      });
      return tokens.map((t) => t.token);
    } catch (error: any) {
      this.logger.error(`Failed to load FCM tokens: ${error?.message || error}`);
      return [];
    }
  }

  private async removeInvalidTokens(userId: string, tokens: string[], responses: { success: boolean }[]) {
    const invalid = tokens.filter((_, index) => !responses[index]?.success);
    if (invalid.length === 0) return;
    await this.deviceTokenRepository.delete({ userId, token: In(invalid) });
  }

  async sendToUser(userId: string, payload: FcmPayload): Promise<boolean> {
    try {
      this.init();
      if (!this.app) return false;

      const tokens = await this.getTokensForUser(userId);
      if (tokens.length === 0) {
        this.logger.debug(`No FCM tokens for user ${userId}`);
        return false;
      }

      const data: Record<string, string> = {};
      if (payload.data) {
        for (const [key, value] of Object.entries(payload.data)) {
          data[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }
      data.title = payload.title;
      data.body = payload.body;

      const response = await getMessaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'bm_stock_alerts',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title: payload.title, body: payload.body },
              sound: 'default',
            },
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icons/Icon-192.png',
          },
        },
      });

      await this.removeInvalidTokens(userId, tokens, response.responses);

      if (response.successCount > 0) {
        this.logger.log(
          `FCM push sent to ${response.successCount}/${tokens.length} device(s) for user ${userId}`,
        );
        return true;
      }

      this.logger.warn(
        `FCM push failed for user ${userId}: ${response.responses
          .map((r) => r.error?.message || 'unknown')
          .join('; ')}`,
      );
      return false;
    } catch (error: any) {
      this.logger.error(`FCM sendToUser failed for ${userId}: ${error?.message || error}`);
      return false;
    }
  }
}
