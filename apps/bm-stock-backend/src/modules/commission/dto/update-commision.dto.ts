import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateCommissionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionAmount?: number;
}