import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { Company } from '../company/entities/company.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Supplier } from '../collections/entities/supplier.entity';
import { ProductAlertService } from '../notifications/product-alert.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CacheService } from '../../shared/cache/cache.service';
import { ProductType } from './enums';
import { ProductQueryDto } from './dto';
import { createMockRepository } from '../../../test/setup';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<Repository<Product>>;
  let warehouseRepository: jest.Mocked<Repository<Warehouse>>;
  let warehouseProductRepository: jest.Mocked<Repository<WarehouseProduct>>;
  let cacheService: jest.Mocked<CacheService>;

  const mockProduct = {
    id: '1',
    name: 'Test Product',
    description: 'Test description',
    price: 100,
    sku: 'PROD-001',
    barcode: '12345678',
    type: 'STANDARD',
    trackStock: true,
    stockQuantity: 50,
    minStockLevel: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(WarehouseProduct),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(ShopProduct),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Company),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Warehouse),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Supplier),
          useValue: createMockRepository(),
        },
        {
          provide: ProductAlertService,
          useValue: {
            checkLowStock: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            deletePattern: jest.fn(),
            generateKey: jest.fn((...args: any[]) => args.join('_')),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repository = module.get(getRepositoryToken(Product));
    warehouseRepository = module.get(getRepositoryToken(Warehouse));
    warehouseProductRepository = module.get(getRepositoryToken(WarehouseProduct));
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new product successfully', async () => {
      const createProductDto = {
        name: 'New Product',
        price: 100,
        sku: 'NEW-001',
        type: ProductType.PRODUCT,
        category: 'Electronics',
        unit: 'pcs',
      };

      repository.findOne.mockResolvedValueOnce(null).mockResolvedValue(mockProduct as any);
      repository.create.mockReturnValue(mockProduct as any);
      repository.save.mockResolvedValue(mockProduct as any);
      cacheService.deletePattern.mockResolvedValue(1);

      const result = await service.create(createProductDto);

      expect(repository.create).toHaveBeenCalledWith(createProductDto);
      expect(repository.save).toHaveBeenCalledWith(mockProduct);
      expect(cacheService.deletePattern).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        name: mockProduct.name,
        price: mockProduct.price,
      }));
    });

    it('should throw ConflictException if SKU already exists', async () => {
      const createProductDto = {
        name: 'Existing SKU',
        price: 100,
        sku: 'EXIST-001',
        type: ProductType.PRODUCT,
        category: 'Electronics',
        unit: 'pcs',
      };

      repository.findOne.mockResolvedValue(mockProduct as any);

      await expect(service.create(createProductDto)).rejects.toThrow(ConflictException);
    });

    it('should attach a newly created product to the requested warehouse', async () => {
      const warehouseId = 'warehouse-1';
      const createProductDto = {
        name: 'Warehouse Product',
        price: 100,
        type: ProductType.PRODUCT,
        category: 'Electronics',
        unit: 'pcs',
        warehouseIds: [warehouseId],
      };

      const warehouse = { id: warehouseId };
      const warehouseProduct = { warehouse: { id: warehouseId }, product: mockProduct, stockQuantity: 10, minStockLevel: 2 };

      repository.findOne.mockResolvedValue(mockProduct as any);
      repository.create.mockReturnValue(mockProduct as any);
      repository.save.mockResolvedValue(mockProduct as any);
      warehouseRepository.findOne.mockResolvedValue(warehouse as any);
      warehouseProductRepository.create.mockReturnValue(warehouseProduct as any);
      warehouseProductRepository.save.mockResolvedValue(warehouseProduct as any);
      cacheService.deletePattern.mockResolvedValue(1);

      await service.create(createProductDto as any);

      expect(warehouseRepository.findOne).toHaveBeenCalledWith({ where: { id: warehouseId } });
      expect(warehouseProductRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        warehouse: { id: warehouseId },
        product: mockProduct,
      }));
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const query = Object.assign(new ProductQueryDto(), {
        page: 1,
        limit: 10,
        search: 'Test',
        companyId: 'company-1',
      });
      const mockProducts = [mockProduct];
      
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockProducts, mockProducts.length]),
      };

      // Mock cache miss
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue();
      
      repository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll(query);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('product');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: '%Test%' }
      );
      expect(result).toEqual(expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ name: mockProduct.name })
        ]),
        total: mockProducts.length,
      }));
    });
  });

  describe('findOne', () => {
    it('should find a product by ID', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue();
      repository.findOne.mockResolvedValue({ ...mockProduct, company: { id: 'company-1' } } as any);

      const result = await service.findOne('1', { companyId: 'company-1' } as any);

      expect(result).toEqual(expect.objectContaining({ name: mockProduct.name }));
    });

    it('should throw NotFoundException if product not found', async () => {
      cacheService.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1', { companyId: 'company-1' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // Add additional tests for update, remove, findByBarcode, etc.

});

