import { Entity, Column, Index, BeforeInsert, BeforeUpdate, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { BaseEntity } from '../../../database/entities/base.entity';
import { UserRole, UserStatus } from '../../../common/enums';
import { Employee } from './employee.entity';
import { Shop } from '../../shops/entities/shops.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Company } from '../../company/entities/company.entity';

@Entity('users')
@Index(['email'], { unique: true, where: '"email" IS NOT NULL' })
@Index(['phone'], { unique: true, where: '"phone" IS NOT NULL' })
export class User extends BaseEntity {
  @ApiPropertyOptional({ description: 'User email address', example: 'user@example.com' })
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email?: string | null;

  @ApiProperty({ description: 'User first name', example: 'John' })
  @Column({ length: 100 })
  firstName: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  @Column({ length: 100 })
  lastName: string;

  @Exclude()
  @Column()
  password: string;

  @ApiProperty({ description: 'User role', enum: UserRole, example: UserRole.USER })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @ApiProperty({ description: 'User status', enum: UserStatus, example: UserStatus.ACTIVE })
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @ApiPropertyOptional({ description: 'User phone number', example: '+251911234567' })
  @Column({ nullable: true, length: 20, unique: true })
  phone?: string;

  @ApiPropertyOptional({ description: 'User avatar URL', example: 'https://example.com/avatar.jpg' })
  @Column({ nullable: true, length: 500 })
  avatar?: string;

  @ApiPropertyOptional({ description: 'Email verification timestamp', example: '2023-01-01T00:00:00.000Z' })
  @Column({ nullable: true, type: 'timestamp with time zone' })
  emailVerifiedAt?: Date;

  @ApiPropertyOptional({ description: 'User email verification status', example: true })
  @Column({ default: false })
  isEmailVerified: boolean;

  @ApiPropertyOptional({ description: 'Last login timestamp', example: '2023-01-01T00:00:00.000Z' })
  @Column({ nullable: true, type: 'timestamp with time zone' })
  lastLoginAt?: Date;

  @Exclude()
  @Column({ nullable: true })
  refreshToken?: string;

  @OneToMany(() => Employee, employee => employee.user)
  employees: Employee[];

  @OneToMany(() => Shop, shop => shop.owner)
  shops: Shop[];

  @OneToMany(() => Warehouse, warehouse => warehouse.manager)
  warehouses: Warehouse[];

  @ApiPropertyOptional({ description: 'Associated company ID' })
  @Column({ nullable: true })
  companyId?: string;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'companyId' })
  company?: Company;

  @ApiPropertyOptional({ description: 'Associated shop ID' })
  @Column({ nullable: true })
  shopId?: string;

  @ManyToOne(() => Shop, { nullable: true })
  @JoinColumn({ name: 'shopId' })
  shop?: Shop;

  @ApiPropertyOptional({ description: 'Associated warehouse ID' })
  @Column({ nullable: true })
  warehouseId?: string;

  @ManyToOne(() => Warehouse, { nullable: true })
  @JoinColumn({ name: 'warehouseId' })
  warehouse?: Warehouse;

  @ApiPropertyOptional({ description: 'Subscription plan ID purchased by the user' })
  @Column({ nullable: true })
  planId?: string;

  @ApiPropertyOptional({ description: 'Subscription plan title purchased by the user', example: 'For 1 Month' })
  @Column({ length: 100, nullable: true })
  planTitle?: string;

  @ApiPropertyOptional({ description: 'Subscription amount paid by the user', example: 399 })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  planAmount?: number;

  @ApiPropertyOptional({ description: 'Subscription period identifier', example: '1_month' })
  @Column({ length: 50, nullable: true })
  planPeriod?: string;

  @ApiPropertyOptional({ description: 'Subscription expiry timestamp' })
  @Column({ nullable: true, type: 'timestamp with time zone' })
  subscriptionExpiresAt?: Date;

  @ApiPropertyOptional({ description: 'Subscription start date' })
  @Column({ nullable: true, type: 'timestamp with time zone' })
  subscriptionStartDate?: Date;

  @ApiPropertyOptional({ description: 'Last subscription payment date' })
  @Column({ nullable: true, type: 'timestamp with time zone' })
  subscriptionPaymentDate?: Date;

  @ApiPropertyOptional({ description: 'Next subscription payment due date' })
  @Column({ nullable: true, type: 'timestamp with time zone' })
  subscriptionNextPaymentDate?: Date;

  @ApiPropertyOptional({ description: 'When the 7-day renewal reminder SMS was last sent' })
  @Column({ nullable: true, type: 'timestamp with time zone' })
  lastSubscriptionReminderAt?: Date;

  @ApiPropertyOptional({ description: 'Number of companies the user plans to add', example: 3 })
  @Column({ type: 'int', nullable: true })
  numCompanies?: number;

  @ApiPropertyOptional({ description: 'Subscription payment method used (e.g. Telebirr, CBE)', example: 'Telebirr' })
  @Column({ length: 50, nullable: true })
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Subscription payment status', example: 'PENDING' })
  @Column({ length: 50, nullable: true })
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Subscription payment reference number', example: 'GS171234567890' })
  @Column({ length: 100, nullable: true })
  paymentRef?: string;

  @ApiPropertyOptional({ description: 'URL of the uploaded payment screenshot / proof', example: '/uploads/payment-proofs/abc.png' })
  @Column({ nullable: true })
  paymentScreenshot?: string;

  @ApiPropertyOptional({ description: 'Fayda Digital ID (FIN)', example: '123456789012' })
  @Column({ length: 20, nullable: true })
  faydaId?: string;

  @ApiPropertyOptional({ description: 'Tax Identification Number (TIN)', example: '1234567890' })
  @Column({ length: 20, nullable: true })
  tin?: string;

  @Exclude()
  @ApiPropertyOptional({ description: 'Hashed 4-digit PIN for quick unlock' })
  @Column({ nullable: true, length: 255 })
  pin?: string;

  @ApiPropertyOptional({ description: 'Admin portal permissions for sub-admin users', example: ['dashboard', 'users', 'companies'] })
  @Column({ type: 'jsonb', nullable: true, default: null })
  adminPermissions?: string[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !/^\$2[aby]\$\d{2}\$/.test(this.password)) {
      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12') || 12;
      this.password = await bcrypt.hash(this.password, rounds);
    }
  }

  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  @BeforeInsert()
  @BeforeUpdate()
  emailToLowerCase() {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
  }
}