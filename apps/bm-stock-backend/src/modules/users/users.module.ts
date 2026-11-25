import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './services/users.service';
import { UserPurgeService } from './services/user-purge.service';
import { UsersController } from './controllers/users.controller';
import { User } from './entities/user.entity';
import { EmployeeService } from './services/employee.service';
import { Shop } from '../shops/entities/shops.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Company } from '../company/entities/company.entity';
import { Employee } from './entities/employee.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { EmployeeController } from './controllers/employee.controller';
import { Product } from '../products/entities/product.entity';
import { Sales } from '../sales/entities/sales.entity';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

import { SmsModule } from '@/shared/sms/sms.module';
import { OtpService } from '../auth/otp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Employee, Shop, Warehouse, Company, Product, Sales]),
    NotificationsModule,
    SmsModule,
  ],
  controllers: [UsersController, EmployeeController],
  providers: [UsersService, UserPurgeService, EmployeeService, CacheService, OtpService],
  exports: [UsersService, UserPurgeService, EmployeeService, TypeOrmModule],
})
export class UsersModule {}