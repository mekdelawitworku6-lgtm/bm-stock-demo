import { IsString, IsOptional, IsNumber, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeQueryDto {
  @ApiPropertyOptional({ description: 'Search term' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({description: 'page', default: 1})
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({description: "limit", default: 10})
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Company ID filter' })
  @IsString()
  @IsOptional()
  companyId?: string;
}