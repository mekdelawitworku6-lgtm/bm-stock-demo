import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SendDeleteOtpDto {
  @ApiPropertyOptional({ description: 'Phone number to send OTP to' })
  @IsOptional()
  @IsString()
  phone?: string;
}
