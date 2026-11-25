import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseUUIDPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { User } from '../users/entities/user.entity';
import { TransferService } from './transfer.service';
import {
  CreateTransferDto, UpdateTransferStatusDto, TransferQueryDto, TransferResponseDto,
} from './dto';
import { PaginatedResult } from '@/common/interfaces';

@ApiTags('Transfers')
@ApiBearerAuth('access-token')
@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a transfer request' })
  async create(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: User,
  ): Promise<TransferResponseDto> {
    return this.transferService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List transfers' })
  async findAll(
    @Query() query: TransferQueryDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedResult<TransferResponseDto>> {
    return this.transferService.findAll(query, user);
  }

  @Get('history/:branchId')
  @ApiOperation({ summary: 'Get transfer history for a branch' })
  async getHistory(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query('type') type: 'warehouse' | 'shop' = 'shop',
  ): Promise<TransferResponseDto[]> {
    return this.transferService.getTransferHistory(branchId, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transfer detail' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransferResponseDto> {
    return this.transferService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve, reject or cancel a transfer' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransferStatusDto,
    @CurrentUser() user: User,
  ): Promise<TransferResponseDto> {
    return this.transferService.updateStatus(id, dto, user);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve a transfer' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<TransferResponseDto> {
    return this.transferService.updateStatus(
      id,
      { status: 'approved' as any },
      user,
    );
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Reject a transfer' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: User,
  ): Promise<TransferResponseDto> {
    return this.transferService.updateStatus(
      id,
      { status: 'rejected' as any, rejectionReason: reason },
      user,
    );
  }
}
