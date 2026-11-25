import { 
  Injectable, 
  NotFoundException, 
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Like, Between } from 'typeorm';
import * as XLSX from 'xlsx';
import { Product } from './entities/product.entity';
import { CommissionType } from './enums/commission-type.enum';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { Shop } from '../shops/entities/shops.entity';
import { Employee } from '../users/entities/employee.entity';
import { 
  CreateProductDto, 
  UpdateProductDto, 
  ProductQueryDto,
  ProductResponseDto
} from './dto';
import { ProductLocationDto } from './dto/product-location.dto';
import { ProductType, ProductStatus } from './enums';
import { PaginatedResult } from '../../common/interfaces';
import { CACHE_KEYS } from '../../common/constants';
import { CacheService } from '@/shared/cache/cache.service';
import { User } from '@/modules/users/entities/user.entity';
import { resolveEffectiveCompanyId } from '@/common/utils/tenant.util';
import { UserRole } from '@/common/enums';
import { Company } from '@/modules/company/entities/company.entity';
import { Supplier } from '@/modules/collections/entities/supplier.entity';
import { ProductAlertService } from '@/modules/notifications/product-alert.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(ShopProduct)
    private readonly shopProductRepository: Repository<ShopProduct>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly cacheService: CacheService,
    private readonly productAlertService: ProductAlertService,
  ) {}

  /**
   * Create a new product
   */
  async create(createProductDto: CreateProductDto, userId?: string, companyId?: string, user?: User): Promise<ProductResponseDto> {
    const isStaff = user && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.COMPANY_ADMIN;
    let allowedStaffWarehouseIds: string[] = [];

    if (isStaff) {
      const employeeRepo = this.productRepository.manager.getRepository(Employee);
      const employee = await employeeRepo.findOne({
        where: { user: { id: user.id } },
        relations: ['warehouse', 'shop', 'shop.warehouse'],
      });
      const perms = employee?.permissions || (user as any).permissions;
      const mp = perms?.modulePermissions;
      if (mp && (mp['addProduct'] === 'none' || mp['products'] === 'none')) {
        throw new ForbiddenException('You do not have permission to add products');
      }

      const allowedSet = new Set<string>();
      if (user.warehouseId) allowedSet.add(user.warehouseId);
      if (employee?.warehouse?.id) allowedSet.add(employee.warehouse.id);
      if (employee?.shop?.warehouse?.id) allowedSet.add(employee.shop.warehouse.id);
      const bp = perms?.branchPermissions;
      if (bp && typeof bp === 'object') {
        for (const [bId, access] of Object.entries(bp)) {
          if (access && typeof access === 'object' && (access as any).warehouse === true) {
            allowedSet.add(bId);
          }
        }
      }
      allowedStaffWarehouseIds = Array.from(allowedSet);

      const requestedWarehouseIds = createProductDto.warehouseIds ? [...createProductDto.warehouseIds] : [];
      if (createProductDto.warehouseId && !requestedWarehouseIds.includes(createProductDto.warehouseId)) {
        requestedWarehouseIds.push(createProductDto.warehouseId);
      }
      if (requestedWarehouseIds.length > 0) {
        const hasUnallowed = requestedWarehouseIds.some(id => !allowedStaffWarehouseIds.includes(id));
        if (hasUnallowed) {
          throw new ForbiddenException('You do not have permission to add products to the selected warehouse(s)');
        }
      }
    }

    // Clean empty SKU & Barcode so auto-generator assigns unique values instead of empty string unique constraint collisions
    if (!createProductDto.sku || !createProductDto.sku.trim()) {
      delete createProductDto.sku;
    } else {
      createProductDto.sku = createProductDto.sku.trim();
    }

    if (!createProductDto.barcode || !createProductDto.barcode.trim()) {
      delete createProductDto.barcode;
    } else {
      createProductDto.barcode = createProductDto.barcode.trim();
    }

    // Check for duplicate SKU within company (if companyId present) or globally
    if (createProductDto.sku) {
      const whereClause: any = { sku: createProductDto.sku };
      if (companyId) whereClause.company = { id: companyId };
      const existingProduct = await this.productRepository.findOne({ where: whereClause });
      if (existingProduct) {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        createProductDto.sku = `${createProductDto.sku}-${suffix}`;
      }
    }

    // Check for duplicate barcode within company (if companyId present) or globally
    if (createProductDto.barcode) {
      const whereClause: any = { barcode: createProductDto.barcode };
      if (companyId) whereClause.company = { id: companyId };
      const existingProduct = await this.productRepository.findOne({ where: whereClause });
      if (existingProduct) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        createProductDto.barcode = `${createProductDto.barcode}-${suffix}`;
      }
    }

    // Services don't track stock
    if (createProductDto.type === ProductType.SERVICE) {
      createProductDto.trackStock = false;
      createProductDto.stockQuantity = 0;
      createProductDto.minStockLevel = 0;
    }

    const commType = createProductDto.commissionType || CommissionType.PERCENT;
    const commRate = createProductDto.commissionRate || 0;
    const priceVal = createProductDto.price || 0;
    if (commType === CommissionType.PERCENT && commRate > 100) {
      throw new BadRequestException('Percentage commission rate cannot exceed 100%');
    }
    if (commType === CommissionType.FIXED && priceVal > 0 && commRate > priceVal) {
      throw new BadRequestException(`Fixed commission rate cannot exceed product price (ETB ${priceVal})`);
    }

    const product = this.productRepository.create(createProductDto);
    if (userId) {
      product.createdBy = { id: userId } as any;
    }
    if (companyId) {
      product.company = { id: companyId } as any;
    }
    if (createProductDto.supplierId) {
      product.supplier = { id: createProductDto.supplierId } as any;
    }

    const savedProduct = await this.productRepository.save(product);

    let targetWarehouseIds = createProductDto.warehouseIds ? [...createProductDto.warehouseIds] : [];
    if (createProductDto.warehouseId && !targetWarehouseIds.includes(createProductDto.warehouseId)) {
      targetWarehouseIds.push(createProductDto.warehouseId);
    }
    let targetShopIds = createProductDto.shopIds ? [...createProductDto.shopIds] : [];
    if (createProductDto.shopId && !targetShopIds.includes(createProductDto.shopId)) {
      targetShopIds.push(createProductDto.shopId);
    }

    if (targetWarehouseIds.length === 0 && targetShopIds.length === 0 && companyId) {
      try {
        if (isStaff && allowedStaffWarehouseIds.length === 1) {
          targetWarehouseIds = allowedStaffWarehouseIds;
        } else if (!isStaff) {
          const companyWarehouses = await this.warehouseRepository.find({ where: { company: { id: companyId } } });
          const companyShops = await this.shopProductRepository.manager.find(Shop, { where: { company: { id: companyId } } });
          // Only auto-assign if there is strictly 1 single location in the company
          if (companyWarehouses.length === 1 && companyShops.length === 0) {
            targetWarehouseIds = [companyWarehouses[0].id];
          } else if (companyWarehouses.length === 0 && companyShops.length === 1) {
            targetShopIds = [companyShops[0].id];
          }
          // When multiple warehouses or shops exist, products remain unassigned to locations
          // until explicitly stocked in or assigned to a specific branch.
        }
      } catch (e) {
        this.logger.warn(`Failed to fetch default company locations for product ${savedProduct.id}: ${e.message}`);
      }
    }

    // Assign to warehouses if specified
    if (targetWarehouseIds.length > 0) {
      for (const warehouseId of targetWarehouseIds) {
        try {
          const warehouse = await this.warehouseRepository.findOne({ where: { id: warehouseId } });
          if (warehouse) {
            const stockQty = createProductDto.stockQuantity || 0;
            const minStock = createProductDto.minStockLevel || 0;
            const warehouseProduct = this.warehouseProductRepository.create({
              warehouse,
              warehouseId,
              product: savedProduct,
              productId: savedProduct.id,
              quantity: stockQty,
              stockQuantity: stockQty,
              minStockLevel: minStock,
            });
            await this.warehouseProductRepository.save(warehouseProduct);
            this.logger.log(`Product ${savedProduct.id} assigned to warehouse ${warehouseId}`);
            try {
              await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.WAREHOUSE_DETAIL, 'products', warehouseId));
              await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSE_DETAIL}*${warehouseId}*`);
              await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSES_LIST}*`);
            } catch (_) {}
          } else {
            this.logger.warn(`Warehouse ${warehouseId} not found when assigning product ${savedProduct.id}`);
          }
        } catch (error) {
          this.logger.error(`Failed to assign product ${savedProduct.id} to warehouse ${warehouseId}: ${error.message}`, error.stack);
        }
      }
    }

    // Assign to shops if specified
    if (targetShopIds.length > 0) {
      for (const shopId of targetShopIds) {
        try {
          const shop = await this.shopProductRepository.manager.findOne(Shop, { 
            where: { id: shopId } 
          });
          if (shop) {
            const stockQty = createProductDto.stockQuantity || 0;
            const minStock = createProductDto.minStockLevel || 0;
            const shopProduct = this.shopProductRepository.create({
              shop: { id: shopId } as Shop,
              product: savedProduct,
              stockQuantity: stockQty,
              minStockLevel: minStock
            });
            await this.shopProductRepository.save(shopProduct);
          }
        } catch (error) {
          this.logger.warn(`Failed to assign product to shop ${shopId}:`, error.message);
        }
      }
    }

    // Clear cache
    await this.invalidateProductCache();
    for (const wId of targetWarehouseIds) {
      try {
        await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.WAREHOUSE_DETAIL, 'products', wId));
        await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSE_DETAIL}*${wId}*`);
      } catch (_) {}
    }

    return this.mapToResponseDto(
      await this.productRepository.findOne({
        where: { id: savedProduct.id },
        relations: ['company', 'supplier', 'warehouseProducts', 'warehouseProducts.warehouse', 'shopProducts', 'shopProducts.shop'],
      }),
    );
  }

  /**
   * Get all products with filtering and pagination
   */
  async findAll(query: ProductQueryDto, currentUser?: User): Promise<PaginatedResult<ProductResponseDto>> {
    const companyId = resolveEffectiveCompanyId(currentUser, query.companyId);
    if (!companyId) {
      return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    }

    const cacheKey = this.cacheService.generateKey(
      CACHE_KEYS.PRODUCTS_LIST,
      companyId,
      JSON.stringify(query)
    );
    
    // Try to get from cache with error handling
    try {
      const cached = await this.cacheService.get<PaginatedResult<ProductResponseDto>>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for products list`);
        return cached;
      }
    } catch (error) {
      this.logger.warn('Cache get failed, proceeding with database query:', error.message);
    }

    const queryBuilder = this.createQueryBuilder();
    queryBuilder.andWhere('company.id = :companyId', { companyId });

    // Apply filters
    this.applyFilters(queryBuilder, query);

    // Apply pagination
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [products, total] = await queryBuilder.getManyAndCount();

    const result: PaginatedResult<ProductResponseDto> = {
      data: products.map(product => this.mapToResponseDto(product)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };

    // Cache the result with error handling
    try {
      await this.cacheService.set(cacheKey, result, 300000);
    } catch (error) {
      this.logger.warn('Cache set failed:', error.message);
    }

    return result;
  }

  /**
   * Get product by ID
   */
  async findOne(id: string, currentUser?: User): Promise<ProductResponseDto> {
    const companyId = currentUser?.companyId;
    if (!companyId) {
      throw new NotFoundException('Product not found');
    }

    const cacheKey = this.cacheService.generateKey(CACHE_KEYS.PRODUCT_DETAIL, companyId, id);
    
    // Try to get from cache
    const cached = await this.cacheService.get<ProductResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product: ${id}`);
      return cached;
    }

    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['company', 'supplier', 'warehouseProducts', 'warehouseProducts.warehouse', 'shopProducts', 'shopProducts.shop'],
    });
    
    if (!product || product.company?.id !== companyId) {
      throw new NotFoundException('Product not found');
    }

    const result = this.mapToResponseDto(product);

    // Cache the result for 10 minutes
    await this.cacheService.set(cacheKey, result, 600000);

    return result;
  }

  /**
   * Update product
   */
  async update(id: string, updateProductDto: UpdateProductDto, currentUser?: User): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id }, relations: ['company'] });
    
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    if (!isSuperAdmin && currentUser?.companyId && product.company?.id !== currentUser.companyId) {
      throw new ForbiddenException('You do not have permission to update this product');
    }

    // Check for duplicate SKU (if updating)
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existingProduct = await this.productRepository.findOne({
        where: { sku: updateProductDto.sku }
      });
      if (existingProduct) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    // Check for duplicate barcode (if updating)
    if (updateProductDto.barcode && updateProductDto.barcode !== product.barcode) {
      const existingProduct = await this.productRepository.findOne({
        where: { barcode: updateProductDto.barcode }
      });
      if (existingProduct) {
        throw new ConflictException('Product with this barcode already exists');
      }
    }

    // Services don't track stock
    if (updateProductDto.type === ProductType.SERVICE) {
      updateProductDto.trackStock = false;
      updateProductDto.stockQuantity = 0;
      updateProductDto.minStockLevel = 0;
    }

    const commType = updateProductDto.commissionType || product.commissionType || CommissionType.PERCENT;
    const commRate = updateProductDto.commissionRate !== undefined ? updateProductDto.commissionRate : Number(product.commissionRate);
    const priceVal = updateProductDto.price !== undefined ? updateProductDto.price : Number(product.price);
    if (commType === CommissionType.PERCENT && commRate > 100) {
      throw new BadRequestException('Percentage commission rate cannot exceed 100%');
    }
    if (commType === CommissionType.FIXED && priceVal > 0 && commRate > priceVal) {
      throw new BadRequestException(`Fixed commission rate cannot exceed product price (ETB ${priceVal})`);
    }

    const previousQuantity = product.stockQuantity;
    Object.assign(product, updateProductDto);
    if (updateProductDto.supplierId) {
      product.supplier = { id: updateProductDto.supplierId } as any;
    }
    const updatedProduct = await this.productRepository.save(product);

    // Send low-stock SMS if the stock dropped to/below the minimum level
    await this.productAlertService.checkLowStock(updatedProduct, previousQuantity);

    // Invalidate caches
    await this.invalidateProductCache();
    await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*${id}`);

    return this.mapToResponseDto(
      await this.productRepository.findOne({
        where: { id },
        relations: ['company', 'supplier', 'warehouseProducts', 'warehouseProducts.warehouse', 'shopProducts', 'shopProducts.shop'],
      }),
    );
  }

  /**
   * Delete product (soft delete)
   */
  async remove(id: string, currentUser?: User): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id }, relations: ['company'] });
    
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    if (!isSuperAdmin && currentUser?.companyId && product.company?.id !== currentUser.companyId) {
      throw new ForbiddenException('You do not have permission to delete this product');
    }

    await this.productRepository.softDelete(id);
    try {
      await this.warehouseProductRepository.delete({ product: { id } as any });
      await this.shopProductRepository.delete({ product: { id } as any });
    } catch (_) {}

    // Invalidate caches
    await this.invalidateProductCache();
    await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*${id}`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.DASHBOARD_SUMMARY}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.SHOPS_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.SHOP_DETAIL}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSES_LIST}*`);
    await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSE_DETAIL}*`);
  }

  /**
   * Find product by barcode
   */
  async findByBarcode(barcode: string, currentUser?: User): Promise<ProductResponseDto> {
    const companyId = currentUser?.companyId;
    if (!companyId) {
      throw new NotFoundException('Product with this barcode not found');
    }

    const cacheKey = this.cacheService.generateKey(CACHE_KEYS.PRODUCT_DETAIL, 'barcode', companyId, barcode);
    
    // Try cache first
    const cached = await this.cacheService.get<ProductResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await this.productRepository.findOne({ 
      where: { barcode },
      relations: ['company', 'supplier'],
    });
    
    if (!product || product.company?.id !== companyId) {
      throw new NotFoundException('Product with this barcode not found');
    }

    const result = this.mapToResponseDto(product);
    
    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, result, 600000);

    return result;
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(currentUser?: User, companyId?: string): Promise<ProductResponseDto[]> {
    const effectiveCompanyId = resolveEffectiveCompanyId(currentUser, companyId);
    if (!effectiveCompanyId) {
      return [];
    }

    const cacheKey = this.cacheService.generateKey(CACHE_KEYS.PRODUCTS_LIST, effectiveCompanyId, 'low-stock');
    
    const cached = await this.cacheService.get<ProductResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.company', 'company')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .where('company.id = :companyId', { companyId: effectiveCompanyId })
      .andWhere('product.trackStock = :trackStock', { trackStock: true })
      .andWhere('product.stockQuantity <= product.minStockLevel')
      .andWhere('product.status = :status', { status: ProductStatus.AVAILABLE })
      .getMany();

    const result = products.map(product => this.mapToResponseDto(product));
    
    // Cache for 2 minutes (short TTL for stock data)
    await this.cacheService.set(cacheKey, result, 120000);

    return result;
  }

  /**
   * Get expired products
   */
  async getExpiredProducts(currentUser?: User, companyId?: string): Promise<ProductResponseDto[]> {
    const effectiveCompanyId = resolveEffectiveCompanyId(currentUser, companyId);
    if (!effectiveCompanyId) {
      return [];
    }

    const now = new Date();
    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.company', 'company')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .where('company.id = :companyId', { companyId: effectiveCompanyId })
      .andWhere('product.expiryDate IS NOT NULL')
      .andWhere('product.expiryDate < :now', { now })
      .andWhere('product.status = :status', { status: ProductStatus.AVAILABLE })
      .getMany();

    return products.map(product => this.mapToResponseDto(product));
  }

  /**
   * Bulk import products from Excel/CSV
   */
  async bulkImport(file: Express.Multer.File): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      for (const [index, row] of data.entries()) {
        try {
          const productData = this.validateImportRow(row as any, index + 2);
          await this.create(productData);
          success++;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }

      // Clear cache after bulk import
      await this.invalidateProductCache();

      return { success, errors };
    } catch (error) {
      throw new BadRequestException('Invalid file format');
    }
  }

  /**
   * Get product categories
   */
  async getCategories(currentUser?: User, companyId?: string): Promise<string[]> {
    const effectiveCompanyId = resolveEffectiveCompanyId(currentUser, companyId);
    if (!effectiveCompanyId) {
      return [];
    }

    const cacheKey = this.cacheService.generateKey(CACHE_KEYS.PRODUCTS_LIST, effectiveCompanyId, 'categories');
    
    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.productRepository
      .createQueryBuilder('product')
      .select('DISTINCT product.category', 'category')
      .leftJoin('product.company', 'company')
      .where('company.id = :companyId', { companyId: effectiveCompanyId })
      .andWhere('product.status = :status', { status: ProductStatus.AVAILABLE })
      .getRawMany();

    const categories = result.map(item => item.category).filter(Boolean);
    
    // Cache for 30 minutes
    await this.cacheService.set(cacheKey, categories, 1800000);

    return categories;
  }

  /**
   * Get product locations in warehouses and shops
   */
  async getProductLocations(productId: string, currentUser?: User): Promise<ProductLocationDto> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['company'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    if (!isSuperAdmin && currentUser?.companyId && product.company?.id !== currentUser.companyId) {
      throw new NotFoundException('Product not found');
    }

    const [warehouseProducts, shopProducts] = await Promise.all([
      this.warehouseProductRepository.find({
        where: { product: { id: productId } },
        relations: ['warehouse']
      }),
      this.shopProductRepository.find({
        where: { product: { id: productId } },
        relations: ['shop']
      })
    ]);

    return {
      warehouses: warehouseProducts.map(wp => ({
        id: wp.warehouse.id,
        name: wp.warehouse.name,
        location: wp.warehouse.location || '',
        stockQuantity: wp.stockQuantity,
        minStockLevel: wp.minStockLevel
      })),
      shops: shopProducts.map(sp => ({
        id: sp.shop.id,
        name: sp.shop.name,
        location: sp.shop.location || '',
        stockQuantity: sp.stockQuantity,
        minStockLevel: sp.minStockLevel
      }))
    };
  }

  /**
   * Get products created by a specific user
   */
  async getProductsByUser(userId: string, query: ProductQueryDto): Promise<PaginatedResult<ProductResponseDto>> {
    const queryBuilder = this.createQueryBuilder();
    
    // Filter by created user
    queryBuilder.where('product.createdBy = :userId', { userId });
    
    // Apply other filters
    this.applyFilters(queryBuilder, query);

    // Apply pagination
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [products, total] = await queryBuilder.getManyAndCount();

    const result: PaginatedResult<ProductResponseDto> = {
      data: products.map(product => this.mapToResponseDto(product)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };

    return result;
  }

  /**
   * Get products based on user's assigned location (warehouse/shop)
   */
  async getProductsByUserLocation(user: User, query: ProductQueryDto): Promise<PaginatedResult<ProductResponseDto>> {
    // Get products from user's assigned warehouse and shop
    const warehouseProducts = user.warehouse ? 
      await this.warehouseProductRepository.find({
        where: { warehouse: { id: user.warehouse.id } },
        relations: ['product']
      }) : [];

    const shopProducts = user.shop ? 
      await this.shopProductRepository.find({
        where: { shop: { id: user.shop.id } },
        relations: ['product']
      }) : [];

    const stockByProductId = new Map<string, { stockQuantity: number; minStockLevel: number }>();
    for (const wp of warehouseProducts) {
      stockByProductId.set(wp.product.id, { stockQuantity: wp.stockQuantity, minStockLevel: wp.minStockLevel });
    }
    for (const sp of shopProducts) {
      const existing = stockByProductId.get(sp.product.id);
      stockByProductId.set(sp.product.id, {
        stockQuantity: (existing?.stockQuantity ?? 0) + sp.stockQuantity,
        minStockLevel: Math.max(existing?.minStockLevel ?? 0, sp.minStockLevel),
      });
    }

    // Combine product IDs
    const productIds = [...stockByProductId.keys()];

    if (productIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: query.page || 1,
        limit: query.limit || 10,
        totalPages: 0
      };
    }

    // Query products with location context
    const queryBuilder = this.createQueryBuilder();
    queryBuilder.where('product.id IN (:...productIds)', { productIds });
    
    // Apply other filters
    this.applyFilters(queryBuilder, query);

    // Apply pagination
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    
    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      data: products.map(product => {
        const locationStock = stockByProductId.get(product.id);
        return this.mapToResponseDto(product, locationStock);
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get products in a specific warehouse
   */
  async getWarehouseProducts(warehouseId: string, query: ProductQueryDto, user: User): Promise<PaginatedResult<ProductResponseDto>> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
      relations: ['company'],
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
    if (!isSuperAdmin && user?.companyId && warehouse.company?.id !== user.companyId) {
      throw new NotFoundException('Warehouse not found');
    }
    const warehouseProducts = await this.warehouseProductRepository.find({
      where: { warehouse: { id: warehouseId } },
      relations: ['product']
    });

    const validWp = warehouseProducts.filter(wp => wp && wp.product && !(wp.product as any).deletedAt);

    const stockByProductId = new Map(
      validWp.map(wp => [wp.product.id, { stockQuantity: wp.stockQuantity, minStockLevel: wp.minStockLevel }]),
    );
    const productIds = validWp.map(wp => wp.product.id);

    if (productIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: query.page || 1,
        limit: query.limit || 10,
        totalPages: 0
      };
    }

    const queryBuilder = this.createQueryBuilder();
    queryBuilder.where('product.id IN (:...productIds)', { productIds });
    queryBuilder.andWhere('product.deletedAt IS NULL');
    
    this.applyFilters(queryBuilder, query);

    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      data: products.map(product => {
        const locationStock = stockByProductId.get(product.id);
        return this.mapToResponseDto(product, locationStock);
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get products in a specific shop
   */
  async getShopProducts(shopId: string, query: ProductQueryDto, user: User): Promise<PaginatedResult<ProductResponseDto>> {
    const shop: Shop | null = await this.shopProductRepository.manager.findOne(Shop, {
      where: { id: shopId },
      relations: ['company'],
    });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }
    if (user.companyId && shop.company?.id !== user.companyId) {
      throw new NotFoundException('Access denied to this shop');
    }

    const shopProducts = await this.shopProductRepository.find({
      where: { shop: { id: shopId } },
      relations: ['product']
    });

    const validSp = shopProducts.filter(sp => sp && sp.product && !(sp.product as any).deletedAt);

    const stockByProductId = new Map(
      validSp.map(sp => [sp.product.id, { stockQuantity: sp.stockQuantity, minStockLevel: sp.minStockLevel }]),
    );
    const productIds = validSp.map(sp => sp.product.id);

    if (productIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: query.page || 1,
        limit: query.limit || 10,
        totalPages: 0
      };
    }

    const queryBuilder = this.createQueryBuilder();
    queryBuilder.where('product.id IN (:...productIds)', { productIds });
    queryBuilder.andWhere('product.deletedAt IS NULL');
    
    this.applyFilters(queryBuilder, query);

    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      data: products.map(product => {
        const locationStock = stockByProductId.get(product.id);
        return this.mapToResponseDto(product, locationStock);
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Private helper methods
   */
  private createQueryBuilder(): SelectQueryBuilder<Product> {
    return this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.company', 'company')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .leftJoinAndSelect('product.warehouseProducts', 'warehouseProducts')
      .leftJoinAndSelect('warehouseProducts.warehouse', 'warehouse')
      .leftJoinAndSelect('product.shopProducts', 'shopProducts')
      .leftJoinAndSelect('shopProducts.shop', 'shop');
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Product>, 
    query: ProductQueryDto
  ): void {
    // Search filter
    if (query.search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    // Type filter
    if (query.type) {
      queryBuilder.andWhere('product.type = :type', { type: query.type });
    }

    // Category filter
    if (query.category) {
      queryBuilder.andWhere('product.category = :category', { category: query.category });
    }

    // Status filter
    if (query.status) {
      queryBuilder.andWhere('product.status = :status', { status: query.status });
    }

    // Price range filter
    if (query.minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice: query.maxPrice });
    }

    // Low stock filter
    if (query.lowStock) {
      queryBuilder.andWhere('product.trackStock = :trackStock', { trackStock: true });
      queryBuilder.andWhere('product.stockQuantity <= product.minStockLevel');
    }

    // Expired filter
    if (query.expired) {
      queryBuilder.andWhere('product.expiryDate < :now', { now: new Date() });
    }

    // Default ordering
    queryBuilder.orderBy('product.createdAt', 'DESC');
  }

  private validateImportRow(row: any, rowNumber: number): CreateProductDto {
    const requiredFields = ['name', 'unit', 'price', 'type'];
    
    for (const field of requiredFields) {
      if (!row[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate type
    if (!Object.values(ProductType).includes(row.type)) {
      throw new Error(`Invalid product type: ${row.type}`);
    }

    const warehouseId = row.warehouseId || row.warehouse || row.storeId;
    const shopId = row.shopId || row.shop;

    return {
      type: row.type,
      name: row.name,
      description: row.description,
      sku: row.sku,
      barcode: row.barcode,
      category: row.category,
      unit: row.unit,
      price: parseFloat(row.price),
      cost: row.cost ? parseFloat(row.cost) : 0,
      stockQuantity: row.stockQuantity ? parseInt(row.stockQuantity) : 0,
      minStockLevel: row.minStockLevel ? parseInt(row.minStockLevel) : 0,
      expiryDate: row.expiryDate,
      status: row.status || ProductStatus.AVAILABLE,
      imageUrl: row.imageUrl,
      taxRate: row.taxRate ? parseFloat(row.taxRate) : 0,
      trackStock: row.trackStock !== undefined ? row.trackStock : true,
      warehouseIds: row.warehouseIds || (warehouseId ? [warehouseId] : undefined),
      shopIds: row.shopIds || (shopId ? [shopId] : undefined),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined
    };
  }

  private mapToResponseDto(product: Product, overrides?: { stockQuantity?: number; minStockLevel?: number }): ProductResponseDto {
    const locations = [
      ...(product.warehouseProducts || []).map(wp => ({
        id: wp.warehouse?.id,
        name: wp.warehouse?.name || 'Warehouse',
        location: wp.warehouse?.location || '',
        quantity: wp.stockQuantity || wp.quantity || 0,
        type: 'Warehouse',
      })),
      ...(product.shopProducts || []).map(sp => ({
        id: sp.shop?.id,
        name: sp.shop?.name || 'Shop',
        location: sp.shop?.location || '',
        quantity: sp.stockQuantity || 0,
        type: 'Shop',
      })),
    ];

    const locationStockSum = locations.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const resolvedStockQuantity = overrides?.stockQuantity ?? (
      (product.stockQuantity && product.stockQuantity > 0)
        ? product.stockQuantity
        : (locations.length > 0 ? locationStockSum : (product.stockQuantity || 0))
    );

    return {
      id: product.id,
      type: product.type,
      name: product.name,
      description: product.description,
      sku: product.sku,
      barcode: product.barcode,
      category: product.category,
      unit: product.unit,
      price: Number(product.price) || 0,
      cost: Number(product.cost) || 0,
      expiryDate: product.expiryDate,
      status: product.status,
      metadata: product.metadata,
      imageUrl: product.imageUrl,
      taxRate: product.taxRate,
      commissionRate: product.commissionRate,
      commissionType: product.commissionType,
      trackStock: product.trackStock,
      profitMargin: product.profitMargin,
      isExpired: product.calculatedIsExpired,
      stockQuantity: resolvedStockQuantity,
      minStockLevel: overrides?.minStockLevel ?? product.minStockLevel,
      reminderDate: product.reminderDate,
      supplierId: product.supplier?.id,
      supplierName: product.supplier?.name,
      locations: locations.length > 0 ? locations : undefined,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  }

  private async invalidateProductCache(): Promise<void> {
    try {
      // Clear product, warehouse, and shop caches
      const deletedCount = await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSES_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSE_DETAIL}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.SHOPS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.SHOP_DETAIL}*`);
      this.logger.debug(`Cleared ${deletedCount} product cache entries`);
    } catch (error) {
      this.logger.warn('Failed to invalidate product cache:', error);
    }
  }
}