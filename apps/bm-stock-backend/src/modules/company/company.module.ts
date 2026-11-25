import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { AccountAccessService } from './account-access.service';
import { Company } from './entities/company.entity';
import { CompanyLimitAttempt } from './entities/company-limit-attempt.entity';
import { User } from '../users/entities/user.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyLimitAttempt, User, Warehouse, Shop]),
    NotificationsModule,
    PlansModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService, AccountAccessService],
  exports: [CompanyService, AccountAccessService]
})

export class CompanyModule {}
