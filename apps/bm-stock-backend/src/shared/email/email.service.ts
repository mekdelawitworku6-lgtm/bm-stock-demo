import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderName?: string;
  senderEmail?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send a transactional email via Brevo (Sendinblue) HTTP API.
   * Docs: https://developers.brevo.com/reference/sendtransacemail
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');

    if (!apiKey) {
      this.logger.warn('[Brevo] BREVO_API_KEY not configured – email not sent.');
      this.logger.warn(`[Brevo DEV] Would send to: ${options.to} | Subject: ${options.subject}`);
      return false;
    }

    const senderName = options.senderName || this.configService.get<string>('BREVO_SENDER_NAME', 'BM Stock');
    const senderEmail = options.senderEmail || this.configService.get<string>('BREVO_SENDER_EMAIL', 'no-reply@bmstock.com');

    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.htmlContent,
      ...(options.textContent ? { textContent: options.textContent } : {}),
    };

    try {
      const { default: axios } = await import('axios');
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        payload,
        {
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 15000,
        },
      );

      this.logger.log(`[Brevo] Email sent to ${options.to} — messageId: ${response.data?.messageId}`);
      return true;
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || error?.message || String(error);
      this.logger.error(`[Brevo] Failed to send email to ${options.to}: ${errMsg}`);
      return false;
    }
  }

  /**
   * Send a 6-digit OTP code to the given email address.
   * Returns whether the email was successfully dispatched.
   */
  async sendOtpEmail(to: string, code: string): Promise<boolean> {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#025EA7;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">BM Stock</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Admin Portal</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;font-weight:600;">Password Reset Code</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                You requested to reset your admin portal password. Use the verification code below to proceed:
              </p>
              <div style="background-color:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
                <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#025EA7;font-family:'Courier New',monospace;">${code}</span>
              </div>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.5;">
                ⏱ This code expires in <strong>5 minutes</strong>.
              </p>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">
                If you did not request this, please ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                &copy; ${new Date().getFullYear()} BM Stock. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const textContent = `BM Stock Admin Portal - Password Reset\n\nYour verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`;

    return this.sendEmail({
      to,
      subject: `${code} — BM Stock Admin Password Reset`,
      htmlContent,
      textContent,
    });
  }
}
