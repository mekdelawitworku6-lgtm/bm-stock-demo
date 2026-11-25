import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { UserRole } from '@/common/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryTransaction, InventoryTransactionType } from './entities/inventory-transaction.entity';
import { Product } from '../products/entities/product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { User } from '../users/entities/user.entity';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { CreateInventoryTransactionDto } from './dto';
import { PaginatedResult } from '@/common/interfaces';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS } from '@/common/constants';
import { ProductAlertService } from '../notifications/product-alert.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(ShopProduct)
    private readonly shopProductRepository: Repository<ShopProduct>,
    private readonly cacheService: CacheService,
    private readonly productAlertService: ProductAlertService,
  ) {}

  async onModuleInit() {
    try {
      await this.transactionRepository.query(`ALTER TYPE "inventory_transactions_type_enum" ADD VALUE IF NOT EXISTS 'purchase'`);
    } catch (_) {}
    try {
      await this.transactionRepository.query(`ALTER TYPE "inventory_transaction_type_enum" ADD VALUE IF NOT EXISTS 'purchase'`);
    } catch (_) {}
  }

  async create(dto: CreateInventoryTransactionDto, currentUserOrId?: User | string): Promise<any> {
    let user: User | null = null;
    let userId: string | undefined;
    if (typeof currentUserOrId === 'string') {
      userId = currentUserOrId;
      user = await this.productRepository.manager.findOne(User, { where: { id: userId } });
    } else if (currentUserOrId) {
      user = currentUserOrId;
      userId = user.id;
    }

    const isPlatformAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = user?.companyId || (user as any)?.company?.id;

    const product = await this.productRepository.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    if (!isPlatformAdmin && userCompanyId && product.companyId && product.companyId !== userCompanyId) {
      throw new ForbiddenException('Product belongs to a different company');
    }

    const absQuantity = Math.abs(dto.quantity);
    const isStockIn = dto.type === InventoryTransactionType.STOCK_IN ||
      dto.type === InventoryTransactionType.PURCHASE ||
      dto.type === InventoryTransactionType.RETURN ||
      dto.type === InventoryTransactionType.TRANSFER_IN;
    const isStockOut = dto.type === InventoryTransactionType.STOCK_OUT ||
      dto.type === InventoryTransactionType.SALE ||
      dto.type === InventoryTransactionType.TRANSFER_OUT;

    // Resolve warehouse and shop
    let warehouse: Warehouse | null = null;
    let shop: Shop | null = null;

    if (dto.warehouseId) {
      warehouse = await this.warehouseRepository.findOne({
        where: { id: dto.warehouseId },
        relations: ['company'],
      });
      if (!warehouse) throw new NotFoundException('Warehouse not found');
      if (!isPlatformAdmin && userCompanyId && warehouse.company?.id && warehouse.company.id !== userCompanyId) {
        throw new ForbiddenException('Warehouse belongs to a different company');
      }
    }
    if (dto.shopId) {
      shop = await this.shopRepository.findOne({
        where: { id: dto.shopId },
        relations: ['company'],
      });
      if (!shop) throw new NotFoundException('Shop not found');
      const shopCompanyId = shop.companyId || shop.company?.id;
      if (!isPlatformAdmin && userCompanyId && shopCompanyId && shopCompanyId !== userCompanyId) {
        throw new ForbiddenException('Shop belongs to a different company');
      }
    }

    // Auto-fallback location from performing user context or first warehouse/shop
    if (!warehouse && !shop && userId) {
      const performingUser = await this.productRepository.manager.findOne(User, {
        where: { id: userId },
        relations: ['warehouse', 'shop'],
      });
      if (performingUser?.warehouse) {
        warehouse = performingUser.warehouse;
      } else if (performingUser?.shop) {
        shop = performingUser.shop;
      }
    }

    if (!warehouse && !shop) {
      const companyFilter = (userCompanyId || product.companyId) ? { company: { id: userCompanyId || product.companyId } } : {};
      const warehouses = await this.warehouseRepository.find({ where: companyFilter, order: { createdAt: 'ASC' }, relations: ['company'], take: 1 });
      warehouse = warehouses.length > 0 ? warehouses[0] : null;
      if (!warehouse) {
        const shops = await this.shopRepository.find({ where: companyFilter, order: { createdAt: 'ASC' }, relations: ['company'], take: 1 });
        shop = shops.length > 0 ? shops[0] : null;
      }
    }

    if (!warehouse && !shop) {
      throw new BadRequestException('Could not resolve storage location for stock transaction');
    }

    // Validate available stock before performing stock-out
    const prevCatalogStock = product.stockQuantity || 0;
    if (isStockOut && prevCatalogStock < absQuantity) {
      throw new BadRequestException(
        `Insufficient product catalog stock. Available: ${prevCatalogStock}, requested: ${absQuantity}`,
      );
    }

    // Update warehouse stock
    if (warehouse) {
      const wp = await this.warehouseProductRepository.findOne({
        where: { warehouse: { id: warehouse.id }, product: { id: product.id } },
      });

      const prevQty = wp ? wp.stockQuantity : 0;
      if (isStockOut && prevQty < absQuantity) {
        throw new BadRequestException(
          `Insufficient stock in warehouse. Available: ${prevQty}, requested: ${absQuantity}`,
        );
      }

      // Always update global product catalog quantity
      const newCatalogStock = isStockIn
        ? prevCatalogStock + absQuantity
        : Math.max(0, prevCatalogStock - absQuantity);
      product.stockQuantity = newCatalogStock;
      if (dto.type === InventoryTransactionType.PURCHASE) {
        if (dto.unitCost && dto.unitCost > 0) {
          product.cost = dto.unitCost;
        }
        if (dto.supplierId) {
          product.supplier = { id: dto.supplierId } as any;
        }
      }
      await this.productRepository.save(product);

      // Invalidate product caches so updated stock quantities appear immediately
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.DASHBOARD_SUMMARY}*`);

      if (wp) {
        wp.stockQuantity = isStockIn ? wp.stockQuantity + absQuantity : Math.max(0, wp.stockQuantity - absQuantity);
        await this.warehouseProductRepository.save(wp);
      } else {
        const newWp = this.warehouseProductRepository.create({
          warehouse,
          product,
          stockQuantity: isStockIn ? absQuantity : 0,
          quantity: isStockIn ? absQuantity : 0,
        });
        await this.warehouseProductRepository.save(newWp);
      }

      const newQty = isStockIn ? prevQty + absQuantity : Math.max(0, prevQty - absQuantity);

      const tx = this.transactionRepository.create({
        type: dto.type,
        quantity: absQuantity,
        previousQuantity: prevQty,
        newQuantity: newQty,
        reason: dto.reason,
        referenceNumber: dto.referenceNumber,
        product,
        warehouse,
        shop: shop || null,
        performedBy: user || (userId ? ({ id: userId } as User) : null),
      });

      const saved = await this.transactionRepository.save(tx);

      await this.productAlertService.checkLowStock(product, prevQty, {
        currentQuantity: newQty,
        locationName: warehouse.name,
        companyId: warehouse.company?.id ?? product.companyId,
      });

      await this.invalidateStockCache();
      return this.toResponseDto(saved);
    }

    // Update shop stock
    if (shop) {
      const sp = await this.shopProductRepository.findOne({
        where: { shop: { id: shop.id }, product: { id: product.id } },
      });

      const prevQty = sp ? sp.stockQuantity : 0;
      if (isStockOut && prevQty < absQuantity) {
        throw new BadRequestException(
          `Insufficient stock in shop. Available: ${prevQty}, requested: ${absQuantity}`,
        );
      }

      // Always update global product catalog quantity
      const newCatalogStock = isStockIn
        ? prevCatalogStock + absQuantity
        : Math.max(0, prevCatalogStock - absQuantity);
      product.stockQuantity = newCatalogStock;
      if (dto.type === InventoryTransactionType.PURCHASE) {
        if (dto.unitCost && dto.unitCost > 0) {
          product.cost = dto.unitCost;
        }
        if (dto.supplierId) {
          product.supplier = { id: dto.supplierId } as any;
        }
      }
      await this.productRepository.save(product);

      // Invalidate product caches so updated stock quantities appear immediately
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.DASHBOARD_SUMMARY}*`);

      if (sp) {
        sp.stockQuantity = isStockIn ? sp.stockQuantity + absQuantity : Math.max(0, sp.stockQuantity - absQuantity);
        await this.shopProductRepository.save(sp);
      } else {
        const newSp = this.shopProductRepository.create({
          shop,
          product,
          stockQuantity: isStockIn ? absQuantity : 0,
        });
        await this.shopProductRepository.save(newSp);
      }

      const newQty = isStockIn ? prevQty + absQuantity : Math.max(0, prevQty - absQuantity);

      const tx = this.transactionRepository.create({
        type: dto.type,
        quantity: absQuantity,
        previousQuantity: prevQty,
        newQuantity: newQty,
        reason: dto.reason,
        referenceNumber: dto.referenceNumber,
        product,
        warehouse: null,
        shop,
        performedBy: user || (userId ? ({ id: userId } as User) : null),
      });

      const saved = await this.transactionRepository.save(tx);

      await this.productAlertService.checkLowStock(product, prevQty, {
        currentQuantity: newQty,
        locationName: shop.name,
        companyId: shop.company?.id ?? product.companyId,
      });

      await this.invalidateStockCache();
      return this.toResponseDto(saved);
    }

    throw new BadRequestException('Could not resolve storage location for stock transaction');
  }

  async findAll(query: {
    productId?: string;
    warehouseId?: string;
    shopId?: string;
    companyId?: string;
    type?: InventoryTransactionType;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResult<any>> {
    const { productId, warehouseId, shopId, companyId, type, page = 1, limit = 20, startDate, endDate } = query;
    const qb = this.transactionRepository.createQueryBuilder('tx')
      .leftJoinAndSelect('tx.product', 'product')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .leftJoinAndSelect('tx.performedBy', 'user')
      .leftJoinAndSelect('tx.warehouse', 'warehouse')
      .leftJoinAndSelect('tx.shop', 'shop');

    if (productId) qb.andWhere('product.id = :productId', { productId });
    if (warehouseId) qb.andWhere('warehouse.id = :warehouseId', { warehouseId });
    if (shopId) qb.andWhere('shop.id = :shopId', { shopId });
    if (companyId) qb.andWhere('product.companyId = :companyId', { companyId });
    if (type) qb.andWhere('tx.type = :type', { type });
    if (startDate) qb.andWhere('tx.createdAt >= :startDate', { startDate: new Date(startDate) });
    if (endDate) qb.andWhere('tx.createdAt <= :endDate', { endDate: new Date(endDate) });

    qb.orderBy('tx.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [txs, total] = await qb.getManyAndCount();

    return {
      data: txs.map(tx => this.toResponseDto(tx)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPurchases(query: {
    companyId?: string;
    warehouseId?: string;
    shopId?: string;
    productId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: {
      totalPurchasesCost: number;
      totalUnitsPurchased: number;
      transactionCount: number;
    };
  }> {
    const { companyId, warehouseId, shopId, productId, search, startDate, endDate, page = 1, limit = 20 } = query;
    const qb = this.transactionRepository.createQueryBuilder('tx')
      .leftJoinAndSelect('tx.product', 'product')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .leftJoinAndSelect('tx.performedBy', 'user')
      .leftJoinAndSelect('tx.warehouse', 'warehouse')
      .leftJoinAndSelect('tx.shop', 'shop')
      .leftJoin('warehouse.company', 'whCompany')
      .leftJoin('shop.company', 'shCompany')
      .where('(tx.type = :ptype OR (tx.type = :stype AND (LOWER(COALESCE(tx.reason, \'\')) LIKE :pterm OR COALESCE(tx.referenceNumber, \'\') LIKE :poPrefix)))', {
        ptype: InventoryTransactionType.PURCHASE,
        stype: InventoryTransactionType.STOCK_IN,
        pterm: '%purchase%',
        poPrefix: 'PO-%',
      });

    if (companyId) {
      qb.andWhere('(product.companyId = :companyId OR whCompany.id = :companyId OR shCompany.id = :companyId)', { companyId });
    }
    if (warehouseId) qb.andWhere('warehouse.id = :warehouseId', { warehouseId });
    if (shopId) qb.andWhere('shop.id = :shopId', { shopId });
    if (productId) qb.andWhere('product.id = :productId', { productId });
    if (startDate) qb.andWhere('tx.createdAt >= :startDate', { startDate: new Date(startDate) });
    if (endDate) qb.andWhere('tx.createdAt <= :endDate', { endDate: new Date(endDate) });

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(product.name) LIKE :s OR LOWER(COALESCE(product.sku, \'\')) LIKE :s OR LOWER(COALESCE(tx.reason, \'\')) LIKE :s OR LOWER(COALESCE(tx.referenceNumber, \'\')) LIKE :s OR LOWER(COALESCE(supplier.name, \'\')) LIKE :s)',
        { s },
      );
    }

    // Overall summary for all matching purchase records
    const summaryQb = qb.clone();
    const summaryRaw = await summaryQb
      .select('SUM(tx.quantity * COALESCE(product.cost, 0))', 'totalCost')
      .addSelect('SUM(tx.quantity)', 'totalUnits')
      .addSelect('COUNT(tx.id)', 'count')
      .getRawOne();

    const totalPurchasesCost = Number(summaryRaw?.totalCost) || 0;
    const totalUnitsPurchased = Number(summaryRaw?.totalUnits) || 0;
    const transactionCount = Number(summaryRaw?.count) || 0;

    qb.orderBy('tx.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [txs, total] = await qb.getManyAndCount();

    return {
      data: txs.map(tx => this.toResponseDto(tx)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalPurchasesCost,
        totalUnitsPurchased,
        transactionCount,
      },
    };
  }

  async findByProduct(productId: string): Promise<any[]> {
    const txs = await this.transactionRepository.find({
      where: { product: { id: productId } },
      relations: ['product', 'product.supplier', 'performedBy', 'warehouse', 'shop'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return txs.map(tx => this.toResponseDto(tx));
  }

  private toResponseDto(tx: InventoryTransaction): any {
    const unitCost = Number(tx.product?.cost) || 0;
    const totalCost = unitCost * (tx.quantity || 0);
    return {
      id: tx.id,
      type: tx.type,
      quantity: tx.quantity,
      previousQuantity: tx.previousQuantity,
      newQuantity: tx.newQuantity,
      reason: tx.reason,
      referenceNumber: tx.referenceNumber,
      productId: tx.product?.id,
      productName: tx.product?.name,
      productSku: tx.product?.sku || null,
      productCategory: tx.product?.category || null,
      productUnit: tx.product?.unit || null,
      unitCost,
      totalCost,
      sellingPrice: Number(tx.product?.price) || 0,
      supplierName: (tx.product as any)?.supplier?.name || null,
      supplierContact: (tx.product as any)?.supplier?.contact || null,
      performedById: tx.performedBy?.id,
      performedByName: tx.performedBy
        ? (`${(tx.performedBy as any).firstName || ''} ${(tx.performedBy as any).lastName || ''}`.trim() || (tx.performedBy as any).email || (tx.performedBy as any).phone || null)
        : null,
      performedByPhone: (tx.performedBy as any)?.phone || null,
      warehouseId: tx.warehouse?.id,
      warehouseName: tx.warehouse?.name,
      shopId: tx.shop?.id,
      shopName: tx.shop?.name,
      createdAt: tx.createdAt,
    };
  }

  private async invalidateStockCache(): Promise<void> {
    try {
      await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSE_DETAIL}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSES_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.SHOP_DETAIL}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.SHOPS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
    } catch (e) {
      this.logger.warn('Failed to invalidate stock cache:', e);
    }
  }
}
