import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  IMPORT = 'import',
  APPROVE = 'approve',
  REJECT = 'reject',
  ASSIGN = 'assign',
  STATUS_CHANGE = 'status_change',
  PASSWORD_RESET = 'password_reset',
  SETTINGS_CHANGE = 'settings_change',
}

@Entity('admin_audit_logs')
@Index(['userId'])
@Index(['entityType'])
@Index(['action'])
@Index(['timestamp'])
export class AdminAuditLog extends BaseEntity {
  @Column({ length: 100 })
  entityType: string; // e.g., 'User', 'Company', 'Product', 'Sale', 'Settings'

  @Column({ length: 255, nullable: true })
  entityId?: string;

  @Column({ length: 255, nullable: true })
  entityName?: string; // Human-readable name of the affected entity

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'json', nullable: true })
  oldValues?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  newValues?: Record<string, any>;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ length: 45, nullable: true })
  ipAddress?: string;

  @Column({ length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ length: 255, nullable: true })
  userName?: string; // Denormalized for fast display without joins

  @Column({ length: 255, nullable: true })
  userEmail?: string; // Denormalized

  @Column({ length: 100, nullable: true })
  userRole?: string; // Denormalized

  @Column({ length: 100, nullable: true })
  module?: string; // Which module/section this action belongs to (e.g., 'users', 'sales', 'inventory')

  @Column({ length: 100, nullable: true })
  method?: string; // HTTP method (GET, POST, PATCH, DELETE)

  @Column({ length: 500, nullable: true })
  endpoint?: string; // The API endpoint that was called
}
