import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard, LargePlanGuard } from '@/common/guards';
import { CurrentUser } from '@/common/decorators';
import { User } from '../users/entities/user.entity';
import { BorrowingService } from './borrowing.service';
import {
  CreateBorrowingDto,
  UpdateBorrowingDto,
  BorrowingQueryDto,
  BorrowingResponseDto,
} from './dto';
import { PaginatedResult } from '@/common/interfaces';

@ApiTags('Borrowings')
@ApiBearerAuth('access-token')
@Controller('borrowings')
@UseGuards(JwtAuthGuard, LargePlanGuard)
export class BorrowingController {
  constructor(private readonly borrowingService: BorrowingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a product borrowed from another seller' })
  async create(
    @Body() dto: CreateBorrowingDto,
    @CurrentUser() user: User,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List product borrowing records' })
  async findAll(
    @Query() query: BorrowingQueryDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedResult<BorrowingResponseDto>> {
    return this.borrowingService.findAll(query, user.companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get borrowing record details' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingService.findOne(id, user.companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update borrowing record (e.g. returned quantity)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBorrowingDto,
    @CurrentUser() user: User,
  ): Promise<BorrowingResponseDto> {
    return this.borrowingService.update(id, dto, user.companyId, user.id);
  }
}
