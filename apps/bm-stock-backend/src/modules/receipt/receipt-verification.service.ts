import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { getBankInfo } from './receipt-banks';

export interface VerifiedReceipt {
  valid: boolean;
  status: 'valid' | 'invalid' | 'pending' | 'error' | 'already_used';
  message: string;
  bank: string;
  amount?: number;
  currency?: string;
  senderName?: string;
  receiverName?: string;
  payerAccount?: string;
  receiverAccount?: string;
  reference?: string;
  receiptNumber?: string;
  receiptUrl?: string;
  transactionDate?: string;
  reason?: string;
  requestId?: string;
  alreadyUsed?: boolean;
  raw?: any;
}

export interface VerifyReceiptParams {
  bank?: string;
  reference?: string;
  suffix?: string;
  phoneNumber?: string;
  receiptUrl?: string;
}

@Injectable()
export class ReceiptVerificationService {
  private readonly logger = new Logger(ReceiptVerificationService.name);
  private readonly defaultApiKey =
    'VERIFY_BANK_ET_siBtYLcHrKyg_2D9BXQONxBF3M_c3B21vsImFGvg_KaPDnhCRy9kKVVcXla3ANAh';
  private readonly verifyUrl = 'https://verify.et/api/verify';

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string {
    return (
      this.configService.get<string>('VERIFY_ET_API_KEY') || this.defaultApiKey
    );
  }

  /**
   * Normalize a CBE input (link, short ID, FT number) into an optimal field value.
   */
  private normalizeCbeReference(rawInput: string): string {
    const trimmed = rawInput.trim();

    // 1. Direct CBE modern link: https://mbreciept.cbe.com.et/{SHORT_ID}
    const modernLinkMatch = trimmed.match(
      /https?:\/\/mbreciept\.cbe\.com\.et\/([A-Za-z0-9_-]+)/i,
    );
    if (modernLinkMatch) return modernLinkMatch[0];

    // 2. Raw modern short ID (typically 14-28 alphanumeric chars)
    if (
      /^[A-Za-z0-9_-]{14,28}$/.test(trimmed) &&
      !trimmed.toUpperCase().startsWith('FT')
    ) {
      return `https://mbreciept.cbe.com.et/${trimmed}`;
    }

    return trimmed;
  }

  /**
   * Map a generic verification request into the verify.et bank-specific payload.
   */
  private buildPayload(params: VerifyReceiptParams): Record<string, string> {
    const bank = String(params.bank || 'cbe').toLowerCase().trim();
    let reference = (params.reference || '').trim();
    const suffix = (params.suffix || '').trim();
    const phoneNumber = (params.phoneNumber || '').trim();
    const receiptUrl = (params.receiptUrl || '').trim();

    if (bank === 'cbe' && reference && !receiptUrl) {
      reference = this.normalizeCbeReference(reference);
    }

    const payload: Record<string, string> = { bank };

    switch (bank) {
      case 'cbe': {
        if (reference) payload.reference = reference;
        if (suffix) payload.suffix = suffix;
        break;
      }
      case 'boa': {
        if (reference) {
          payload.reference = reference;
          payload.referenceNumber = reference;
        }
        if (suffix) {
          payload.suffix = suffix;
          payload.accountSuffix = suffix;
        }
        break;
      }
      case 'cbebirr': {
        if (reference) {
          payload.reference = reference;
          payload.receiptNumber = reference;
        }
        if (phoneNumber) {
          payload.phoneNumber = phoneNumber;
          payload.phone = phoneNumber;
        }
        break;
      }
      case 'telebirr':
      case 'mpesa': {
        if (reference) {
          payload.reference = reference;
          payload.transactionNumber = reference;
        }
        break;
      }
      case 'coopayebirr': {
        if (receiptUrl) payload.receiptUrl = receiptUrl;
        if (reference) {
          payload.reference = reference;
          payload.referenceNumber = reference;
        }
        if (phoneNumber) payload.phoneNumber = phoneNumber;
        break;
      }
      case 'kaafiebirr': {
        if (reference) {
          payload.reference = reference;
          payload.referenceNumber = reference;
        }
        if (phoneNumber) payload.phoneNumber = phoneNumber;
        break;
      }
      default: {
        // dashen, awash, siinqee, zemen
        if (reference) {
          payload.reference = reference;
          payload.referenceNumber = reference;
        }
        break;
      }
    }

    return payload;
  }

  /**
   * Validate required fields for a given provider before hitting the network.
   */
  private validatePayload(payload: Record<string, string>): string | null {
    const bank = payload.bank;
    const info = getBankInfo(bank);
    if (!payload.reference && !payload.receiptUrl) {
      return `Please provide the ${info.primaryLabel.toLowerCase()}.`;
    }
    for (const field of info.fields) {
      if (field.required && !payload[field.key]) {
        return `Please provide the ${field.label.toLowerCase()} for ${info.shortName}.`;
      }
    }
    return null;
  }

  /**
   * Verify a receipt by link, reference, transaction number, or token.
   */
  async verify(params: VerifyReceiptParams): Promise<VerifiedReceipt> {
    const bank = String(params.bank || 'cbe').toLowerCase().trim();
    const payload = this.buildPayload(params);

    const validationError = this.validatePayload(payload);
    if (validationError) {
      return {
        valid: false,
        status: 'invalid',
        message: validationError,
        bank,
      };
    }

    const apiKey = this.getApiKey();
    const idempotencyKey = crypto.randomUUID();

    try {
      this.logger.log(
        `Verifying ${bank} receipt via verify.et: ${JSON.stringify(payload)}`,
      );
      const response = await axios.post(`${this.verifyUrl}?waitMs=15000`, payload, {
        headers: {
          'x-api-key': apiKey,
          'Idempotency-Key': idempotencyKey,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
        validateStatus: () => true,
      });

      return this.formatVerificationResponse(response.data, bank, response.status);
    } catch (error: any) {
      this.logger.error(`Error calling verify.et: ${error?.message || error}`);
      return {
        valid: false,
        status: 'error',
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to connect to receipt verification service.',
        bank,
        raw: error?.response?.data,
      };
    }
  }

  /**
   * Verify a receipt via image upload (multipart). Optionally hint the bank/reference.
   */
  async verifyByImage(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string = 'image/png',
    bank: string = 'cbe',
    reference?: string,
  ): Promise<VerifiedReceipt> {
    const bankId = String(bank || 'cbe').toLowerCase().trim();
    const apiKey = this.getApiKey();
    const idempotencyKey = crypto.randomUUID();
    const boundary =
      '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const parts: Buffer[] = [];
    const addField = (name: string, value: string) => {
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
            `${value}\r\n`,
        ),
      );
    };

    addField('bank', bankId);
    if (reference && reference.trim()) addField('reference', reference.trim());

    const fileHeader = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`,
    );
    const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([...parts, fileHeader, fileBuffer, fileFooter]);

    try {
      this.logger.log(`Uploading ${bankId} receipt image to verify.et...`);
      const response = await axios.post(this.verifyUrl, payload, {
        headers: {
          'x-api-key': apiKey,
          'Idempotency-Key': idempotencyKey,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        timeout: 25000,
        validateStatus: () => true,
      });

      const body = response.data;

      if (
        response.status === 403 &&
        body?.error?.code === 'IMAGE_PROCESSING_DISABLED'
      ) {
        return {
          valid: false,
          status: 'error',
          message:
            'Direct screenshot OCR requires Image Processing to be enabled in verify.et developer dashboard. Please enter or paste the receipt link/reference or scan the receipt QR code.',
          bank: bankId,
          raw: body,
        };
      }

      return this.formatVerificationResponse(body, bankId, response.status);
    } catch (error: any) {
      this.logger.error(`Error uploading image to verify.et: ${error?.message || error}`);
      return {
        valid: false,
        status: 'error',
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to verify receipt image.',
        bank: bankId,
        raw: error?.response?.data,
      };
    }
  }

  /**
   * Format a verify.et response into the unified VerifiedReceipt shape.
   */
  private formatVerificationResponse(
    body: any,
    bank: string,
    httpStatus?: number,
  ): VerifiedReceipt {
    if (!body) {
      return {
        valid: false,
        status: 'invalid',
        message: 'Invalid response from verification service.',
        bank,
      };
    }

    // Pick the most likely transaction object from the varied provider envelopes.
    let tx: any = null;
    if (Array.isArray(body.data) && body.data.length > 0) tx = body.data[0];
    else if (body.data && typeof body.data === 'object') tx = body.data;
    else if (body.transaction && typeof body.transaction === 'object') tx = body.transaction;
    else if (body.receipt && typeof body.receipt === 'object') tx = body.receipt;
    else if (body.status || body.verified !== undefined || body.amount !== undefined) tx = body;

    const nested = tx && typeof tx === 'object' ? tx.receipt || tx.bankSpecific || tx.data || {} : {};
    const source = { ...(nested || {}), ...(tx || {}) };
    const bankSpecific = (tx && tx.bankSpecific) || nested.bankSpecific || {};

    const status = String(source.status || body.status || '').toLowerCase();
    const isSuccess =
      source.verified === true ||
      status === 'success' ||
      status === 'valid' ||
      status === 'completed' ||
      (body.success === true && (source.amount !== undefined || source.referenceNumber));

    // Queued / async (202) responses.
    const isQueued =
      !isSuccess &&
      (httpStatus === 202 ||
        status === 'queued' ||
        status === 'pending' ||
        status === 'processing' ||
        (!!body.requestId && !body.data));

    if (isSuccess) {
      const amount = Number(source.amount ?? bankSpecific.amountValue ?? 0);
      return {
        valid: true,
        status: 'valid',
        message:
          body.message ||
          `Valid ${bank.toUpperCase()} Receipt. Transaction verified successfully.`,
        bank,
        amount,
        currency: source.currency || bankSpecific.currency || 'ETB',
        senderName: source.senderName || source.sender || bankSpecific.senderName || '',
        receiverName: source.receiverName || source.receiver || bankSpecific.receiverName || '',
        payerAccount: bankSpecific.payerAccount || source.senderAccount || source.payerAccount || '',
        receiverAccount: bankSpecific.receiverAccount || source.receiverAccount || '',
        reference: source.referenceNumber || source.reference || bankSpecific.reference || '',
        receiptNumber: source.receiptNumber || source.transactionNumber || '',
        receiptUrl: source.receiptUrl || bankSpecific.receiptUrl || '',
        transactionDate:
          source.transactionDateIsoUtc ||
          bankSpecific.transactionDateIsoUtc ||
          source.timestamp ||
          source.transactionDate ||
          bankSpecific.transactionDateRaw ||
          new Date().toISOString(),
        reason: bankSpecific.reason || source.reason || '',
        requestId: body.requestId,
        raw: tx,
      };
    }

    if (isQueued) {
      return {
        valid: false,
        status: 'pending',
        message:
          body.message ||
          'Verification is still processing with the bank. Please try again in a few seconds.',
        bank,
        requestId: body.requestId,
        raw: body,
      };
    }

    const msg =
      body.message ||
      body.error?.message ||
      source.message ||
      (status === 'not_found'
        ? 'Invalid Receipt: No transaction found matching this record.'
        : 'Invalid Receipt: Transaction could not be verified.');

    return {
      valid: false,
      status: 'invalid',
      message: msg,
      bank,
      requestId: body.requestId,
      raw: body,
    };
  }
}
