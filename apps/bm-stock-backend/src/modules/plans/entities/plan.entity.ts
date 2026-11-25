import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../database/entities/base.entity';

@Entity('plans')
export class Plan extends BaseEntity {
  @ApiProperty({ description: 'Plan title', example: 'For 1 Month' })
  @Column({ length: 100 })
  title: string;

  @ApiProperty({ description: 'Formatted price label', example: '399' })
  @Column({ length: 20 })
  price: string;

  @ApiProperty({ description: 'Numeric amount in ETB', example: 399 })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @ApiProperty({ description: 'Plan period identifier', example: '1_month' })
  @Column({ length: 50, default: '' })
  period: string;

  @ApiProperty({ description: 'Plan features list', example: ['Unlimited products', '24/7 support'] })
  @Column({ type: 'json' })
  features: string[];

  @ApiProperty({ description: 'Extra hidden benefits count', example: 3 })
  @Column({ type: 'int', default: 0 })
  moreCount: number;

  @ApiProperty({ description: 'Display order', example: 1 })
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @ApiProperty({ description: 'Whether the plan is visible in the app', example: true })
  @Column({ default: true })
  isActive: boolean;
}
