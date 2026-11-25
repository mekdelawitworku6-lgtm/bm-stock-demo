import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In, ILike } from 'typeorm';
import { Shop } from '../shops/entities/shops.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { Product } from '../products/entities/product.entity';
import { CreateShopDto, UpdateShopDto, ShopQueryDto, ShopResponseDto } from './dto';
import { AttachProductDto } from './dto/attach-product.dto';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Company } from '../company/entities/company.entity';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { Employee } from '../users/entities/employee.entity';
import { PaginatedResult } from '../../common/interfaces';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS } from '../../common/constants';
import { User } from '../users/entities/user.entity';
import { UserRole } from '@/common/enums';
import { assertShopLimit } from '@/shared/subscription/subscription-plans.util';

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(ShopProduct)
    private readonly shopProductRepository: Repository<ShopProduct>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly cacheService: CacheService,
  ) {}

  async getStaffAllowedShopIds(currentUser: User): Promise<string[] | null> {
    if (!currentUser || currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.COMPANY_ADMIN) {
      return null;
    }

    const employeeRepo = this.shopRepository.manager.getRepository(Employee);
    let employee: Employee | null = null;
    if ((currentUser as any).employeeId) {
      employee = await employeeRepo.findOne({
        where: { id: (currentUser as any).employeeId },
        relations: ['shop', 'company'],
      });
    }
    if (!employee && currentUser.id) {
      employee = await employeeRepo.findOne({
        where: { user: { id: currentUser.id } },
        relations: ['shop', 'company'],
      });
    }

    const allowedIds = new Set<string>();

    // 1. Primary assigned shop is ALWAYS allowed
    if (currentUser.shopId) {
      allowedIds.add(currentUser.shopId);
    }
    if (employee?.shop?.id) {
      allowedIds.add(employee.shop.id);
    }

    // 2. Additional shops from branchPermissions
    let permissions = employee?.permissions || (currentUser as any).permissions;
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch (_) {}
    }
    let branchPermissions = permissions?.branchPermissions;
    if (typeof branchPermissions === 'string') {
      try {
        branchPermissions = JSON.parse(branchPermissions);
      } catch (_) {}
    }

    if (branchPermissions && typeof branchPermissions === 'object') {
      for (const [branchId, access] of Object.entries(branchPermissions)) {
        const hasAccess = access && (
          access === true ||
          access === 'true' ||
          (typeof access === 'object' && ((access as any).shop === true || (access as any).shop === 'true'))
        );
        if (hasAccess) {
          allowedIds.add(branchId);
        }
      }
    }

    return Array.from(allowedIds);
  }

  async create(createShopDto: CreateShopDto, currentUser?: User): Promise<ShopResponseDto> {
    const { name, location } = createShopDto;

    // Always scope new shops to the ACTIVE company (the one in x-company-id),
    // never to a client-supplied companyId or a stale cross-company fallback.
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const companyId = isPlatformAdmin
      ? createShopDto.companyId || (currentUser as any)?.companyId || (currentUser as any)?.company?.id
      : (currentUser as any)?.companyId || (currentUser as any)?.company?.id || createShopDto.companyId;

    let warehouse: Warehouse | undefined;
    let company: Company | undefined;
    if (companyId) {
      company = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['createdBy'] });
      if (!company) throw new NotFoundException('Company not found');

      // Enforce plan shop limits (Small: 3, Medium: 5, Large: Unlimited)
      const currentCount = await this.shopRepository.count({
        where: { company: { id: companyId } },
      });
      const planUser = currentUser || company.createdBy;
      assertShopLimit(planUser, currentCount);
    }

    // Only assign a parent warehouse if explicitly provided in the request
    if (createShopDto.warehouseId) {
      const candidate = await this.warehouseRepository.findOne({
        where: { id: createShopDto.warehouseId },
        relations: ['company'],
      });
      if (candidate && (!companyId || candidate.company?.id === companyId)) {
        warehouse = candidate;
      }
    }

    const shop = this.shopRepository.create({
      name,
      location,
      ...(warehouse ? { warehouse } : {}),
      ...(company ? { company } : {}),
    });
    const savedShop = await this.shopRepository.save(shop);
    const shopWithRelations = await this.shopRepository.findOne({
      where: { id: savedShop.id },
      relations: ['warehouse', 'company']
    });
    await this.invalidateShopCache();
    return this.mapToResponseDto(shopWithRelations || savedShop, 0, 0);
  }

  async findAll(query: ShopQueryDto, currentUser: any): Promise<PaginatedResult<ShopResponseDto>> {
    const companyId = query.companyId || currentUser?.companyId || currentUser?.company?.id;

    const allowedShopIds = await this.getStaffAllowedShopIds(currentUser);
    if (allowedShopIds !== null && allowedShopIds.length === 0) {
      return { data: [], total: 0, page: query.page || 1, limit: query.limit || 10, totalPages: 0 };
    }

    const isStaff = allowedShopIds !== null;
    const cacheKey = isStaff
      ? this.cacheService.generateKey(CACHE_KEYS.SHOPS_LIST, currentUser?.id || 'staff', JSON.stringify(query))
      : this.cacheService.generateKey(CACHE_KEYS.SHOPS_LIST, companyId || 'all', JSON.stringify(query));

    const cached = await this.cacheService.get<PaginatedResult<ShopResponseDto>>(cacheKey);
    if (cached) return cached;

    const queryBuilder = this.createQueryBuilder();
    if (allowedShopIds !== null) {
      queryBuilder.andWhere('shop.id IN (:...allowedShopIds)', { allowedShopIds });
      if (query.companyId) {
        queryBuilder.andWhere('company.id = :companyId', { companyId: query.companyId });
      }
    } else if (companyId) {
      queryBuilder.andWhere('company.id = :companyId', { companyId });
    }
    this.applyFilters(queryBuilder, query);

    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [shops, total] = await queryBuilder.getManyAndCount();

    const shopIds = shops.map(s => s.id);
    const stockMap = new Map<string, number>();
    const warehouseStockMap = new Map<string, number>();
    const managerMap = new Map<string, string>();

    if (shopIds.length > 0) {
      const shopProductsRepository = this.shopRepository.manager.getRepository(ShopProduct);
      const stockAmounts = await shopProductsRepository
        .createQueryBuilder('sp')
        .select('sp.shopId', 'shopId')
        .addSelect('SUM(sp.stockQuantity)', 'sum')
        .where('sp.shopId IN (:...shopIds)', { shopIds })
        .groupBy('sp.shopId')
        .getRawMany();
      
      stockAmounts.forEach(row => {
        stockMap.set(row.shopId, Number(row.sum) || 0);
      });

      const warehouseIds = shops.map(s => s.warehouse?.id).filter(Boolean);
      if (warehouseIds.length > 0) {
        const warehouseProductsRepository = this.shopRepository.manager.getRepository(WarehouseProduct);
        const warehouseAmounts = await warehouseProductsRepository
          .createQueryBuilder('wp')
          .select('wp.warehouseId', 'warehouseId')
          .addSelect('SUM(wp.stockQuantity)', 'sum')
          .where('wp.warehouseId IN (:...warehouseIds)', { warehouseIds })
          .groupBy('wp.warehouseId')
          .getRawMany();
        
        warehouseAmounts.forEach(row => {
          warehouseStockMap.set(row.warehouseId, Number(row.sum) || 0);
        });
      }

      const employeeRepository = this.shopRepository.manager.getRepository(Employee);
      const employees = await employeeRepository.find({
        where: { shop: { id: In(shopIds) } },
        relations: ['shop']
      });
      shops.forEach(shop => {
        const shopEmps = employees.filter(e => e.shop?.id === shop.id);
        const mgr = shopEmps.find(e => e.jobTitle?.toLowerCase().includes('manager')) || shopEmps[0];
        if (mgr) {
          managerMap.set(shop.id, mgr.name);
        }
      });
    }

    const result = {
      data: shops.map(shop => this.mapToResponseDto(
        shop,
        stockMap.get(shop.id) || 0,
        warehouseStockMap.get(shop.warehouse?.id) || 0,
        managerMap.get(shop.id)
      )),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result, 300000);
    return result;
  }

  private assertShopTenantAccess(shop: Shop, currentUser?: User): void {
    if (!currentUser) {
      throw new ForbiddenException('Authentication required');
    }
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }
    const shopCompanyId = shop.companyId || shop.company?.id;
    const userCompanyId = currentUser.companyId || (currentUser as any).company?.id;
    const isOwner = shop.company?.createdById === currentUser.id;
    if (!shopCompanyId || !userCompanyId || (shopCompanyId !== userCompanyId && !isOwner)) {
      throw new ForbiddenException('Access denied to this shop');
    }
  }

  async findOne(id: string, currentUser?: User): Promise<ShopResponseDto> {
    if (currentUser) {
      const allowedShopIds = await this.getStaffAllowedShopIds(currentUser);
      if (allowedShopIds !== null && !allowedShopIds.includes(id)) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }
    const cacheKey = this.cacheService.generateKey(CACHE_KEYS.SHOP_DETAIL, id);
    const cached = await this.cacheService.get<ShopResponseDto>(cacheKey);
    if (cached) return cached;

    const shop = await this.shopRepository.findOne({ where: { id }, relations: ['warehouse', 'company'] });
    if (!shop) throw new NotFoundException('Shop not found');
    this.assertShopTenantAccess(shop, currentUser);
    
    const shopProductsRepository = this.shopRepository.manager.getRepository(ShopProduct);
    const stockResult = await shopProductsRepository
      .createQueryBuilder('sp')
      .select('SUM(sp.stockQuantity)', 'sum')
      .where('sp.shopId = :shopId', { shopId: shop.id })
      .getRawOne();
    const unitsInStock = Number(stockResult?.sum) || 0;

    let unitsStored = 0;
    if (shop.warehouse) {
      const warehouseProductsRepository = this.shopRepository.manager.getRepository(WarehouseProduct);
      const warehouseResult = await warehouseProductsRepository
        .createQueryBuilder('wp')
        .select('SUM(wp.stockQuantity)', 'sum')
        .where('wp.warehouseId = :warehouseId', { warehouseId: shop.warehouse.id })
        .getRawOne();
      unitsStored = Number(warehouseResult?.sum) || 0;
    }

    const employeeRepository = this.shopRepository.manager.getRepository(Employee);
    const shopEmps = await employeeRepository.find({
      where: { shop: { id: shop.id } }
    });
    const mgr = shopEmps.find(e => e.jobTitle?.toLowerCase().includes('manager')) || shopEmps[0];
    const managerName = mgr?.name;

    const result = this.mapToResponseDto(shop, unitsInStock, unitsStored, managerName);
    await this.cacheService.set(cacheKey, result, 600000);
    return result;
  }

  async update(id: string, updateShopDto: UpdateShopDto, currentUser?: User): Promise<ShopResponseDto> {
    const shop = await this.shopRepository.findOne({ where: { id }, relations: ['warehouse', 'company'] });
    if (!shop) throw new NotFoundException('Shop not found');
    this.assertShopTenantAccess(shop, currentUser);

    Object.assign(shop, updateShopDto);
    const updatedShop = await this.shopRepository.save(shop);
    
    const shopProductsRepository = this.shopRepository.manager.getRepository(ShopProduct);
    const stockResult = await shopProductsRepository
      .createQueryBuilder('sp')
      .select('SUM(sp.stockQuantity)', 'sum')
      .where('sp.shopId = :shopId', { shopId: updatedShop.id })
      .getRawOne();
    const unitsInStock = Number(stockResult?.sum) || 0;

    let unitsStored = 0;
    if (updatedShop.warehouse) {
      const warehouseProductsRepository = this.shopRepository.manager.getRepository(WarehouseProduct);
      const warehouseResult = await warehouseProductsRepository
        .createQueryBuilder('wp')
        .select('SUM(wp.stockQuantity)', 'sum')
        .where('wp.warehouseId = :warehouseId', { warehouseId: updatedShop.warehouse.id })
        .getRawOne();
      unitsStored = Number(warehouseResult?.sum) || 0;
    }

    const employeeRepository = this.shopRepository.manager.getRepository(Employee);
    const shopEmps = await employeeRepository.find({
      where: { shop: { id: updatedShop.id } }
    });
    const mgr = shopEmps.find(e => e.jobTitle?.toLowerCase().includes('manager')) || shopEmps[0];
    const managerName = mgr?.name;

    await this.invalidateShopCache();
    await this.cacheService.del(CACHE_KEYS.SHOPS_LIST);
    return this.mapToResponseDto(updatedShop, unitsInStock, unitsStored, managerName);
  }

  async remove(id: string, currentUser?: User): Promise<void> {
    const shop = await this.shopRepository.findOne({ where: { id }, relations: ['company'] });
    if (!shop) throw new NotFoundException('Shop not found');
    this.assertShopTenantAccess(shop, currentUser);

    const mgr = this.shopRepository.manager;
    // Detach or null out constraints so deletion succeeds smoothly
    await mgr.query(`UPDATE "employees" SET "shopId" = NULL WHERE "shopId" = $1`, [id]).catch(() => {});
    await mgr.query(`UPDATE "sales" SET "shopId" = NULL WHERE "shopId" = $1`, [id]).catch(() => {});
    await mgr.query(`UPDATE "transfers" SET "sourceShopId" = NULL WHERE "sourceShopId" = $1`, [id]).catch(() => {});
    await mgr.query(`UPDATE "transfers" SET "destinationShopId" = NULL WHERE "destinationShopId" = $1`, [id]).catch(() => {});
    try {
      await this.shopProductRepository.delete({ shop: { id } as any });
    } catch (_) {}

    await this.shopRepository.softDelete(id);
    await this.invalidateShopCache();
    await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.SHOP_DETAIL, id));
    await this.cacheService.del(CACHE_KEYS.SHOPS_LIST);
  }

  async findOneWithProducts(shopId: string, currentUser?: User) {
    if (currentUser) {
      const allowedShopIds = await this.getStaffAllowedShopIds(currentUser);
      if (allowedShopIds !== null && !allowedShopIds.includes(shopId)) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }
    const cacheKey = this.cacheService.generateKey(CACHE_KEYS.SHOP_DETAIL, 'products', shopId);
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const shop = await this.shopRepository.findOne({ where: { id: shopId }, relations: ['company'] });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }
    this.assertShopTenantAccess(shop, currentUser);

    const shopProducts = await this.shopProductRepository.find({
      where: { shop: { id: shopId } },
      relations: ['product'],
    });

    const data = shopProducts
      .filter((sp) => sp && sp.product && !(sp.product as any).deletedAt)
      .map((sp) => ({
        id: sp.product.id,
        name: sp.product.name,
        description: sp.product.description,
        price: Number(sp.product.price) || 0,
        type: sp.product.type,
        sku: sp.product.sku,
        category: sp.product.category,
        brand: (sp.product.metadata as any)?.brand || (sp.product.metadata as any)?.Brand || '',
        unit: sp.product.unit,
        barcode: sp.product.barcode,
        metadata: sp.product.metadata,
        cost: Number(sp.product.cost) || 0,
        status: sp.product.status,
        imageUrl: sp.product.imageUrl,
        minStockLevel: sp.product.minStockLevel,
        isExpired: sp.product.calculatedIsExpired,
        expiryDate: sp.product.expiryDate,
        stockQuantity: sp.stockQuantity,
      }));

    const result = { data };
    await this.cacheService.set(cacheKey, result, 5000);
    return result;
  }

  async getShopDashboard(shopId: string, currentUser?: User) {
    if (currentUser) {
      const allowedShopIds = await this.getStaffAllowedShopIds(currentUser);
      if (allowedShopIds !== null && !allowedShopIds.includes(shopId)) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }
    const shop = await this.shopRepository.findOne({ where: { id: shopId }, relations: ['company'] });
    if (!shop) throw new NotFoundException('Shop not found');
    this.assertShopTenantAccess(shop, currentUser);

    const spRepo = this.shopProductRepository;

    const result = await spRepo
      .createQueryBuilder('sp')
      .leftJoin('sp.product', 'product')
      .select('COUNT(DISTINCT sp.productId)', 'totalProducts')
      .addSelect('COALESCE(SUM(sp.stockQuantity), 0)', 'currentStock')
      .where('sp.shopId = :shopId', { shopId })
      .andWhere('product.deletedAt IS NULL')
      .getRawOne();

    const lowStockResult = await spRepo
      .createQueryBuilder('sp')
      .leftJoin('sp.product', 'product')
      .where('sp.shopId = :shopId', { shopId })
      .andWhere('sp.stockQuantity <= product.minStockLevel')
      .andWhere('product.minStockLevel > 0')
      .andWhere('product.deletedAt IS NULL')
      .getCount();

    return {
      totalProducts: parseInt(result?.totalProducts) || 0,
      currentStock: parseInt(result?.currentStock) || 0,
      lowStockProducts: lowStockResult,
    };
  }

  private createQueryBuilder(): SelectQueryBuilder<Shop> {
    return this.shopRepository.createQueryBuilder('shop')
      .leftJoin('shop.warehouse', 'warehouse')
      .leftJoin('shop.company', 'company')
      .select(['shop', 'warehouse.id', 'warehouse.name', 'company.name']);
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Shop>, query: ShopQueryDto): void {
    if (query.search) {
      queryBuilder.andWhere('shop.name ILIKE :search OR warehouse.name ILIKE :search', { search: `%${query.search}%` });
    }
    queryBuilder.orderBy('shop.createdAt', 'DESC');
  }

  private mapToResponseDto(
    shop: Shop,
    unitsInStock = 0,
    unitsStored = 0,
    managerName?: string
  ): ShopResponseDto {
    return {
      id: shop.id,
      name: shop.name,
      location: shop.location,
      warehouseName: shop.warehouse?.name || '',
      companyName: shop.company?.name || '',
      unitsInStock,
      unitsStored,
      managerName,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
    };
  }

  async attachProduct(shopId: string, attachProductDto: AttachProductDto, currentUser?: User): Promise<void> {
    const { productId, stockQuantity = 0 } = attachProductDto;
    const shop = await this.shopRepository.findOne({ where: { id: shopId }, relations: ['warehouse', 'company'] });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }
    this.assertShopTenantAccess(shop, currentUser);

    if (currentUser && currentUser.role === UserRole.SHOP_EMPLOYEE) {
      const allowedShopIds = await this.getStaffAllowedShopIds(currentUser);
      if (allowedShopIds !== null && !allowedShopIds.includes(shopId)) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }

    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const shopCompanyId = shop.companyId || shop.company?.id;
    if (product.companyId && shopCompanyId && product.companyId !== shopCompanyId) {
      throw new ForbiddenException('Product belongs to a different company');
    }

    const existing = await this.shopProductRepository.findOne({
      where: { shop: { id: shopId }, product: { id: productId } },
    });
    if (existing) {
      if (stockQuantity > 0) {
        existing.stockQuantity = stockQuantity;
      }
      if (attachProductDto.minStockLevel !== undefined && attachProductDto.minStockLevel > 0) {
        existing.minStockLevel = attachProductDto.minStockLevel;
      }
      await this.shopProductRepository.save(existing);
      await this.invalidateShopCache();
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
      if (shopId) {
        await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.SHOP_DETAIL, shopId));
      }
      return;
    }

    if (stockQuantity > 0 && shop.warehouse) {
      const wpRepo = this.shopRepository.manager.getRepository(WarehouseProduct);
      const wp = await wpRepo.findOne({
        where: { warehouse: { id: shop.warehouse.id }, product: { id: productId } },
      });
      if (wp) {
        const currentWh = wp.stockQuantity || wp.quantity || 0;
        const newWh = Math.max(0, currentWh - stockQuantity);
        wp.stockQuantity = newWh;
        wp.quantity = newWh;
        await wpRepo.save(wp);
      }
    }

    const shopProduct = this.shopProductRepository.create({
      shop,
      product,
      stockQuantity,
      minStockLevel: attachProductDto.minStockLevel || 0,
    });
    await this.shopProductRepository.save(shopProduct);
    await this.invalidateShopCache();
    await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
    if (shopId) {
      await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.SHOP_DETAIL, shopId));
    }
  }

  async detachProduct(shopId: string, productId: string, currentUser?: User): Promise<void> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId }, relations: ['company'] });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }
    this.assertShopTenantAccess(shop, currentUser);

    if (currentUser && currentUser.role === UserRole.SHOP_EMPLOYEE) {
      const allowedShopIds = await this.getStaffAllowedShopIds(currentUser);
      if (allowedShopIds !== null && !allowedShopIds.includes(shopId)) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }

    const result = await this.shopProductRepository.delete({
      shop: { id: shopId },
      product: { id: productId },
    });
    if (result.affected === 0) {
      throw new NotFoundException('Product not found in shop');
    }
    await this.invalidateShopCache();
  }

  private async invalidateShopCache(): Promise<void> {
    const deletedCount = await this.cacheService.deletePattern(`${CACHE_KEYS.SHOPS_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.SHOP_DETAIL}*`);
    this.logger.debug(`Cleared ${deletedCount} shop cache entries`);
  }
}