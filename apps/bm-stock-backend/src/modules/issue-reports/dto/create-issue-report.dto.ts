import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueReportAppType } from '../entities/issue-report.entity';

export class CreateIssueReportDto {
  @ApiProperty({ example: 'Cannot export CSV report' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'When clicking export on sales screen, app freezes' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'Bug Report' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ enum: IssueReportAppType, example: 'flutter' })
  @IsEnum(IssueReportAppType)
  @IsOptional()
  appType?: IssueReportAppType;

  @ApiPropertyOptional({ example: '+251911223344' })
  @IsString()
  @IsOptional()
  userPhone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsString()
  @IsOptional()
  userEmail?: string;

  @ApiPropertyOptional({ example: 'Abebe Bikila' })
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiPropertyOptional({ example: 'Gelagle Traders' })
  @IsString()
  @IsOptional()
  companyName?: string;
}
