import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Discount } from './entities/discount.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Customer } from '@/modules/customer/entities/customer.entity';
import { CreateDiscountDto, UpdateDiscountDto, DiscountResponseDto } from './dto/discount.dto';
import { PaginatedResult } from '@/common/interfaces';
import { CacheService } from '@/shared/cache/cache.service';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly cacheService: CacheService,
  ) {}

  private companyWhere(companyId?: string): FindOptionsWhere<Discount> {
    return companyId ? { companyId } : { companyId: IsNull() };
  }

  async create(dto: CreateDiscountDto, companyId?: string): Promise<DiscountResponseDto> {
    if (dto.code) {
      const existing = await this.discountRepository.findOne({
        where: { code: dto.code, ...this.companyWhere(companyId) },
      });
      if (existing) {
        throw new ConflictException(`Discount code "${dto.code}" already exists`);
      }
    }

    const discount = this.discountRepository.create({
      companyId: companyId ?? null,
      name: dto.name,
      description: dto.description,
      code: dto.code,
      type: dto.type,
      value: dto.value,
      minimumOrderAmount: dto.minimumOrderAmount,
      maximumDiscountAmount: dto.maximumDiscountAmount,
      usageLimit: dto.usageLimit,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      isActive: dto.isActive ?? true,
      applyToAllProducts: dto.applyToAllProducts ?? false,
      applyToAllCustomers: dto.applyToAllCustomers ?? false,
    });

    if (dto.applicableProductIds?.length) {
      discount.applicableProducts = dto.applicableProductIds.map(id => ({ id } as Product));
    }
    if (dto.applicableCustomerIds?.length) {
      discount.applicableCustomers = dto.applicableCustomerIds.map(id => ({ id } as Customer));
    }

    const saved = await this.discountRepository.save(discount);
    this.logger.log(`Discount created: ${saved.id} (${saved.name})`);
    await this.invalidateCache();
    return this.toResponseDto(saved);
  }

  async findAll(query: { search?: string; isActive?: string; page?: number; limit?: number }, companyId?: string): Promise<PaginatedResult<DiscountResponseDto>> {
    const { search, isActive, page = 1, limit = 20 } = query;
    const qb = this.discountRepository.createQueryBuilder('discount');

    if (companyId) {
      qb.andWhere('discount.companyId = :companyId', { companyId });
    } else {
      qb.andWhere('discount.companyId IS NULL');
    }

    if (search) {
      qb.andWhere('(discount.name ILIKE :search OR discount.code ILIKE :search)', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('discount.isActive = :isActive', { isActive: isActive === 'true' });
    }

    qb.orderBy('discount.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [discounts, total] = await qb.getManyAndCount();

    return {
      data: discounts.map(d => this.toResponseDto(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, companyId?: string): Promise<DiscountResponseDto> {
    const discount = await this.discountRepository.findOne({
      where: { id, ...this.companyWhere(companyId) },
      relations: ['applicableProducts', 'applicableCustomers'],
    });
    if (!discount) throw new NotFoundException('Discount not found');
    return this.toResponseDto(discount);
  }

  async findByCode(code: string, companyId?: string): Promise<DiscountResponseDto> {
    const discount = await this.discountRepository.findOne({
      where: { code, ...this.companyWhere(companyId) },
      relations: ['applicableProducts', 'applicableCustomers'],
    });
    if (!discount) throw new NotFoundException(`Discount with code "${code}" not found`);
    return this.toResponseDto(discount);
  }

  async update(id: string, dto: UpdateDiscountDto, companyId?: string): Promise<DiscountResponseDto> {
    const discount = await this.discountRepository.findOne({
      where: { id, ...this.companyWhere(companyId) },
      relations: ['applicableProducts', 'applicableCustomers'],
    });
    if (!discount) throw new NotFoundException('Discount not found');

    if (dto.code && dto.code !== discount.code) {
      const existing = await this.discountRepository.findOne({
        where: { code: dto.code, ...this.companyWhere(companyId) },
      });
      if (existing) {
        throw new ConflictException(`Discount code "${dto.code}" already exists`);
      }
    }

    if (dto.name !== undefined) discount.name = dto.name;
    if (dto.description !== undefined) discount.description = dto.description;
    if (dto.code !== undefined) discount.code = dto.code;
    if (dto.type !== undefined) discount.type = dto.type;
    if (dto.value !== undefined) discount.value = dto.value;
    if (dto.minimumOrderAmount !== undefined) discount.minimumOrderAmount = dto.minimumOrderAmount;
    if (dto.maximumDiscountAmount !== undefined) discount.maximumDiscountAmount = dto.maximumDiscountAmount;
    if (dto.usageLimit !== undefined) discount.usageLimit = dto.usageLimit;
    if (dto.startDate !== undefined) discount.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) discount.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) discount.isActive = dto.isActive;
    if (dto.applyToAllProducts !== undefined) discount.applyToAllProducts = dto.applyToAllProducts;
    if (dto.applyToAllCustomers !== undefined) discount.applyToAllCustomers = dto.applyToAllCustomers;

    if (dto.applicableProductIds) {
      discount.applicableProducts = dto.applicableProductIds.map(pid => ({ id: pid } as Product));
    }
    if (dto.applicableCustomerIds) {
      discount.applicableCustomers = dto.applicableCustomerIds.map(cid => ({ id: cid } as Customer));
    }

    const saved = await this.discountRepository.save(discount);
    this.logger.log(`Discount updated: ${saved.id}`);
    await this.invalidateCache();
    return this.toResponseDto(saved);
  }

  async remove(id: string, companyId?: string): Promise<void> {
    const discount = await this.discountRepository.findOne({
      where: { id, ...this.companyWhere(companyId) },
    });
    if (!discount) throw new NotFoundException('Discount not found');
    await this.discountRepository.delete(id);
    this.logger.log(`Discount deleted: ${id}`);
    await this.invalidateCache();
  }

  async validate(code: string, orderAmount: number, customerId?: string, companyId?: string): Promise<{ valid: boolean; discount: DiscountResponseDto; discountAmount: number }> {
    const discount = await this.discountRepository.findOne({
      where: { code, ...this.companyWhere(companyId) },
      relations: ['applicableProducts', 'applicableCustomers'],
    });
    if (!discount) throw new NotFoundException(`Discount code "${code}" not found`);

    const now = new Date();
    if (!discount.isActive) {
      return { valid: false, discount: this.toResponseDto(discount), discountAmount: 0 };
    }
    if (now < discount.startDate || now > discount.endDate) {
      return { valid: false, discount: this.toResponseDto(discount), discountAmount: 0 };
    }
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return { valid: false, discount: this.toResponseDto(discount), discountAmount: 0 };
    }
    if (discount.minimumOrderAmount && orderAmount < discount.minimumOrderAmount) {
      return { valid: false, discount: this.toResponseDto(discount), discountAmount: 0 };
    }

    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (orderAmount * discount.value) / 100;
      if (discount.maximumDiscountAmount) {
        discountAmount = Math.min(discountAmount, discount.maximumDiscountAmount);
      }
    } else {
      discountAmount = Math.min(discount.value, orderAmount);
    }

    return { valid: true, discount: this.toResponseDto(discount), discountAmount };
  }

  private toResponseDto(discount: Discount): DiscountResponseDto {
    return {
      id: discount.id,
      name: discount.name,
      description: discount.description,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      minimumOrderAmount: discount.minimumOrderAmount,
      maximumDiscountAmount: discount.maximumDiscountAmount,
      usageLimit: discount.usageLimit,
      usageCount: discount.usageCount,
      startDate: discount.startDate,
      endDate: discount.endDate,
      isActive: discount.isActive,
      applyToAllProducts: discount.applyToAllProducts,
      applyToAllCustomers: discount.applyToAllCustomers,
      isValid: discount.isValid,
      createdAt: discount.createdAt,
      updatedAt: discount.updatedAt,
    };
  }

  private async invalidateCache(): Promise<void> {
    try {
      await this.cacheService.deletePattern('discounts*');
    } catch {
      // ignore cache errors
    }
  }
}
