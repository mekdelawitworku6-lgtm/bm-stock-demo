import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptService } from './receipt.service';
import { Sales } from '../sales/entities/sales.entity';
import { SaleItem } from '../sales/entities/sales-item.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Settings } from '../settings/entities/settings.entity';
import { CreditAccount, CreditPayment, CreditTransaction } from '../credits/entities/credit.entity';

import { ReceiptController } from './receipt.controller';
import { ReceiptVerificationService } from './receipt-verification.service';

import { UsedReceipt } from '../auth/entities/used-receipt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sales, SaleItem, Customer, Settings,
      CreditAccount, CreditPayment, CreditTransaction,
      UsedReceipt,
    ]),
  ],
  controllers: [ReceiptController],
  providers: [ReceiptService, ReceiptVerificationService],
  exports: [ReceiptService, ReceiptVerificationService],
})
export class ReceiptModule {}
