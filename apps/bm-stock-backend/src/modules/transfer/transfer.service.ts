import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transfer, TransferStatus, TransferType } from './entities/transfer.entity';
import { Product } from '../products/entities/product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shop } from '../shops/entities/shops.entity';
import { User } from '../users/entities/user.entity';
import { WarehouseProduct } from '../warehouse/entities/warehouse-product.entity';
import { ShopProduct } from '../shops/entities/shop-product.entity';
import { InventoryTransaction, InventoryTransactionType } from '../inventory/entities/inventory-transaction.entity';
import { CreateTransferDto, UpdateTransferStatusDto, TransferQueryDto, TransferResponseDto } from './dto';
import { PaginatedResult } from '@/common/interfaces';
import { UserRole } from '@/common/enums';
import { NotificationService } from '../notifications/notification.service';
import { ProductAlertService } from '../notifications/product-alert.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS } from '@/common/constants';

@Injectable()
export class TransferService implements OnModuleInit {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    @InjectRepository(Transfer) private readonly transferRepo: Repository<Transfer>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Shop) private readonly shopRepo: Repository<Shop>,
    @InjectRepository(WarehouseProduct) private readonly warehouseProductRepo: Repository<WarehouseProduct>,
    @InjectRepository(ShopProduct) private readonly shopProductRepo: Repository<ShopProduct>,
    @InjectRepository(InventoryTransaction) private readonly transactionRepo: Repository<InventoryTransaction>,
    @InjectRepository(User)     private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly productAlertService: ProductAlertService,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.recoverPendingTransfers();
  }

  /** Completes transfers left pending by older backend versions that required manual approval. */
  private async recoverPendingTransfers(): Promise<void> {
    const pending = await this.transferRepo.find({
      where: { status: TransferStatus.PENDING },
      relations: ['product', 'fromWarehouse', 'toWarehouse', 'fromShop', 'toShop', 'requestedBy'],
    });
    if (pending.length === 0) return;

    this.logger.log(`Recovering ${pending.length} pending transfer(s)`);
    for (const transfer of pending) {
      try {
        const actor = transfer.requestedBy;
        if (!actor) {
          this.logger.warn(`Skipping transfer ${transfer.id}: missing requester`);
          continue;
        }
        await this.executeTransfer(transfer, actor);
        transfer.status = TransferStatus.COMPLETED;
        transfer.approvedBy = actor;
        const saved = await this.transferRepo.save(transfer);
        await this.invalidateBranchCaches(saved);
        this.logger.log(`Recovered pending transfer ${transfer.id}`);
      } catch (error) {
        this.logger.error(`Failed to recover pending transfer ${transfer.id}`, error);
      }
    }
  }

  async create(dto: CreateTransferDto, user: User): Promise<TransferResponseDto> {
    const product = await this.productRepo.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    let fromWarehouse: Warehouse | null = null;
    let toWarehouse: Warehouse | null = null;
    let fromShop: Shop | null = null;
    let toShop: Shop | null = null;

    if (dto.type === TransferType.WAREHOUSE_TO_SHOP) {
      if (!dto.fromWarehouseId) throw new BadRequestException('fromWarehouseId is required for warehouse_to_shop');
      if (!dto.toShopId) throw new BadRequestException('toShopId is required for warehouse_to_shop');

      fromWarehouse = await this.warehouseRepo.findOne({ where: { id: dto.fromWarehouseId }, relations: ['company'] });
      if (!fromWarehouse) throw new NotFoundException('Source warehouse not found');

      toShop = await this.shopRepo.findOne({ where: { id: dto.toShopId }, relations: ['company'] });
      if (!toShop) throw new NotFoundException('Destination shop not found');

      const wp = await this.warehouseProductRepo.findOne({
        where: { warehouse: { id: fromWarehouse.id }, product: { id: product.id } },
      });
      if (!wp || wp.stockQuantity < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock in warehouse. Available: ${wp?.stockQuantity || 0}, Requested: ${dto.quantity}`,
        );
      }
    } else {
      if (!dto.fromShopId) throw new BadRequestException('fromShopId is required for shop_to_warehouse');
      if (!dto.toWarehouseId) throw new BadRequestException('toWarehouseId is required for shop_to_warehouse');

      fromShop = await this.shopRepo.findOne({ where: { id: dto.fromShopId }, relations: ['company'] });
      if (!fromShop) throw new NotFoundException('Source shop not found');

      toWarehouse = await this.warehouseRepo.findOne({ where: { id: dto.toWarehouseId }, relations: ['company'] });
      if (!toWarehouse) throw new NotFoundException('Destination warehouse not found');

      const sp = await this.shopProductRepo.findOne({
        where: { shop: { id: fromShop.id }, product: { id: product.id } },
      });
      if (!sp || sp.stockQuantity < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock in shop. Available: ${sp?.stockQuantity || 0}, Requested: ${dto.quantity}`,
        );
      }
    }

    const transfer = this.transferRepo.create({
      type: dto.type,
      product,
      fromWarehouse: fromWarehouse || null,
      toWarehouse: toWarehouse || null,
      fromShop: fromShop || null,
      toShop: toShop || null,
      quantity: dto.quantity,
      note: dto.note,
      requestedBy: user,
      status: TransferStatus.PENDING,
    });

    const saved = await this.transferRepo.save(transfer);

    const fullTransfer = await this.transferRepo.findOne({
      where: { id: saved.id },
      relations: [
        'product',
        'fromWarehouse',
        'fromWarehouse.company',
        'toWarehouse',
        'toWarehouse.company',
        'fromShop',
        'fromShop.company',
        'toShop',
        'toShop.company',
        'requestedBy',
      ],
    });
    if (!fullTransfer) throw new NotFoundException('Transfer not found after save');

    // Execute immediately so stock moves without a separate approval step.
    await this.executeTransfer(fullTransfer, user);
    fullTransfer.status = TransferStatus.COMPLETED;
    fullTransfer.approvedBy = user;
    const completed = await this.transferRepo.save(fullTransfer);
    await this.invalidateBranchCaches(completed);
    await this.sendTransferNotification(completed, 'approved');
    return this.mapToDto(completed);
  }

  private async invalidateBranchCaches(transfer: Transfer): Promise<void> {
    try {
      await this.cacheService.deletePattern(`${CACHE_KEYS.SHOPS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.WAREHOUSES_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCTS_LIST}*`);
      await this.cacheService.deletePattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
      if (transfer.toShop?.id) {
        await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.SHOP_DETAIL, transfer.toShop.id));
      }
      if (transfer.fromShop?.id) {
        await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.SHOP_DETAIL, transfer.fromShop.id));
      }
      if (transfer.fromWarehouse?.id) {
        await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.WAREHOUSE_DETAIL, transfer.fromWarehouse.id));
      }
      if (transfer.toWarehouse?.id) {
        await this.cacheService.del(this.cacheService.generateKey(CACHE_KEYS.WAREHOUSE_DETAIL, transfer.toWarehouse.id));
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate branch caches after transfer: ${error}`);
    }
  }

  async findAll(query: TransferQueryDto, user: User): Promise<PaginatedResult<TransferResponseDto>> {
    const { page = 1, limit = 10, status, type, branchId } = query;

    const qb = this.transferRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.product', 'product')
      .leftJoinAndSelect('t.fromWarehouse', 'fromWarehouse')
      .leftJoinAndSelect('t.toWarehouse', 'toWarehouse')
      .leftJoinAndSelect('t.fromShop', 'fromShop')
      .leftJoinAndSelect('t.toShop', 'toShop')
      .leftJoinAndSelect('t.requestedBy', 'requestedBy')
      .leftJoinAndSelect('t.approvedBy', 'approvedBy');

    if (user.companyId) {
      qb.leftJoin('fromWarehouse.company', 'fwCompany')
        .leftJoin('toWarehouse.company', 'twCompany')
        .leftJoin('fromShop.company', 'fsCompany')
        .leftJoin('toShop.company', 'tsCompany');
      qb.andWhere(
        `(fwCompany.id = :companyId OR twCompany.id = :companyId OR fsCompany.id = :companyId OR tsCompany.id = :companyId)`,
        { companyId: user.companyId },
      );
    }

    if (status) qb.andWhere('t.status = :status', { status });
    if (type) qb.andWhere('t.type = :type', { type });
    if (branchId) {
      qb.andWhere('(fromShop.id = :branchId OR toShop.id = :branchId)', { branchId });
    }

    qb.orderBy('t.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [transfers, total] = await qb.getManyAndCount();

    return {
      data: transfers.map(t => this.mapToDto(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<TransferResponseDto> {
    const transfer = await this.transferRepo.findOne({
      where: { id },
      relations: ['product', 'fromWarehouse', 'toWarehouse', 'fromShop', 'toShop', 'requestedBy', 'approvedBy'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return this.mapToDto(transfer);
  }

  async updateStatus(id: string, dto: UpdateTransferStatusDto, user: User): Promise<TransferResponseDto> {
    const transfer = await this.transferRepo.findOne({
      where: { id },
      relations: [
        'product',
        'fromWarehouse',
        'fromWarehouse.company',
        'toWarehouse',
        'toWarehouse.company',
        'fromShop',
        'fromShop.company',
        'toShop',
        'toShop.company',
        'requestedBy',
      ],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(`Transfer is already ${transfer.status}`);
    }

    if (dto.status === TransferStatus.REJECTED) {
      transfer.status = TransferStatus.REJECTED;
      transfer.rejectionReason = dto.rejectionReason;
      transfer.approvedBy = user;
      const saved = await this.transferRepo.save(transfer);
      await this.sendTransferNotification(saved, 'rejected');
      return this.mapToDto(saved);
    }

    if (dto.status === TransferStatus.CANCELLED) {
      transfer.status = TransferStatus.CANCELLED;
      transfer.approvedBy = user;
      const saved = await this.transferRepo.save(transfer);
      await this.sendTransferNotification(saved, 'cancelled');
      return this.mapToDto(saved);
    }

    // APPROVED - execute the stock transfer
    if (dto.status === TransferStatus.APPROVED) {
      await this.executeTransfer(transfer, user);
      transfer.status = TransferStatus.COMPLETED;
      transfer.approvedBy = user;
      const saved = await this.transferRepo.save(transfer);
      await this.invalidateBranchCaches(saved);
      await this.sendTransferNotification(saved, 'approved');
      return this.mapToDto(saved);
    }

    throw new BadRequestException('Invalid status');
  }

  private async executeTransfer(transfer: Transfer, user: User): Promise<void> {
    const { product, quantity, type } = transfer;

    if (type === TransferType.WAREHOUSE_TO_SHOP) {
      // Decrement warehouse stock
      const wp = await this.warehouseProductRepo.findOne({
        where: { warehouse: { id: transfer.fromWarehouse!.id }, product: { id: product.id } },
      });
      if (!wp || wp.stockQuantity < quantity) {
        throw new BadRequestException(`Insufficient stock in warehouse. Available: ${wp?.stockQuantity || 0}`);
      }
      const prevWhQty = wp.stockQuantity;
      wp.stockQuantity -= quantity;
      wp.quantity = wp.stockQuantity;
      await this.warehouseProductRepo.save(wp);

      // Create TRANSFER_OUT transaction
      await this.transactionRepo.save(this.transactionRepo.create({
        type: InventoryTransactionType.TRANSFER_OUT,
        quantity,
        previousQuantity: prevWhQty,
        newQuantity: wp.stockQuantity,
        reason: `Transfer to ${transfer.toShop!.name}`,
        referenceNumber: `TRF-${transfer.id.substring(0, 8)}`,
        product,
        warehouse: transfer.fromWarehouse,
        performedBy: user,
      }));

      // Increment shop stock
      let sp = await this.shopProductRepo.findOne({
        where: { shop: { id: transfer.toShop!.id }, product: { id: product.id } },
      });
      const prevShopQty = sp ? sp.stockQuantity : 0;
      if (sp) {
        sp.stockQuantity += quantity;
        await this.shopProductRepo.save(sp);
      } else {
        sp = this.shopProductRepo.create({
          shop: { id: transfer.toShop!.id } as Shop,
          product: { id: product.id } as Product,
          stockQuantity: quantity,
        });
        await this.shopProductRepo.save(sp);
      }

      // Create TRANSFER_IN transaction
      await this.transactionRepo.save(this.transactionRepo.create({
        type: InventoryTransactionType.TRANSFER_IN,
        quantity,
        previousQuantity: prevShopQty,
        newQuantity: sp.stockQuantity,
        reason: `Transfer from ${transfer.fromWarehouse!.name}`,
        referenceNumber: `TRF-${transfer.id.substring(0, 8)}`,
        product,
        shop: transfer.toShop,
        performedBy: user,
      }));

      await this.productAlertService.checkLowStock(product, prevShopQty, {
        currentQuantity: sp.stockQuantity,
        locationName: transfer.toShop!.name,
        companyId: transfer.toShop!.company?.id ?? product.companyId,
      });
    } else {
      // SHOP_TO_WAREHOUSE
      const sp = await this.shopProductRepo.findOne({
        where: { shop: { id: transfer.fromShop!.id }, product: { id: product.id } },
      });
      if (!sp || sp.stockQuantity < quantity) {
        throw new BadRequestException(`Insufficient stock in shop. Available: ${sp?.stockQuantity || 0}`);
      }
      const prevShopQty = sp.stockQuantity;
      sp.stockQuantity -= quantity;
      await this.shopProductRepo.save(sp);

      // Create TRANSFER_OUT transaction
      await this.transactionRepo.save(this.transactionRepo.create({
        type: InventoryTransactionType.TRANSFER_OUT,
        quantity,
        previousQuantity: prevShopQty,
        newQuantity: sp.stockQuantity,
        reason: `Transfer to ${transfer.toWarehouse!.name}`,
        referenceNumber: `TRF-${transfer.id.substring(0, 8)}`,
        product,
        shop: transfer.fromShop,
        performedBy: user,
      }));

      // Increment warehouse stock
      let wp = await this.warehouseProductRepo.findOne({
        where: { warehouse: { id: transfer.toWarehouse!.id }, product: { id: product.id } },
      });
      const prevWhQty = wp ? wp.stockQuantity : 0;
      if (wp) {
        wp.stockQuantity += quantity;
        wp.quantity = wp.stockQuantity;
        await this.warehouseProductRepo.save(wp);
      } else {
        wp = this.warehouseProductRepo.create({
          warehouse: transfer.toWarehouse!,
          product,
          stockQuantity: quantity,
          quantity,
        });
        await this.warehouseProductRepo.save(wp);
      }

      // Create TRANSFER_IN transaction
      await this.transactionRepo.save(this.transactionRepo.create({
        type: InventoryTransactionType.TRANSFER_IN,
        quantity,
        previousQuantity: prevWhQty,
        newQuantity: wp.stockQuantity,
        reason: `Transfer from ${transfer.fromShop!.name}`,
        referenceNumber: `TRF-${transfer.id.substring(0, 8)}`,
        product,
        warehouse: transfer.toWarehouse,
        performedBy: user,
      }));

      await this.productAlertService.checkLowStock(product, prevWhQty, {
        currentQuantity: wp.stockQuantity,
        locationName: transfer.toWarehouse!.name,
        companyId: transfer.toWarehouse!.company?.id ?? product.companyId,
      });
    }
  }

  async getTransferHistory(branchId: string, type: 'warehouse' | 'shop'): Promise<TransferResponseDto[]> {
    let transfers: Transfer[];

    if (type === 'warehouse') {
      transfers = await this.transferRepo.find({
        where: [
          { fromWarehouse: { id: branchId }, status: TransferStatus.COMPLETED },
          { toWarehouse: { id: branchId }, status: TransferStatus.COMPLETED },
        ],
        relations: ['product', 'fromWarehouse', 'toWarehouse', 'fromShop', 'toShop', 'requestedBy', 'approvedBy'],
        order: { createdAt: 'DESC' },
        take: 100,
      });
    } else {
      transfers = await this.transferRepo.find({
        where: [
          { fromShop: { id: branchId }, status: TransferStatus.COMPLETED },
          { toShop: { id: branchId }, status: TransferStatus.COMPLETED },
        ],
        relations: ['product', 'fromWarehouse', 'toWarehouse', 'fromShop', 'toShop', 'requestedBy', 'approvedBy'],
        order: { createdAt: 'DESC' },
        take: 100,
      });
    }

    return transfers.map(t => this.mapToDto(t));
  }

  private async sendTransferNotification(transfer: Transfer, action: 'requested' | 'approved' | 'rejected' | 'cancelled'): Promise<void> {
    try {
      const companyId = transfer.requestedBy?.companyId;
      if (!companyId) return;

      const users = await this.userRepo.find({
        where: { companyId, role: UserRole.COMPANY_ADMIN },
      });

      const statusLabels: Record<string, string> = {
        requested: 'Transfer Requested',
        approved: 'Transfer Approved',
        rejected: 'Transfer Rejected',
        cancelled: 'Transfer Cancelled',
      };

      const messages: Record<string, string> = {
        requested: `Transfer of ${transfer.quantity} "${transfer.product?.name}" requested`,
        approved: `Transfer of ${transfer.quantity} "${transfer.product?.name}" has been approved and completed`,
        rejected: `Transfer of ${transfer.quantity} "${transfer.product?.name}" has been rejected${transfer.rejectionReason ? `: ${transfer.rejectionReason}` : ''}`,
        cancelled: `Transfer of ${transfer.quantity} "${transfer.product?.name}" has been cancelled`,
      };

      for (const user of users) {
        await this.notificationService.sendEventNotification({
          type: NotificationType.TRANSFER,
          title: statusLabels[action] || 'Transfer Update',
          message: messages[action] || `Transfer ${action}`,
          userId: user.id,
          companyId,
          metadata: {
            transferId: transfer.id,
            action,
            productName: transfer.product?.name,
            quantity: transfer.quantity,
            rejectionReason: transfer.rejectionReason,
          },
        });
      }

      // Also notify the requester if action is not 'requested'
      if (action !== 'requested' && transfer.requestedBy?.id) {
        await this.notificationService.sendEventNotification({
          type: NotificationType.TRANSFER,
          title: statusLabels[action] || 'Transfer Update',
          message: messages[action] || `Transfer ${action}`,
          userId: transfer.requestedBy.id,
          companyId,
          metadata: {
            transferId: transfer.id,
            action,
            productName: transfer.product?.name,
            quantity: transfer.quantity,
            rejectionReason: transfer.rejectionReason,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send TRANSFER notification', error);
    }
  }

  private mapToDto(t: Transfer): TransferResponseDto {
    return {
      id: t.id,
      type: t.type,
      status: t.status,
      quantity: t.quantity,
      note: t.note,
      rejectionReason: t.rejectionReason,
      productId: t.product?.id,
      productName: t.product?.name,
      productSku: t.product?.sku,
      fromWarehouseId: t.fromWarehouse?.id,
      fromWarehouseName: t.fromWarehouse?.name,
      toWarehouseId: t.toWarehouse?.id,
      toWarehouseName: t.toWarehouse?.name,
      fromShopId: t.fromShop?.id,
      fromShopName: t.fromShop?.name,
      toShopId: t.toShop?.id,
      toShopName: t.toShop?.name,
      requestedById: t.requestedBy?.id,
      requestedByName: t.requestedBy
        ? `${(t.requestedBy as any).firstName || ''} ${(t.requestedBy as any).lastName || ''}`.trim()
        : '',
      approvedById: t.approvedBy?.id,
      approvedByName: t.approvedBy
        ? `${(t.approvedBy as any).firstName || ''} ${(t.approvedBy as any).lastName || ''}`.trim()
        : undefined,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}
