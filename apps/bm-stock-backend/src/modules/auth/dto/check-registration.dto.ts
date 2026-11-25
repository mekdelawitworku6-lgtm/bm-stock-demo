import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckRegistrationDto {
  @ApiProperty({ example: '+251911234567', description: 'Phone number to check' })
  @IsString()
  @MinLength(9)
  phone: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'Email address to check (optional)', required: false })
  @IsOptional()
  @IsString()
  email?: string;
}
