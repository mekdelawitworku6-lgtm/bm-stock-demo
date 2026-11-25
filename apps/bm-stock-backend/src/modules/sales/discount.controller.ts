import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { DiscountService } from './discount.service';
import { CreateDiscountDto, UpdateDiscountDto, DiscountResponseDto } from './dto/discount.dto';
import { PaginatedResult } from '@/common/interfaces';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { CurrentUser, Roles } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('Discounts')
@ApiBearerAuth('access-token')
@Controller('discounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  private companyIdOf(user?: User): string | undefined {
    return (user as any)?.companyId || user?.company?.id;
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new discount' })
  @ApiBody({ type: CreateDiscountDto })
  @ApiResponse({ status: 201, description: 'Discount created', type: DiscountResponseDto })
  async create(
    @Body() dto: CreateDiscountDto,
    @CurrentUser() user: User,
  ): Promise<DiscountResponseDto> {
    return this.discountService.create(dto, this.companyIdOf(user));
  }

  @Get()
  @ApiOperation({ summary: 'List all discounts' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of discounts' })
  async findAll(
    @Query() query: { search?: string; isActive?: string; page?: number; limit?: number },
    @CurrentUser() user: User,
  ): Promise<PaginatedResult<DiscountResponseDto>> {
    return this.discountService.findAll(query, this.companyIdOf(user));
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validate a discount code for an order amount' })
  @ApiQuery({ name: 'code', type: String })
  @ApiQuery({ name: 'orderAmount', type: Number })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Discount validation result' })
  async validate(
    @Query('code') code: string,
    @Query('orderAmount') orderAmount: number,
    @CurrentUser() user: User,
    @Query('customerId') customerId?: string,
  ) {
    return this.discountService.validate(code, orderAmount, customerId, this.companyIdOf(user));
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get a discount by code' })
  @ApiResponse({ status: 200, description: 'Discount details', type: DiscountResponseDto })
  async findByCode(
    @Param('code') code: string,
    @CurrentUser() user: User,
  ): Promise<DiscountResponseDto> {
    return this.discountService.findByCode(code, this.companyIdOf(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a discount by ID' })
  @ApiResponse({ status: 200, description: 'Discount details', type: DiscountResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<DiscountResponseDto> {
    return this.discountService.findOne(id, this.companyIdOf(user));
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a discount' })
  @ApiBody({ type: UpdateDiscountDto })
  @ApiResponse({ status: 200, description: 'Discount updated', type: DiscountResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountDto,
    @CurrentUser() user: User,
  ): Promise<DiscountResponseDto> {
    return this.discountService.update(id, dto, this.companyIdOf(user));
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a discount' })
  @ApiResponse({ status: 204, description: 'Discount deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.discountService.remove(id, this.companyIdOf(user));
  }
}
