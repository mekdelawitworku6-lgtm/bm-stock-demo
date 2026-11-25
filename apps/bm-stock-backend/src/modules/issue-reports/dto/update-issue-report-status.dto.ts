import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IssueReportStatus } from '../entities/issue-report.entity';

export class UpdateIssueReportStatusDto {
  @ApiProperty({ enum: IssueReportStatus, example: 'RESOLVED' })
  @IsEnum(IssueReportStatus)
  @IsNotEmpty()
  status: IssueReportStatus;
}
