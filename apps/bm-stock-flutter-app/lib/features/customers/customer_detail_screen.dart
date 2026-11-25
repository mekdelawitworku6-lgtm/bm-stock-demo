import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/customer_model.dart';
import '../../core/models/sale_model.dart';
import '../../core/services/customer_service.dart';
import '../../core/services/sale_service.dart';
import 'add_customer_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class CustomerDetailScreen extends StatefulWidget {
  final CustomerModel customer;

  const CustomerDetailScreen({super.key, required this.customer});

  @override
  State<CustomerDetailScreen> createState() => _CustomerDetailScreenState();
}

class _CustomerDetailScreenState extends State<CustomerDetailScreen> with SingleTickerProviderStateMixin {
  final _customerService = CustomerService();
  final _saleService = SaleService();

  late CustomerModel _customer;
  List<SaleModel> _sales = [];
  final Map<String, List<Map<String, dynamic>>> _paymentHistory = {};
  bool _isLoading = true;
  String? _error;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _customer = widget.customer;
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final customer = await _customerService.getById(_customer.id);
      final sales = await _saleService.getAll(customerId: _customer.id, limit: 200);
      final history = <String, List<Map<String, dynamic>>>{};
      for (final sale in sales.where((s) => s.isCreditSale)) {
        try {
          history[sale.id] = await _saleService.getPaymentHistory(sale.id);
        } catch (_) {
          history[sale.id] = [];
        }
      }
      if (!mounted) return;
      setState(() {
        _customer = customer;
        _sales = sales;
        _paymentHistory
          ..clear()
          ..addAll(history);
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _isLoading = false;
      });
    }
  }

  double get _totalSpent => _sales.fold(0, (sum, s) => sum + s.totalAmount);

  double get _outstandingBalance =>
      _sales.where((s) => s.isCreditSale).fold(0, (sum, s) => sum + s.remainingBalance);

  String get _paymentStatus {
    if (_sales.isEmpty) return 'No purchases';
    if (_outstandingBalance > 0.01) return 'Outstanding';
    final hasCredit = _sales.any((s) => s.isCreditSale);
    if (hasCredit) return 'Paid';
    return 'Clear';
  }

  List<SaleModel> get _creditSales => _sales.where((s) => s.isCreditSale).toList();

  List<Map<String, dynamic>> get _allPayments {
    final payments = <Map<String, dynamic>>[];
    for (final entry in _paymentHistory.entries) {
      for (final payment in entry.value) {
        payments.add({
          ...payment,
          'saleId': entry.key,
        });
      }
    }
    payments.sort((a, b) {
      final da = DateTime.tryParse('${a['transactionDate'] ?? a['createdAt'] ?? ''}') ?? DateTime.fromMillisecondsSinceEpoch(0);
      final db = DateTime.tryParse('${b['transactionDate'] ?? b['createdAt'] ?? ''}') ?? DateTime.fromMillisecondsSinceEpoch(0);
      return db.compareTo(da);
    });
    return payments;
  }

  Future<void> _editCustomer() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => AddCustomerScreen(customer: _customer)),
    );
    if (result == true && mounted) {
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _customer.name,
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: _kBlue, size: 22),
            onPressed: _editCustomer,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: _kBlue,
          unselectedLabelColor: _kSlate,
          indicatorColor: _kBlue,
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Purchases'),
            Tab(text: 'Credit'),
            Tab(text: 'Payments'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: _kBlue))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: GoogleFonts.outfit(color: _kRed)),
                      const SizedBox(height: 12),
                      TextButton(onPressed: _load, child: Text(context.tr('retry'), style: GoogleFonts.outfit(color: _kBlue))),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: Column(
                    children: [
                      _buildSummary(),
                      Expanded(
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            _buildPurchaseList(),
                            _buildCreditList(),
                            _buildPaymentList(),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildSummary() {
    final statusColor = _paymentStatus == 'Outstanding'
        ? _kAmber
        : (_paymentStatus == 'Paid' || _paymentStatus == 'Clear' ? _kGreen : _kSlate);

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _infoRow(Icons.person_outline, _customer.name),
          const SizedBox(height: 8),
          _infoRow(Icons.phone_outlined, _customer.displayPhone),
          if (_customer.address != null && _customer.address!.isNotEmpty) ...[
            const SizedBox(height: 8),
            _infoRow(Icons.location_on_outlined, _customer.address!),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _metricCard('Total Spent', 'ETB ${_totalSpent.toStringAsFixed(2)}', _kBlue)),
              const SizedBox(width: 10),
              Expanded(child: _metricCard(context.tr('outstanding_credit'), 'ETB ${_outstandingBalance.toStringAsFixed(2)}', _kAmber)),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: statusColor.withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 18, color: statusColor),
                const SizedBox(width: 8),
                Text('Payment status: $_paymentStatus', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: statusColor)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: _kSlate),
        const SizedBox(width: 10),
        Expanded(child: Text(value, style: GoogleFonts.outfit(fontSize: 14, color: _kInk))),
      ],
    );
  }

  Widget _metricCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
          const SizedBox(height: 4),
          Text(value, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildPurchaseList() {
    if (_sales.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 80),
          Center(child: Text('No purchase history yet', style: GoogleFonts.outfit(color: _kSlate))),
        ],
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _sales.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _SaleTile(sale: _sales[i]),
    );
  }

  Widget _buildCreditList() {
    if (_creditSales.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 80),
          Center(child: Text('No credit transactions', style: GoogleFonts.outfit(color: _kSlate))),
        ],
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _creditSales.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _CreditTile(sale: _creditSales[i]),
    );
  }

  Widget _buildPaymentList() {
    final payments = _allPayments;
    if (payments.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 80),
          Center(child: Text('No payments recorded', style: GoogleFonts.outfit(color: _kSlate))),
        ],
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: payments.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _PaymentTile(payment: payments[i]),
    );
  }
}

class _SaleTile extends StatelessWidget {
  final SaleModel sale;
  const _SaleTile({required this.sale});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ETB ${sale.totalAmount.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                const SizedBox(height: 4),
                Text('${sale.paymentType.toUpperCase()} · ${sale.saleDate}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                if (sale.warehouseName.isNotEmpty)
                  Text(sale.warehouseName, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
              ],
            ),
          ),
          _statusChip(sale.status),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    final color = status == 'completed' || status == 'paid' ? _kGreen : _kAmber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
      child: Text(status, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _CreditTile extends StatelessWidget {
  final SaleModel sale;
  const _CreditTile({required this.sale});

  @override
  Widget build(BuildContext context) {
    final isOutstanding = sale.remainingBalance > 0.01;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isOutstanding ? _kAmber.withValues(alpha: 0.4) : _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('ETB ${sale.totalAmount.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
              ),
              Text(
                isOutstanding ? 'Due ETB ${sale.remainingBalance.toStringAsFixed(2)}' : 'Paid',
                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: isOutstanding ? _kAmber : _kGreen),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text('Advance: ETB ${sale.advancePayment.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
          Text(sale.saleDate, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
        ],
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final Map<String, dynamic> payment;
  const _PaymentTile({required this.payment});

  @override
  Widget build(BuildContext context) {
    final amount = (payment['amount'] as num?)?.toDouble() ?? 0;
    final method = payment['paymentMethod']?.toString() ?? 'payment';
    final date = payment['transactionDate']?.toString() ?? payment['createdAt']?.toString() ?? '';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: _kGreen.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.payments_outlined, color: _kGreen, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ETB ${amount.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
                Text('$method · $date', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
