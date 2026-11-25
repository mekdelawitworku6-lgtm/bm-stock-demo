import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveLimitAttemptDto {
  @ApiPropertyOptional({
    description: 'New company allowance for the user. Defaults to their current allowance + 1.',
    example: 3,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  numCompanies?: number;
}
