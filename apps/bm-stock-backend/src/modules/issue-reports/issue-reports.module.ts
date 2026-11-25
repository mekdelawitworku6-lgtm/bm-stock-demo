import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssueReport } from './entities/issue-report.entity';
import { IssueReportsService } from './issue-reports.service';
import { IssueReportsController } from './issue-reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IssueReport])],
  controllers: [IssueReportsController],
  providers: [IssueReportsService],
  exports: [IssueReportsService],
})
export class IssueReportsModule {}
