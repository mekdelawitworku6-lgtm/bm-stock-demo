import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { Supplier } from './entities/supplier.entity';
import { ProductGroup } from './entities/product-group.entity';
import { CreateBranchDto, UpdateBranchDto, BranchQueryDto, BranchResponseDto } from './dto/branch.dto';
import { CreateSupplierDto, UpdateSupplierDto, SupplierQueryDto, SupplierResponseDto } from './dto/supplier.dto';
import { CreateProductGroupDto, UpdateProductGroupDto, ProductGroupQueryDto, ProductGroupResponseDto, AddProductsToGroupDto, RemoveProductsFromGroupDto } from './dto/product-group.dto';
import { PaginatedResult } from '@/common/interfaces';
import { Product } from '../products/entities/product.entity';
import { Company } from '../company/entities/company.entity';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(ProductGroup)
    private readonly productGroupRepository: Repository<ProductGroup>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  // Branch Management
  async createBranch(createBranchDto: CreateBranchDto, companyId?: string): Promise<BranchResponseDto> {
    const existing = await this.branchRepository.findOne({ where: { name: createBranchDto.name } });
    if (existing) {
      throw new ConflictException('Branch with this name already exists');
    }
    const branch = this.branchRepository.create(createBranchDto);
    if (companyId) {
      branch.company = { id: companyId } as Company;
    }
    await this.branchRepository.save(branch);
    return this.mapToDto(branch, BranchResponseDto);
  }

  async findAllBranches(query: BranchQueryDto, companyId?: string): Promise<PaginatedResult<BranchResponseDto>> {
    if (!companyId) {
      return { data: [], total: 0, page: query.page, limit: query.limit, totalPages: 0 };
    }
    const queryBuilder = this.branchRepository.createQueryBuilder('branch')
      .leftJoin('branch.company', 'company')
      .where('company.id = :companyId', { companyId });

    if (query.search) {
      queryBuilder.andWhere('(branch.name LIKE :search OR branch.address LIKE :search)', { search: `%${query.search}%` });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('branch.isActive = :isActive', { isActive: query.isActive });
    }

    queryBuilder.skip(query.skip).take(query.limit);
    const [data, total] = await queryBuilder.getManyAndCount();
    return { data: data.map(b => this.mapToDto(b, BranchResponseDto)), total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  // Supplier Management
  async createSupplier(createSupplierDto: CreateSupplierDto, companyId?: string): Promise<SupplierResponseDto> {
    const existing = await this.supplierRepository.findOne({ where: { name: createSupplierDto.name } });
    if (existing) {
      throw new ConflictException('Supplier with this name already exists');
    }
    const supplier = this.supplierRepository.create(createSupplierDto);
    if (companyId) {
      supplier.company = { id: companyId } as Company;
    }
    await this.supplierRepository.save(supplier);
    return this.mapToDto(supplier, SupplierResponseDto);
  }

  async findAllSuppliers(query: SupplierQueryDto, companyId?: string): Promise<PaginatedResult<SupplierResponseDto>> {
    if (!companyId) {
      return { data: [], total: 0, page: query.page, limit: query.limit, totalPages: 0 };
    }
    const queryBuilder = this.supplierRepository.createQueryBuilder('supplier')
      .leftJoin('supplier.company', 'company')
      .where('company.id = :companyId', { companyId });

    if (query.search) {
      queryBuilder.andWhere('(supplier.name LIKE :search OR supplier.contact LIKE :search)', { search: `%${query.search}%` });
    }
    if (query.status) {
      queryBuilder.andWhere('supplier.status = :status', { status: query.status });
    }

    queryBuilder.skip(query.skip).take(query.limit);
    const [data, total] = await queryBuilder.getManyAndCount();
    return { data: data.map(s => this.mapToDto(s, SupplierResponseDto)), total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  // Product Group Management
  async createProductGroup(createProductGroupDto: CreateProductGroupDto, companyId?: string): Promise<ProductGroupResponseDto> {
    const { productIds, ...groupData } = createProductGroupDto;
    const group = this.productGroupRepository.create(groupData);
    if (companyId) {
      group.company = { id: companyId } as Company;
    }

    if (productIds && productIds.length > 0) {
      const products = await this.productRepository.findByIds(productIds);
      group.products = products;
    }

    await this.productGroupRepository.save(group);
    return this.mapToDto(group, ProductGroupResponseDto);
  }

  async findAllProductGroups(query: ProductGroupQueryDto, companyId?: string): Promise<PaginatedResult<ProductGroupResponseDto>> {
    if (!companyId) {
      return { data: [], total: 0, page: query.page, limit: query.limit, totalPages: 0 };
    }
    const queryBuilder = this.productGroupRepository.createQueryBuilder('productGroup')
      .leftJoin('productGroup.company', 'company')
      .where('company.id = :companyId', { companyId });

    if (query.search) {
      queryBuilder.andWhere('(productGroup.name LIKE :search OR productGroup.code LIKE :search)', { search: `%${query.search}%` });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('productGroup.isActive = :isActive', { isActive: query.isActive });
    }

    queryBuilder.skip(query.skip).take(query.limit);
    const [data, total] = await queryBuilder.getManyAndCount();
    return { data: data.map(g => this.mapToDto(g, ProductGroupResponseDto)), total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  // Generic DTO Mapper
  private mapToDto<T, D>(source: T, dtoClass: new () => D): D {
    const dto = new dtoClass();
    Object.assign(dto, source);
    return dto;
  }
}
