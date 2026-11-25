import {
  Controller,
  Get,
  Post,
  Put,
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
import { CollectionsService } from './collections.service';
import {
  CreateBranchDto,
  UpdateBranchDto,
  BranchQueryDto,
  BranchResponseDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierQueryDto,
  SupplierResponseDto,
  CreateProductGroupDto,
  UpdateProductGroupDto,
  ProductGroupQueryDto,
  ProductGroupResponseDto,
} from './dto';
import { PaginatedResult } from '@/common/interfaces';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('Collections')
@ApiBearerAuth('access-token')
@Controller('collections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // Branch Management
  @Post('branch')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new branch' })
  @ApiBody({ type: CreateBranchDto })
  @ApiResponse({
    status: 201,
    description: 'Branch created successfully',
    type: BranchResponseDto,
  })
  async createBranch(
    @Body() createBranchDto: CreateBranchDto,
    @CurrentUser() user: User,
  ): Promise<BranchResponseDto> {
    return this.collectionsService.createBranch(createBranchDto, user.companyId);
  }

  @Get('branches')
  @ApiOperation({ summary: 'Get all branches with filtering' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of branches',
    type: [BranchResponseDto],
  })
  async findAllBranches(
    @Query() query: BranchQueryDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedResult<BranchResponseDto>> {
    return this.collectionsService.findAllBranches(query, user.companyId);
  }

  // Supplier Management
  @Post('supplier')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiBody({ type: CreateSupplierDto })
  @ApiResponse({
    status: 201,
    description: 'Supplier created successfully',
    type: SupplierResponseDto,
  })
  async createSupplier(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser() user: User,
  ): Promise<SupplierResponseDto> {
    return this.collectionsService.createSupplier(createSupplierDto, user.companyId);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'Get all suppliers with filtering' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of suppliers',
    type: [SupplierResponseDto],
  })
  async findAllSuppliers(
    @Query() query: SupplierQueryDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedResult<SupplierResponseDto>> {
    return this.collectionsService.findAllSuppliers(query, user.companyId);
  }

  // Product Group Management
  @Post('group')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product group' })
  @ApiBody({ type: CreateProductGroupDto })
  @ApiResponse({
    status: 201,
    description: 'Product group created successfully',
    type: ProductGroupResponseDto,
  })
  async createProductGroup(
    @Body() createProductGroupDto: CreateProductGroupDto,
    @CurrentUser() user: User,
  ): Promise<ProductGroupResponseDto> {
    return this.collectionsService.createProductGroup(createProductGroupDto, user.companyId);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Get all product groups with filtering' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of product groups',
    type: [ProductGroupResponseDto],
  })
  async findAllProductGroups(
    @Query() query: ProductGroupQueryDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedResult<ProductGroupResponseDto>> {
    return this.collectionsService.findAllProductGroups(query, user.companyId);
  }
}
