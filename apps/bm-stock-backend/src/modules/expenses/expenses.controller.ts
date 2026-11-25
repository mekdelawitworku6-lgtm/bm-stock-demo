import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards';
import { CurrentUser } from '@/common/decorators';
import { User } from '../users/entities/user.entity';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, ExpenseQueryDto } from './dto';

@ApiTags('Expenses')
@ApiBearerAuth('access-token')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a purchase or business expense (does not affect stock or products)' })
  @ApiResponse({ status: 201, description: 'Expense recorded' })
  async create(@Body() dto: CreateExpenseDto, @CurrentUser() user: User) {
    return this.expensesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List recorded expenses with filters and summary' })
  @ApiResponse({ status: 200, description: 'Expense list with summary' })
  async findAll(@Query() query: ExpenseQueryDto, @CurrentUser() user: User) {
    return this.expensesService.findAll(query, user);
  }
}
