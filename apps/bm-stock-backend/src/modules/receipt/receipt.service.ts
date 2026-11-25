import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Sales } from '../sales/entities/sales.entity';
import { SaleItem } from '../sales/entities/sales-item.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Settings } from '../settings/entities/settings.entity';
import { CreditAccount, CreditPayment } from '../credits/entities/credit.entity';
import { UserRole } from '@/common/enums';

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    @InjectRepository(Sales)
    private readonly salesRepository: Repository<Sales>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
    @InjectRepository(CreditAccount)
    private readonly creditAccountRepository: Repository<CreditAccount>,
    @InjectRepository(CreditPayment)
    private readonly creditPaymentRepository: Repository<CreditPayment>,
  ) {}

  /**
   * Look up the settings row belonging to a company. Falls back to the global
   * settings row when no company is provided or the company has none yet.
   */
  private async findSettingsForCompany(companyId?: string): Promise<Settings | null> {
    const where: FindOptionsWhere<Settings> = companyId
      ? { companyId }
      : { companyId: IsNull() };
    const scoped = await this.settingsRepository.findOne({ where });
    if (scoped) return scoped;
    if (companyId) {
      return this.settingsRepository.findOne({ where: { companyId: IsNull() } });
    }
    return null;
  }

  async generateSaleReceipt(saleId: string, currentUser?: any): Promise<{ html: string; invoiceNumber: string }> {
    const sale = await this.salesRepository.findOne({
      where: { id: saleId },
      relations: ['customer', 'warehouse', 'shop', 'items', 'items.product', 'paymentTransactions', 'warehouse.company', 'shop.company'],
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    const userCompanyId = currentUser?.companyId || currentUser?.company?.id;
    if (!isSuperAdmin && userCompanyId) {
      const saleCompanyId = sale.warehouse?.company?.id || sale.shop?.company?.id;
      if (saleCompanyId && saleCompanyId !== userCompanyId) {
        throw new NotFoundException('Sale not found');
      }
    }

    const settings = await this.findSettingsForCompany((sale.warehouse as any)?.companyId);
    const items = sale.items || [];

    const html = this.buildReceiptHtml({
      companyName: settings?.companyName || 'GelagleStock',
      companyAddress: settings?.companyAddress || '',
      companyPhone: settings?.companyPhone || '',
      companyEmail: settings?.companyEmail || '',
      companyLogo: settings?.companyLogo || '',
      invoiceNumber: sale.invoiceNumber || `INV-${sale.id.slice(0, 8)}`,
      saleDate: sale.saleDate,
      customerName: sale.customer?.name || 'Walk-in Customer',
      customerPhone: sale.customer?.phoneNumber || '',
      warehouseName: sale.warehouse?.name || '',
      shopName: sale.shop?.name || '',
      items: items.map(item => ({
        productName: item.product?.name || 'Unknown',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        taxAmount: Number(item.taxAmount),
        discountAmount: Number(item.discountAmount),
        total: Number(item.total),
      })),
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.taxAmount),
      discountAmount: Number(sale.discountAmount),
      totalAmount: Number(sale.totalAmount),
      advancePayment: Number(sale.advancePayment || 0),
      remainingBalance: Number(sale.remainingBalance || 0),
      paymentType: sale.paymentType,
      status: sale.status,
      currency: settings?.defaultCurrency || 'USD',
    });

    return { html, invoiceNumber: sale.invoiceNumber };
  }

  async generateCreditStatement(creditId: string): Promise<{ html: string }> {
    const account = await this.creditAccountRepository.findOne({
      where: { id: creditId },
      relations: ['customer', 'payments', 'transactions', 'linkedSale', 'company'],
    });
    if (!account) throw new NotFoundException('Credit account not found');

    const settings = await this.findSettingsForCompany((account as any).company?.id);

    const html = this.buildCreditStatementHtml({
      companyName: settings?.companyName || 'GelagleStock',
      companyAddress: settings?.companyAddress || '',
      companyPhone: settings?.companyPhone || '',
      customerName: account.customer?.name || 'Unknown',
      customerPhone: account.customer?.phoneNumber || '',
      account: {
        totalOwed: Number(account.totalOwed),
        totalPaid: Number(account.totalPaid),
        outstandingBalance: Number(account.outstandingBalance),
        interestRate: Number(account.interestRate),
        accruedInterest: Number(account.accruedInterest),
        status: account.status,
        dueDate: account.dueDate,
      },
      transactions: (account.transactions || []).map(tx => ({
        type: tx.type,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
        description: tx.description || '',
        date: tx.createdAt,
      })),
      payments: (account.payments || []).map(p => ({
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        reference: p.reference || '',
        date: p.createdAt,
      })),
      currency: settings?.defaultCurrency || 'USD',
    });

    return { html };
  }

  async generatePaymentReceipt(creditId: string, paymentId: string): Promise<{ html: string }> {
    const account = await this.creditAccountRepository.findOne({
      where: { id: creditId },
      relations: ['customer', 'company'],
    });
    if (!account) throw new NotFoundException('Credit account not found');

    const payment = await this.creditPaymentRepository.findOne({
      where: { id: paymentId },
      relations: ['receivedBy'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const settings = await this.findSettingsForCompany((account as any).company?.id);

    const html = this.buildPaymentReceiptHtml({
      companyName: settings?.companyName || 'GelagleStock',
      companyAddress: settings?.companyAddress || '',
      companyPhone: settings?.companyPhone || '',
      customerName: account.customer?.name || 'Unknown',
      paymentId: payment.id,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      reference: payment.reference || '',
      date: payment.createdAt,
      outstandingBalance: Number(account.outstandingBalance),
      currency: settings?.defaultCurrency || 'USD',
    });

    return { html };
  }

  private buildReceiptHtml(data: any): string {
    const items = data.items.map((item: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.productName}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${this.fmt(item.unitPrice, data.currency)}</td>
        <td class="right">${this.fmt(item.total, data.currency)}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Courier New', monospace; max-width: 400px; margin: 0 auto; padding: 20px; font-size: 12px; }
  h1 { text-align: center; font-size: 18px; margin: 0; }
  .company-info { text-align: center; margin-bottom: 15px; }
  .divider { border-top: 1px dashed #000; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 3px 0; text-align: left; }
  .right { text-align: right; }
  .totals { margin-top: 10px; }
  .totals td { padding: 2px 0; }
  .total-row td { font-weight: bold; border-top: 1px solid #000; padding-top: 5px; }
  .footer { text-align: center; margin-top: 15px; font-size: 10px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; text-transform: uppercase; }
  .badge.paid { background: #d4edda; color: #155724; }
  .badge.pending { background: #fff3cd; color: #856404; }
  .badge.credit { background: #f8d7da; color: #721c24; }
  .due { color: #dc2626; font-weight: bold; }
</style></head><body>
  <div class="company-info">
    <h1>${data.companyName}</h1>
    ${data.companyAddress ? `<p>${data.companyAddress}</p>` : ''}
    ${data.companyPhone ? `<p>Tel: ${data.companyPhone}</p>` : ''}
    ${data.companyEmail ? `<p>Email: ${data.companyEmail}</p>` : ''}
  </div>
  <div class="divider"></div>
  <p><strong>Invoice:</strong> ${data.invoiceNumber}</p>
  <p><strong>Date:</strong> ${new Date(data.saleDate).toLocaleDateString()}</p>
  <p><strong>Customer:</strong> ${data.customerName}</p>
  ${data.customerPhone ? `<p><strong>Phone:</strong> ${data.customerPhone}</p>` : ''}
  ${data.warehouseName ? `<p><strong>Warehouse:</strong> ${data.warehouseName}</p>` : ''}
  ${data.shopName ? `<p><strong>Shop:</strong> ${data.shopName}</p>` : ''}
  <div class="divider"></div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="totals">
    <table>
      ${data.discountAmount > 0 ? `<tr><td>Discount:</td><td class="right">-${this.fmt(data.discountAmount, data.currency)}</td></tr>` : ''}
      <tr class="total-row"><td><strong>TOTAL:</strong></td><td class="right"><strong>${this.fmt(data.totalAmount, data.currency)}</strong></td></tr>
      ${data.advancePayment > 0 ? `<tr><td>Amount Paid:</td><td class="right">${this.fmt(data.advancePayment, data.currency)}</td></tr>` : ''}
      ${data.remainingBalance > 0 ? `<tr><td>Balance Due:</td><td class="right due">${this.fmt(data.remainingBalance, data.currency)}</td></tr>` : ''}
    </table>
  </div>
  <div class="divider"></div>
  <p><strong>Payment:</strong> ${data.paymentType.toUpperCase()} <span class="badge ${data.status === 'completed' ? 'paid' : data.paymentType === 'credit' ? 'credit' : 'pending'}">${data.status === 'completed' ? 'Paid' : data.status === 'partially_paid' ? 'Partially Paid' : 'Not Paid'}</span></p>
  <div class="footer"><p>Thank you for your business!</p></div>
</body></html>`;
  }

  private buildCreditStatementHtml(data: any): string {
    const txRows = data.transactions.map((tx: any) => `
      <tr>
        <td>${new Date(tx.date).toLocaleDateString()}</td>
        <td>${tx.type}</td>
        <td class="right">${this.fmt(tx.amount, data.currency)}</td>
        <td class="right">${this.fmt(tx.balanceAfter, data.currency)}</td>
        <td>${tx.description}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; padding: 20px; font-size: 12px; }
  h1 { font-size: 18px; }
  .divider { border-top: 1px dashed #000; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 2px; text-align: left; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  .summary { display: flex; gap: 20px; margin: 15px 0; }
  .summary-box { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
  .summary-box .label { font-size: 10px; text-transform: uppercase; color: #666; }
  .summary-box .value { font-size: 18px; font-weight: bold; }
</style></head><body>
  <h1>Credit Statement</h1>
  <div class="company-info">
    <p>${data.companyName} | ${data.companyPhone}</p>
  </div>
  <div class="divider"></div>
  <p><strong>Customer:</strong> ${data.customerName} | ${data.customerPhone}</p>
  <div class="summary">
    <div class="summary-box"><div class="label">Total Owed</div><div class="value">${this.fmt(data.account.totalOwed, data.currency)}</div></div>
    <div class="summary-box"><div class="label">Total Paid</div><div class="value">${this.fmt(data.account.totalPaid, data.currency)}</div></div>
    <div class="summary-box"><div class="label">Outstanding</div><div class="value">${this.fmt(data.account.outstandingBalance, data.currency)}</div></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th class="right">Amount</th><th class="right">Balance</th><th>Description</th></tr></thead>
    <tbody>${txRows}</tbody>
  </table>
</body></html>`;
  }

  private buildPaymentReceiptHtml(data: any): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Courier New', monospace; max-width: 400px; margin: 0 auto; padding: 20px; font-size: 12px; }
  h1 { text-align: center; font-size: 18px; }
  .divider { border-top: 1px dashed #000; margin: 10px 0; }
  .detail td { padding: 3px 0; }
</style></head><body>
  <h1>Payment Receipt</h1>
  <p style="text-align:center">${data.companyName} | ${data.companyPhone}</p>
  <div class="divider"></div>
  <table class="detail">
    <tr><td><strong>Receipt #:</strong></td><td>${data.paymentId.slice(0, 8).toUpperCase()}</td></tr>
    <tr><td><strong>Date:</strong></td><td>${new Date(data.date).toLocaleDateString()}</td></tr>
    <tr><td><strong>Customer:</strong></td><td>${data.customerName}</td></tr>
    <tr><td><strong>Amount:</strong></td><td>${this.fmt(data.amount, data.currency)}</td></tr>
    <tr><td><strong>Method:</strong></td><td>${data.paymentMethod.toUpperCase()}</td></tr>
    ${data.reference ? `<tr><td><strong>Reference:</strong></td><td>${data.reference}</td></tr>` : ''}
    <tr><td><strong>Outstanding Balance:</strong></td><td>${this.fmt(data.outstandingBalance, data.currency)}</td></tr>
  </table>
  <div class="divider"></div>
  <p style="text-align:center">Payment received successfully</p>
</body></html>`;
  }

  private fmt(amount: number, currency: string = 'USD'): string {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
