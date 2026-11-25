import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProductBorrowing,
  BorrowingStatus,
} from './entities/product-borrowing.entity';
import { Product } from '../products/entities/product.entity';
import { ProductType } from '../products/enums/product-type.enum';
import { ProductStatus } from '../products/enums/product-status.enum';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateBorrowingDto,
  UpdateBorrowingDto,
  BorrowingQueryDto,
  BorrowingResponseDto,
} from './dto';
import { PaginatedResult } from '@/common/interfaces';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransactionType } from '../inventory/entities/inventory-transaction.entity';

@Injectable()
export class BorrowingService {
  private readonly logger = new Logger(BorrowingService.name);

  constructor(
    @InjectRepository(ProductBorrowing)
    private readonly borrowingRepo: Repository<ProductBorrowing>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    private readonly inventoryService: InventoryService,
  ) {}

  static computeRemaining(quantityTaken: number, quantityReturned: number): number {
    return Math.max(0, quantityTaken - quantityReturned);
  }

  static computeStatus(quantityTaken: number, quantityReturned: number): BorrowingStatus {
    if (quantityReturned <= 0) return BorrowingStatus.ACTIVE;
    if (quantityReturned >= quantityTaken) return BorrowingStatus.FULLY_RETURNED;
    return BorrowingStatus.PARTIALLY_RETURNED;
  }

  async create(dto: CreateBorrowingDto, user: User): Promise<BorrowingResponseDto> {
    if (!dto.warehouseId && !dto.shopId) {
      throw new BadRequestException('Either warehouseId or shopId is required');
    }
    if (dto.warehouseId && dto.shopId) {
      throw new BadRequestException('Provide either warehouseId or shopId, not both');
    }

    const companyId = user.companyId;
    if (!companyId) throw new BadRequestException('User must belong to a company');

    let warehouse: Warehouse | null = null;
    let shop: Shop | null = null;

    if (dto.warehouseId) {
      warehouse = await this.warehouseRepo.findOne({
        where: { id: dto.warehouseId },
        relations: ['company'],
      });
      if (!warehouse) throw new NotFoundException('Warehouse not found');
      if (warehouse.company?.id !== companyId) {
        throw new BadRequestException('Warehouse does not belong to your company');
      }
    }

    if (dto.shopId) {
      shop = await this.shopRepo.findOne({
        where: { id: dto.shopId },
        relations: ['company'],
      });
      if (!shop) throw new NotFoundException('Shop not found');
      if (shop.company?.id !== companyId) {
        throw new BadRequestException('Shop does not belong to your company');
      }
    }

    let product: Product | null = null;
    if (dto.productId) {
      product = await this.productRepo.findOne({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found');
    } else if (dto.productName) {
      const existing = await this.productRepo.findOne({
        where: { name: dto.productName.trim(), companyId },
      });
      if (existing) {
        product = existing;
      } else {
        const newProduct = new Product();
        newProduct.name = dto.productName.trim();
        newProduct.category = dto.productCategory?.trim() || 'General';
        newProduct.companyId = companyId;
        newProduct.price = 0;
        newProduct.cost = 0;
        newProduct.unit = 'pcs';
        newProduct.stockQuantity = 0;
        newProduct.trackStock = true;
        newProduct.type = ProductType.PRODUCT;
        newProduct.status = ProductStatus.AVAILABLE;
        product = await this.productRepo.save(newProduct);
      }
    }

    const borrowing = this.borrowingRepo.create({
      company: { id: companyId } as any,
      productName: dto.productName.trim(),
      productCategory: dto.productCategory?.trim() || product?.category,
      product: product ?? undefined,
      quantityTaken: dto.quantityTaken,
      quantityReturned: 0,
      sellerName: dto.sellerName.trim(),
      sellerPhone: dto.sellerPhone?.trim(),
      dateTaken: dto.dateTaken,
      expectedReturnDate: dto.expectedReturnDate,
      note: dto.note?.trim(),
      warehouse: warehouse ?? undefined,
      shop: shop ?? undefined,
      status: BorrowingStatus.ACTIVE,
      recordedBy: user,
    });

    const saved = await this.borrowingRepo.save(borrowing);
    this.logger.log(`Borrowing record created: ${saved.id}`);

    // Add borrowed stock to the specified location (stock_in)
    if (product && dto.quantityTaken > 0) {
      try {
        await this.inventoryService.create(
          {
            productId: product.id,
            type: InventoryTransactionType.STOCK_IN,
            quantity: dto.quantityTaken,
            warehouseId: dto.warehouseId,
            shopId: dto.shopId,
            reason: `Borrowed from ${dto.sellerName.trim()}`,
            referenceNumber: `BORROW-${saved.id}`,
          },
          user.id,
        );
      } catch (err) {
        this.logger.error(`Failed to adjust inventory for borrowing ${saved.id}: ${err?.message || err}`);
      }
    }

    return this.findOne(saved.id, companyId);
  }

  async findAll(
    query: BorrowingQueryDto,
    companyId?: string,
  ): Promise<PaginatedResult<BorrowingResponseDto>> {
    const { search, status, warehouseId, shopId, page = 1, limit = 20 } = query;

    const qb = this.borrowingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.warehouse', 'warehouse')
      .leftJoinAndSelect('b.shop', 'shop')
      .leftJoinAndSelect('b.product', 'product')
      .leftJoinAndSelect('b.recordedBy', 'recordedBy');

    if (companyId) {
      qb.andWhere('b.company_id = :companyId', { companyId });
    }
    if (search) {
      qb.andWhere(
        '(b.product_name ILIKE :search OR b.seller_name ILIKE :search OR b.note ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (status) {
      qb.andWhere('b.status = :status', { status });
    }
    if (warehouseId) {
      qb.andWhere('b.warehouse_id = :warehouseId', { warehouseId });
    }
    if (shopId) {
      qb.andWhere('b.shop_id = :shopId', { shopId });
    }

    qb.orderBy('b.dateTaken', 'DESC').addOrderBy('b.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [records, total] = await qb.getManyAndCount();

    return {
      data: records.map((r) => this.toDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, companyId?: string): Promise<BorrowingResponseDto> {
    const qb = this.borrowingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.warehouse', 'warehouse')
      .leftJoinAndSelect('b.shop', 'shop')
      .leftJoinAndSelect('b.product', 'product')
      .leftJoinAndSelect('b.recordedBy', 'recordedBy')
      .where('b.id = :id', { id });

    if (companyId) {
      qb.andWhere('b.company_id = :companyId', { companyId });
    }

    const record = await qb.getOne();
    if (!record) throw new NotFoundException('Borrowing record not found');
    return this.toDto(record);
  }

  async update(
    id: string,
    dto: UpdateBorrowingDto,
    companyId?: string,
    userId?: string,
  ): Promise<BorrowingResponseDto> {
    const record = await this.borrowingRepo.findOne({
      where: companyId ? { id, company: { id: companyId } } : { id },
      relations: ['warehouse', 'shop', 'product', 'recordedBy'],
    });
    if (!record) throw new NotFoundException('Borrowing record not found');

    if (dto.quantityReturned !== undefined) {
      if (dto.quantityReturned > record.quantityTaken) {
        throw new BadRequestException(
          `Returned quantity cannot exceed quantity taken (${record.quantityTaken})`,
        );
      }
      const deltaReturned = dto.quantityReturned - record.quantityReturned;
      record.quantityReturned = dto.quantityReturned;
      record.status = BorrowingService.computeStatus(
        record.quantityTaken,
        record.quantityReturned,
      );

      // Deduct stock if items were returned to seller (stock_out)
      if (deltaReturned > 0 && record.product?.id) {
        try {
          await this.inventoryService.create(
            {
              productId: record.product.id,
              type: InventoryTransactionType.STOCK_OUT,
              quantity: deltaReturned,
              warehouseId: record.warehouse?.id,
              shopId: record.shop?.id,
              reason: `Returned borrowed stock to ${record.sellerName}`,
              referenceNumber: `BORROW-RET-${record.id}`,
            },
            userId,
          );
        } catch (err) {
          this.logger.error(`Failed to deduct returned borrowed stock: ${err?.message || err}`);
        }
      }
    }

    if (dto.note !== undefined) record.note = dto.note;
    if (dto.expectedReturnDate !== undefined) {
      record.expectedReturnDate = dto.expectedReturnDate;
    }

    await this.borrowingRepo.save(record);
    return this.toDto(record);
  }

  private toDto(record: ProductBorrowing): BorrowingResponseDto {
    const remaining = BorrowingService.computeRemaining(
      record.quantityTaken,
      record.quantityReturned,
    );
    const status =
      record.status ??
      BorrowingService.computeStatus(record.quantityTaken, record.quantityReturned);

    return {
      id: record.id,
      productName: record.productName,
      productCategory: record.productCategory,
      productId: record.product?.id,
      quantityTaken: record.quantityTaken,
      quantityReturned: record.quantityReturned,
      remainingQuantity: remaining,
      sellerName: record.sellerName,
      sellerPhone: record.sellerPhone,
      dateTaken: record.dateTaken,
      expectedReturnDate: record.expectedReturnDate,
      note: record.note,
      warehouseId: record.warehouse?.id,
      warehouseName: record.warehouse?.name,
      shopId: record.shop?.id,
      shopName: record.shop?.name,
      status,
      recordedByName: record.recordedBy
        ? `${record.recordedBy.firstName || ''} ${record.recordedBy.lastName || ''}`.trim()
        : undefined,
      createdAt: record.createdAt?.toISOString?.() ?? String(record.createdAt),
      updatedAt: record.updatedAt?.toISOString?.() ?? String(record.updatedAt),
    };
  }
}
