import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum IssueReportStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum IssueReportAppType {
  FLUTTER = 'flutter',
  WEB = 'web',
}

@Entity('issue_reports')
export class IssueReport extends BaseEntity {
  @ApiProperty({ example: 'Cannot export CSV report' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ example: 'When clicking export on sales screen, app freezes' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ example: 'Bug Report' })
  @Column({ type: 'varchar', length: 100, default: 'General' })
  category: string;

  @ApiProperty({ enum: IssueReportAppType, example: 'flutter' })
  @Column({
    type: 'enum',
    enum: IssueReportAppType,
    default: IssueReportAppType.WEB,
  })
  appType: IssueReportAppType;

  @ApiProperty({ enum: IssueReportStatus, example: 'OPEN' })
  @Column({
    type: 'enum',
    enum: IssueReportStatus,
    default: IssueReportStatus.OPEN,
  })
  status: IssueReportStatus;

  @ApiProperty({ example: '+251911223344', nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  userPhone?: string;

  @ApiProperty({ example: 'user@example.com', nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail?: string;

  @ApiProperty({ example: 'Abebe Bikila', nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  userName?: string;

  @ApiProperty({ example: 'Gelagle Traders', nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName?: string;
}
