import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IssueReportsService } from './issue-reports.service';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { UpdateIssueReportStatusDto } from './dto/update-issue-report-status.dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { ResponseDto } from '@/common/dto';
import { IssueReport } from './entities/issue-report.entity';

@ApiTags('Issue Reports')
@Controller('issue-reports')
export class IssueReportsController {
  constructor(private readonly issueReportsService: IssueReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit an issue report (Flutter or Web)' })
  @ApiResponse({ status: 201, description: 'Report submitted successfully' })
  async create(
    @Body() dto: CreateIssueReportDto,
    @CurrentUser() user: any,
  ): Promise<ResponseDto<IssueReport>> {
    const report = await this.issueReportsService.create(dto, user);
    return {
      success: true,
      message: 'Issue report submitted successfully. Thank you for your feedback!',
      data: report,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all issue reports (Admin only)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'appType', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Issue reports retrieved successfully' })
  async findAll(
    @Query('status') status?: string,
    @Query('appType') appType?: string,
  ): Promise<ResponseDto<IssueReport[]>> {
    const reports = await this.issueReportsService.findAll(status, appType);
    return {
      success: true,
      message: 'Issue reports retrieved successfully',
      data: reports,
    };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update issue report status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Issue report status updated successfully' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIssueReportStatusDto,
  ): Promise<ResponseDto<IssueReport>> {
    const updated = await this.issueReportsService.updateStatus(id, dto);
    return {
      success: true,
      message: 'Issue report status updated successfully',
      data: updated,
    };
  }
}
