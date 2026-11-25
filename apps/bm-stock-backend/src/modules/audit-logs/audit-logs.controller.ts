import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuditLogsService, AuditLogQueryDto } from './audit-logs.service';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { CurrentUser, Roles } from '@/common/decorators';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@/common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit logs with pagination and filtering (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get audit log statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Audit stats retrieved successfully' })
  async getStats() {
    return this.auditLogsService.getStats();
  }

  @Get('entity-types')
  @ApiOperation({ summary: 'Get distinct entity types found in audit logs' })
  @ApiResponse({ status: 200, description: 'Entity types retrieved' })
  async getEntityTypes() {
    return this.auditLogsService.getEntityTypes();
  }

  @Get('modules')
  @ApiOperation({ summary: 'Get distinct modules found in audit logs' })
  @ApiResponse({ status: 200, description: 'Modules retrieved' })
  async getModules() {
    return this.auditLogsService.getModules();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users for audit log filtering (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved for audit filter' })
  async getUsers() {
    return this.auditLogsService.getUsers();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get audit logs for a specific user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User audit logs retrieved' })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditLogsService.findByUser(userId, query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export audit logs (Admin only)' })
  @ApiResponse({ status: 200, description: 'Audit logs exported successfully' })
  async export(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.export(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single audit log entry by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Audit log entry retrieved' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditLogsService.findOne(id);
  }
}
