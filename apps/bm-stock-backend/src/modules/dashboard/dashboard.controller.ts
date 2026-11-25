import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardSummaryResponseDto } from './dto/dashboard-response.dto';
import { JwtAuthGuard } from '@/common/guards';
import { CurrentUser } from '@/common/decorators';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('reports/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary' })
  @ApiQuery({ name: 'period', required: false, type: String })
  @ApiQuery({ name: 'format', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Dashboard summary retrieved successfully', type: DashboardSummaryResponseDto })
  async getSummary(
    @Query() query: DashboardQueryDto,
    @CurrentUser() currentUser: any,
  ): Promise<DashboardSummaryResponseDto> {
    return this.dashboardService.getSummary(query, currentUser);
  }
}
