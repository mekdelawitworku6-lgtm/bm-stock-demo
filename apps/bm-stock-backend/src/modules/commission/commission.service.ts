import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Commission } from './entities/commission.entity';
import { User } from '../users/entities/user.entity';
import { Employee } from '../users/entities/employee.entity';
import { Product } from '../products/entities/product.entity';
import { Sales } from '../sales/entities/sales.entity';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { UpdateCommissionDto } from './dto/update-commision.dto';
import { UserRole } from '@/common/enums';

@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Sales)
    private readonly salesRepository: Repository<Sales>,
  ) {}

  async create(createCommissionDto: CreateCommissionDto): Promise<Commission> {
    const { employeeId, productId, saleId, commissionRate, commissionAmount } = createCommissionDto;
    const employee = await this.employeeRepository.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const sale = await this.salesRepository.findOne({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');

    const commission = this.commissionRepository.create({
      employee,
      product,
      sale,
      commissionRate,
      commissionAmount,
      amount: commissionAmount,
      commissionDate: new Date(),
    });
    return this.commissionRepository.save(commission);
  }

  async findAll(currentUser?: User, productId?: string): Promise<any[]> {
    const qb = this.commissionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'employeeUser')
      .leftJoinAndSelect('employee.company', 'employeeCompany')
      .leftJoinAndSelect('commission.product', 'product')
      .leftJoinAndSelect('commission.sale', 'sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'itemProduct')
      .leftJoinAndSelect('sale.createdBy', 'saleCreatedBy')
      .leftJoinAndSelect('sale.warehouse', 'warehouse')
      .leftJoinAndSelect('sale.shop', 'shop')
      .orderBy('commission.commissionDate', 'DESC')
      .addOrderBy('commission.createdAt', 'DESC');

    const effectiveCompanyId = (currentUser as any)?.companyId || currentUser?.company?.id;
    if (
      effectiveCompanyId &&
      currentUser?.role !== UserRole.SUPER_ADMIN &&
      currentUser?.role !== UserRole.ADMIN
    ) {
      qb.andWhere(
        '(employeeCompany.id = :companyId OR warehouse.companyId = :companyId OR shop.companyId = :companyId)',
        { companyId: effectiveCompanyId },
      );
    }

    if (productId) {
      qb.andWhere('product.id = :productId', { productId });
    }

    const commissions = await qb.getMany();
    return commissions.map((c) => this.mapToDto(c));
  }

  private mapToDto(c: Commission): any {
    const item = c.sale?.items?.find((i) => i.product?.id === c.product?.id || (i as any)?.productId === c.product?.id) || c.sale?.items?.[0];
    const resolvedProduct = c.product || item?.product;

    const resolvedSalesperson =
      c.employee?.name ||
      (c.employee?.user ? `${c.employee.user.firstName || ''} ${c.employee.user.lastName || ''}`.trim() : null) ||
      (c.sale?.createdBy ? `${c.sale.createdBy.firstName || ''} ${c.sale.createdBy.lastName || ''}`.trim() : null) ||
      'Staff';

    const resolvedProductName = resolvedProduct?.name || 'Product';
    const resolvedQuantity = item?.quantity != null ? Number(item.quantity) : 1;
    const resolvedUnitPrice = item?.unitPrice != null ? Number(item.unitPrice) : (resolvedProduct?.price != null ? Number(resolvedProduct.price) : 0);
    const resolvedLineTotal = item?.total != null ? Number(item.total) : (resolvedQuantity * resolvedUnitPrice);
    const resolvedSaleTotal = Number(c.sale?.totalAmount || resolvedLineTotal || c.amount || 0);
    const resolvedCustomer = c.sale?.customer;

    return {
      id: c.id,
      amount: Number(c.amount || c.commissionAmount || 0),
      commissionRate: Number(c.commissionRate || 0),
      commissionAmount: Number(c.commissionAmount || c.amount || 0),
      commissionDate: c.commissionDate,
      createdAt: c.createdAt,
      isApproved: Boolean(c.isApproved),
      approvedAt: c.approvedAt,
      approvedBy: c.approvedBy,
      salespersonName: resolvedSalesperson,
      productName: resolvedProductName,
      productSku: resolvedProduct?.sku || '',
      saleAmount: resolvedSaleTotal,
      quantity: resolvedQuantity,
      unitPrice: resolvedUnitPrice,
      lineTotal: resolvedLineTotal,
      customerName: resolvedCustomer?.name || 'Walk-in',
      customerPhone: resolvedCustomer?.phoneNumber || '',
      invoiceNumber: c.sale?.invoiceNumber || 'POS',
      product: resolvedProduct
        ? {
            id: resolvedProduct.id,
            name: resolvedProduct.name,
            sku: resolvedProduct.sku,
            price: resolvedProduct.price,
          }
        : null,
      employee: c.employee
        ? {
            id: c.employee.id,
            name: c.employee.name || resolvedSalesperson,
            jobTitle: c.employee.jobTitle,
            phoneNumber: c.employee.phoneNumber,
            baseCommissionRate: c.employee.baseCommissionRate,
          }
        : {
            id: 'unassigned',
            name: resolvedSalesperson,
            jobTitle: 'Staff',
            phoneNumber: '',
            baseCommissionRate: 0,
          },
      sale: c.sale
        ? {
            id: c.sale.id,
            invoiceNumber: c.sale.invoiceNumber,
            saleDate: c.sale.saleDate,
            totalAmount: c.sale.totalAmount,
            subtotal: c.sale.subtotal,
            taxAmount: c.sale.taxAmount,
            discountAmount: c.sale.discountAmount,
            paymentType: c.sale.paymentType,
            status: c.sale.status,
            customer: resolvedCustomer
              ? { id: resolvedCustomer.id, name: resolvedCustomer.name, phoneNumber: resolvedCustomer.phoneNumber }
              : null,
            item: item
              ? {
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                }
              : {
                  quantity: resolvedQuantity,
                  unitPrice: resolvedUnitPrice,
                  total: resolvedLineTotal,
                },
            items: c.sale.items?.map((it) => ({
              productName: it.product?.name,
              sku: it.product?.sku,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.total,
            })),
          }
        : null,
    };
  }

  async findByEmployee(employeeId: string): Promise<Commission[]> {
    return this.commissionRepository.find({
      where: { employee: { id: employeeId } },
      relations: ['employee', 'product', 'sale'],
    });
  }

  async findBySale(saleId: string): Promise<Commission[]> {
    return this.commissionRepository.find({
      where: { sale: { id: saleId } },
      relations: ['employee', 'product', 'sale'],
    });
  }

  /**
   * Update a commission's rate/amount. Company admins can only edit commissions
   * belonging to employees within their own company.
   */
  async update(id: string, dto: UpdateCommissionDto, currentUser: User): Promise<any> {
    if (!currentUser || (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.COMPANY_ADMIN)) {
      throw new ForbiddenException('Only admins can edit commissions');
    }

    const commission = await this.commissionRepository.findOne({
      where: { id },
      relations: ['employee', 'employee.company', 'product', 'sale'],
    });
    if (!commission) throw new NotFoundException('Commission not found');

    // Company Admin can only edit commissions within their company
    if (currentUser.role === UserRole.COMPANY_ADMIN) {
      if (!commission.employee?.company || commission.employee.company.id !== currentUser.company?.id) {
        throw new ForbiddenException('Company Admin can only edit commissions within their company');
      }
    }

    if (dto.commissionRate !== undefined) {
      commission.commissionRate = dto.commissionRate;
    }
    if (dto.commissionAmount !== undefined) {
      commission.commissionAmount = dto.commissionAmount;
      commission.amount = dto.commissionAmount;
    }

    const saved = await this.commissionRepository.save(commission);
    return this.mapToDto(saved);
  }

  /**
   * Approve multiple commissions
   */
  async approveCommissions(commissionIds: string[], approvedBy: User): Promise<Commission[]> {
    if (!approvedBy || (approvedBy.role !== UserRole.SUPER_ADMIN && approvedBy.role !== UserRole.COMPANY_ADMIN)) {
      throw new ForbiddenException('Only admins can approve commissions');
    }

    const commissions = await this.commissionRepository.find({
      where: { id: In(commissionIds) },
      relations: ['employee', 'employee.company']
    });

    if (commissions.length === 0) {
      throw new NotFoundException('No commissions found');
    }

    // Company Admin can only approve commissions within their company
    if (approvedBy.role === UserRole.COMPANY_ADMIN) {
      const companyId = approvedBy.company?.id || (approvedBy as any).companyId;
      if (companyId) {
        const invalidCommissions = commissions.filter(c => 
          c.employee?.company && c.employee.company.id !== companyId
        );
        if (invalidCommissions.length > 0) {
          throw new ForbiddenException('Company Admin can only approve commissions within their company');
        }
      }
    }

    // Update commissions with approval
    const updatedCommissions = commissions.map(commission => ({
      ...commission,
      isApproved: true,
      approvedBy: approvedBy.id,
      approvedAt: new Date()
    }));

    return this.commissionRepository.save(updatedCommissions);
  }

  /**
   * Get commission report for an employee
   */
  async getCommissionReport(employeeId: string, dateRange: { startDate: Date, endDate: Date }): Promise<any> {
    const commissions = await this.commissionRepository.find({
      where: {
        employee: { id: employeeId },
        commissionDate: Between(dateRange.startDate, dateRange.endDate)
      },
      relations: [
        'employee',
        'employee.user',
        'product',
        'sale',
        'sale.customer',
        'sale.items',
        'sale.items.product',
      ],
      order: { commissionDate: 'DESC' }
    });

    const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
    const approvedCommissions = commissions.filter(c => c.isApproved);
    const totalApproved = approvedCommissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
    const pendingCommissions = commissions.filter(c => !c.isApproved);
    const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);

    return {
      employeeId,
      dateRange,
      summary: {
        totalCommissions: commissions.length,
        totalAmount: totalCommissions,
        approvedAmount: totalApproved,
        pendingAmount: totalPending,
        approvedCount: approvedCommissions.length,
        pendingCount: pendingCommissions.length
      },
      commissions: commissions.map(c => this.mapToDto(c))
    };
  }

  /**
   * Get pending commissions for approval
   */
  async getPendingCommissions(currentUser: User): Promise<any[]> {
    const qb = this.commissionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'employeeUser')
      .leftJoinAndSelect('employee.company', 'employeeCompany')
      .leftJoinAndSelect('commission.product', 'product')
      .leftJoinAndSelect('commission.sale', 'sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'itemProduct')
      .leftJoinAndSelect('sale.createdBy', 'saleCreatedBy')
      .leftJoinAndSelect('sale.warehouse', 'warehouse')
      .leftJoinAndSelect('sale.shop', 'shop')
      .where('commission.isApproved = :isApproved', { isApproved: false })
      .orderBy('commission.commissionDate', 'DESC');

    const effectiveCompanyId = (currentUser as any)?.companyId || currentUser?.company?.id;
    if (
      effectiveCompanyId &&
      currentUser?.role !== UserRole.SUPER_ADMIN &&
      currentUser?.role !== UserRole.ADMIN
    ) {
      qb.andWhere(
        '(employeeCompany.id = :companyId OR warehouse.companyId = :companyId OR shop.companyId = :companyId)',
        { companyId: effectiveCompanyId },
      );
    }

    const commissions = await qb.getMany();
    return commissions.map((c) => this.mapToDto(c));
  }
}
