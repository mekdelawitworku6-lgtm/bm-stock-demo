import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto';
import { UserRole } from '@/common/enums';

export class AdminUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserRole, description: 'Filter users by role' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
