import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sales } from '../sales/entities/sales.entity';
import { Product } from '../products/entities/product.entity';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS } from '@/common/constants';
import { resolveEffectiveCompanyId } from '@/common/utils/tenant.util';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Sales)
    private readonly salesRepository: Repository<Sales>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(ShopProduct)
    private readonly shopProductRepository: Repository<ShopProduct>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly cacheService: CacheService,
  ) {}

  async getSummary(query: { period?: string; format?: string; startDate?: string; endDate?: string; companyId?: string }, currentUser?: any) {
    const { start, end, periodLabel } = this.resolveDateRange(query);
    const companyId = resolveEffectiveCompanyId(currentUser, query.companyId);

    const cacheKey = this.cacheService.generateKey(
      CACHE_KEYS.DASHBOARD_SUMMARY,
      companyId || 'all',
      periodLabel,
      query.startDate || '',
      query.endDate || '',
    );
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const qb = this.salesRepository.createQueryBuilder('sales')
      .leftJoin('sales.warehouse', 'warehouse')
      .leftJoin('sales.shop', 'shop')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany');

    if (companyId) {
      qb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId });
    }
    qb.andWhere('sales.saleDate >= :start', { start });
    qb.andWhere('sales.saleDate <= :end', { end });
    qb.andWhere('sales.status != :cancelled', { cancelled: 'cancelled' });

    const salesResult = await qb
      .select([
        'COUNT(sales.id) as "totalSales"',
        'COALESCE(SUM(sales.totalAmount), 0) as "totalRevenue"',
        'COALESCE(AVG(sales.totalAmount), 0) as "averageSaleAmount"',
      ])
      .getRawOne();

    const customerQb = this.salesRepository.createQueryBuilder('sales')
      .leftJoin('sales.warehouse', 'warehouse')
      .leftJoin('sales.shop', 'shop')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany')
      .leftJoin('sales.customer', 'customer');
    if (companyId) {
      customerQb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId });
    }
    customerQb
      .andWhere('sales.saleDate >= :start', { start })
      .andWhere('sales.saleDate <= :end', { end })
      .andWhere('sales.status != :cancelled', { cancelled: 'cancelled' })
      .select('COUNT(DISTINCT customer.id) as "totalCustomers"');
    const customerResult = await customerQb.getRawOne();

    const productQb = this.productRepository.createQueryBuilder('product')
      .leftJoin('product.company', 'pCompany')
      .leftJoin('product.warehouseProducts', 'wp')
      .leftJoin('wp.warehouse', 'wh')
      .leftJoin('wh.company', 'wpCompany');
    if (companyId) {
      productQb.andWhere('(pCompany.id = :companyId OR wpCompany.id = :companyId)', { companyId });
    }
    const totalProducts = await productQb.getCount();

    const lowStockQb = this.productRepository.createQueryBuilder('product')
      .leftJoin('product.company', 'pCompany')
      .leftJoin('product.warehouseProducts', 'wp')
      .leftJoin('wp.warehouse', 'wh')
      .leftJoin('wh.company', 'wpCompany');
    if (companyId) {
      lowStockQb.andWhere('(pCompany.id = :companyId OR wpCompany.id = :companyId)', { companyId });
    }
    lowStockQb.andWhere('product.trackStock = true')
      .andWhere('product.stockQuantity <= product.minStockLevel');
    const lowStockItems = await lowStockQb.getCount();

    const expiredQb = this.productRepository.createQueryBuilder('product')
      .leftJoin('product.company', 'pCompany')
      .leftJoin('product.warehouseProducts', 'wp')
      .leftJoin('wp.warehouse', 'wh')
      .leftJoin('wh.company', 'wpCompany');
    if (companyId) {
      expiredQb.andWhere('(pCompany.id = :companyId OR wpCompany.id = :companyId)', { companyId });
    }
    expiredQb.andWhere('product.expiryDate IS NOT NULL')
      .andWhere('product.expiryDate < :today', { today: new Date() });
    const expiredItems = await expiredQb.getCount();

    const stockValueQb = this.productRepository.createQueryBuilder('product')
      .leftJoin('product.company', 'pCompany')
      .leftJoin('product.warehouseProducts', 'wp')
      .leftJoin('wp.warehouse', 'wh')
      .leftJoin('wh.company', 'wpCompany');
    if (companyId) {
      stockValueQb.andWhere('(pCompany.id = :companyId OR wpCompany.id = :companyId)', { companyId });
    }
    const stockValueResult = await stockValueQb
      .select('COALESCE(SUM(product.stockQuantity * product.price), 0)', 'totalStockValue')
      .getRawOne();

    const creditQb = this.salesRepository.createQueryBuilder('sales')
      .leftJoin('sales.warehouse', 'warehouse')
      .leftJoin('sales.shop', 'shop')
      .leftJoin('warehouse.company', 'wCompany')
      .leftJoin('shop.company', 'sCompany')
      .leftJoin('sales.customer', 'customer')
      .where('sales.paymentType = :credit', { credit: 'credit' })
      .andWhere('sales.remainingBalance > 0')
      .andWhere('sales.status != :cancelled', { cancelled: 'cancelled' });

    if (companyId) {
      creditQb.andWhere('(wCompany.id = :companyId OR sCompany.id = :companyId)', { companyId });
    }

    const creditResult = await creditQb
      .select([
        'COALESCE(SUM(sales.remainingBalance), 0) as "totalCredit"',
        'COUNT(DISTINCT customer.id) as "creditCustomers"',
      ])
      .getRawOne();

    const result = {
      metadata: {
        generatedAt: new Date().toISOString(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        filters: {
          format: query.format || 'json',
          period: periodLabel,
          companyId,
        },
      },
      inventory: {
        totalProducts,
        totalStockValue: parseFloat(stockValueResult?.totalStockValue) || 0,
        lowStockItems,
        expiredItems,
      },
      sales: {
        totalSales: parseInt(salesResult?.totalSales) || 0,
        totalRevenue: parseFloat(salesResult?.totalRevenue) || 0,
        averageSaleAmount: parseFloat(salesResult?.averageSaleAmount) || 0,
        totalCustomers: parseInt(customerResult?.totalCustomers) || 0,
        totalCredit: parseFloat(creditResult?.totalCredit) || 0,
        creditCustomers: parseInt(creditResult?.creditCustomers) || 0,
      },
      expenses: {
        totalExpenses: 0,
        totalAmount: 0,
      },
    };

    await this.cacheService.set(cacheKey, result, 120000);
    return result;
  }

  private resolveDateRange(query: { period?: string; startDate?: string; endDate?: string }) {
    const now = new Date();

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      return { start, end, periodLabel: `${query.startDate}_to_${query.endDate}` };
    }

    const period = query.period || 'today';
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (period) {
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return {
          start: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0),
          end: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999),
          periodLabel: 'yesterday',
        };
      }
      case 'thisWeek': {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd, periodLabel: 'thisWeek' };
      }
      case 'thisMonth': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: monthStart, end: monthEnd, periodLabel: 'thisMonth' };
      }
      case 'all':
        return {
          start: new Date(2000, 0, 1),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
          periodLabel: 'all',
        };
      default:
        return { start: startOfDay, end: endOfDay, periodLabel: 'today' };
    }
  }
}
