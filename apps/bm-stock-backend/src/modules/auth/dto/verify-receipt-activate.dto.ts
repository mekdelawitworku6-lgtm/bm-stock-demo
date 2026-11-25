import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyReceiptActivateDto {
  @ApiProperty({ example: '0911223344', description: 'Registered account phone number' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'cbe', description: 'Bank / wallet ID (e.g. cbe, telebirr, boa, awash)' })
  @IsOptional()
  @IsString()
  bank?: string;

  @ApiPropertyOptional({ example: 'https://mbreciept.cbe.com.et/ABC123', description: 'Receipt URL or modern CBE link' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional({ example: 'https://mbreciept.cbe.com.et/ABC123', description: 'Alias of receiptUrl' })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({ example: 'FT2412345678', description: 'Receipt transaction reference number' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'data:image/png;base64,...', description: 'Optional Base64 encoded screenshot image' })
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @ApiPropertyOptional({ example: '537', description: 'Account suffix (for CBE old references or BOA)' })
  @IsOptional()
  @IsString()
  suffix?: string;
}
