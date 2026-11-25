import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Period filter (today, yesterday, thisWeek, thisMonth, all)', default: 'today' })
  @IsString()
  @IsOptional()
  period?: string = 'today';

  @ApiPropertyOptional({ description: 'Response format', default: 'json' })
  @IsString()
  @IsOptional()
  format?: string = 'json';

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD) — overrides period' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD) — overrides period' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Company ID filter' })
  @IsString()
  @IsOptional()
  companyId?: string;
}
