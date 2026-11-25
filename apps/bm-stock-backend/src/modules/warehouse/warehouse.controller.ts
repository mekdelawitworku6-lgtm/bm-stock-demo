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
} from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { User } from '../users/entities/user.entity';
import { WarehouseService } from './warehouse.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseQueryDto,
  WarehouseResponseDto,
  WarehouseDetailResponseDto,
  AttachProductDto,
} from './dto';
import { PaginatedResult } from '@/common/interfaces';

@ApiTags('Warehouses')
@ApiBearerAuth('access-token')
@Controller('warehouses')
@UseGuards(JwtAuthGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new warehouse' })
  @ApiBody({ type: CreateWarehouseDto })
  @ApiResponse({
    status: 201,
    description: 'Warehouse created successfully',
    type: WarehouseResponseDto,
  })
  async create(
    @Body() createWarehouseDto: CreateWarehouseDto,
    @CurrentUser() currentUser: User,
  ): Promise<WarehouseResponseDto> {
    return this.warehouseService.create(createWarehouseDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Get all warehouses with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of warehouses',
    type: [WarehouseResponseDto],
  })
  async findAll(
    @Query() query: WarehouseQueryDto,
    @CurrentUser() currentUser: User,
  ): Promise<PaginatedResult<WarehouseResponseDto>> {
    return this.warehouseService.findAll(query, currentUser);
  }

  @Get('with-products')
  @ApiOperation({
    summary: 'Get all warehouses with product details and pagination',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of warehouses with products',
    type: [WarehouseDetailResponseDto],
  })
  async findAllWithProducts(
    @Query() query: WarehouseQueryDto,
    @CurrentUser() currentUser: User,
  ): Promise<PaginatedResult<WarehouseDetailResponseDto>> {
    return this.warehouseService.findAllWithProducts(query, currentUser);
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Get warehouse dashboard stats' })
  async getDashboard(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.warehouseService.getWarehouseDashboard(id, currentUser);
  }

  @Get(':id/with-products')
  @ApiOperation({ summary: 'Get warehouse products with stock levels' })
  async findOneWithProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.warehouseService.findOneWithProducts(id, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a warehouse by ID with attached products' })
  @ApiResponse({
    status: 200,
    description: 'Warehouse details',
    type: WarehouseDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<WarehouseDetailResponseDto> {
    return this.warehouseService.findOne(id, currentUser);
  }

  @Get(':id/products/:productId')
  @ApiOperation({ summary: 'Get a specific product of a warehouse by ID' })
  @ApiResponse({
    status: 200,
    description: 'Product details for this warehouse',
    type: WarehouseDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Warehouse or product not found' })
  async getProductOfWarehouse(
    @Param('id', ParseUUIDPipe) warehouseId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.warehouseService.findProductOfWarehouse(warehouseId, productId, currentUser);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a warehouse by ID' })
  @ApiBody({ type: UpdateWarehouseDto })
  @ApiResponse({
    status: 200,
    description: 'Warehouse updated successfully',
    type: WarehouseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
    @CurrentUser() currentUser: User,
  ): Promise<WarehouseResponseDto> {
    return this.warehouseService.update(id, updateWarehouseDto, currentUser);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a warehouse by ID' })
  @ApiResponse({ status: 204, description: 'Warehouse deleted successfully' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: User): Promise<void> {
    return this.warehouseService.remove(id, currentUser);
  }

  @Post(':id/products')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE_EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Attach a product to a warehouse' })
  @ApiBody({ type: AttachProductDto })
  @ApiResponse({ status: 201, description: 'Product attached to warehouse' })
  @ApiResponse({ status: 404, description: 'Warehouse or product not found' })
  @ApiResponse({ status: 409, description: 'Product already attached' })
  async attachProduct(
    @Param('id', ParseUUIDPipe) warehouseId: string,
    @Body() attachProductDto: AttachProductDto,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    return this.warehouseService.attachProduct(warehouseId, attachProductDto, currentUser);
  }

  @Delete(':id/products/:productId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach a product from a warehouse' })
  @ApiResponse({ status: 204, description: 'Product detached from warehouse' })
  @ApiResponse({ status: 404, description: 'Warehouse or product not found' })
  async detachProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    return this.warehouseService.detachProduct(id, productId, currentUser);
  }
}
