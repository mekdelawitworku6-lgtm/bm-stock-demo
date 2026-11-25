import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GeezSmsSendResponse {
  error?: boolean;
  msg?: string;
  message_status?: string;
  data?: Record<string, any>;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  static readonly APP_SMS_BRAND = 'BM Stock';

  static readonly DEFAULT_GEEZSMS_TOKEN = 'iRdmmzzqzhEwp4bd3ILigG6emcwHDtp7';

  constructor(private readonly configService: ConfigService) {}

  /** Retrieve GeezSMS token with fallback to default token so production never has undefined token */
  private getToken(): string {
    return (
      this.configService.get<string>('GEEZSMS_TOKEN') ||
      process.env.GEEZSMS_TOKEN ||
      SmsService.DEFAULT_GEEZSMS_TOKEN
    );
  }

  /** Normalize legacy GelagleStock branding in outbound SMS text. */
  brandMessage(message: string): string {
    return message
      .replace(/GelagleStock/gi, SmsService.APP_SMS_BRAND)
      .replace(/Gelagle Stock/gi, SmsService.APP_SMS_BRAND);
  }

  /**
   * Send a general notification SMS to a user's phone via GeezSMS.
   * Returns false (without throwing) when SMS is not configured or fails,
   * so callers can treat SMS as best-effort.
   */
  async sendNotificationSms(to: string, message: string): Promise<boolean> {
    const token = this.getToken();
    const forceDevMode = this.configService.get<string>('OTP_DEV_MODE') === 'true';

    if (forceDevMode || !token) {
      this.logger.warn(`[SMS DEV MODE] To: ${to} | Message: ${message}`);
      return true;
    }

    try {
      return await this.sendSmsViaGeezSms(to, message, token);
    } catch (err: any) {
      this.logger.error(`[GeezSMS Error] Failed to send notification to ${to}: ${err?.message || err}`);
      return false;
    }
  }

  /**
   * Send an SMS and throw if it cannot be delivered (used where delivery is required).
   */
  async sendSmsOrThrow(to: string, message: string): Promise<boolean> {
    const token = this.getToken();
    const forceDevMode = this.configService.get<string>('OTP_DEV_MODE') === 'true';

    if (forceDevMode) {
      this.logger.warn(`[SMS DEV MODE] To: ${to} | Message: ${message}`);
      return false;
    }
    if (!token) {
      throw new BadRequestException('SMS gateway is not configured (missing GeezSMS token).');
    }
    return await this.sendSmsViaGeezSms(to, message, token);
  }

  /**
   * Normalize an Ethiopian phone number to GeezSMS format (2519XXXXXXXX or 2517XXXXXXXX).
   */
  private normalizePhone(to: string): string {
    let cleaned = to.trim().replace(/[^\d]/g, '');
    if (cleaned.startsWith('2510') && cleaned.length === 13) {
      cleaned = `251${cleaned.substring(4)}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = `251${cleaned.substring(1)}`;
    } else if ((cleaned.startsWith('9') || cleaned.startsWith('7')) && cleaned.length === 9) {
      cleaned = `251${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Send a message via GeezSMS send endpoint.
   * Endpoint: POST https://api.geezsms.com/api/v1/sms/send
   * Body: { token, phone, msg, shortcode_id? }
   */
  private async sendSmsViaGeezSms(to: string, message: string, token: string): Promise<boolean> {
    const cleanedPhone = this.normalizePhone(to);
    const shortcodeId = this.configService.get<string>('GEEZSMS_SHORTCODE_ID');
    const brandedMessage = this.brandMessage(message);

    if (brandedMessage.length > 335) {
      throw new BadRequestException('Message content must be less than 335 characters.');
    }

    const url = 'https://api.geezsms.com/api/v1/sms/send';
    const payload: Record<string, any> = {
      token,
      phone: cleanedPhone,
      msg: brandedMessage,
    };
    if (shortcodeId && shortcodeId.trim().length > 0) {
      payload.shortcode_id = shortcodeId.trim();
    }

    this.logger.log(`[GeezSMS Request] Sending SMS to ${cleanedPhone} (input: ${to})...`);

    const { default: axios } = await import('axios');
    try {
      const response = await axios.post<GeezSmsSendResponse>(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      const data = response.data ?? {};
      this.logger.log(`[GeezSMS Response] ${JSON.stringify(data)}`);

      if (data.error === true || data.message_status === 'error') {
        this.logger.error(`[GeezSMS Error Response] ${data.msg || JSON.stringify(data)}`);
        throw new BadRequestException(data.msg || 'Failed to send SMS via GeezSMS');
      }

      if (data.message_status === 'success' || response.status >= 200 && response.status < 300) {
        return true;
      }

      return !data.error;
    } catch (error: any) {
      const resp = error?.response?.data;
      const errorMsg = resp?.msg || resp?.message || resp?.error || error?.message || 'Failed to send SMS';
      this.logger.error(`[GeezSMS API Call Failed] Phone: ${cleanedPhone}, Error: ${errorMsg}`);
      throw new BadRequestException(`SMS Delivery Failed: ${errorMsg}`);
    }
  }
}
