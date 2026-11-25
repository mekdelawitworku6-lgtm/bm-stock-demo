import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckPhoneDto {
  @ApiProperty({ example: '+251911234567', description: 'Phone number to check' })
  @IsString()
  @MinLength(9)
  phone: string;
}
