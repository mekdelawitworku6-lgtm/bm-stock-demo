import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { Product } from '../products/entities/product.entity';
import { WarehouseProduct } from './entities/warehouse-product.entity';
import { Company } from '../company/entities/company.entity';
import { CreateWarehouseDto, UpdateWarehouseDto, WarehouseQueryDto, WarehouseResponseDto, WarehouseDetailResponseDto, AttachProductDto } from './dto';
import { PaginatedResult } from '../../common/interfaces';
import { ProductResponseDto } from '../products/dto';
import { User } from '../users/entities/user.entity';
import { Shop } from '../shops/entities/shops.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { UserRole } from '@/common/enums';
import { Sales } from '../sales/entities/sales.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS } from '../../common/constants';
import { Employee } from '../users/entities/employee.entity';
import { assertStoreLimit } from '@/shared/subscription/subscription-plans.util';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
  ) {}

  async getStaffAllowedWarehouseIds(currentUser: User): Promise<string[] | null> {
    if (!currentUser || currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.COMPANY_ADMIN) {
      return null;
    }

    const employeeRepo = this.warehouseRepository.manager.getRepository(Employee);
    let employee: Employee | null = null;
    if ((currentUser as any).employeeId) {
      employee = await employeeRepo.findOne({
        where: { id: (currentUser as any).employeeId },
        relations: ['warehouse', 'shop', 'shop.warehouse', 'company'],
      });
    }
    if (!employee && currentUser.id) {
      employee = await employeeRepo.findOne({
        where: { user: { id: currentUser.id } },
        relations: ['warehouse', 'shop', 'shop.warehouse', 'company'],
      });
    }

    const allowedIds = new Set<string>();

    // 1. Primary assigned warehouse is ALWAYS allowed
    if (currentUser.warehouseId) {
      allowedIds.add(currentUser.warehouseId);
    }
    if (employee?.warehouse?.id) {
      allowedIds.add(employee.warehouse.id);
    }
    if (employee?.shop?.warehouse?.id) {
      allowedIds.add(employee.shop.warehouse.id);
    }

    // 2. Additional warehouses allowed via branchPermissions
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
          (typeof access === 'object' && ((access as any).warehouse === true || (access as any).warehouse === 'true'))
        );
        if (hasAccess) {
          allowedIds.add(branchId);
        }
      }
    }

    return Array.from(allowedIds);
  }

  async create(createWarehouseDto: CreateWarehouseDto, currentUser?: User): Promise<WarehouseResponseDto> {
    // Always scope new warehouses to the ACTIVE company (x-company-id), never
    // to a client-supplied companyId for non-platform admins.
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const companyId = isPlatformAdmin
      ? createWarehouseDto.companyId || (currentUser as any)?.companyId || (currentUser as any)?.company?.id
      : (currentUser as any)?.companyId || (currentUser as any)?.company?.id || createWarehouseDto.companyId;
    const { managerId, ...warehouseData } = createWarehouseDto;

    let company: Company | undefined;
    if (companyId) {
      company = await this.companyRepository.findOne({ where: { id: companyId }, relations: ['createdBy'] });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      // Enforce plan store limits (Small: 3, Medium: 5, Large: Unlimited)
      const currentCount = await this.warehouseRepository.count({
        where: { company: { id: companyId } },
      });
      const planUser = currentUser || company.createdBy;
      assertStoreLimit(planUser, currentCount);
    }

    let manager: User | null = null;
    if (managerId) {
      manager = await this.userRepository.findOne({ where: { id: managerId } });
      if (!manager) {
        throw new NotFoundException('Manager not found');
      }
      // A manager can only be attached to a warehouse of their own company.
      if (companyId && manager.companyId && manager.companyId !== companyId) {
        throw new ForbiddenException('Manager must belong to the same company as the warehouse');
      }
    }

    const warehouse = this.warehouseRepository.create({
      ...warehouseData,
      ...(company ? { company } : {}),
      ...(manager ? { manager } : {}),
    });

    const savedWarehouse = await this.warehouseRepository.save(warehouse);
    const warehouseWithRelations = await this.warehouseRepository.findOne({
      where: { id: savedWarehouse.id },
      relations: ['company', 'manager']
    });
    await this.invalidateWarehouseCache();
    return this.mapToResponseDto(warehouseWithRelations || savedWarehouse, 0, 0);
  }

  async findAll(query: WarehouseQueryDto, currentUser?: any): Promise<PaginatedResult<WarehouseResponseDto>> {
    const companyId = query.companyId || currentUser?.companyId || currentUser?.company?.id;

    const allowedWarehouseIds = await this.getStaffAllowedWarehouseIds(currentUser);
    if (allowedWarehouseIds !== null && allowedWarehouseIds.length === 0) {
      return { data: [], total: 0, page: query.page || 1, limit: query.limit || 10, totalPages: 0 };
    }

    const isStaff = allowedWarehouseIds !== null;
    const cacheKey = isStaff 
      ? this.cacheService.generateKey(CACHE_KEYS.WAREHOUSES_LIST, currentUser?.id || 'staff', JSON.stringify(query))
      : this.cacheService.generateKey(CACHE_KEYS.WAREHOUSES_LIST, companyId || 'all', JSON.stringify(query));

    const cached = await this.cacheService.get<PaginatedResult<WarehouseResponseDto>>(cacheKey);
    if (cached) return cached;

    const { page = 1, limit = 10, search } = query;
    const queryBuilder = this.warehouseRepository.createQueryBuilder('warehouse')
      .leftJoinAndSelect('warehouse.company', 'company')
      .leftJoinAndSelect('warehouse.manager', 'manager');
    if (allowedWarehouseIds !== null) {
      queryBuilder.andWhere('warehouse.id IN (:...allowedWarehouseIds)', { allowedWarehouseIds });
      if (query.companyId) {
        queryBuilder.andWhere('company.id = :companyId', { companyId: query.companyId });
      }
    } else if (companyId) {
      queryBuilder.andWhere('company.id = :companyId', { companyId });
    }
    if (search) {
      queryBuilder.andWhere('warehouse.name LIKE :search', { search: `%${search}%` });
    }
    const [warehouses, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const warehouseIds = warehouses.map(w => w.id);
    const stockMap = new Map<string, number>();
    const warehouseStockMap = new Map<string, number>();

    if (warehouseIds.length > 0) {
      const shopProductsRepository = this.warehouseRepository.manager.getRepository(ShopProduct);
      const shopStockAmounts = await shopProductsRepository
        .createQueryBuilder('sp')
        .leftJoin('sp.shop', 'shop')
        .select('shop.warehouseId', 'warehouseId')
        .addSelect('SUM(sp.stockQuantity)', 'sum')
        .where('shop.warehouseId IN (:...warehouseIds)', { warehouseIds })
        .groupBy('shop.warehouseId')
        .getRawMany();
      
      shopStockAmounts.forEach(row => {
        stockMap.set(row.warehouseId, Number(row.sum) || 0);
      });

      const warehouseProductsRepository = this.warehouseRepository.manager.getRepository(WarehouseProduct);
      const warehouseStockAmounts = await warehouseProductsRepository
        .createQueryBuilder('wp')
        .select('wp.warehouseId', 'warehouseId')
        .addSelect('SUM(wp.stockQuantity)', 'sum')
        .where('wp.warehouseId IN (:...warehouseIds)', { warehouseIds })
        .groupBy('wp.warehouseId')
        .getRawMany();
      
      warehouseStockAmounts.forEach(row => {
        warehouseStockMap.set(row.warehouseId, Number(row.sum) || 0);
      });
    }

    const result = {
      data: warehouses.map(w => this.mapToResponseDto(
        w,
        stockMap.get(w.id) || 0,
        warehouseStockMap.get(w.id) || 0
      )),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result, 300000);
    return result;
  }

  async findAllWithProducts(query: WarehouseQueryDto, currentUser: any): Promise<PaginatedResult<WarehouseDetailResponseDto>> {
    const companyId = query.companyId || currentUser?.companyId;
    const allowedWarehouseIds = await this.getStaffAllowedWarehouseIds(currentUser);
    if (allowedWarehouseIds !== null && allowedWarehouseIds.length === 0) {
      return { data: [], total: 0, page: query.page || 1, limit: query.limit || 10, totalPages: 0 };
    }
    if (allowedWarehouseIds === null && !companyId) {
      return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    }
    const { page = 1, limit = 10, search } = query;
    const queryBuilder = this.warehouseRepository.createQueryBuilder('warehouse')
      .leftJoinAndSelect('warehouse.products', 'products')
      .leftJoinAndSelect('products.product', 'product')
      .leftJoinAndSelect('warehouse.company', 'company');
    if (allowedWarehouseIds !== null) {
      queryBuilder.andWhere('warehouse.id IN (:...allowedWarehouseIds)', { allowedWarehouseIds });
      if (query.companyId) {
        queryBuilder.andWhere('company.id = :companyId', { companyId: query.companyId });
      }
    } else if (companyId) {
      queryBuilder.andWhere('company.id = :companyId', { companyId });
    }
    if (search) {
      queryBuilder.andWhere('warehouse.name LIKE :search', { search: `%${search}%` });
    }
    const [warehouses, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const warehouseIds = warehouses.map(w => w.id);
    const stockMap = new Map<string, number>();
    const warehouseStockMap = new Map<string, number>();

    if (warehouseIds.length > 0) {
      const shopProductsRepository = this.warehouseRepository.manager.getRepository(ShopProduct);
      const shopStockAmounts = await shopProductsRepository
        .createQueryBuilder('sp')
        .leftJoin('sp.shop', 'shop')
        .select('shop.warehouseId', 'warehouseId')
        .addSelect('SUM(sp.stockQuantity)', 'sum')
        .where('shop.warehouseId IN (:...warehouseIds)', { warehouseIds })
        .groupBy('shop.warehouseId')
        .getRawMany();
      
      shopStockAmounts.forEach(row => {
        stockMap.set(row.warehouseId, Number(row.sum) || 0);
      });

      const warehouseProductsRepository = this.warehouseRepository.manager.getRepository(WarehouseProduct);
      const warehouseStockAmounts = await warehouseProductsRepository
        .createQueryBuilder('wp')
        .select('wp.warehouseId', 'warehouseId')
        .addSelect('SUM(wp.stockQuantity)', 'sum')
        .where('wp.warehouseId IN (:...warehouseIds)', { warehouseIds })
        .groupBy('wp.warehouseId')
        .getRawMany();
      
      warehouseStockAmounts.forEach(row => {
        warehouseStockMap.set(row.warehouseId, Number(row.sum) || 0);
      });
    }

    return {
      data: warehouses.map(w => this.mapToDetailResponseDto(
        w,
        stockMap.get(w.id) || 0,
        warehouseStockMap.get(w.id) || 0
      )),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private assertWarehouseTenantAccess(warehouse: Warehouse, currentUser?: User): void {
    if (!currentUser) return;
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }
    const warehouseCompanyId = warehouse.company?.id;
    const userCompanyId = currentUser.companyId;
    const isOwner = warehouse.company?.createdById === currentUser.id;
    if (warehouseCompanyId && userCompanyId && warehouseCompanyId !== userCompanyId && !isOwner) {
      throw new NotFoundException('Warehouse not found');
    }
  }

  async findProductOfWarehouse(warehouseId: string, productId: string, currentUser?: User): Promise<WarehouseDetailResponseDto> {
    if (currentUser) {
      const allowedWarehouseIds = await this.getStaffAllowedWarehouseIds(currentUser);
      if (allowedWarehouseIds !== null && !allowedWarehouseIds.includes(warehouseId)) {
        throw new ForbiddenException('You do not have access to this warehouse');
      }
    }
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
      relations: ['products', 'products.product', 'company'],
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    this.assertWarehouseTenantAccess(warehouse, currentUser);

    const filteredProducts = warehouse.products.filter(
      wp => wp.product.id === productId
    );
    if (filteredProducts.length === 0) {
      throw new NotFoundException('Product not found in this warehouse');
    }
    const warehouseWithFilteredProduct = {
      ...warehouse,
      products: filteredProducts,
    };
    return this.mapToDetailResponseDto(warehouseWithFilteredProduct as Warehouse);
  }

  async findOne(id: string, currentUser?: User): Promise<WarehouseDetailResponseDto> {
    if (currentUser) {
      const allowedWarehouseIds = await this.getStaffAllowedWarehouseIds(currentUser);
      if (allowedWarehouseIds !== null && !allowedWarehouseIds.includes(id)) {
        throw new ForbiddenException('You do not have access to this warehouse');
      }
    }
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
      relations: ['products', 'products.product', 'company', 'manager'],
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    this.assertWarehouseTenantAccess(warehouse, currentUser);

    const shopProductsRepository = this.warehouseRepository.manager.getRepository(ShopProduct);
    const shopStockResult = await shopProductsRepository
      .createQueryBuilder('sp')
      .leftJoin('sp.shop', 'shop')
      .select('SUM(sp.stockQuantity)', 'sum')
      .where('shop.warehouseId = :warehouseId', { warehouseId: warehouse.id })
      .getRawOne();
    const unitsInStock = Number(shopStockResult?.sum) || 0;

    const warehouseProductsRepository = this.warehouseRepository.manager.getRepository(WarehouseProduct);
    const warehouseResult = await warehouseProductsRepository
      .createQueryBuilder('wp')
      .select('SUM(wp.stockQuantity)', 'sum')
      .where('wp.warehouseId = :warehouseId', { warehouseId: warehouse.id })
      .getRawOne();
    const unitsStored = Number(warehouseResult?.sum) || 0;

    return this.mapToDetailResponseDto(warehouse, unitsInStock, unitsStored);
  }

  async update(id: string, updateWarehouseDto: UpdateWarehouseDto, currentUser?: User): Promise<WarehouseResponseDto> {
    const warehouse = await this.warehouseRepository.findOne({ where: { id }, relations: ['company', 'manager'] });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    this.assertWarehouseTenantAccess(warehouse, currentUser);

    Object.assign(warehouse, updateWarehouseDto);
    const updatedWarehouse = await this.warehouseRepository.save(warehouse);
    const warehouseWithRelations = await this.warehouseRepository.findOne({
      where: { id: updatedWarehouse.id },
      relations: ['company', 'manager']
    });

    const shopProductsRepository = this.warehouseRepository.manager.getRepository(ShopProduct);
    const shopStockResult = await shopProductsRepository
      .createQueryBuilder('sp')
      .leftJoin('sp.shop', 'shop')
      .select('SUM(sp.stockQuantity)', 'sum')
      .where('shop.warehouseId = :warehouseId', { warehouseId: updatedWarehouse.id })
      .getRawOne();
    const unitsInStock = Number(shopStockResult?.sum) || 0;

    const warehouseProductsRepository = this.warehouseRepository.manager.getRepository(WarehouseProduct);
    const warehouseResult = await warehouseProductsRepository
      .createQueryBuilder('wp')
      .select('SUM(wp.stockQuantity)', 'sum')
      .where('wp.warehouseId = :warehouseId', { warehouseId: updatedWarehouse.id })
      .getRawOne();
    const unitsStored = Number(warehouseResult?.sum) || 0;

    return this.mapToResponseDto(warehouseWithRelations || updatedWarehouse, unitsInStock, unitsStored);
  }

  async remove(id: string, currentUser?: User): Promise<void> {
    const warehouse = await this.warehouseRepository.findOne({ where: { id }, relations: ['company'] });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    this.assertWarehouseTenantAccess(warehouse, currentUser);

    const mgr = this.warehouseRepository.manager;
    // Delete attached warehouse products first to prevent FK constraint errors
    try {
      await this.warehouseProductRepository.delete({ warehouse: { id } as any });
    } catch (_) {}

    // Null out foreign keys in related tables before deletion
    await mgr.query(`UPDATE "shops" SET "warehouseId" = NULL WHERE "warehouseId" = $1`, [id]).catch(() => {});
    await mgr.query(`UPDATE "employees" SET "warehouseId" = NULL WHERE "warehouseId" = $1`, [id]).catch(() => {});
    await mgr.query(`UPDATE "transfers" SET "sourceWarehouseId" = NULL WHERE "sourceWarehouseId" = $1`, [id]).catch(() => {});
    await mgr.query(`UPDATE "transfers" SET "destinationWarehouseId" = NULL WHERE "destinationWarehouseId" = $1`, [id]).catch(() => {});
    await mgr.query(`UPDATE "inventory_transactions" SET "warehouse_id" = NULL WHERE "warehouse_id" = $1`, [id]).catch(() => {});

    const result = await this.warehouseRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Warehouse not found');
    }
    await this.invalidateWarehouseCache();
  }

  async attachProduct(warehouseId: string, attachProductDto: AttachProductDto, currentUser?: User): Promise<void> {
    if (currentUser) {
      const allowedWarehouseIds = await this.getStaffAllowedWarehouseIds(currentUser);
      if (allowedWarehouseIds !== null && !allowedWarehouseIds.includes(warehouseId)) {
        throw new ForbiddenException('You do not have access to this warehouse');
      }
      if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.COMPANY_ADMIN) {
        const employeeRepo = this.warehouseRepository.manager.getRepository(Employee);
        const employee = await employeeRepo.findOne({ where: { user: { id: currentUser.id } } });
        const mp = employee?.permissions?.modulePermissions || (currentUser as any).permissions?.modulePermissions;
        if (mp && (mp['addProduct'] === 'none' || mp['products'] === 'none')) {
          throw new ForbiddenException('You do not have permission to add products');
        }
      }
    }
    const { productId } = attachProductDto;
    const warehouse = await this.warehouseRepository.findOne({ where: { id: warehouseId }, relations: ['company'] });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    this.assertWarehouseTenantAccess(warehouse, currentUser);

    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const warehouseCompanyId = warehouse.company?.id;
    if (product.companyId && warehouseCompanyId && product.companyId !== warehouseCompanyId) {
      throw new ForbiddenException('Product belongs to a different company');
    }
    let existing = await this.warehouseProductRepository.findOne({
      where: [
        { warehouse: { id: warehouseId }, product: { id: productId } },
        { warehouseId, productId },
      ],
    });
    if (existing) {
      existing.quantity = attachProductDto.stockQuantity !== undefined ? attachProductDto.stockQuantity : existing.quantity;
      existing.stockQuantity = attachProductDto.stockQuantity !== undefined ? attachProductDto.stockQuantity : existing.stockQuantity;
      if (attachProductDto.minStockLevel !== undefined) {
        existing.minStockLevel = attachProductDto.minStockLevel;
      }
      await this.warehouseProductRepository.save(existing);
      await this.invalidateWarehouseCache();
      try {
        await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.WAREHOUSE_DETAIL, 'products', warehouseId));
        await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSE_DETAIL}*${warehouseId}*`);
      } catch (_) {}
      return;
    }
    const warehouseProduct = this.warehouseProductRepository.create({
      warehouse,
      warehouseId,
      product,
      productId,
      quantity: attachProductDto.stockQuantity || 0,
      stockQuantity: attachProductDto.stockQuantity || 0,
      minStockLevel: attachProductDto.minStockLevel || 0, 
    });
    await this.warehouseProductRepository.save(warehouseProduct);
    await this.invalidateWarehouseCache();
    try {
      await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.WAREHOUSE_DETAIL, 'products', warehouseId));
      await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSE_DETAIL}*${warehouseId}*`);
    } catch (_) {}
  }

  async detachProduct(warehouseId: string, productId: string, currentUser?: User): Promise<void> {
    if (currentUser) {
      const warehouse = await this.warehouseRepository.findOne({ where: { id: warehouseId }, relations: ['company'] });
      if (!warehouse) {
        throw new NotFoundException('Warehouse not found');
      }
      this.assertWarehouseTenantAccess(warehouse, currentUser);
    }
    const result = await this.warehouseProductRepository.delete({
      warehouse: { id: warehouseId },
      product: { id: productId },
    });
    if (result.affected === 0) {
      throw new NotFoundException('Product not found in warehouse');
    }
    await this.invalidateWarehouseCache();
  }

  async updateProductStock(warehouseId: string, productId: string, stockQuantity: number): Promise<void> {
    const warehouseProduct = await this.warehouseProductRepository.findOne({
      where: { warehouse: { id: warehouseId }, product: { id: productId } },
    });
    if (!warehouseProduct) {
      throw new NotFoundException('Product not found in warehouse');
    }
    warehouseProduct.stockQuantity = stockQuantity;
    await this.warehouseProductRepository.save(warehouseProduct);
    await this.invalidateWarehouseCache();
  }

  async transferProducts(warehouseId: string, shopId: string, productId: string, quantity: number, user: User) {
    if (user.role !== UserRole.COMPANY_ADMIN) throw new ForbiddenException('Only company owners can transfer products');

    const warehouse = await this.warehouseRepository.findOne({ where: { id: warehouseId }, relations: ['products', 'company'] });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const shop = await this.shopRepository.findOne({ where: { id: shopId }, relations: ['warehouse'] });
    if (!shop) throw new NotFoundException('Shop not found');

    const warehouseProduct = await this.warehouseProductRepository.findOne({ where: { warehouse: { id: warehouseId }, product: { id: productId } } });
    if (!warehouseProduct || ((warehouseProduct.stockQuantity || 0) < quantity && (warehouseProduct.quantity || 0) < quantity)) {
      throw new NotFoundException('Insufficient product quantity in warehouse');
    }

    // Update warehouse product quantity & stockQuantity
    const currentWhQty = warehouseProduct.stockQuantity || warehouseProduct.quantity || 0;
    const newWhQty = Math.max(0, currentWhQty - quantity);
    warehouseProduct.stockQuantity = newWhQty;
    warehouseProduct.quantity = newWhQty;
    await this.warehouseProductRepository.save(warehouseProduct);

    // Update or create ShopProduct record
    const shopProductRepo = this.shopRepository.manager.getRepository(ShopProduct);
    let shopProduct = await shopProductRepo.findOne({
      where: { shop: { id: shopId }, product: { id: productId } }
    });
    if (shopProduct) {
      shopProduct.stockQuantity += quantity;
    } else {
      shopProduct = shopProductRepo.create({
        shop: { id: shopId } as Shop,
        product: { id: productId } as Product,
        stockQuantity: quantity,
      });
    }
    await shopProductRepo.save(shopProduct);

    await this.invalidateWarehouseCache();
    await this.cacheService.deletePattern(`${CACHE_KEYS.SHOPS_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.SHOP_DETAIL}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);

    return { message: 'Product transferred successfully' };
  }

  async recordSale(warehouseId: string, productId: string, quantity: number, revenue: number): Promise<void> {
    const warehouseProduct = await this.warehouseProductRepository.findOne({
      where: { warehouse: { id: warehouseId }, product: { id: productId } },
    });
    if (!warehouseProduct) {
      throw new NotFoundException('Product not found in warehouse');
    }
    if (warehouseProduct.stockQuantity < quantity) {
      throw new ConflictException('Insufficient stock');
    }
    warehouseProduct.stockQuantity -= quantity;
    warehouseProduct.salesQuantity = (warehouseProduct.salesQuantity || 0) + quantity;
    warehouseProduct.salesRevenue = (warehouseProduct.salesRevenue || 0) + revenue;
    warehouseProduct.lastSaleDate = new Date();
    await this.warehouseProductRepository.save(warehouseProduct);
  }

  async findOneWithProducts(warehouseId: string, currentUser?: User) {
    if (currentUser) {
      const allowedWarehouseIds = await this.getStaffAllowedWarehouseIds(currentUser);
      if (allowedWarehouseIds !== null && !allowedWarehouseIds.includes(warehouseId)) {
        throw new ForbiddenException('You do not have access to this warehouse');
      }
    }
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
      relations: ['company'],
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    this.assertWarehouseTenantAccess(warehouse, currentUser);

    const warehouseProducts = await this.warehouseProductRepository.find({
      where: [
        { warehouse: { id: warehouseId } },
        { warehouseId },
      ],
      relations: ['product', 'product.supplier'],
    });

    const data = warehouseProducts
      .filter((wp) => wp && !(wp as any).deletedAt && wp.product && !(wp.product as any).deletedAt)
      .map((wp) => {
        const prodDto = this.mapProductToResponseDto(wp.product);
        const qty = wp.stockQuantity !== undefined ? wp.stockQuantity : (wp.quantity || 0);
        return {
          ...prodDto,
          warehouseId,
          branchId: warehouseId,
          locationId: warehouseId,
          stockQuantity: qty,
          quantity: qty,
          minStockLevel: wp.minStockLevel !== undefined ? wp.minStockLevel : prodDto.minStockLevel,
        };
      });

    return {
      success: true,
      message: 'Success',
      data,
    };
  }

  async getWarehouseDashboard(warehouseId: string, currentUser?: User) {
    if (currentUser) {
      const allowedWarehouseIds = await this.getStaffAllowedWarehouseIds(currentUser);
      if (allowedWarehouseIds !== null && !allowedWarehouseIds.includes(warehouseId)) {
        throw new ForbiddenException('You do not have access to this warehouse');
      }
    }
    const warehouse = await this.warehouseRepository.findOne({ where: { id: warehouseId }, relations: ['company'] });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    this.assertWarehouseTenantAccess(warehouse, currentUser);

    const wpRepo = this.warehouseRepository.manager.getRepository(WarehouseProduct);

    const result = await wpRepo
      .createQueryBuilder('wp')
      .leftJoin('wp.product', 'product')
      .select('COUNT(DISTINCT wp.productId)', 'totalProducts')
      .addSelect('COALESCE(SUM(wp.stockQuantity), 0)', 'totalQuantity')
      .addSelect('COALESCE(SUM(wp.stockQuantity * product.cost), 0)', 'totalInventoryValue')
      .where('wp.warehouseId = :warehouseId', { warehouseId })
      .andWhere('wp.deletedAt IS NULL')
      .andWhere('product.deletedAt IS NULL')
      .getRawOne();

    const lowStockResult = await wpRepo
      .createQueryBuilder('wp')
      .leftJoin('wp.product', 'product')
      .where('wp.warehouseId = :warehouseId', { warehouseId })
      .andWhere('wp.deletedAt IS NULL')
      .andWhere('wp.stockQuantity <= product.minStockLevel')
      .andWhere('product.minStockLevel > 0')
      .andWhere('product.deletedAt IS NULL')
      .getCount();

    const salesRepo = this.warehouseRepository.manager.getRepository(Sales);
    const salesResult = await salesRepo
      .createQueryBuilder('sale')
      .select('COALESCE(SUM(sale.totalAmount), 0)', 'totalSales')
      .addSelect('COUNT(sale.id)', 'salesCount')
      .where('sale.warehouseId = :warehouseId', { warehouseId })
      .getRawOne();

    return {
      totalProducts: parseInt(result?.totalProducts) || 0,
      totalQuantity: parseInt(result?.totalQuantity) || 0,
      lowStockProducts: lowStockResult,
      totalInventoryValue: parseFloat(result?.totalInventoryValue) || 0,
      totalSales: parseFloat(salesResult?.totalSales) || 0,
      salesCount: parseInt(salesResult?.salesCount) || 0,
    };
  }

  private mapToResponseDto(
    warehouse: Warehouse,
    unitsInStock = 0,
    unitsStored = 0
  ): WarehouseResponseDto {
    return {
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location,
      description: warehouse.description,
      capacity: warehouse.capacity,
      companyName: warehouse.company?.name,
      managerName: warehouse.manager?.fullName,
      unitsInStock,
      unitsStored,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
    };
  }

  private mapToDetailResponseDto(
    warehouse: Warehouse,
    unitsInStock = 0,
    unitsStored = 0
  ): WarehouseDetailResponseDto {
    return {
      ...this.mapToResponseDto(warehouse, unitsInStock, unitsStored),
      products: warehouse.products
        ? warehouse.products
            .filter(wp => wp && wp.product)
            .map(wp => {
              const mapped = this.mapProductToResponseDto(wp.product);
              return {
                ...mapped,
                stockQuantity: wp.stockQuantity ?? wp.quantity ?? mapped.stockQuantity,
                minStockLevel: wp.minStockLevel ?? mapped.minStockLevel,
                warehouseProductId: wp.id,
              };
            })
        : [],
    };
  }

  private mapProductToResponseDto(product: Product): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price) || 0,
      type: product.type,
      sku: product.sku,
      category: product.category,
      unit: product.unit,
      barcode: product.barcode,
      metadata: product.metadata,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      cost: Number(product.cost) || 0,
      status: product.status,
      taxRate: product.taxRate,
      commissionRate: product.commissionRate,
      commissionType: product.commissionType,
      trackStock: product.trackStock,
      imageUrl: product.imageUrl,
      profitMargin: product.profitMargin,
      isExpired: product.calculatedIsExpired,
      expiryDate: product.expiryDate,
      reminderDate: product.reminderDate,
      stockQuantity: product.stockQuantity,
      minStockLevel: product.minStockLevel,
    };
  }

  private async invalidateWarehouseCache(): Promise<void> {
    const deletedCount = await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSES_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSE_DETAIL}*`);
    this.logger.debug(`Cleared ${deletedCount} warehouse cache entries`);
  }
}