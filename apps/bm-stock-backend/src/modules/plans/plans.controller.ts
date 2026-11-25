import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from './dto/plan.dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { ResponseDto } from '@/common/dto';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'Get active subscription plans (public)' })
  @ApiResponse({ status: 200, description: 'Plans retrieved', type: [PlanResponseDto] })
  async getPublicPlans() {
    return this.plansService.findAllPublic();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all subscription plans (Admin only)' })
  @ApiResponse({ status: 200, description: 'All plans retrieved', type: [PlanResponseDto] })
  async getAdminPlans() {
    return this.plansService.findAll();
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a subscription plan (Admin only)' })
  @ApiResponse({ status: 201, description: 'Plan created', type: PlanResponseDto })
  async create(
    @Body() dto: CreatePlanDto,
  ): Promise<ResponseDto<PlanResponseDto>> {
    const plan = await this.plansService.create(dto);
    return { success: true, message: 'Plan created successfully', data: plan };
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a subscription plan (Admin only)' })
  @ApiResponse({ status: 200, description: 'Plan updated', type: PlanResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<ResponseDto<PlanResponseDto>> {
    const plan = await this.plansService.update(id, dto);
    return { success: true, message: 'Plan updated successfully', data: plan };
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a subscription plan (Admin only)' })
  @ApiResponse({ status: 200, description: 'Plan deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseDto<{ success: boolean }>> {
    const result = await this.plansService.remove(id);
    return { success: true, message: 'Plan deleted successfully', data: result };
  }
}