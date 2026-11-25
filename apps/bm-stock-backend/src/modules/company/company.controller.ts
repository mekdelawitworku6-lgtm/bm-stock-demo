import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CompanyService } from './company.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyQueryDto,
  CompanyResponseDto,
  ApproveLimitAttemptDto,
  AddWarehouseDto,
  AddShopDto,
  RequestLimitUpgradeDto,
} from './dto';
import { PaginatedResult } from '../../common/interfaces';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, Roles, Public } from '../../common/decorators';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums';

@ApiTags('Companies')
@ApiBearerAuth('access-token')
@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Public()
  @Get('lookup')
  @ApiOperation({ summary: 'Public: lookup a company by name (for staff first-time sign-in)' })
  @ApiQuery({ name: 'name', required: true, type: String, description: 'Company name to look up' })
  @ApiResponse({ status: 200, description: 'Company found' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async lookupByName(@Query('name') name: string) {
    return this.companyService.lookupByName(name);
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new company' })
  @ApiBody({ type: CreateCompanyDto })
  @ApiResponse({
    status: 201,
    description: 'Company created successfully',
    type: CompanyResponseDto,
  })
  async create(
    @Body() createCompanyDto: CreateCompanyDto,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.create(createCompanyDto, currentUser);
  }

  @Post(':id/warehouses')
  @ApiOperation({ summary: 'Associate a warehouse with a company' })
  @ApiParam({ name: 'id', description: 'Company ID', type: String })
  @ApiBody({
    type: AddWarehouseDto,
    description: 'List of warehouse IDs to associate with the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse associated',
    type: CompanyResponseDto,
  })
  async addWarehouses(
    @Param('id', ParseUUIDPipe) companyId: string,
    @Body() addWarehousesDto: AddWarehouseDto,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.addWarehouses(companyId, addWarehousesDto.warehouseIds, currentUser);
  }

  @Get(':id/warehouses')
  @ApiOperation({ summary: 'Get warehouses associated with a company' })
  @ApiParam({ name: 'id', description: 'Company ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of warehouses',
    type: [CompanyResponseDto],
  })
  async getWarehouses(
    @Param('id', ParseUUIDPipe) companyId: string,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.getWarehouses(companyId, currentUser);
  }

  @Post(':id/shops')
  @ApiOperation({ summary: 'Associate shops with a company' })
  @ApiParam({ name: 'id', description: 'Company ID', type: String })
  @ApiBody({
    type: AddShopDto,
    description: 'List of shop IDs to associate with the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Shops associated',
    type: CompanyResponseDto,
  })
  async addShops(
    @Param('id', ParseUUIDPipe) companyId: string,
    @Body() addShopsDto: AddShopDto,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.addShops(companyId, addShopsDto.shopIds, currentUser);
  }

  @Get(':id/shops')
  @ApiOperation({ summary: 'Get shops associated with a company' })
  @ApiParam({ name: 'id', description: 'Company ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of shops',
    type: CompanyResponseDto,
  })
  async getShops(
    @Param('id', ParseUUIDPipe) companyId: string,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.getShops(companyId, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Get all companies with filtering' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of companies',
    type: [CompanyResponseDto],
  })
  async findAll(
    @Query() query: CompanyQueryDto,
    @CurrentUser() currentUser: User,
  ): Promise<PaginatedResult<CompanyResponseDto>> {
    return this.companyService.findAll(query, currentUser);
  }

  @Post('request-limit-upgrade')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a company limit upgrade request (multiple companies + payment plan)' })
  @ApiBody({ type: RequestLimitUpgradeDto })
  @ApiResponse({
    status: 201,
    description: 'Request submitted for admin approval',
  })
  async requestLimitUpgrade(
    @Body() dto: RequestLimitUpgradeDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.companyService.requestLimitUpgrade(dto, currentUser);
  }

  @Get('admin/limit-attempts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all attempts by users who tried to add companies beyond their limit (Admin only)' })
  async findLimitAttempts(
    @CurrentUser() currentUser: User,
  ) {
    return this.companyService.findLimitAttempts(currentUser);
  }

  @Patch('admin/limit-attempts/:id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark a company limit attempt as resolved (Admin only)' })
  async resolveLimitAttempt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.companyService.resolveLimitAttempt(id, currentUser);
  }

  @Patch('admin/limit-attempts/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a company limit attempt and raise the user allowance (Admin only)' })
  @ApiBody({ type: ApproveLimitAttemptDto, required: false })
  async approveLimitAttempt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveLimitAttemptDto,
  ) {
    return this.companyService.approveLimitAttempt(id, dto.numCompanies);
  }

  @Patch('admin/limit-attempts/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a company limit attempt (Admin only)' })
  async rejectLimitAttempt(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.companyService.rejectLimitAttempt(id);
  }

  @Get('admin/:id/detail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get full company admin detail (Admin only)' })
  async getAdminDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.getAdminDetail(id, currentUser);
  }

  @Patch('admin/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a company account (Admin only)' })
  async deactivateCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.deactivateCompany(id, currentUser);
  }

  @Patch('admin/:id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reactivate a company account (Admin only)' })
  async reactivateCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.reactivateCompany(id, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company by ID' })
  @ApiResponse({
    status: 200,
    description: 'Company details',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.findOne(id, currentUser);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a company by ID' })
  @ApiBody({ type: UpdateCompanyDto })
  @ApiResponse({
    status: 200,
    description: 'Company updated successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser() currentUser: User,
  ): Promise<CompanyResponseDto> {
    return this.companyService.update(id, updateCompanyDto, currentUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a company by ID' })
  @ApiResponse({ status: 204, description: 'Company deleted successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    return this.companyService.remove(id, currentUser);
  }
}
