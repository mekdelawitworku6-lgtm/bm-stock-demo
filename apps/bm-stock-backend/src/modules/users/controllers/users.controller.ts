import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '@/modules/users/services/users.service';
import { OtpService } from '@/modules/auth/otp.service';
import { CreateUserDto } from '@/modules/users/dto/user/create-user.dto';
import { UpdateUserDto } from '@/modules/users/dto/user/update-user.dto';
import { UpdateMeDto } from '@/modules/users/dto/user/update-me.dto';
import { AdminUpdateUserDto } from '@/modules/users/dto/user/admin-user-update.dto';
import { AdminResetPasswordDto } from '@/modules/users/dto/user/admin-reset-password.dto';
import { AssignUserDto } from '@/modules/users/dto/user/assign-user.dto';
import { SendDeleteOtpDto } from '@/modules/users/dto/user/send-delete-otp.dto';
import { DeleteAccountDto } from '@/modules/users/dto/user/delete-account.dto';
import { CreateSubAdminDto, UpdateSubAdminDto, UpdateSubAdminPermissionsDto } from '@/modules/users/dto/user/create-sub-admin.dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@/common/decorators';
import { User } from '../../users/entities/user.entity';
import { PaginationDto } from '@/common/dto';
import { AdminUsersQueryDto } from '@/modules/users/dto/user/admin-users-query.dto';
import { UserRole, UserStatus } from '@/common/enums';
import * as bcrypt from 'bcrypt';


@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
  ) {}

  // --- USER ENDPOINTS ---

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current logged in user' })
  getMe(@CurrentUser() user: User) {
    return this.usersService.findMe(user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@Body() dto: UpdateMeDto, @CurrentUser() user: User) {
    return this.usersService.update(user.id, dto, user);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete current user account' })
  deleteMe(
    @CurrentUser() user: User,
    @Body() body?: DeleteAccountDto,
    @Query('otp') queryOtp?: string,
    @Query('phone') queryPhone?: string,
  ) {
    const otp = body?.otp || queryOtp;
    const phone = body?.phone || queryPhone;
    return this.usersService.remove(user.id, user, otp, phone);
  }

  @Post('me/send-delete-otp')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send OTP for account deletion to phone' })
  async sendDeleteOtp(@CurrentUser() user: User, @Body() body?: SendDeleteOtpDto) {
    const targetPhone = body?.phone || user.phone;
    if (!targetPhone) {
      throw new BadRequestException('A phone number is required to receive verification OTP.');
    }
    const result = await this.otpService.sendOtp(
      targetPhone,
      `Your BM Stock security code for ACCOUNT DELETION is {CODE}. Please verify to confirm deletion.`,
    );
    const isDevOrFallback = process.env.OTP_DEV_MODE === 'true' || process.env.NODE_ENV === 'development' || !result.smsSent;
    return {
      success: true,
      message: result.smsError ? `OTP code generated (${result.smsError})` : 'OTP sent successfully to your phone',
      phone: targetPhone,
      verificationId: result.verificationId,
      ...(isDevOrFallback ? { code: result.code } : {}),
      ...(result.smsError ? { smsError: result.smsError } : {}),
    };
  }

  // --- ADMIN ENDPOINTS ---

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create a new user with optional auto-assignment (Super Admin and Company Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'User with email already exists' })
  @ApiResponse({ status: 403, description: 'Company Admin can only create users within their company' })
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.create(createUserDto, currentUser);
  }

  @Post('admin/bulk-assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Bulk assign multiple users to company/shop/warehouse' })
  @ApiResponse({ status: 200, description: 'Users assigned successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async bulkAssignUsers(
    @Body() body: { userIds: string[], assignmentData: AssignUserDto },
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.bulkAssignUsers(body.userIds, body.assignmentData, currentUser);
  }

  @Get('admin/activity/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Get user activity log' })
  @ApiResponse({ status: 200, description: 'Activity log retrieved' })
  async getUserActivityLog(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.getUserActivityLog(userId, currentUser);
  }

  @Get('admin/company-stats/:companyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Get comprehensive user statistics by company' })
  @ApiResponse({ status: 200, description: 'Company user statistics retrieved' })
  async getCompanyUserStats(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.getCompanyUserStats(companyId, currentUser);
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user statistics (Admin only)' })
  getUserStats() {
    return this.usersService.getUserStats();
  }

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all pending users (Admin only)' })
  findPending() {
    return this.usersService.findPending();
  }

  @Get('admin/approvals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all approval submissions incl. reviewed (Admin only)' })
  findApprovals() {
    return this.usersService.findApprovals();
  }

  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get per-company usage and subscription reports (Admin only)' })
  getAdminReports() {
    return this.usersService.getAdminReports();
  }

  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a pending user (Admin only)' })
  async approveUser(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.usersService.adminUpdate(id, { status: UserStatus.ACTIVE } as any, admin);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users with pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  findAll(@Query() query: AdminUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  // --- SUB-ADMIN MANAGEMENT ENDPOINTS ---

  @Get('admin/sub-admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all sub-admin users (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Sub-admin users retrieved successfully' })
  async getSubAdmins(@CurrentUser() currentUser: User) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can manage sub-admins');
    }
    const result = await this.usersService.findAll({ role: UserRole.ADMIN, limit: 1000 } as any);
    const users = Array.isArray(result) ? result : (result as any)?.users || (result as any)?.data || [];
    // Filter out super_admin users, only return admin (sub-admin) users
    const subAdmins = users.filter((u: any) => u.role === UserRole.ADMIN && u.id !== currentUser.id);
    return { success: true, data: subAdmins };
  }

  @Post('admin/sub-admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new sub-admin user (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Sub-admin created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async createSubAdmin(
    @Body() dto: CreateSubAdminDto,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can create sub-admins');
    }

    // Check if email already exists
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    // Check if phone already exists (if provided)
    if (dto.phone) {
      const existingPhone = await this.usersService.findByPhone(dto.phone);
      if (existingPhone) {
        throw new BadRequestException('A user with this phone number already exists');
      }
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(dto.password, rounds);

    const subAdmin = await this.usersService.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName || '',
      password: hashedPassword,
      phone: dto.phone || null,
      role: UserRole.ADMIN,
      adminPermissions: dto.adminPermissions || [],
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    } as any);

    // Ensure the created user is active and email verified
    await this.usersService.adminUpdate(subAdmin.id, { status: UserStatus.ACTIVE, isEmailVerified: true } as any, currentUser);

    const { password, ...subAdminWithoutPassword } = subAdmin;
    return {
      success: true,
      message: 'Sub-admin created successfully',
      data: subAdminWithoutPassword,
    };
  }

  @Patch('admin/sub-admins/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a sub-admin user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Sub-admin updated successfully' })
  async updateSubAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubAdminDto,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can update sub-admins');
    }

    const targetUser = await this.usersService.findById(id);
    if (!targetUser || targetUser.role !== UserRole.ADMIN) {
      throw new BadRequestException('Sub-admin user not found');
    }

    const updateData: any = {};
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.email) updateData.email = dto.email;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.adminPermissions !== undefined) updateData.adminPermissions = dto.adminPermissions;

    const updated = await this.usersService.adminUpdate(id, updateData, currentUser);
    return { success: true, message: 'Sub-admin updated successfully', data: updated };
  }

  @Patch('admin/sub-admins/:id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update sub-admin permissions (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Permissions updated successfully' })
  async updateSubAdminPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubAdminPermissionsDto,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can update sub-admin permissions');
    }

    const targetUser = await this.usersService.findById(id);
    if (!targetUser || targetUser.role !== UserRole.ADMIN) {
      throw new BadRequestException('Sub-admin user not found');
    }

    const updated = await this.usersService.adminUpdate(id, { adminPermissions: dto.adminPermissions } as any, currentUser);
    return { success: true, message: 'Permissions updated successfully', data: updated };
  }

  @Patch('admin/sub-admins/:id/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle sub-admin active/inactive status (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Sub-admin status toggled successfully' })
  async toggleSubAdminStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can toggle sub-admin status');
    }

    const targetUser = await this.usersService.findById(id);
    if (!targetUser || targetUser.role !== UserRole.ADMIN) {
      throw new BadRequestException('Sub-admin user not found');
    }

    const newStatus = targetUser.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    const updated = await this.usersService.adminUpdate(id, { status: newStatus } as any, currentUser);
    return { success: true, message: `Sub-admin ${newStatus === UserStatus.ACTIVE ? 'activated' : 'deactivated'} successfully`, data: updated };
  }

  @Post('admin/sub-admins/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reset sub-admin password (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetSubAdminPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can reset sub-admin passwords');
    }

    const targetUser = await this.usersService.findById(id);
    if (!targetUser || targetUser.role !== UserRole.ADMIN) {
      throw new BadRequestException('Sub-admin user not found');
    }

    return this.usersService.adminResetPassword(id, dto.newPassword, currentUser);
  }

  @Delete('admin/sub-admins/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a sub-admin user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Sub-admin deleted successfully' })
  async deleteSubAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can delete sub-admins');
    }

    const targetUser = await this.usersService.findById(id);
    if (!targetUser || targetUser.role !== UserRole.ADMIN) {
      throw new BadRequestException('Sub-admin user not found');
    }

    if (targetUser.id === currentUser.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.usersService.remove(id, currentUser);
    return { success: true, message: 'Sub-admin deleted successfully' };
  }

  // --- PARAMETRIC ADMIN USER ENDPOINTS ---

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin update user (Admin only)' })
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() admin: User,
  ) {
    return this.usersService.adminUpdate(id, dto, admin);
  }

  @Patch('admin/:id/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle user active/inactive status (Admin only)' })
  toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: User,
  ) {
    return this.usersService.toggleUserStatus(id, admin);
  }

  @Post('admin/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin reset user password (Admin only)' })
  adminResetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() admin: User,
  ) {
    return this.usersService.adminResetPassword(id, dto.newPassword, admin);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: User) {
    return this.usersService.remove(id, admin);
  }

  @Post('admin/:id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Assign user to company/shop/warehouse' })
  @ApiResponse({ status: 200, description: 'User assigned successfully' })
  async assignUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignDto: AssignUserDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.assignUser(id, assignDto, currentUser);
  }

  @Get('company/:companyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Get users in a company' })
  @ApiResponse({ status: 200, description: 'Company users retrieved successfully' })
  async getCompanyUsers(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.getCompanyUsers(companyId, currentUser);
  }

  @Get('shop/:shopId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get users in a shop' })
  @ApiResponse({ status: 200, description: 'Shop users retrieved successfully' })
  async getShopUsers(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.getShopUsers(shopId, currentUser);
  }

  @Get('warehouse/:warehouseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get users in a warehouse' })
  @ApiResponse({ status: 200, description: 'Warehouse users retrieved successfully' })
  async getWarehouseUsers(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.getWarehouseUsers(warehouseId, currentUser);
  }
}