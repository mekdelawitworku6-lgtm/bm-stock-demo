import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsInterceptor } from './audit-logs.interceptor';
import { AdminAuditLog } from './entities/audit-log.entity';

@Global() // Make AuditLogsService available globally so the interceptor can use it
@Module({
  imports: [
    TypeOrmModule.forFeature([AdminAuditLog]),
  ],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogsInterceptor],
  exports: [AuditLogsService, AuditLogsInterceptor],
})
export class AuditLogsModule {}

