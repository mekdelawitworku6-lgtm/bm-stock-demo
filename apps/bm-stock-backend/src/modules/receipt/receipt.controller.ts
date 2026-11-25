import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UseGuards,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards';
import { Public } from '@/common/decorators';
import { ReceiptVerificationService, VerifiedReceipt } from './receipt-verification.service';
import { SUPPORTED_BANKS, getBankInfo, ReceiptBankInfo } from './receipt-banks';

import { IsOptional, IsString } from 'class-validator';

export class VerifyReceiptDto {
  @IsOptional()
  @IsString()
  bank?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @IsOptional()
  @IsString()
  transactionNumber?: string;

  @IsOptional()
  @IsString()
  suffix?: string;

  @IsOptional()
  @IsString()
  accountSuffix?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  imageBase64?: string;
}

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsedReceipt } from '../auth/entities/used-receipt.entity';

@ApiTags('Receipts')
@ApiBearerAuth('access-token')
@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptController {
  constructor(
    private readonly receiptVerificationService: ReceiptVerificationService,
    @InjectRepository(UsedReceipt)
    private readonly usedReceiptRepository: Repository<UsedReceipt>,
  ) {}

  @Public()
  @Get('banks')
  @ApiOperation({ summary: 'List banks & wallets supported for receipt verification' })
  listBanks(): { success: boolean; data: ReceiptBankInfo[] } {
    return { success: true, data: SUPPORTED_BANKS };
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a bank or wallet receipt (CBE, Telebirr, Dashen, BOA, CBEBirr, Awash, M-Pesa, Siinqee, Kaafi Ebirr, Coopay Ebirr, Zemen)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('image'))
  async verifyReceipt(
    @Body() dto: VerifyReceiptDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<VerifiedReceipt> {
    return this.handleVerification(dto, file);
  }

  @Public()
  @Post('verify-cbe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a Commercial Bank of Ethiopia (CBE) receipt (alias of /verify)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('image'))
  async verifyCbe(
    @Body() dto: VerifyReceiptDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<VerifiedReceipt> {
    return this.handleVerification({ ...dto, bank: 'cbe' }, file);
  }

  private extractCandidateKeys(inputs: (string | undefined | null)[]): string[] {
    const keys = new Set<string>();
    for (const input of inputs) {
      if (!input || typeof input !== 'string') continue;
      const trimmed = input.trim();
      if (!trimmed) continue;
      keys.add(trimmed);
      const cbeMatch = trimmed.match(/mbreciept\.cbe\.com\.et\/([A-Za-z0-9_-]+)/i);
      if (cbeMatch && cbeMatch[1]) {
        keys.add(cbeMatch[1]);
      }
      const lastPart = trimmed.split('/').filter(Boolean).pop();
      if (lastPart && lastPart.length >= 6) {
        keys.add(lastPart);
      }
    }
    return Array.from(keys);
  }

  private async checkReceiptAlreadyUsed(candidates: string[]): Promise<boolean> {
    if (!candidates || candidates.length === 0) return false;
    for (const key of candidates) {
      const found = await this.usedReceiptRepository.findOne({
        where: [
          { reference: key },
          { receiptUrl: key },
        ],
      });
      if (found) return true;
    }
    return false;
  }

  private async handleVerification(
    dto: VerifyReceiptDto,
    file?: Express.Multer.File,
  ): Promise<VerifiedReceipt> {
    const bank = getBankInfo(dto.bank || 'cbe').id;
    const reference =
      dto.link ||
      dto.reference ||
      dto.referenceNumber ||
      dto.receiptNumber ||
      dto.transactionNumber;
    const suffix = dto.suffix || dto.accountSuffix;
    const phoneNumber = dto.phoneNumber || dto.phone;

    // Check before external call if reference or link is already marked as used
    const initialCandidates = this.extractCandidateKeys([
      reference,
      dto.link,
      dto.receiptUrl,
      dto.referenceNumber,
      dto.receiptNumber,
      dto.transactionNumber,
    ]);
    if (await this.checkReceiptAlreadyUsed(initialCandidates)) {
      return {
        valid: false,
        status: 'already_used',
        alreadyUsed: true,
        message: 'This receipt has already been used and cannot be reused.',
        bank,
        reference,
      };
    }

    let result: VerifiedReceipt;

    // 1. File upload -> image verification
    if (file && file.buffer) {
      result = await this.receiptVerificationService.verifyByImage(
        file.buffer,
        file.originalname || 'receipt.png',
        file.mimetype || 'image/png',
        bank,
        reference,
      );
    } else if (dto.imageBase64) {
      // 2. Base64 image
      try {
        const matches = dto.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const base64Data = matches ? matches[2] : dto.imageBase64;
        const mimeType = matches ? matches[1] : 'image/png';
        const buffer = Buffer.from(base64Data, 'base64');
        result = await this.receiptVerificationService.verifyByImage(
          buffer,
          'receipt.png',
          mimeType,
          bank,
          reference,
        );
      } catch (err: any) {
        throw new BadRequestException('Invalid base64 image format.');
      }
    } else if (reference || dto.receiptUrl) {
      // 3. Reference / link / token
      result = await this.receiptVerificationService.verify({
        bank,
        reference,
        suffix,
        phoneNumber,
        receiptUrl: dto.receiptUrl,
      });
    } else {
      return {
        valid: false,
        status: 'invalid',
        message: `Please provide a ${getBankInfo(bank).shortName} receipt link, reference number, or screenshot image.`,
        bank,
      };
    }

    // Check after verification if resolved reference or receiptUrl was already used
    if (result && (result.valid || result.reference || result.receiptUrl)) {
      const verifiedCandidates = this.extractCandidateKeys([
        result.reference,
        result.receiptUrl,
        result.receiptNumber,
        reference,
      ]);
      if (await this.checkReceiptAlreadyUsed(verifiedCandidates)) {
        return {
          valid: false,
          status: 'already_used',
          alreadyUsed: true,
          message: 'This receipt has already been used and cannot be reused.',
          bank: result.bank || bank,
          reference: result.reference || reference,
        };
      }
    }

    return result;
  }
}
