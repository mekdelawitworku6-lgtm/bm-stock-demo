import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { User } from '../users/entities/user.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { UserRole } from '@/common/enums';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
  ) {}

  private isPlatformAdmin(user?: User): boolean {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  }

  private resolveCompanyId(user?: User, requestedCompanyId?: string): string | undefined {
    if (this.isPlatformAdmin(user)) {
      return requestedCompanyId || user?.companyId;
    }
    return user?.companyId;
  }

  async create(dto: CreateExpenseDto, user: User): Promise<any> {
    const companyId = this.resolveCompanyId(user, dto.companyId);
    if (!companyId) {
      throw new BadRequestException('Company association is required to record an expense');
    }

    let warehouse: Warehouse | null = null;
    if (dto.warehouseId) {
      warehouse = await this.warehouseRepository.findOne({
        where: { id: dto.warehouseId },
        relations: ['company'],
      });
      if (!warehouse) throw new NotFoundException('Warehouse not found');
      if (!this.isPlatformAdmin(user) && warehouse.company?.id && warehouse.company.id !== companyId) {
        throw new BadRequestException('Warehouse does not belong to your company');
      }
    }

    let shop: Shop | null = null;
    if (dto.shopId) {
      shop = await this.shopRepository.findOne({
        where: { id: dto.shopId },
        relations: ['company'],
      });
      if (!shop) throw new NotFoundException('Shop not found');
      const shopCompanyId = shop.company?.id || shop.companyId;
      if (!this.isPlatformAdmin(user) && shopCompanyId && shopCompanyId !== companyId) {
        throw new BadRequestException('Shop does not belong to your company');
      }
    }

    const quantity = dto.quantity && dto.quantity > 0 ? dto.quantity : 1;
    const unitCost = dto.unitCost && dto.unitCost > 0 ? dto.unitCost : 0;
    const totalCost = dto.totalCost != null ? dto.totalCost : quantity * unitCost;

    const expense = this.expenseRepository.create({
      itemName: dto.itemName.trim(),
      category: dto.category?.trim() || undefined,
      quantity,
      unitCost,
      totalCost,
      supplierName: dto.supplierName?.trim() || undefined,
      referenceNumber: dto.referenceNumber?.trim() || undefined,
      note: dto.note?.trim() || undefined,
      warehouse: warehouse || undefined,
      shop: shop || undefined,
      company: { id: companyId } as any,
      performedBy: user ? ({ id: user.id } as User) : undefined,
    });

    const saved = await this.expenseRepository.save(expense);
    const withRelations = await this.expenseRepository.findOne({
      where: { id: saved.id },
      relations: ['warehouse', 'shop', 'performedBy'],
    });
    return this.toResponseDto(withRelations || saved);
  }

  async findAll(query: ExpenseQueryDto, user: User): Promise<any> {
    const { search, warehouseId, shopId, startDate, endDate, page = 1, limit = 50 } = query;
    const companyId = this.resolveCompanyId(user, query.companyId);

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.warehouse', 'warehouse')
      .leftJoinAndSelect('expense.shop', 'shop')
      .leftJoinAndSelect('expense.performedBy', 'performedBy')
      .leftJoin('expense.company', 'company');

    if (companyId) {
      qb.andWhere('company.id = :companyId', { companyId });
    }
    if (warehouseId) {
      qb.andWhere('warehouse.id = :warehouseId', { warehouseId });
    }
    if (shopId) {
      qb.andWhere('shop.id = :shopId', { shopId });
    }
    if (startDate) {
      qb.andWhere('expense.createdAt >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      qb.andWhere('expense.createdAt <= :endDate', { endDate: new Date(endDate) });
    }
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(expense.itemName) LIKE :term
          OR LOWER(COALESCE(expense.category, '')) LIKE :term
          OR LOWER(COALESCE(expense.supplierName, '')) LIKE :term
          OR LOWER(COALESCE(expense.referenceNumber, '')) LIKE :term)`,
        { term },
      );
    }

    const summaryQb = qb.clone();
    const summaryRaw = await summaryQb
      .select('COALESCE(SUM(expense.totalCost), 0)', 'totalExpenseAmount')
      .addSelect('COALESCE(SUM(expense.quantity), 0)', 'totalUnits')
      .addSelect('COUNT(expense.id)', 'recordCount')
      .getRawOne();

    qb.orderBy('expense.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((expense) => this.toResponseDto(expense)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalExpenseAmount: Number(summaryRaw?.totalExpenseAmount) || 0,
        totalUnits: Number(summaryRaw?.totalUnits) || 0,
        recordCount: Number(summaryRaw?.recordCount) || 0,
      },
    };
  }

  private toResponseDto(expense: Expense): any {
    return {
      id: expense.id,
      itemName: expense.itemName,
      category: expense.category,
      quantity: expense.quantity,
      unitCost: Number(expense.unitCost) || 0,
      totalCost: Number(expense.totalCost) || 0,
      supplierName: expense.supplierName,
      referenceNumber: expense.referenceNumber,
      note: expense.note,
      warehouseId: expense.warehouse?.id,
      warehouseName: expense.warehouse?.name,
      shopId: expense.shop?.id,
      shopName: expense.shop?.name,
      performedByName: expense.performedBy
        ? `${expense.performedBy.firstName || ''} ${expense.performedBy.lastName || ''}`.trim()
        : undefined,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }
}
