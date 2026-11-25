import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, DataSource } from 'typeorm';
import { CreateSaleDto, UpdateSaleDto, SaleQueryDto, SaleResponseDto, ReportQueryDto } from './dto';
import { ReportPeriod, ReportLocationType } from './dto/report-query.dto';
import { PaginatedResult } from '../../common/interfaces';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS } from '../../common/constants';
import { Sales } from './entities/sales.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { CommissionType } from '../products/enums/commission-type.enum';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { User } from '../users/entities/user.entity';
import { SaleItem } from './entities/sales-item.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { Discount } from './entities/discount.entity';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { PaymentType, SaleStatus, TransactionType, DiscountType } from './enums';
import { UserRole } from '../../common/enums';
import { CommissionService } from '../commission/commission.service';
import { Employee } from '../users/entities/employee.entity';
import { Company } from '../company/entities/company.entity';
import { CreatePaymentTransactionDto, PaymentTransactionResponseDto } from './dto/payment-transaction.dto';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { NotificationService } from '../notifications/notification.service';
import { ProductAlertService } from '../notifications/product-alert.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { BankExpense } from '../bank/entities/bank-expense.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { InventoryTransaction, InventoryTransactionType } from '../inventory/entities/inventory-transaction.entity';
import { Commission } from '../commission/entities/commission.entity';
import { CreditAccount, CreditPayment, CreditStatus } from '../credits/entities/credit.entity';
import { ProductBorrowing } from '../borrowing/entities/product-borrowing.entity';
import { resolveEffectiveCompanyId } from '@/common/utils/tenant.util';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Sales)
    private readonly salesRepository: Repository<Sales>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(ShopProduct)
    private readonly shopProductRepository: Repository<ShopProduct>,
    private readonly cacheService: CacheService,
    private readonly commissionService: CommissionService,
    private readonly notificationService: NotificationService,
    private readonly productAlertService: ProductAlertService,
  ) {}

  async create(createSaleDto: CreateSaleDto, currentUser?: any): Promise<SaleResponseDto> {
    const { customerId, items, paymentType, saleDate, note, advancePayment, dueDate, reminderDate, referenceNumber } = createSaleDto;
    
    // Find customer with fallback
    let customer: Customer | null = null;
    if (customerId) {
      customer = await this.customerRepository.findOne({ where: { id: customerId } });
    }
    if (!customer) {
      const companyId = currentUser?.companyId;
      if (companyId) {
        customer = await this.customerRepository.findOne({
          where: { name: 'Walk-in Customer', company: { id: companyId } }
        });
      }
      if (!customer) {
        customer = await this.customerRepository.findOne({
          where: { name: 'Walk-in Customer' }
        });
      }
      if (!customer) {
        customer = await this.customerRepository.save(
          this.customerRepository.create({
            name: 'Walk-in Customer',
            phoneNumber: '0000000000',
            company: companyId ? { id: companyId } as Company : undefined,
          })
        );
      }
    }

    // Get employee record for the current user (if exists)
    const userId = currentUser?.id || createSaleDto.createdBy;
    const effectiveEmpId = (currentUser as any)?.employeeId || (currentUser as any)?.employee?.id;
    let employee = effectiveEmpId
      ? await this.employeeRepository.findOne({
          where: { id: effectiveEmpId },
          relations: ['company', 'shop', 'warehouse', 'user', 'warehouse.company', 'shop.company'],
        })
      : null;
    if (!employee && userId) {
      employee = await this.employeeRepository.findOne({ 
        where: { user: { id: userId } },
        relations: ['company', 'shop', 'warehouse', 'user', 'warehouse.company', 'shop.company'],
      });
    }

    // Auto-determine warehouse and shop from payload or employee assignment
    let warehouse: Warehouse | null = null;
    let shop: Shop | null = null;
    const saleCompanyId = currentUser?.companyId || (currentUser as any)?.company?.id;

    if (createSaleDto.shopId) {
      const candidateShop = await this.shopRepository.findOne({
        where: { id: createSaleDto.shopId },
        relations: ['company'],
      });
      if (candidateShop && (!saleCompanyId || candidateShop.company?.id === saleCompanyId)) {
        shop = candidateShop;
      }
    } else if (employee?.shop) {
      shop = employee.shop;
    }

    if (!shop && createSaleDto.warehouseId) {
      const candidateWarehouse = await this.warehouseRepository.findOne({
        where: { id: createSaleDto.warehouseId },
        relations: ['company'],
      });
      if (candidateWarehouse && (!saleCompanyId || candidateWarehouse.company?.id === saleCompanyId)) {
        warehouse = candidateWarehouse;
      }
    } else if (!shop && employee?.warehouse) {
      warehouse = employee.warehouse;
    }

    // Fall back to the first warehouse within the ACTIVE company only. Never
    // fall back to an arbitrary warehouse, which would leak another company's
    // sales/stock into this tenant.
    if (!shop && !warehouse && saleCompanyId) {
      warehouse = await this.warehouseRepository.findOne({
        where: { company: { id: saleCompanyId } },
        relations: ['company'],
        order: { createdAt: 'ASC' },
      });
    }

    const sales = this.salesRepository.create({
      customer,
      warehouse,
      shop,
      paymentType,
      saleDate: saleDate || new Date(),
      dueDate: dueDate || undefined,
      reminderDate: reminderDate || undefined,
      note,
      referenceNumber,
      advancePayment: advancePayment || 0,
      receiptImageUrl: createSaleDto.receiptImageUrl,
      createdBy: currentUser ? { id: currentUser.id } as User : null,
    });

    let totalAmount = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    let subtotal = 0;
    const saleItems: SaleItem[] = [];

    // Apply sale-level discount if provided
    const saleDiscountType = createSaleDto.discountType;
    const saleDiscountRate = createSaleDto.discountRate || 0;

    // Remaining fixed (ETB) discount to allocate across items. A fixed discount
    // applies once to the whole sale, so we deduct it item by item (in order)
    // instead of applying it to every line.
    let remainingFixedDiscount = saleDiscountType === DiscountType.FIXED
      ? saleDiscountRate
      : 0;

    // Process sale items and calculate totals
    for (const itemDto of items) {
      const product = await this.productRepository.findOne({ where: { id: itemDto.productId } });
      if (!product) throw new NotFoundException(`Product ${itemDto.productId} not found`);

      const unitPrice = itemDto.unitPrice ?? product.price;
      const lineSubtotal = unitPrice * itemDto.quantity;
      const lineTax = (lineSubtotal * product.taxRate) / 100;

      // Calculate item-level discount
      let itemDiscount = itemDto.discountAmount || 0;
      if (saleDiscountType && saleDiscountRate > 0 && itemDiscount === 0) {
        if (saleDiscountType === DiscountType.PERCENTAGE) {
          itemDiscount = (lineSubtotal * saleDiscountRate) / 100;
        } else if (saleDiscountType === DiscountType.FIXED) {
          // Capping each item at its own subtotal guarantees the total discount
          // never exceeds the sale subtotal and no line total goes negative.
          itemDiscount = Math.min(lineSubtotal, remainingFixedDiscount);
          remainingFixedDiscount = Math.max(0, remainingFixedDiscount - itemDiscount);
        }
      }

      const saleItem = this.saleItemRepository.create({
        sales,
        product,
        quantity: itemDto.quantity,
        unitPrice: unitPrice,
        subtotal: lineSubtotal,
        total: lineSubtotal - itemDiscount + lineTax,
        taxRate: product.taxRate,
        taxAmount: lineTax,
        discountAmount: itemDiscount,
        notes: itemDto.notes,
      });

      subtotal += saleItem.subtotal;
      taxAmount += saleItem.taxAmount;
      discountAmount += saleItem.discountAmount;
      totalAmount += saleItem.total;

      saleItems.push(saleItem);
    }

    // Set calculated totals
    sales.items = saleItems;
    sales.totalAmount = totalAmount;
    sales.taxAmount = taxAmount;
    sales.discountAmount = discountAmount;
    sales.discountType = saleDiscountType || null;
    sales.discountRate = saleDiscountRate;
    sales.subtotal = subtotal;
    const advanceAmt = sales.advancePayment || 0;
    if (paymentType !== PaymentType.CREDIT) {
      // For non-credit payments: if an advance was recorded and it's less than
      // the total, keep the remaining balance so the sale is tracked as partially paid.
      if (advanceAmt > 0 && advanceAmt < totalAmount) {
        sales.remainingBalance = Math.max(0, totalAmount - advanceAmt);
      } else {
        sales.advancePayment = 0;
        sales.remainingBalance = 0;
      }
    } else {
      sales.remainingBalance = Math.max(0, totalAmount - advanceAmt);
    }
    sales.status = this.resolveInitialStatus(paymentType, sales.remainingBalance, sales.advancePayment || 0);

    // Validate stock before persisting anything (avoid orphan rows on failure)
    await this.validateStock(saleItems, warehouse, shop);

    const savedSale = await this.salesRepository.save(sales);

    // Persist items and explicitly link them to the saved sale
    for (const saleItem of saleItems) {
      saleItem.sales = { id: savedSale.id } as Sales;
    }
    await this.saleItemRepository.save(saleItems);

    // Update inventory levels for each sale item
    await this.updateInventoryOnSale(saleItems, warehouse, shop);

    // Auto-calculate and create commissions when seller has an employee profile
    // Only platform-level SUPER_ADMIN and ADMIN are excluded; COMPANY_ADMIN (store owners)
    // can generate commissions if their products or profile have commission rates configured.
    const isPlatformAdmin = currentUser &&
      [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(currentUser.role);

    if (employee && !isPlatformAdmin) {
      for (const saleItem of saleItems) {
        const product = saleItem.product;
        const commissionType = product.commissionRate > 0
          ? (product.commissionType || CommissionType.PERCENT)
          : ((employee.permissions as any)?.baseCommissionType === 'fixed' ? CommissionType.FIXED : CommissionType.PERCENT);
        const commissionRate = product.commissionRate || employee.baseCommissionRate || 0;
        // Commission is calculated per quantity sold:
        // FIXED: quantity × flat rate per unit
        // PERCENT: (quantity × unitPrice × rate) / 100
        const commissionAmount =
          commissionType === CommissionType.FIXED
            ? saleItem.quantity * commissionRate
            : (saleItem.quantity * saleItem.unitPrice * commissionRate) / 100;

        if (commissionAmount > 0) {
          try {
            await this.commissionService.create({
              employeeId: employee.id,
              productId: product.id,
              saleId: savedSale.id,
              commissionRate: commissionRate,
              commissionAmount: commissionAmount,
            });
          } catch (error) {
            this.logger.warn(
              `Commission skipped for sale ${savedSale.id}, employee ${employee.id}: ${error?.message || error}`,
            );
          }
        }
      }
    }

    // Automatically record payment transaction for upfront payment (cash/card/bank/mobile full payment or advance payment)
    const upfrontPaid = paymentType === PaymentType.CREDIT
      ? Number(savedSale.advancePayment || 0)
      : Math.max(0, Number(savedSale.totalAmount) - Number(savedSale.remainingBalance || 0));

    if (upfrontPaid > 0) {
      try {
        const initialPayment = this.paymentTransactionRepository.create({
          amount: upfrontPaid,
          paymentMethod: savedSale.paymentType || PaymentType.CASH,
          transactionType: TransactionType.SALE,
          transactionDate: savedSale.saleDate ? new Date(savedSale.saleDate) : new Date(),
          sale: savedSale,
          transactionReference: savedSale.referenceNumber || undefined,
          notes: Number(savedSale.advancePayment || 0) > 0 && Number(savedSale.remainingBalance || 0) > 0
            ? 'Advance payment'
            : 'Initial payment',
          processedBy: currentUser?.id ? ({ id: currentUser.id } as User) : null,
          isSuccessful: true,
        });
        await this.paymentTransactionRepository.save(initialPayment);
      } catch (err) {
        this.logger.warn(`Failed to record initial payment transaction for sale ${savedSale.id}: ${err?.message || err}`);
      }
    }
    
    // Log creation
    await this.createAuditLog(savedSale, currentUser?.id || 'system', AuditAction.CREATE);

    await this.invalidateSaleCache();

    const fullSale = await this.salesRepository.findOne({
      where: { id: savedSale.id },
      relations: ['customer', 'warehouse', 'shop', 'items', 'items.product', 'createdBy'],
    });

    return this.mapToResponseDto(fullSale!);
  }

  async findAll(query: SaleQueryDto, currentUser?: any): Promise<PaginatedResult<SaleResponseDto>> {
    const companyId = resolveEffectiveCompanyId(currentUser, query.companyId);

    const cacheKey = this.cacheService.generateKey(CACHE_KEYS.SALES_LIST, companyId || 'all', JSON.stringify(query));
    const cached = await this.cacheService.get<PaginatedResult<SaleResponseDto>>(cacheKey);
    if (cached) return cached;

    const queryBuilder = this.createQueryBuilder();
    if (companyId) {
      queryBuilder.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId });
    }
    this.applyFilters(queryBuilder, query);

    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [sales, total] = await queryBuilder.getManyAndCount();

    const result = {
      data: sales.map(sale => this.mapToResponseDto(sale)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result, 300000);
    return result;
  }

  async findOne(id: string, currentUser?: any): Promise<SaleResponseDto> {
    const sale = await this.salesRepository.findOne({
      where: { id },
      relations: ['customer', 'warehouse', 'shop', 'items', 'items.product', 'createdBy', 'warehouse.company', 'shop.company', 'paymentTransactions'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (currentUser?.companyId && sale.warehouse?.company?.id !== currentUser.companyId && sale.shop?.company?.id !== currentUser.companyId) {
      throw new NotFoundException('Sale not found');
    }
    return this.mapToResponseDto(sale);
  }

  async update(id: string, updateSaleDto: UpdateSaleDto, currentUser?: any): Promise<SaleResponseDto> {
    const sale = await this.salesRepository.findOne({
      where: { id },
      relations: ['customer', 'warehouse', 'shop', 'warehouse.company', 'shop.company']
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
    if (!isSuperAdmin && userCompanyId) {
      const saleCompanyId = sale.warehouse?.company?.id || sale.shop?.company?.id;
      if (saleCompanyId && saleCompanyId !== userCompanyId) {
        throw new ForbiddenException('You do not have permission to update this sale');
      }
    }

    Object.assign(sale, updateSaleDto);
    const updatedSale = await this.salesRepository.save(sale);
    await this.invalidateSaleCache();
    await this.cacheService.del(CACHE_KEYS.SALES_LIST);
    
    // Log update - using a placeholder for updatedBy since UpdateSaleDto doesn't have it
    await this.createAuditLog(updatedSale, currentUser?.id || 'system', AuditAction.UPDATE);

    return this.mapToResponseDto(updatedSale);
  }

  async remove(id: string, currentUser?: any): Promise<void> {
    const sale = await this.salesRepository.findOne({
      where: { id },
      relations: ['warehouse.company', 'shop.company']
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
    if (!isSuperAdmin && userCompanyId) {
      const saleCompanyId = sale.warehouse?.company?.id || sale.shop?.company?.id;
      if (saleCompanyId && saleCompanyId !== userCompanyId) {
        throw new ForbiddenException('You do not have permission to delete this sale');
      }
    }

    await this.salesRepository.delete(id);

    // Log deletion
    await this.createAuditLog(sale, currentUser?.id || null, AuditAction.DELETE);
    await this.invalidateSaleCache();
    await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.SALE_DETAIL, id));
  }

  private createQueryBuilder(): SelectQueryBuilder<Sales> {
    return this.salesRepository.createQueryBuilder('sales')
      .leftJoinAndSelect('sales.customer', 'customer')
      .leftJoinAndSelect('sales.warehouse', 'warehouse')
      .leftJoinAndSelect('sales.shop', 'shop')
      .leftJoinAndSelect('sales.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('sales.createdBy', 'createdBy')
      .leftJoinAndSelect('sales.paymentTransactions', 'paymentTransactions')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany');
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Sales>, query: SaleQueryDto): void {
    if (query.search) {
      queryBuilder.andWhere('(customer.name ILIKE :search OR warehouse.name ILIKE :search OR shop.name ILIKE :search)', { search: `%${query.search}%` });
    }
    if (query.status) {
      queryBuilder.andWhere('sales.status = :status', { status: query.status });
    }
    if (query.customerId) {
      queryBuilder.andWhere('customer.id = :customerId', { customerId: query.customerId });
    }
    queryBuilder.orderBy('sales.createdAt', 'DESC');
  }


  async applyPayment(saleId: string, paymentDto: CreatePaymentTransactionDto, currentUser?: any): Promise<PaymentTransactionResponseDto> {
    this.logger.log(`Apply payment requested for saleId=${saleId}, amount=${paymentDto.amount}, method=${paymentDto.paymentMethod}`);
    const sale = await this.salesRepository.findOne({
      where: { id: saleId },
      relations: ['warehouse.company', 'shop.company', 'customer'],
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
    if (!isPlatformAdmin && userCompanyId) {
      const saleCompanyId = sale.warehouse?.company?.id || sale.shop?.company?.id;
      if (saleCompanyId && saleCompanyId !== userCompanyId) {
        throw new ForbiddenException('You do not have permission to record payments for this sale');
      }
    }

    const paymentAmount = Number(paymentDto.amount || 0);
    const currentRemaining = Number(sale.remainingBalance || 0);

    if (currentRemaining <= 0.01) {
      throw new BadRequestException('Sale is already fully paid');
    }
    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }
    if (paymentAmount > currentRemaining + 0.05) {
      throw new BadRequestException(`Payment amount (${paymentAmount.toFixed(2)}) exceeds remaining balance (${currentRemaining.toFixed(2)})`);
    }

    const processorId = currentUser?.id || (paymentDto.processedBy && paymentDto.processedBy.trim() !== '' ? paymentDto.processedBy : null);

    const transaction = this.paymentTransactionRepository.create({
      amount: paymentAmount,
      paymentMethod: paymentDto.paymentMethod,
      transactionType: paymentDto.transactionType || TransactionType.SALE,
      sale,
      transactionReference: paymentDto.transactionReference,
      notes: paymentDto.notes,
      paymentDetails: paymentDto.paymentDetails,
      processedBy: processorId ? ({ id: processorId } as User) : null,
      isSuccessful: true,
    });

    const savedTransaction = await this.paymentTransactionRepository.save(transaction);

    const transactions = await this.paymentTransactionRepository.find({
      where: { sale: { id: saleId }, isSuccessful: true, transactionType: TransactionType.SALE },
    });
    const hasAdvanceTx = transactions.some(t => t.notes === 'Advance payment');
    const transactionTotal = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalPaid = hasAdvanceTx ? transactionTotal : (Number(sale.advancePayment || 0) + transactionTotal);
    sale.remainingBalance = Math.max(0, Number(sale.totalAmount) - totalPaid);
    if (Number(sale.remainingBalance) <= 0.01) {
      sale.remainingBalance = 0;
    }
    sale.status = this.resolveInitialStatus(sale.paymentType, Number(sale.remainingBalance), Number(sale.advancePayment || 0));

    await this.salesRepository.save(sale);
    await this.invalidateSaleCache();

    // Send PAYMENT notification
    await this.notifyPaymentReceived(sale, savedTransaction);

    return this.mapToPaymentTransactionResponseDto(savedTransaction);
  }

  async sendPaymentReminder(saleId: string, currentUser?: any): Promise<{ success: boolean; message: string }> {
    const sale = await this.salesRepository.findOne({
      where: { id: saleId },
      relations: ['customer', 'warehouse.company', 'shop.company'],
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
    if (!isPlatformAdmin && userCompanyId) {
      const saleCompanyId = sale.warehouse?.company?.id || sale.shop?.company?.id;
      if (saleCompanyId && saleCompanyId !== userCompanyId) {
        throw new ForbiddenException('You do not have permission to send reminders for this sale');
      }
    }

    if (Number(sale.remainingBalance) <= 0) {
      throw new BadRequestException('Sale is already fully paid');
    }

    const phone = sale.customer?.phoneNumber;
    if (!phone || phone === '0000000000') {
      throw new BadRequestException('Customer has no phone number for reminder');
    }

    const invoiceRef = sale.invoiceNumber || sale.id.slice(0, 8).toUpperCase();
    const message = `Payment reminder: You have an outstanding balance of ETB ${Number(sale.remainingBalance).toFixed(2)} for invoice ${invoiceRef}. Please contact us to arrange payment.`;

    const sent = await this.notificationService.sendEventNotification({
      type: NotificationType.PAYMENT,
      title: 'Payment Reminder',
      message,
      userId: sale.customer?.id || saleId,
      companyId: undefined,
      metadata: { saleId: sale.id, remainingBalance: sale.remainingBalance },
    });

    return {
      success: !!sent,
      message: 'Reminder sent successfully',
    };
  }

  async updateStatus(saleId: string, status: SaleStatus, userId: string): Promise<SaleResponseDto> {
    const sale = await this.salesRepository.findOne({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');

    const oldStatus = sale.status;
    sale.status = status;
    const updatedSale = await this.salesRepository.save(sale);

    // Log status update
    await this.createAuditLog(updatedSale, userId, AuditAction.UPDATE);

    await this.invalidateSaleCache();
    return this.mapToResponseDto(updatedSale);
  }

  async processSaleReturn(saleId: string, reason: string, userId: string): Promise<SaleResponseDto> {
    const sale = await this.salesRepository.findOne({ 
      where: { id: saleId }, 
      relations: ['items', 'items.product'] 
    });
    if (!sale) throw new NotFoundException('Sale not found');

    if (sale.status === SaleStatus.RETURNED) {
      throw new BadRequestException('Sale has already been returned');
    }

    // Update sale status to returned
    sale.status = SaleStatus.RETURNED;
    sale.note = `${sale.note || ''} [RETURN REASON: ${reason}]`;
    
    const updatedSale = await this.salesRepository.save(sale);

    // Create a return transaction
    const returnTransaction = this.paymentTransactionRepository.create({
      amount: sale.totalAmount,
      paymentMethod: sale.paymentType,
      transactionType: TransactionType.RETURN,
      sale,
      notes: `Return processed. Reason: ${reason}`,
      processedBy: { id: userId } as User,
      isSuccessful: true,
    });

    await this.paymentTransactionRepository.save(returnTransaction);

    // Log return
    await this.createAuditLog(updatedSale, userId, AuditAction.UPDATE);

    await this.invalidateSaleCache();
    return this.mapToResponseDto(updatedSale);
  }

  async getPaymentHistory(saleId: string, currentUser?: any): Promise<PaymentTransactionResponseDto[]> {
    const sale = await this.salesRepository.findOne({
      where: { id: saleId },
      relations: ['warehouse.company', 'shop.company'],
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
    if (!isPlatformAdmin && userCompanyId) {
      const saleCompanyId = sale.warehouse?.company?.id || sale.shop?.company?.id;
      if (saleCompanyId && saleCompanyId !== userCompanyId) {
        throw new ForbiddenException('You do not have permission to view payment history for this sale');
      }
    }

    let transactions = await this.paymentTransactionRepository.find({
      where: { sale: { id: saleId } },
      relations: ['processedBy', 'sale'],
      order: { transactionDate: 'ASC', createdAt: 'ASC' },
    });

    // Auto-backfill for existing or previously recorded sales that have payments but no payment_transactions rows yet
    if (transactions.length === 0) {
      try {
        const sale = await this.salesRepository.findOne({
          where: { id: saleId },
          relations: ['createdBy'],
        });

        if (sale) {
          const totalAmt = Number(sale.totalAmount || 0);
          const remBal = Number(sale.remainingBalance || 0);
          const advAmt = Number(sale.advancePayment || 0);
          const paidTotal = Math.max(0, totalAmt - remBal);

          if (paidTotal > 0) {
            const initialDate = sale.saleDate ? new Date(sale.saleDate) : sale.createdAt;
            if (advAmt > 0 && paidTotal > advAmt + 0.01) {
              // 1. Initial Advance payment
              const t1 = this.paymentTransactionRepository.create({
                amount: advAmt,
                paymentMethod: sale.paymentType || PaymentType.CASH,
                transactionType: TransactionType.SALE,
                transactionDate: initialDate,
                sale,
                notes: 'Advance payment',
                processedBy: sale.createdBy ? ({ id: sale.createdBy.id } as User) : null,
                isSuccessful: true,
              });
              await this.paymentTransactionRepository.save(t1);

              // 2. Subsequent Repayment for the remainder
              const t2 = this.paymentTransactionRepository.create({
                amount: Math.round((paidTotal - advAmt) * 100) / 100,
                paymentMethod: sale.paymentType || PaymentType.CASH,
                transactionType: TransactionType.SALE,
                transactionDate: sale.updatedAt || new Date(),
                sale,
                notes: 'Repayment',
                processedBy: sale.createdBy ? ({ id: sale.createdBy.id } as User) : null,
                isSuccessful: true,
              });
              await this.paymentTransactionRepository.save(t2);
            } else if (advAmt > 0) {
              const t1 = this.paymentTransactionRepository.create({
                amount: advAmt,
                paymentMethod: sale.paymentType || PaymentType.CASH,
                transactionType: TransactionType.SALE,
                transactionDate: initialDate,
                sale,
                notes: 'Advance payment',
                processedBy: sale.createdBy ? ({ id: sale.createdBy.id } as User) : null,
                isSuccessful: true,
              });
              await this.paymentTransactionRepository.save(t1);
            } else {
              const t1 = this.paymentTransactionRepository.create({
                amount: paidTotal,
                paymentMethod: sale.paymentType || PaymentType.CASH,
                transactionType: TransactionType.SALE,
                transactionDate: initialDate,
                sale,
                notes: 'Initial payment',
                processedBy: sale.createdBy ? ({ id: sale.createdBy.id } as User) : null,
                isSuccessful: true,
              });
              await this.paymentTransactionRepository.save(t1);
            }

            // Reload newly generated transactions with relations
            transactions = await this.paymentTransactionRepository.find({
              where: { sale: { id: saleId } },
              relations: ['processedBy', 'sale'],
              order: { transactionDate: 'ASC', createdAt: 'ASC' },
            });
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to backfill payment history for sale ${saleId}: ${err?.message || err}`);
      }
    }

    return transactions.map(transaction => this.mapToPaymentTransactionResponseDto(transaction));
  }

  async getDailySalesReport(date?: string, currentUser?: any, companyId?: string): Promise<any> {
    const effectiveCompanyId = resolveEffectiveCompanyId(currentUser, companyId);
    const reportDate = date ? new Date(date) : new Date();

    const buildQuery = (filterToday: boolean) => {
      const qb = this.salesRepository
        .createQueryBuilder('sales')
        .leftJoin('sales.warehouse', 'warehouse')
        .leftJoin('sales.shop', 'shop')
        .leftJoin('warehouse.company', 'wCompany')
        .leftJoin('shop.company', 'sCompany')
        .select([
          'COUNT(sales.id) as "totalSales"',
          'SUM(sales.totalAmount) as "totalRevenue"',
          'AVG(sales.totalAmount) as "averageSaleAmount"',
          'SUM(sales.taxAmount) as "totalTax"',
          'SUM(sales.discountAmount) as "totalDiscount"'
        ])
        .where('sales.status != :cancelledStatus', { cancelledStatus: SaleStatus.CANCELLED });

      if (filterToday) {
        if (date) {
          qb.andWhere('(sales.saleDate = :date OR DATE(sales.createdAt) = :date)', { date });
        } else {
          const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
          qb.andWhere('(sales.saleDate >= :since24h OR sales.createdAt >= :since24h OR sales.saleDate = CURRENT_DATE OR DATE(sales.createdAt) = CURRENT_DATE)', { since24h });
        }
      }

      if (effectiveCompanyId) {
        qb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId: effectiveCompanyId });
      }
      return qb;
    };

    let result = await buildQuery(true).getRawOne();
    let totalSales = parseInt(result?.totalSales || result?.totalsales || '0') || 0;
    let totalRevenue = parseFloat(result?.totalRevenue || result?.totalrevenue || '0') || 0;

    let allTimeResult = await buildQuery(false).getRawOne();
    let allTimeSales = parseInt(allTimeResult?.totalSales || allTimeResult?.totalsales || '0') || 0;
    let allTimeRevenue = parseFloat(allTimeResult?.totalRevenue || allTimeResult?.totalrevenue || '0') || 0;

    const buildCreditQuery = (filterToday: boolean) => {
      const creditQb = this.salesRepository
        .createQueryBuilder('sales')
        .leftJoin('sales.warehouse', 'warehouse')
        .leftJoin('sales.shop', 'shop')
        .leftJoin('warehouse.company', 'wCompany')
        .leftJoin('shop.company', 'sCompany')
        .leftJoin('sales.customer', 'customer')
        .where('sales.paymentType = :credit', { credit: 'credit' })
        .andWhere('sales.status != :cancelledStatus', { cancelledStatus: SaleStatus.CANCELLED });

      if (filterToday) {
        if (date) {
          creditQb.andWhere('(sales.saleDate = :date OR DATE(sales.createdAt) = :date)', { date });
        } else {
          const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
          creditQb.andWhere('(sales.saleDate >= :since24h OR sales.createdAt >= :since24h OR sales.saleDate = CURRENT_DATE OR DATE(sales.createdAt) = CURRENT_DATE)', { since24h });
        }
      }

      if (effectiveCompanyId) {
        creditQb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId: effectiveCompanyId });
      }
      return creditQb;
    };

    let creditResult = await buildCreditQuery(true).select(['COUNT(sales.id) as "creditSales"', 'COUNT(DISTINCT customer.id) as "creditCustomers"']).getRawOne();
    let creditSales = parseInt(creditResult?.creditSales || creditResult?.creditsales || '0') || 0;

    const buildOutstandingQuery = () => {
      const qb = this.salesRepository
        .createQueryBuilder('sales')
        .leftJoin('sales.warehouse', 'warehouse')
        .leftJoin('sales.shop', 'shop')
        .leftJoin('warehouse.company', 'wCompany')
        .leftJoin('shop.company', 'sCompany')
        .leftJoin('sales.customer', 'customer')
        .where('sales.paymentType = :credit', { credit: PaymentType.CREDIT })
        .andWhere('sales.remainingBalance > 0')
        .andWhere('sales.status != :cancelledStatus', { cancelledStatus: SaleStatus.CANCELLED });

      if (effectiveCompanyId) {
        qb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId: effectiveCompanyId });
      }
      return qb;
    };

    const outstandingResult = await buildOutstandingQuery()
      .select('COALESCE(SUM(sales.remainingBalance), 0)', 'totalOutstandingCredit')
      .addSelect('COUNT(DISTINCT customer.id)', 'creditCustomersWithBalance')
      .getRawOne();

    const buildAllCreditQuery = () => {
      const qb = this.salesRepository
        .createQueryBuilder('sales')
        .leftJoin('sales.warehouse', 'warehouse')
        .leftJoin('sales.shop', 'shop')
        .leftJoin('warehouse.company', 'wCompany')
        .leftJoin('shop.company', 'sCompany')
        .where('sales.paymentType = :credit', { credit: PaymentType.CREDIT })
        .andWhere('sales.status != :cancelledStatus', { cancelledStatus: SaleStatus.CANCELLED });

      if (effectiveCompanyId) {
        qb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId: effectiveCompanyId });
      }
      return qb;
    };

    const creditBreakdown = await buildAllCreditQuery()
      .select('COALESCE(SUM(sales.totalAmount), 0)', 'totalCredit')
      .addSelect(
        `COALESCE(SUM(CASE WHEN sales.status = '${SaleStatus.PENDING}' AND sales.remainingBalance > 0 THEN sales.remainingBalance ELSE 0 END), 0)`,
        'unpaidCredit',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN sales.status = '${SaleStatus.PARTIALLY_PAID}' AND sales.remainingBalance > 0 THEN sales.remainingBalance ELSE 0 END), 0)`,
        'partiallyPaidCredit',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN sales.status = '${SaleStatus.COMPLETED}' OR sales.remainingBalance <= 0 THEN sales.totalAmount ELSE 0 END), 0)`,
        'paidCredit',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN sales.dueDate IS NOT NULL AND sales.dueDate < CURRENT_DATE AND sales.remainingBalance > 0 THEN sales.remainingBalance ELSE 0 END), 0)`,
        'overdueCredit',
      )
      .getRawOne();

    return {
      date: date || reportDate.toISOString().split('T')[0],
      totalSales: totalSales,
      totalRevenue: totalRevenue,
      todaySales: totalSales,
      todayRevenue: totalRevenue,
      allTimeSales: allTimeSales,
      allTimeRevenue: allTimeRevenue,
      averageSaleAmount: parseFloat(result?.averageSaleAmount || result?.averagesaleamount || '0') || 0,
      totalTax: parseFloat(result?.totalTax || result?.totaltax || '0') || 0,
      totalDiscount: parseFloat(result?.totalDiscount || result?.totaldiscount || '0') || 0,
      creditSales: parseInt(creditResult?.creditSales || creditResult?.creditsales || '0') || 0,
      creditCustomers: parseInt(creditResult?.creditCustomers || creditResult?.creditcustomers || '0') || 0,
      totalOutstandingCredit: parseFloat(outstandingResult?.totalOutstandingCredit || outstandingResult?.totaloutstandingcredit || '0') || 0,
      creditCustomersWithBalance: parseInt(outstandingResult?.creditCustomersWithBalance || outstandingResult?.creditcustomerswithbalance || '0') || 0,
      totalCredit: parseFloat(creditBreakdown?.totalCredit || creditBreakdown?.totalcredit || '0') || 0,
      unpaidCredit: parseFloat(creditBreakdown?.unpaidCredit || creditBreakdown?.unpaidcredit || '0') || 0,
      partiallyPaidCredit: parseFloat(creditBreakdown?.partiallyPaidCredit || creditBreakdown?.partiallypaidcredit || '0') || 0,
      paidCredit: parseFloat(creditBreakdown?.paidCredit || creditBreakdown?.paidcredit || '0') || 0,
      overdueCredit: parseFloat(creditBreakdown?.overdueCredit || creditBreakdown?.overduecredit || '0') || 0,
    };
  }

  async getMonthlySalesReport(year?: number, month?: number, currentUser?: any, companyId?: string): Promise<any> {
    const effectiveCompanyId = resolveEffectiveCompanyId(currentUser, companyId);
    const currentDate = new Date();
    const reportYear = year || currentDate.getFullYear();
    const reportMonth = month || (currentDate.getMonth() + 1);

    const qb = this.salesRepository
      .createQueryBuilder('sales')
      .leftJoin('sales.warehouse', 'warehouse')
      .leftJoin('sales.shop', 'shop')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany')
      .select([
        'COUNT(sales.id) as "totalSales"',
        'SUM(sales.totalAmount) as "totalRevenue"',
        'AVG(sales.totalAmount) as "averageSaleAmount"',
        'SUM(sales.taxAmount) as "totalTax"',
        'SUM(sales.discountAmount) as "totalDiscount"'
      ])
      .where('sales.status != :cancelledStatus', { cancelledStatus: SaleStatus.CANCELLED });

    if (year || month) {
      qb.andWhere(
        '((EXTRACT(YEAR FROM sales.saleDate) = :year AND EXTRACT(MONTH FROM sales.saleDate) = :month) OR (EXTRACT(YEAR FROM sales.createdAt) = :year AND EXTRACT(MONTH FROM sales.createdAt) = :month))',
        { year: reportYear, month: reportMonth }
      );
    }

    if (effectiveCompanyId) {
      qb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId: effectiveCompanyId });
    }

    const result = await qb.getRawOne();

    return {
      year: reportYear,
      month: reportMonth,
      totalSales: parseInt(result?.totalSales || result?.totalsales || '0') || 0,
      totalRevenue: parseFloat(result?.totalRevenue || result?.totalrevenue || '0') || 0,
      averageSaleAmount: parseFloat(result?.averageSaleAmount || result?.averagesaleamount || '0') || 0,
      totalTax: parseFloat(result?.totalTax || result?.totaltax || '0') || 0,
      totalDiscount: parseFloat(result?.totalDiscount || result?.totaldiscount || '0') || 0,
    };
  }

  async getAnalytics(query: ReportQueryDto, currentUser?: any): Promise<any> {
    const companyId = resolveEffectiveCompanyId(currentUser, query.companyId);
    const range = this.resolveReportRange(query);

    // Resolve allowed warehouse and shop IDs for restricted staff members
    let allowedWarehouseIds: string[] | null = null;
    let allowedShopIds: string[] | null = null;

    if (currentUser && currentUser.role !== UserRole.COMPANY_ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      try {
        const employee = await this.employeeRepository.findOne({
          where: { user: { id: currentUser.id } },
          relations: ['warehouse', 'shop'],
        });
        const branchPermissions = employee?.permissions?.branchPermissions || (currentUser as any).permissions?.branchPermissions;
        if (branchPermissions && typeof branchPermissions === 'object' && Object.keys(branchPermissions).length > 0) {
          allowedWarehouseIds = [];
          allowedShopIds = [];
          for (const [bId, access] of Object.entries(branchPermissions)) {
            if (access && typeof access === 'object') {
              if ((access as any).warehouse === true) allowedWarehouseIds.push(bId);
              if ((access as any).shop === true) allowedShopIds.push(bId);
            }
          }
        } else {
          if (currentUser.warehouseId || employee?.warehouse?.id) {
            allowedWarehouseIds = [currentUser.warehouseId || employee!.warehouse!.id];
          }
          if (currentUser.shopId || employee?.shop?.id) {
            allowedShopIds = [currentUser.shopId || employee!.shop!.id];
          }
        }
      } catch (_) {}
    }

    const base = () => this.salesRepository
      .createQueryBuilder('sales')
      .leftJoin('sales.warehouse', 'warehouse')
      .leftJoin('sales.shop', 'shop')
      .leftJoin('sales.customer', 'customer')
      .leftJoin('sales.createdBy', 'createdBy')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany')
      .where('sales.status != :cancelled', { cancelled: SaleStatus.CANCELLED })
      .andWhere('sales.saleDate >= :from', { from: range.from })
      .andWhere('sales.saleDate <= :to', { to: range.to });

    const applySalesFilters = (qb: SelectQueryBuilder<Sales>) => {
      if (companyId) qb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId });
      if (query.customerId) qb.andWhere('customer.id = :customerId', { customerId: query.customerId });
      if (query.sellerId) qb.andWhere('createdBy.id = :sellerId', { sellerId: query.sellerId });
      if (query.locationId) {
        if (query.locationType === ReportLocationType.WAREHOUSE) {
          qb.andWhere('warehouse.id = :locationId', { locationId: query.locationId });
        } else {
          qb.andWhere('shop.id = :locationId', { locationId: query.locationId });
        }
      } else if (allowedWarehouseIds !== null || allowedShopIds !== null) {
        const wIds = allowedWarehouseIds || [];
        const sIds = allowedShopIds || [];
        if (wIds.length > 0 && sIds.length > 0) {
          qb.andWhere('(warehouse.id IN (:...wIds) OR shop.id IN (:...sIds))', { wIds, sIds });
        } else if (wIds.length > 0) {
          qb.andWhere('warehouse.id IN (:...wIds)', { wIds });
        } else if (sIds.length > 0) {
          qb.andWhere('shop.id IN (:...sIds)', { sIds });
        } else {
          qb.andWhere('1 = 0');
        }
      }
      if (query.productId) {
        qb.andWhere(
          `EXISTS (SELECT 1 FROM sales_items si WHERE si.sales_id = sales.id AND si.product_id = :productId)`,
          { productId: query.productId },
        );
      }
    };

    // ── Summary ──
    const summaryQb = base().select([
      'COUNT(sales.id) AS "totalSales"',
      'SUM(sales.subtotal) AS "totalSubtotal"',
      'SUM(sales.totalAmount) AS "totalRevenue"',
      'SUM(sales.taxAmount) AS "totalTax"',
      'SUM(sales.discountAmount) AS "totalDiscount"',
      'AVG(sales.totalAmount) AS "averageSaleAmount"',
      'SUM(sales.remainingBalance) AS "totalCredit"',
      'SUM(sales.advancePayment) AS "totalAdvance"',
    ]);
    applySalesFilters(summaryQb);
    const summaryRaw = await summaryQb.getRawOne();

    // ── Series (daily buckets) ──
    const seriesQb = base()
      .select([
        "to_char(sales.saleDate, 'YYYY-MM-DD') AS \"day\"",
        'SUM(sales.totalAmount) AS "revenue"',
        'COUNT(sales.id) AS "count"',
      ])
      .groupBy('"day"')
      .orderBy('"day"');
    applySalesFilters(seriesQb);
    const seriesRaw = await seriesQb.getRawMany();
    const series = this.buildReportSeries(seriesRaw, query.period || ReportPeriod.MONTH, range);

    // ── By product ──
    const productQb = this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.sales', 'sales')
      .leftJoin('item.product', 'product')
      .leftJoin('sales.warehouse', 'warehouse')
      .leftJoin('sales.shop', 'shop')
      .leftJoin('sales.customer', 'customer')
      .leftJoin('sales.createdBy', 'createdBy')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany')
      .select([
        'product.id AS "productId"',
        'product.name AS "productName"',
        'SUM(item.quantity) AS "quantity"',
        'SUM(item.subtotal) AS "grossRevenue"',
        'SUM(item.discountAmount) AS "discount"',
        'SUM(item.taxAmount) AS "tax"',
        'SUM(item.total) AS "revenue"',
        'SUM(item.quantity * COALESCE(product.cost, 0)) AS "cost"',
      ])
      .where('sales.status != :cancelled', { cancelled: SaleStatus.CANCELLED })
      .andWhere('sales.saleDate >= :from', { from: range.from })
      .andWhere('sales.saleDate <= :to', { to: range.to })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('"revenue"', 'DESC')
      .limit(10);

    const applyItemFilters = (qb: SelectQueryBuilder<SaleItem>) => {
      if (companyId) qb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId });
      if (query.customerId) qb.andWhere('customer.id = :customerId', { customerId: query.customerId });
      if (query.sellerId) qb.andWhere('createdBy.id = :sellerId', { sellerId: query.sellerId });
      if (query.locationId) {
        if (query.locationType === ReportLocationType.WAREHOUSE) {
          qb.andWhere('warehouse.id = :locationId', { locationId: query.locationId });
        } else {
          qb.andWhere('shop.id = :locationId', { locationId: query.locationId });
        }
      } else if (allowedWarehouseIds !== null || allowedShopIds !== null) {
        const wIds = allowedWarehouseIds || [];
        const sIds = allowedShopIds || [];
        if (wIds.length > 0 && sIds.length > 0) {
          qb.andWhere('(warehouse.id IN (:...wIds) OR shop.id IN (:...sIds))', { wIds, sIds });
        } else if (wIds.length > 0) {
          qb.andWhere('warehouse.id IN (:...wIds)', { wIds });
        } else if (sIds.length > 0) {
          qb.andWhere('shop.id IN (:...sIds)', { sIds });
        } else {
          qb.andWhere('1 = 0');
        }
      }
      if (query.productId) qb.andWhere('product.id = :productId', { productId: query.productId });
    };
    applyItemFilters(productQb);
    const byProductRaw = await productQb.getRawMany();
    const byProduct = byProductRaw.map((r) => {
      const revenue = Number(r.revenue || 0);
      const tax = Number(r.tax || 0);
      const discount = Number(r.discount || 0);
      const cost = Number(r.cost || 0);
      const netRevenue = Math.max(
        0,
        Number((Number(r.grossRevenue || 0) - discount).toFixed(2)),
      );
      const profit = Number((revenue - tax - cost).toFixed(2));
      const margin = netRevenue > 0 ? Number(((profit / netRevenue) * 100).toFixed(2)) : 0;

      return {
        productId: r.productId,
        productName: r.productName || 'Unknown',
        quantity: Number(r.quantity || 0),
        grossRevenue: Number(r.grossRevenue || 0),
        discount,
        tax,
        revenue,
        netRevenue,
        cost,
        profit,
        margin,
      };
    });

    // ── By customer ──
    const customerQb = base()
      .select([
        'customer.id AS "customerId"',
        'COALESCE(customer.name, \'Walk-in\') AS "customerName"',
        'COUNT(sales.id) AS "invoiceCount"',
        'SUM(sales.totalAmount) AS "totalSpent"',
        'SUM(sales.remainingBalance) AS "outstanding"',
      ])
      .groupBy('customer.id')
      .addGroupBy('customer.name')
      .orderBy('"totalSpent"', 'DESC')
      .limit(10);
    applySalesFilters(customerQb);
    const byCustomer = await customerQb.getRawMany();

    // ── By location (shops + warehouses) ──
    const shopQb = base()
      .select([
        'shop.id AS "id"',
        'shop.name AS "name"',
        'COUNT(sales.id) AS "invoiceCount"',
        'SUM(sales.totalAmount) AS "revenue"',
      ])
      .andWhere('shop.id IS NOT NULL')
      .groupBy('shop.id')
      .addGroupBy('shop.name')
      .orderBy('"revenue"', 'DESC');
    applySalesFilters(shopQb);

    const warehouseQb = base()
      .select([
        'warehouse.id AS "id"',
        'warehouse.name AS "name"',
        'COUNT(sales.id) AS "invoiceCount"',
        'SUM(sales.totalAmount) AS "revenue"',
      ])
      .andWhere('warehouse.id IS NOT NULL')
      .groupBy('warehouse.id')
      .addGroupBy('warehouse.name')
      .orderBy('"revenue"', 'DESC');
    applySalesFilters(warehouseQb);

    const [shopRows, warehouseRows] = await Promise.all([shopQb.getRawMany(), warehouseQb.getRawMany()]);
    let byLocation = [
      ...shopRows.map((r) => ({ ...r, type: ReportLocationType.SHOP })),
      ...warehouseRows.map((r) => ({ ...r, type: ReportLocationType.WAREHOUSE })),
    ].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));

    if (allowedWarehouseIds !== null || allowedShopIds !== null) {
      byLocation = byLocation.filter((loc) => {
        if (loc.type === ReportLocationType.WAREHOUSE) {
          return allowedWarehouseIds ? allowedWarehouseIds.includes(loc.id) : false;
        }
        return allowedShopIds ? allowedShopIds.includes(loc.id) : false;
      });
    }

    // ── By seller ──
    const sellerQb = base()
      .select([
        'createdBy.id AS "sellerId"',
        "CONCAT(COALESCE(createdBy.firstName, ''), ' ', COALESCE(createdBy.lastName, '')) AS \"sellerName\"",
        'COUNT(sales.id) AS "invoiceCount"',
        'SUM(sales.totalAmount) AS "revenue"',
      ])
      .andWhere('createdBy.id IS NOT NULL')
      .groupBy('createdBy.id')
      .addGroupBy('createdBy.firstName')
      .addGroupBy('createdBy.lastName')
      .orderBy('"revenue"', 'DESC')
      .limit(10);
    applySalesFilters(sellerQb);
    const bySellerRaw = await sellerQb.getRawMany();
    const bySeller = bySellerRaw.map((r) => ({
      ...r,
      sellerName: (r.sellerName || '').trim() || 'Unknown',
    }));

    // ── Sales list ──
    const listQb = this.salesRepository
      .createQueryBuilder('sales')
      .leftJoinAndSelect('sales.customer', 'customer')
      .leftJoinAndSelect('sales.warehouse', 'warehouse')
      .leftJoinAndSelect('sales.shop', 'shop')
      .leftJoinAndSelect('sales.createdBy', 'createdBy')
      .leftJoinAndSelect('sales.items', 'items')
      .leftJoinAndSelect('items.product', 'itemProduct')
      .leftJoinAndSelect('warehouse.company', 'wCompany')
      .leftJoinAndSelect('shop.company', 'sCompany')
      .where('sales.status != :cancelled', { cancelled: SaleStatus.CANCELLED })
      .andWhere('sales.saleDate >= :from', { from: range.from })
      .andWhere('sales.saleDate <= :to', { to: range.to });
    applySalesFilters(listQb);
    listQb.orderBy('sales.saleDate', 'DESC').addOrderBy('sales.createdAt', 'DESC').take(query.limit || 50);
    const salesRows = await listQb.getMany();
    const sales = salesRows.map((s) => this.mapToResponseDto(s));

    // ── Purchase & Expense Calculations ──
    let totalPurchase = 0;
    let totalCogs = 0;
    try {
      const cogsQb = this.saleItemRepository
        .createQueryBuilder('item')
        .leftJoin('item.sales', 'sales')
        .leftJoin('item.product', 'product')
        .leftJoin('sales.warehouse', 'warehouse')
        .leftJoin('sales.shop', 'shop')
        .leftJoin('sales.customer', 'customer')
        .leftJoin('sales.createdBy', 'createdBy')
        .leftJoin('warehouse.company', 'wCompany')
        .leftJoin('shop.company', 'sCompany')
        .where('sales.status != :cancelled', { cancelled: SaleStatus.CANCELLED })
        .andWhere('sales.saleDate >= :from', { from: range.from })
        .andWhere('sales.saleDate <= :to', { to: range.to })
        .select('SUM(item.quantity * COALESCE(product.cost, 0)) AS "cogsTotal"');
      applyItemFilters(cogsQb);
      const cogsRaw = await cogsQb.getRawOne();
      const cogsVal = Number(cogsRaw?.cogsTotal) || 0;
      totalCogs = cogsVal;

      const itRepo = this.salesRepository.manager.getRepository(InventoryTransaction);
      const itQb = itRepo
        .createQueryBuilder('it')
        .leftJoin('it.product', 'product')
        .leftJoin('it.warehouse', 'warehouse')
        .leftJoin('it.shop', 'shop')
        .leftJoin('warehouse.company', 'wCompany')
        .leftJoin('shop.company', 'sCompany')
        .where('it.type = :stype', { stype: InventoryTransactionType.STOCK_IN })
        .andWhere('it.createdAt >= :from', { from: range.from })
        .andWhere('it.createdAt <= :to', { to: range.to });
      if (companyId) itQb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId });
      if (query.locationId) {
        if (query.locationType === ReportLocationType.WAREHOUSE) {
          itQb.andWhere('warehouse.id = :locationId', { locationId: query.locationId });
        } else {
          itQb.andWhere('shop.id = :locationId', { locationId: query.locationId });
        }
      } else if (allowedWarehouseIds !== null || allowedShopIds !== null) {
        const wIds = allowedWarehouseIds || [];
        const sIds = allowedShopIds || [];
        if (wIds.length > 0 && sIds.length > 0) {
          itQb.andWhere('(warehouse.id IN (:...wIds) OR shop.id IN (:...sIds))', { wIds, sIds });
        } else if (wIds.length > 0) {
          itQb.andWhere('warehouse.id IN (:...wIds)', { wIds });
        } else if (sIds.length > 0) {
          itQb.andWhere('shop.id IN (:...sIds)', { sIds });
        } else {
          itQb.andWhere('1 = 0');
        }
      }
      itQb.select('SUM(it.quantity * COALESCE(product.cost, 0)) AS "stockInTotal"');
      const itRaw = await itQb.getRawOne();
      const stockInVal = Number(itRaw?.stockInTotal) || 0;

      totalPurchase = stockInVal > 0 ? stockInVal : cogsVal;
    } catch (_) {}

    let totalExpense = 0;
    try {
      const expenseRepo = this.salesRepository.manager.getRepository(BankExpense);
      const expQb = expenseRepo
        .createQueryBuilder('exp')
        .leftJoin('exp.company', 'company')
        .where('exp.createdAt >= :from', { from: range.from })
        .andWhere('exp.createdAt <= :to', { to: range.to });
      if (companyId) expQb.andWhere('company.id = :companyId', { companyId });
      expQb.select('SUM(exp.amount) AS "totalExpense"');
      const expRaw = await expQb.getRawOne();
      totalExpense = Number(expRaw?.totalExpense) || 0;
    } catch (_) {}

    try {
      const recordedExpenseRepo = this.salesRepository.manager.getRepository(Expense);
      const recordedQb = recordedExpenseRepo
        .createQueryBuilder('recordedExp')
        .leftJoin('recordedExp.company', 'company')
        .where('recordedExp.createdAt >= :from', { from: range.from })
        .andWhere('recordedExp.createdAt <= :to', { to: range.to });
      if (companyId) recordedQb.andWhere('company.id = :companyId', { companyId });
      recordedQb.select('SUM(recordedExp.totalCost) AS "totalExpense"');
      const recordedRaw = await recordedQb.getRawOne();
      totalExpense += Number(recordedRaw?.totalExpense) || 0;
    } catch (_) {}

    // ── Commission Calculations ──
    let totalCommission = 0;
    try {
      const commRepo = this.salesRepository.manager.getRepository(Commission);
      const commQb = commRepo
        .createQueryBuilder('comm')
        .leftJoin('comm.sale', 'sale')
        .leftJoin('sale.warehouse', 'warehouse')
        .leftJoin('sale.shop', 'shop')
        .leftJoin('warehouse.company', 'wCompany')
        .leftJoin('shop.company', 'sCompany')
        .leftJoin('comm.employee', 'employee')
        .leftJoin('employee.company', 'eCompany')
        .where('((comm.commissionDate >= :from AND comm.commissionDate <= :to) OR (comm.createdAt >= :from AND comm.createdAt <= :to))', {
          from: range.from,
          to: range.to,
        });
      if (companyId) {
        commQb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId OR eCompany.id = :companyId)', { companyId });
      }
      if (query.sellerId) {
        commQb.andWhere('employee.user.id = :sellerId', { sellerId: query.sellerId });
      }
      if (query.locationId) {
        if (query.locationType === ReportLocationType.WAREHOUSE) {
          commQb.andWhere('warehouse.id = :locationId', { locationId: query.locationId });
        } else {
          commQb.andWhere('shop.id = :locationId', { locationId: query.locationId });
        }
      }
      commQb.select('SUM(COALESCE(comm.commissionAmount, comm.amount, 0)) AS "totalCommission"');
      const commRaw = await commQb.getRawOne();
      totalCommission = Number(commRaw?.totalCommission) || 0;
    } catch (_) {}

    // ── Credit Recovery & Outstanding Debt ──
    let creditCollected = 0;
    try {
      const cpRepo = this.salesRepository.manager.getRepository(CreditPayment);
      const cpQb = cpRepo
        .createQueryBuilder('cp')
        .leftJoin('cp.creditAccount', 'ca')
        .leftJoin('ca.company', 'company')
        .where('cp.createdAt >= :from AND cp.createdAt <= :to', { from: range.from, to: range.to });
      if (companyId) cpQb.andWhere('company.id = :companyId', { companyId });
      cpQb.select('SUM(cp.amount) AS "creditCollected"');
      const cpRaw = await cpQb.getRawOne();
      creditCollected = Number(cpRaw?.creditCollected) || 0;
    } catch (_) {}

    let outstandingCredit = 0;
    try {
      const caRepo = this.salesRepository.manager.getRepository(CreditAccount);
      const caQb = caRepo
        .createQueryBuilder('ca')
        .leftJoin('ca.company', 'company')
        .where('ca.status = :cStatus', { cStatus: CreditStatus.ACTIVE });
      if (companyId) caQb.andWhere('company.id = :companyId', { companyId });
      caQb.select('SUM(ca.totalOwed - ca.totalPaid + ca.accruedInterest) AS "outstandingCredit"');
      const caRaw = await caQb.getRawOne();
      outstandingCredit = Number(caRaw?.outstandingCredit) || 0;
    } catch (_) {}

    // ── Product Borrowings ──
    let totalBorrowings = 0;
    let unreturnedBorrowingCount = 0;
    try {
      const pbRepo = this.salesRepository.manager.getRepository(ProductBorrowing);
      const pbQb = pbRepo
        .createQueryBuilder('pb')
        .leftJoin('pb.company', 'company')
        .leftJoin('pb.warehouse', 'warehouse')
        .leftJoin('pb.shop', 'shop')
        .where('pb.createdAt >= :from AND pb.createdAt <= :to', { from: range.from, to: range.to });
      if (companyId) pbQb.andWhere('company.id = :companyId', { companyId });
      if (query.locationId) {
        if (query.locationType === ReportLocationType.WAREHOUSE) {
          pbQb.andWhere('warehouse.id = :locationId', { locationId: query.locationId });
        } else {
          pbQb.andWhere('shop.id = :locationId', { locationId: query.locationId });
        }
      }
      pbQb.select([
        'COUNT(pb.id) AS "totalBorrowings"',
        'SUM(pb.quantityTaken - pb.quantityReturned) AS "unreturnedBorrowingCount"',
      ]);
      const pbRaw = await pbQb.getRawOne();
      totalBorrowings = Number(pbRaw?.totalBorrowings) || 0;
      unreturnedBorrowingCount = Number(pbRaw?.unreturnedBorrowingCount) || 0;
    } catch (_) {}

    // ── Total Profits Derivations ──
    const totalSubtotal = Number(summaryRaw?.totalSubtotal) || 0;
    const totalRevenue = Number(summaryRaw?.totalRevenue) || 0;
    const totalTax = Number(summaryRaw?.totalTax) || 0;
    const totalDiscount = Number(summaryRaw?.totalDiscount) || 0;
    const totalCredit = Number(summaryRaw?.totalCredit) || 0;
    const totalAdvance = Number(summaryRaw?.totalAdvance) || 0;

    // Sale price (before tax, after discount) less the cost of the sold goods.
    const netSalesRevenue = Math.max(0, Number((totalSubtotal - totalDiscount).toFixed(2)));
    const grossProfit = Number((netSalesRevenue - totalCogs).toFixed(2));
    const grossMargin = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;
    const netProfit = Number((grossProfit - totalExpense - totalCommission).toFixed(2));
    const totalProfit = netProfit;
    const netMargin = netSalesRevenue > 0 ? (netProfit / netSalesRevenue) * 100 : 0;
    // Cash Profit: Realized cash inflow minus total cash outflows
    const cashInflow = (totalRevenue - totalCredit) + creditCollected;
    const cashOutflow = totalCogs + totalExpense + totalCommission;
    const cashProfit = Number((cashInflow - cashOutflow).toFixed(2));

    return {
      period: query.period || ReportPeriod.MONTH,
      from: range.from,
      to: range.to,
      summary: {
        totalSales: Number(summaryRaw?.totalSales) || 0,
        totalSubtotal,
        totalRevenue,
        netSalesRevenue,
        totalCogs,
        totalPurchase,
        totalExpense,
        totalCommission,
        totalCredit,
        creditCollected,
        outstandingCredit,
        grossProfit,
        grossMargin: Number(grossMargin.toFixed(2)),
        totalProfit,
        netProfit,
        netMargin: Number(netMargin.toFixed(2)),
        cashProfit,
        totalTax,
        totalDiscount,
        averageSaleAmount: Number(summaryRaw?.averageSaleAmount) || 0,
        totalAdvance,
        totalBorrowings,
        unreturnedBorrowingCount,
      },
      series,
      byProduct,
      byCustomer,
      byLocation,
      bySeller,
      sales,
    };
  }

  private resolveReportRange(query: ReportQueryDto): { from: Date; to: Date } {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    switch (query.period || ReportPeriod.MONTH) {
      case ReportPeriod.TODAY:
        return { from: startOfDay(now), to: endOfDay(now) };
      case ReportPeriod.WEEK: {
        const from = new Date(now);
        from.setDate(from.getDate() - 6);
        return { from: startOfDay(from), to: endOfDay(now) };
      }
      case ReportPeriod.YEAR:
        return {
          from: new Date(now.getFullYear(), 0, 1),
          to: endOfDay(new Date(now.getFullYear(), 11, 31)),
        };
      case ReportPeriod.ALL:
        return {
          from: new Date(2000, 0, 1),
          to: endOfDay(new Date(now.getFullYear() + 10, 11, 31)),
        };
      case ReportPeriod.CUSTOM: {
        const from = query.from
          ? new Date(query.from)
          : startOfDay(new Date(now.getTime() - 29 * 86400000));
        const to = query.to ? new Date(query.to) : endOfDay(now);
        return { from: startOfDay(from), to: endOfDay(to) };
      }
      case ReportPeriod.MONTH:
      default:
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        };
    }
  }

  private buildReportSeries(
    daily: any[],
    period: ReportPeriod,
    range: { from: Date; to: Date },
  ): { label: string; revenue: number }[] {
    const map = new Map<string, number>();
    for (const d of daily) {
      map.set(String(d.day), Number(d.revenue) || 0);
    }
    const keyOf = (dt: Date) => {
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${dt.getFullYear()}-${m}-${day}`;
    };

    if (period === ReportPeriod.TODAY) {
      return [{ label: 'Today', revenue: map.get(keyOf(range.from)) ?? 0 }];
    }

    if (period === ReportPeriod.ALL) {
      if (daily.length === 0) return [{ label: 'All Time', revenue: 0 }];
      return daily.slice(-12).map((d) => ({ label: String(d.day), revenue: Number(d.revenue) || 0 }));
    }

    if (period === ReportPeriod.YEAR) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const series = months.map((label, i) => ({ label, revenue: 0 }));
      map.forEach((rev, day) => {
        const month = Number(day.slice(5, 7));
        if (month >= 1 && month <= 12) series[month - 1].revenue += rev;
      });
      return series;
    }

    const series: { label: string; revenue: number }[] = [];
    const start = new Date(range.from);
    const end = new Date(range.to);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      series.push({ label: `${dt.getMonth() + 1}/${dt.getDate()}`, revenue: map.get(keyOf(dt)) ?? 0 });
    }
    return series;
  }



  private async notifyPaymentReceived(sale: Sales, transaction: PaymentTransaction): Promise<void> {
    try {
      const warehouse = sale.warehouse;
      const shop = sale.shop;
      const companyId = warehouse?.company?.id || shop?.company?.id;
      if (!companyId) return;

      const users = await this.userRepository.find({
        where: { companyId, role: UserRole.COMPANY_ADMIN },
      });

      for (const user of users) {
        await this.notificationService.sendEventNotification({
          type: NotificationType.PAYMENT,
          title: 'Payment Received',
          message: `Payment of ${transaction.amount} received for sale. Remaining: ${sale.remainingBalance}`,
          userId: user.id,
          companyId,
          metadata: {
            saleId: sale.id,
            amount: transaction.amount,
            remainingBalance: sale.remainingBalance,
            paymentMethod: transaction.paymentMethod,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send PAYMENT notification', error);
    }
  }

  private async createAuditLog(sale: Sales, userId: string | null, action: AuditAction): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      entityType: Sales.name,
      entityId: sale.id,
      action,
      user: userId ? { id: userId } as User : null,
      newValues: sale,
    });

    await this.auditLogRepository.save(auditLog);
  }

  private resolveInitialStatus(paymentType: PaymentType, remainingBalance: number, advancePayment: number): SaleStatus {
    if (paymentType !== PaymentType.CREDIT && remainingBalance <= 0.01) {
      return SaleStatus.COMPLETED;
    }
    if (paymentType === PaymentType.CREDIT || remainingBalance > 0.01) {
      if (remainingBalance <= 0.01) return SaleStatus.COMPLETED;
      if (advancePayment > 0.01) return SaleStatus.PARTIALLY_PAID;
      return SaleStatus.PENDING;
    }
    return remainingBalance <= 0.01 ? SaleStatus.COMPLETED : SaleStatus.PENDING;
  }

  private mapToResponseDto(sales: Sales): SaleResponseDto {
    const amountPaid = Math.max(0, Number(sales.totalAmount) - Number(sales.remainingBalance || 0));
    const customerPhone = sales.customer?.phoneNumber;
    const salesperson = sales.createdBy
      ? `${sales.createdBy.firstName || ''} ${sales.createdBy.lastName || ''}`.trim()
      : '';

    // Calculate last payment info
    let lastPaymentAmount: number | undefined;
    let lastPaymentDate: Date | undefined;

    const successfulTransactions = (sales.paymentTransactions || [])
      .filter(t => t.isSuccessful && t.transactionType === TransactionType.SALE)
      .sort((a, b) => new Date(b.transactionDate || b.createdAt).getTime() - new Date(a.transactionDate || a.createdAt).getTime());

    if (successfulTransactions.length > 0) {
      lastPaymentAmount = Number(successfulTransactions[0].amount || 0);
      lastPaymentDate = successfulTransactions[0].transactionDate || successfulTransactions[0].createdAt;
    } else if (amountPaid > 0) {
      lastPaymentAmount = Number(sales.advancePayment && Number(sales.advancePayment) > 0 ? sales.advancePayment : amountPaid);
      lastPaymentDate = sales.updatedAt || sales.saleDate || sales.createdAt;
    }

    return {
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      totalAmount: sales.totalAmount,
      taxAmount: sales.taxAmount,
      subtotal: sales.subtotal,
      discountAmount: sales.discountAmount,
      advancePayment: sales.advancePayment,
      amountPaid,
      lastPaymentAmount,
      lastPaymentDate,
      remainingBalance: Number(sales.remainingBalance || 0),
      saleDate: sales.saleDate,
      dueDate: sales.dueDate,
      reminderDate: sales.reminderDate,
      paymentType: sales.paymentType,
      status: sales.status,
      note: sales.note,
      receiptImageUrl: sales.receiptImageUrl,
      customerId: sales.customer?.id,
      customerName: sales.customer?.name || '',
      customerPhone: customerPhone && customerPhone !== '0000000000' ? customerPhone : undefined,
      warehouseName: sales.warehouse?.name || '',
      shopName: sales.shop?.name || undefined,
      salespersonName: salesperson || undefined,
      items: sales.items?.map(item => ({
        id: item.id,
        productId: item.product?.id || '',
        productName: item.product?.name || '',
        brand: (item.product?.metadata as any)?.brand || (item.product?.metadata as any)?.Brand || '',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      createdAt: sales.createdAt,
      updatedAt: sales.updatedAt,
    };
  }

  private mapToPaymentTransactionResponseDto(transaction: PaymentTransaction): PaymentTransactionResponseDto {
    const processor = transaction.processedBy;
    const processedByName = processor
      ? `${processor.firstName || ''} ${processor.lastName || ''}`.trim() || processor.email || processor.phone || ''
      : '';

    return {
      id: transaction.id,
      amount: Number(transaction.amount || 0),
      paymentMethod: transaction.paymentMethod,
      transactionType: transaction.transactionType,
      transactionReference: transaction.transactionReference,
      notes: transaction.notes,
      transactionDate: transaction.transactionDate,
      paymentDetails: transaction.paymentDetails,
      isSuccessful: transaction.isSuccessful,
      failureReason: transaction.failureReason,
      saleId: transaction.sale?.id || (transaction as any).saleId || '',
      processedBy: processor?.id || '',
      processedByName,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private async invalidateSaleCache(): Promise<void> {
    try {
      const deletedCount = await this.cacheService.deletePattern(`${CACHE_KEYS.SALES_LIST}*`);
      this.logger.debug(`Cleared ${deletedCount} sale cache entries`);
    } catch (error) {
      this.logger.warn('Failed to invalidate sale cache:', error);
    }
  }

  /**
   * Validate stock availability before processing a sale.
   * The location (warehouse/shop) stock is the source of truth - a sale can
   * never exceed what the selected location actually has on hand.
   */
  private async validateStock(saleItems: SaleItem[], warehouse: Warehouse, shop?: Shop): Promise<void> {
    for (const saleItem of saleItems) {
      const product = saleItem.product;
      const quantityRequested = saleItem.quantity;

      // Skip stock check if stock tracking is disabled for this product
      if (product.trackStock === false) {
        continue;
      }

      // 1. Overall product stock check
      if (product.stockQuantity < quantityRequested) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${quantityRequested}`
        );
      }

      // 2. Location-specific stock check (check shop if shop sale, else warehouse)
      if (shop) {
        const shopProduct = await this.shopProductRepository.findOne({
          where: { shop: { id: shop.id }, product: { id: product.id } }
        });
        const available = shopProduct ? shopProduct.stockQuantity : product.stockQuantity;
        if (available < quantityRequested) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" in shop "${shop.name}". Available: ${available}, Requested: ${quantityRequested}`
          );
        }
      } else if (warehouse) {
        const warehouseProduct = await this.warehouseProductRepository.findOne({
          where: { warehouse: { id: warehouse.id }, product: { id: product.id } }
        });
        const available = warehouseProduct ? warehouseProduct.stockQuantity : product.stockQuantity;
        if (available < quantityRequested) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" in warehouse "${warehouse.name}". Available: ${available}, Requested: ${quantityRequested}`
          );
        }
      }
    }
  }

  /**
   * Update inventory levels when a sale is made.
   */
  private async updateInventoryOnSale(saleItems: SaleItem[], warehouse: Warehouse, shop?: Shop): Promise<void> {
    for (const saleItem of saleItems) {
      const product = saleItem.product;
      const quantitySold = saleItem.quantity;

      if (warehouse) {
        let warehouseProduct = await this.warehouseProductRepository.findOne({
          where: { warehouse: { id: warehouse.id }, product: { id: product.id } }
        });

        if (!warehouseProduct) {
          warehouseProduct = this.warehouseProductRepository.create({
            warehouse: { id: warehouse.id } as Warehouse,
            product: { id: product.id } as Product,
            stockQuantity: Math.max(0, product.stockQuantity - quantitySold),
            salesQuantity: quantitySold,
            lastSaleDate: new Date(),
          });
        } else {
          warehouseProduct.stockQuantity = Math.max(0, warehouseProduct.stockQuantity - quantitySold);
          warehouseProduct.salesQuantity = (warehouseProduct.salesQuantity || 0) + quantitySold;
          warehouseProduct.lastSaleDate = new Date();
        }
        await this.warehouseProductRepository.save(warehouseProduct);
      }

      if (shop) {
        let shopProduct = await this.shopProductRepository.findOne({
          where: { shop: { id: shop.id }, product: { id: product.id } }
        });

        if (!shopProduct) {
          shopProduct = this.shopProductRepository.create({
            shop: { id: shop.id } as Shop,
            product: { id: product.id } as Product,
            stockQuantity: Math.max(0, product.stockQuantity - quantitySold),
            salesQuantity: quantitySold,
          });
        } else {
          shopProduct.stockQuantity = Math.max(0, shopProduct.stockQuantity - quantitySold);
          shopProduct.salesQuantity = (shopProduct.salesQuantity || 0) + quantitySold;
        }
        await this.shopProductRepository.save(shopProduct);
      }

      product.stockQuantity = Math.max(0, product.stockQuantity - quantitySold);
      const previousStock = product.stockQuantity + quantitySold;
      await this.productRepository.save(product);

      await this.productAlertService.checkLowStock(product, previousStock);
    }
  }

  /**
   * Get real-time inventory levels for a product at a specific location
   */
  async getInventoryLevels(productId: string, locationId: string, locationType: 'warehouse' | 'shop', currentUser?: any): Promise<any> {
    const product = await this.productRepository.findOne({ where: { id: productId }, relations: ['company'] });
    if (!product) throw new NotFoundException('Product not found');

    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
    if (!isSuperAdmin && userCompanyId && product.company?.id !== userCompanyId) {
      throw new NotFoundException('Product not found');
    }

    let locationStock = 0;
    let locationName = '';

    if (locationType === 'warehouse') {
      const warehouseProduct = await this.warehouseProductRepository.findOne({
        where: { warehouse: { id: locationId }, product: { id: productId } },
        relations: ['warehouse', 'warehouse.company']
      });
      
      if (warehouseProduct) {
        if (!isSuperAdmin && userCompanyId && warehouseProduct.warehouse?.company?.id !== userCompanyId) {
          throw new NotFoundException('Location not found');
        }
        locationStock = warehouseProduct.stockQuantity;
        locationName = warehouseProduct.warehouse.name;
      }
    } else if (locationType === 'shop') {
      const shopProduct = await this.shopProductRepository.findOne({
        where: { shop: { id: locationId }, product: { id: productId } },
        relations: ['shop', 'shop.company']
      });
      
      if (shopProduct) {
        if (!isSuperAdmin && userCompanyId && shopProduct.shop?.company?.id !== userCompanyId) {
          throw new NotFoundException('Location not found');
        }
        locationStock = shopProduct.stockQuantity;
        locationName = shopProduct.shop.name;
      }
    }

    return {
      productId: product.id,
      productName: product.name,
      totalStock: product.stockQuantity,
      locationId,
      locationType,
      locationName,
      locationStock,
      minStockLevel: product.minStockLevel,
      isLowStock: locationStock <= product.minStockLevel,
      lastUpdated: new Date()
    };
  }

  async findCustomerByPhone(phone: string, currentUser?: any): Promise<any> {
    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;

    const whereClause: any = { phoneNumber: phone };
    if (!isSuperAdmin && userCompanyId) {
      whereClause.company = { id: userCompanyId };
    }

    // Check if it's a customer
    const customer = await this.customerRepository.findOne({ 
      where: whereClause,
      select: ['id', 'name', 'phoneNumber', 'address']
    });
    
    if (customer) {
      return {
        type: 'customer',
        id: customer.id,
        name: customer.name,
        phone: customer.phoneNumber,
        address: customer.address
      };
    }

    // Check if it's a user in the same company
    const userWhere: any = { phone };
    if (!isSuperAdmin && userCompanyId) {
      userWhere.company = { id: userCompanyId };
    }
    const user = await this.userRepository.findOne({ 
      where: userWhere,
      select: ['id', 'firstName', 'lastName', 'email', 'phone']
    });
    
    if (user) {
      return {
        type: 'user',
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone
      };
    }

    throw new NotFoundException('Customer or user not found with this phone number');
  }

  async getUserInfo(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['company', 'shop', 'warehouse'],
      select: ['id', 'firstName', 'lastName', 'role', 'email', 'phone']
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const employee = await this.employeeRepository.findOne({
      where: { user: { id: userId } },
      relations: ['shop', 'warehouse']
    });

    return {
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        email: user.email,
        phone: user.phone
      },
      company: user.company ? {
        id: user.company.id,
        name: user.company.name
      } : null,
      shop: user.shop ? {
        id: user.shop.id,
        name: user.shop.name,
        location: user.shop.location
      } : null,
      warehouse: user.warehouse ? {
        id: user.warehouse.id,
        name: user.warehouse.name,
        location: user.warehouse.location
      } : null,
      employee: employee ? {
        id: employee.id,
        shop: employee.shop ? {
          id: employee.shop.id,
          name: employee.shop.name
        } : null,
        warehouse: employee.warehouse ? {
          id: employee.warehouse.id,
          name: employee.warehouse.name
        } : null
      } : null
    };
  }
}
