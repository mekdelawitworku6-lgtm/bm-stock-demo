import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:async';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/commission/commission_bloc.dart';
import '../../core/localization/app_localizations.dart';
import 'commission_config_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kBlueDark = Color(0xFF024A85);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);

class CommissionScreen extends StatefulWidget {
  const CommissionScreen({super.key});

  @override
  State<CommissionScreen> createState() => _CommissionScreenState();
}

class _CommissionScreenState extends State<CommissionScreen> {
  String _period = 'Week';
  String _activeTab = 'Staff Earnings';
  StreamSubscription<CommissionState>? _sub;
  String? _lastNotice;

  @override
  void initState() {
    super.initState();
    _loadCommissions();
    _sub = context.read<CommissionBloc>().stream.listen((s) {
      final notice = s.notice;
      if (notice != null && notice != _lastNotice && mounted) {
        _lastNotice = notice;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(notice)));
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _loadCommissions() {
    context.read<CommissionBloc>().add(CommissionsLoadRequested(period: _period));
  }

  double _toDouble(Object? value) => double.tryParse('$value') ?? 0;

  Future<void> _openCommissionConfig() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const CommissionConfigScreen()),
    );
    if (mounted) _loadCommissions();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthBloc>().user;
    if (!(user?.canUseCommission ?? false)) {
      return Scaffold(
        backgroundColor: _kBg,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(context.tr('commission'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(20)),
                  child: const Icon(Icons.lock_outline, color: _kBlue, size: 36),
                ),
                const SizedBox(height: 18),
                Text('Large Business Plan Exclusive', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                const SizedBox(height: 8),
                Text(
                  'Commission management is exclusively available on the Large Business Plan (15,999 ETB). Upgrade to track staff earnings, approve payouts, and configure commission rules.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.pushNamed(context, '/choose_plan', arguments: {'upgrade': true}),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  child: Text('Upgrade to Large Plan', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return BlocBuilder<CommissionBloc, CommissionState>(
      builder: (context, state) {
        final visible = state.filterCommissions(_period);

        double totalCommission = 0;
        double paidOut = 0;
        for (final c in visible) {
          final amount = _toDouble(c['commissionAmount']);
          totalCommission += amount;
          if (c['isApproved'] == true) {
            paidOut += amount;
          }
        }
        final pending = totalCommission - paidOut;

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
              context.tr('commission'),
              style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
            ),
          ),
          body: state.isLoading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: () async { _loadCommissions(); },
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Commission config (company admin only)
                      if (context.read<AuthBloc>().user?.isAdmin ?? false) ...[
                        _CommissionConfigButton(onTap: _openCommissionConfig),
                        const SizedBox(height: 12),
                      ],

                      // Period tabs
                      _PeriodSelector(
                        selected: _period,
                        onSelect: (p) => setState(() { _period = p; }),
                      ),
                      const SizedBox(height: 12),

                      // Product filter
                      if (state.products.isNotEmpty) ...[
                        _ProductFilterChips(
                          products: state.products,
                          selectedId: state.selectedProductId,
                          onSelect: (id) {
                            context.read<CommissionBloc>().add(CommissionProductFilterChanged(id));
                          },
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Summary card
                      _SummaryCard(
                        total: totalCommission,
                        paidOut: paidOut,
                        pending: pending,
                        count: visible.length,
                      ),
                      const SizedBox(height: 20),

                      // Toggle buttons
                      _TabToggle(
                        activeTab: _activeTab,
                        onToggle: (t) => setState(() => _activeTab = t),
                      ),
                      const SizedBox(height: 16),

                      // Content
                      if (_activeTab == 'Staff Earnings')
                        _StaffEarningsList(
                          commissions: visible,
                          onMarkPaid: (ids) {
                            context.read<CommissionBloc>().add(CommissionsApproveRequested(ids));
                          },
                        )
                      else if (_activeTab == 'Commission Report')
                        _CommissionReportPanel(
                          commissions: visible,
                          onMarkPaid: (ids) {
                            context.read<CommissionBloc>().add(CommissionsApproveRequested(ids));
                          },
                        )
                      else
                        const _CommissionRulesPanel(),
                    ],
                  ),
                ),
        );
      },
    );
  }
}

class _CommissionConfigButton extends StatelessWidget {
  final VoidCallback onTap;
  const _CommissionConfigButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: _kBorder),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _kBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.tune, color: _kBlue, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(context.tr('commission_config'),
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                    Text(context.tr('edit'),
                        style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: _kSlate),
            ],
          ),
        ),
      ),
    );
  }
}

class _PeriodSelector extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelect;
  const _PeriodSelector({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: ['Week', 'Month', 'Quarter', 'All'].map((period) {
          final isSelected = selected == period;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelect(period),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? _kBlue : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  period,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isSelected ? Colors.white : _kSlate,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ProductFilterChips extends StatelessWidget {
  final List<Map<String, dynamic>> products;
  final String? selectedId;
  final ValueChanged<String?> onSelect;
  const _ProductFilterChips({
    required this.products,
    required this.selectedId,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _chip(context, context.tr('all'), null, selectedId == null),
          ...products.map((p) {
            final id = p['id']?.toString() ?? '';
            final name = p['name']?.toString() ?? context.tr('product');
            return _chip(context, name, id, selectedId == id);
          }),
        ],
      ),
    );
  }

  Widget _chip(BuildContext context, String label, String? id, bool active) {
    return GestureDetector(
      onTap: () => onSelect(id),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? _kBlue : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? _kBlue : _kBorder),
        ),
        child: Text(
          label,
          overflow: TextOverflow.ellipsis,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : _kSlate,
          ),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final double total;
  final double paidOut;
  final double pending;
  final int count;
  const _SummaryCard({
    required this.total,
    required this.paidOut,
    required this.pending,
    required this.count,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_kBlueDark, _kBlue],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: _kBlue.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('commission'),
            style: GoogleFonts.outfit(fontSize: 14, color: Colors.white.withValues(alpha: 0.8)),
          ),
          const SizedBox(height: 8),
          Text(
            'ETB ${total.toStringAsFixed(0)}',
            style: GoogleFonts.outfit(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 4),
          Text(
            '$count ${context.tr('total')}',
            style: GoogleFonts.outfit(fontSize: 12, color: Colors.white.withValues(alpha: 0.7)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _SummaryPill(label: context.tr('paid'), value: paidOut, color: _kGreen),
              const SizedBox(width: 12),
              _SummaryPill(label: context.tr('unpaid'), value: pending, color: _kAmber),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryPill extends StatelessWidget {
  final String label;
  final double value;
  final Color color;
  const _SummaryPill({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            '$label: ETB ${value.toStringAsFixed(0)}',
            style: GoogleFonts.outfit(fontSize: 12, color: Colors.white.withValues(alpha: 0.9)),
          ),
        ],
      ),
    );
  }
}

class _TabToggle extends StatelessWidget {
  final String activeTab;
  final ValueChanged<String> onToggle;
  const _TabToggle({required this.activeTab, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final tabs = [
      ('Staff Earnings', context.tr('staff')),
      ('Commission Report', context.tr('commission_report')),
      ('Commission Rules', context.tr('commission')),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: tabs.map((tab) {
          final isActive = activeTab == tab.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onToggle(tab.$1),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: isActive ? _kBlue : Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isActive ? _kBlue : _kBorder),
                ),
                child: Text(
                  tab.$2,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isActive ? Colors.white : _kSlate,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(40),
      child: Column(
        children: [
          Icon(Icons.analytics_outlined, size: 48, color: _kSlate.withValues(alpha: 0.4)),
          const SizedBox(height: 12),
          Text(context.tr('no_results_found'),
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600, color: _kInk)),
        ],
      ),
    );
  }
}

class _StaffEarningsList extends StatelessWidget {
  final List<Map<String, dynamic>> commissions;
  final ValueChanged<List<String>> onMarkPaid;
  const _StaffEarningsList({
    required this.commissions,
    required this.onMarkPaid,
  });

  @override
  Widget build(BuildContext context) {
    if (commissions.isEmpty) return const _EmptyBox();

    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final c in commissions) {
      final empId = c['employee']?['id']?.toString() ?? 'unknown';
      grouped.putIfAbsent(empId, () => []).add(c);
    }

    return Column(
      children: grouped.entries.map((entry) {
        final entries = entry.value;
        final employee = entries.first['employee'] as Map?;
        double total = 0;
        double paid = 0;
        for (final c in entries) {
          final amount = double.tryParse(c['commissionAmount']?.toString() ?? '0') ?? 0;
          total += amount;
          if (c['isApproved'] == true) paid += amount;
        }
        final name = employee?['name']?.toString() ?? context.tr('staff');
        final role = employee?['jobTitle']?.toString() ?? context.tr('staff');

        return _StaffCard(
          name: name,
          role: role,
          entries: entries,
          total: total,
          paid: paid,
          onMarkPaid: onMarkPaid,
        );
      }).toList(),
    );
  }
}

class _StaffCard extends StatelessWidget {
  final String name;
  final String role;
  final List<Map<String, dynamic>> entries;
  final double total;
  final double paid;
  final ValueChanged<List<String>> onMarkPaid;
  const _StaffCard({
    required this.name,
    required this.role,
    required this.entries,
    required this.total,
    required this.paid,
    required this.onMarkPaid,
  });

  @override
  Widget build(BuildContext context) {
    final pendingIds = entries
        .where((e) => e['isApproved'] != true && e['id'] != null)
        .map((e) => e['id'].toString())
        .toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _kBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kBlue),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                    Text(role, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('ETB ${total.toStringAsFixed(0)}',
                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
                  Text(context.tr('paid'),
                      style: GoogleFonts.outfit(fontSize: 11, color: _kGreen)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(color: _kBorder, height: 1),
          ...entries.map((c) => _SaleEntryCard(entry: c)),
          if (pendingIds.isNotEmpty) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => onMarkPaid(pendingIds),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kGreen,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  elevation: 0,
                ),
                child: Text(
                  '${context.tr('mark_paid')} (${pendingIds.length})',
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SaleEntryCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _SaleEntryCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final product = entry['product'] as Map?;
    final sale = entry['sale'] as Map?;
    final item = sale?['item'] as Map?;
    final customer = sale?['customer'] as Map?;

    final productName = entry['productName']?.toString() ?? product?['name']?.toString() ?? context.tr('product');
    final sku = entry['productSku']?.toString() ?? product?['sku']?.toString() ?? '';
    final invoice = entry['invoiceNumber']?.toString() ?? sale?['invoiceNumber']?.toString() ?? '';
    final customerName = entry['customerName']?.toString() ?? customer?['name']?.toString();
    final customerPhone = entry['customerPhone']?.toString() ?? customer?['phoneNumber']?.toString();
    final paymentType = sale?['paymentType']?.toString() ?? '';
    final saleTotal = double.tryParse('${entry['saleAmount'] ?? sale?['totalAmount']}') ?? 0;
    final quantity = item?['quantity'] is num
        ? (item!['quantity'] as num).toInt()
        : (double.tryParse('${entry['quantity'] ?? item?['quantity']}') ?? 1).toInt();
    final unitPrice = double.tryParse('${entry['unitPrice'] ?? item?['unitPrice']}') ?? 0;
    final lineTotal = double.tryParse('${entry['lineTotal'] ?? item?['total']}') ?? 0;
    final rate = double.tryParse('${entry['commissionRate']}') ?? 0;
    final amount = double.tryParse('${entry['commissionAmount']}') ?? 0;
    final approved = entry['isApproved'] == true;
    final rawDate = entry['commissionDate']?.toString() ?? entry['createdAt']?.toString() ?? '';
    final dateText = rawDate.isNotEmpty ? rawDate.split('T').first : '';
    final date = DateTime.tryParse(rawDate);
    final dateLabel = date != null
        ? '${date.day}/${date.month}/${date.year}'
        : dateText;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _kBorder.withValues(alpha: 0.8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  productName,
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              _StatusPill(approved: approved),
            ],
          ),
          if (sku.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2, bottom: 4),
              child: Text('SKU: $sku', style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
            ),
          const SizedBox(height: 4),
          if (invoice.isNotEmpty)
            _detailRow(context, context.tr('invoice'), invoice),
          if (customerName != null && customerName.isNotEmpty)
            _detailRow(
              context,
              context.tr('customer'),
              customerPhone != null && customerPhone.isNotEmpty
                  ? '$customerName ($customerPhone)'
                  : customerName,
            ),
          if (quantity > 0)
            _detailRow(context, context.tr('quantity'), '$quantity x ETB ${unitPrice.toStringAsFixed(2)}'),
          if (lineTotal > 0)
            _detailRow(context, context.tr('total'), 'ETB ${lineTotal.toStringAsFixed(2)}'),
          if (saleTotal > 0 && saleTotal != lineTotal)
            _detailRow(context, context.tr('sale_amount'), 'ETB ${saleTotal.toStringAsFixed(2)}'),
          if (paymentType.isNotEmpty)
            _detailRow(context, context.tr('payment_method'), paymentType.replaceAll('_', ' ')),
          _detailRow(context, context.tr('date'), dateLabel),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: _kBlue.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${context.tr('commission_rate')}: ${rate.toStringAsFixed(2)}%',
                    style: GoogleFonts.outfit(fontSize: 11, color: _kSlate, fontWeight: FontWeight.w500)),
                Text('ETB ${amount.toStringAsFixed(2)}',
                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kBlue)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1.5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 85,
            child: Text(label,
                style: GoogleFonts.outfit(fontSize: 11.5, color: _kSlate)),
          ),
          Expanded(
            child: Text(value,
                style: GoogleFonts.outfit(fontSize: 11.5, fontWeight: FontWeight.w500, color: _kInk)),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final bool approved;
  const _StatusPill({required this.approved});

  @override
  Widget build(BuildContext context) {
    final color = approved ? _kGreen : _kAmber;
    final label = approved ? context.tr('paid') : context.tr('unpaid');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}

class _CommissionReportPanel extends StatelessWidget {
  final List<Map<String, dynamic>> commissions;
  final ValueChanged<List<String>> onMarkPaid;
  const _CommissionReportPanel({
    required this.commissions,
    required this.onMarkPaid,
  });

  @override
  Widget build(BuildContext context) {
    if (commissions.isEmpty) return const _EmptyBox();

    return Column(
      children: commissions.map((c) {
        final employee = c['employee'] as Map?;
        final sale = c['sale'] as Map?;
        final product = c['product'] as Map?;
        final item = sale?['item'] as Map?;
        final customer = sale?['customer'] as Map?;

        final amount = double.tryParse('${c['commissionAmount']}') ?? 0;
        final rate = double.tryParse('${c['commissionRate']}') ?? 0;
        final name = c['salespersonName']?.toString() ?? employee?['name']?.toString() ?? context.tr('staff');
        final role = employee?['jobTitle']?.toString() ?? '';
        final productName = c['productName']?.toString() ?? product?['name']?.toString() ?? context.tr('product');
        final productSku = c['productSku']?.toString() ?? product?['sku']?.toString() ?? '';
        final invoiceNumber = c['invoiceNumber']?.toString() ?? sale?['invoiceNumber']?.toString() ?? '';
        final customerName = c['customerName']?.toString() ?? customer?['name']?.toString();
        final customerPhone = c['customerPhone']?.toString() ?? customer?['phoneNumber']?.toString();
        final saleTotal = double.tryParse('${c['saleAmount'] ?? sale?['totalAmount']}') ?? 0;
        final paymentType = sale?['paymentType']?.toString() ?? '';
        final quantity = item?['quantity'] is num
            ? (item!['quantity'] as num).toInt()
            : (double.tryParse('${c['quantity'] ?? item?['quantity']}') ?? 1).toInt();
        final unitPrice = double.tryParse('${c['unitPrice'] ?? item?['unitPrice']}') ?? 0;
        final lineTotal = double.tryParse('${c['lineTotal'] ?? item?['total']}') ?? 0;

        final rawDate = c['commissionDate']?.toString() ?? c['createdAt']?.toString() ?? '';
        final date = DateTime.tryParse(rawDate);
        final dateLabel = date != null ? '${date.day}/${date.month}/${date.year}' : rawDate.split('T').first;

        final saleDate = sale?['saleDate']?.toString() ?? '';
        final parsedSaleDate = DateTime.tryParse(saleDate);
        final saleDateLabel = parsedSaleDate != null
            ? '${parsedSaleDate.day}/${parsedSaleDate.month}/${parsedSaleDate.year}'
            : saleDate.split('T').first;

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _kBorder),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Staff name + Status
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: _kBlue.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : '?',
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kBlue),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                        if (role.isNotEmpty)
                          Text(role, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                      ],
                    ),
                  ),
                  _StatusPill(approved: c['isApproved'] == true),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(color: _kBorder, height: 1),
              const SizedBox(height: 12),

              // Product info
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.inventory_2_outlined, size: 18, color: _kBlue),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(productName,
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                            maxLines: 2, overflow: TextOverflow.ellipsis),
                        if (productSku.isNotEmpty)
                          Text('SKU: $productSku', style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Details grid
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _kBorder.withValues(alpha: 0.6)),
                ),
                child: Column(
                  children: [
                    if (invoiceNumber.isNotEmpty)
                      _reportDetailRow(context, context.tr('invoice'), invoiceNumber),
                    if (customerName != null && customerName.isNotEmpty)
                      _reportDetailRow(context, context.tr('customer'), customerName),
                    if (customerPhone != null && customerPhone.isNotEmpty)
                      _reportDetailRow(context, context.tr('phone'), customerPhone),
                    if (quantity > 0)
                      _reportDetailRow(context, context.tr('quantity'), '$quantity x ETB ${unitPrice.toStringAsFixed(2)}'),
                    if (lineTotal > 0)
                      _reportDetailRow(context, context.tr('total'), 'ETB ${lineTotal.toStringAsFixed(2)}'),
                    if (saleTotal > 0)
                      _reportDetailRow(context, context.tr('sale_amount'), 'ETB ${saleTotal.toStringAsFixed(2)}'),
                    if (paymentType.isNotEmpty)
                      _reportDetailRow(context, context.tr('payment_method'), paymentType.replaceAll('_', ' ')),
                    _reportDetailRow(context, context.tr('date'),
                        saleDateLabel.isNotEmpty ? saleDateLabel : dateLabel),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Commission summary row
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: _kBlue.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${context.tr('commission_rate')}: ${rate.toStringAsFixed(2)}%',
                        style: GoogleFonts.outfit(fontSize: 12, color: _kSlate, fontWeight: FontWeight.w500)),
                    Text('ETB ${amount.toStringAsFixed(2)}',
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kBlue)),
                  ],
                ),
              ),

              // Mark Paid button
              if (c['isApproved'] != true && c['id'] != null) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: TextButton.icon(
                    onPressed: () => onMarkPaid([c['id'].toString()]),
                    icon: const Icon(Icons.check_circle_outline, size: 16, color: _kGreen),
                    label: Text(context.tr('mark_paid'),
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kGreen)),
                    style: TextButton.styleFrom(
                      backgroundColor: _kGreen.withValues(alpha: 0.08),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _reportDetailRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
          ),
          Expanded(
            child: Text(value,
                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: _kInk),
                maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}

class _CommissionRulesPanel extends StatelessWidget {
  const _CommissionRulesPanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.tr('commission'),
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
          const SizedBox(height: 16),
          const _RuleRow(label: 'Default Rate', value: '5%'),
          const _RuleRow(label: 'Manager Rate', value: '8%'),
          const _RuleRow(label: 'Min. Sale for Commission', value: 'ETB 100'),
          const _RuleRow(label: 'Payment Threshold', value: 'ETB 500'),
        ],
      ),
    );
  }
}

class _RuleRow extends StatelessWidget {
  final String label;
  final String value;
  const _RuleRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
          Text(value, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
        ],
      ),
    );
  }
}
