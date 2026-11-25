import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: '+251954068503 or admin@example.com', description: 'Phone number or email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+251954068503', description: 'Phone number (alternative to email field)' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'SuperAdmin2026!' })
  @IsNotEmpty()
  @IsString()
  password: string;
}