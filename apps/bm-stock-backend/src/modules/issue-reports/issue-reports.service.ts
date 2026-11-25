import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssueReport, IssueReportStatus } from './entities/issue-report.entity';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { UpdateIssueReportStatusDto } from './dto/update-issue-report-status.dto';

@Injectable()
export class IssueReportsService {
  constructor(
    @InjectRepository(IssueReport)
    private readonly issueReportRepository: Repository<IssueReport>,
  ) {}

  async create(dto: CreateIssueReportDto, user?: any): Promise<IssueReport> {
    const report = this.issueReportRepository.create({
      title: dto.title,
      description: dto.description,
      category: dto.category || 'General',
      appType: dto.appType,
      userPhone: dto.userPhone || user?.phone || user?.phoneNumber,
      userEmail: dto.userEmail || user?.email,
      userName: dto.userName || (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined),
      companyName: dto.companyName || user?.company?.name || user?.companyName,
      status: IssueReportStatus.OPEN,
    });
    return this.issueReportRepository.save(report);
  }

  async findAll(status?: string, appType?: string): Promise<IssueReport[]> {
    const query = this.issueReportRepository.createQueryBuilder('report');

    if (status && status !== 'ALL') {
      query.andWhere('report.status = :status', { status });
    }

    if (appType && appType !== 'ALL') {
      query.andWhere('report.appType = :appType', { appType });
    }

    query.orderBy('report.createdAt', 'DESC');

    return query.getMany();
  }

  async findOne(id: string): Promise<IssueReport> {
    const report = await this.issueReportRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException(`Issue report with ID "${id}" not found`);
    }
    return report;
  }

  async updateStatus(id: string, dto: UpdateIssueReportStatusDto): Promise<IssueReport> {
    const report = await this.findOne(id);
    report.status = dto.status;
    return this.issueReportRepository.save(report);
  }
}
