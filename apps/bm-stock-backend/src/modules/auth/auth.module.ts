import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { CompanyModule } from '../company/company.module';
import { PlansModule } from '../plans/plans.module';
import { ReceiptModule } from '../receipt/receipt.module';
import { Company } from '../company/entities/company.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { User } from '../users/entities/user.entity';
import { Employee } from '../users/entities/employee.entity';
import { UsedReceipt } from './entities/used-receipt.entity';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UsersModule,
    CompanyModule,
    PlansModule,
    ReceiptModule,
    PassportModule,
    TypeOrmModule.forFeature([Company, Warehouse, Employee, User, UsedReceipt]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: { expiresIn: configService.get<string>('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}