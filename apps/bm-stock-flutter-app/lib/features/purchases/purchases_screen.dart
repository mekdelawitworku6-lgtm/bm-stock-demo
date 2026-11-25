import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/services/expense_service.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/localization/app_localizations.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

/// Backwards compatibility alias so existing imports & routes work seamlessly
typedef PurchasesScreen = ExpensesScreen;

class _ExpensesScreenState extends State<ExpensesScreen> {
  final _expenseService = ExpenseService();
  final _searchCtrl = TextEditingController();

  List<dynamic> _expenses = [];
  Map<String, dynamic> _summary = {
    'totalExpenseAmount': 0,
    'totalUnits': 0,
    'recordCount': 0,
  };

  bool _loading = false;
  String _dateFilter = 'all'; // all | today | week | month
  String _locationFilter = 'all'; // all | warehouse | shop
  int _page = 1;
  int _totalPages = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  String? _buildStartDate() {
    final now = DateTime.now();
    switch (_dateFilter) {
      case 'today':
        return DateTime(now.year, now.month, now.day).toIso8601String();
      case 'week':
        return now.subtract(const Duration(days: 7)).toIso8601String();
      case 'month':
        return DateTime(now.year, now.month, 1).toIso8601String();
      default:
        return null;
    }
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() {
        _page = 1;
        _expenses = [];
      });
    }
    setState(() => _loading = true);
    try {
      final result = await _expenseService.getExpenses(
        search: _searchCtrl.text.isNotEmpty ? _searchCtrl.text : null,
        startDate: _buildStartDate(),
        page: _page,
        limit: 50,
      );
      final rawList = (result['data'] as List? ?? []);
      final filtered = _locationFilter == 'all'
          ? rawList
          : _locationFilter == 'warehouse'
              ? rawList.where((p) => (p['warehouseId'] as String?) != null).toList()
              : rawList.where((p) => (p['shopId'] as String?) != null).toList();

      setState(() {
        _expenses = filtered;
        _summary = (result['summary'] as Map<String, dynamic>?) ?? _summary;
        _totalPages = (result['totalPages'] as int?) ?? 1;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _exportCsv() {
    final rows = <List<String>>[
      ['Date', 'Reference', 'Expense Item', 'Category', 'Branch', 'Qty', 'Unit Cost (ETB)', 'Total Cost (ETB)', 'Supplier', 'Staff'],
      ..._expenses.map((p) => [
        _fmtDate(p['createdAt']),
        p['referenceNumber'] ?? '-',
        p['itemName'] ?? '-',
        p['category'] ?? '-',
        p['warehouseName'] ?? p['shopName'] ?? '-',
        '${p['quantity'] ?? 0}',
        (p['unitCost'] as num? ?? 0).toStringAsFixed(2),
        (p['totalCost'] as num? ?? 0).toStringAsFixed(2),
        p['supplierName'] ?? '-',
        p['performedByName'] ?? '-',
      ]),
    ];
    final csv = rows.map((r) => r.map((v) => '"${v.replaceAll('"', '""')}"').join(',')).join('\n');
    Clipboard.setData(ClipboardData(text: csv));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Expenses CSV copied to clipboard (${_expenses.length} rows)', style: GoogleFonts.outfit()),
        backgroundColor: _kBlue,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  String _fmtDate(dynamic raw) {
    if (raw == null) return '—';
    try {
      final d = DateTime.parse(raw.toString()).toLocal();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
    } catch (_) {
      return raw.toString();
    }
  }

  String _fmtCurrency(dynamic v) {
    final n = (v as num? ?? 0).toDouble();
    return 'ETB ${n.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  void _openRecordExpenseModal() async {
    final success = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const _RecordExpenseSheet(),
    );
    if (success == true) {
      _load(reset: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: _kBg,
        appBar: _buildAppBar(),
        body: RefreshIndicator(
          onRefresh: () => _load(reset: true),
          color: _kBlue,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _buildSummaryCards()),
              SliverToBoxAdapter(child: _buildFilters()),
              if (_loading && _expenses.isEmpty)
                const SliverFillRemaining(child: Center(child: CircularProgressIndicator(color: _kBlue)))
              else if (!_loading && _expenses.isEmpty)
                SliverFillRemaining(child: _buildEmptyState())
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => index < _expenses.length ? _buildExpenseCard(_expenses[index]) : null,
                      childCount: _expenses.length,
                    ),
                  ),
                ),
                if (_totalPages > 1) SliverToBoxAdapter(child: _buildPagination()),
                const SliverToBoxAdapter(child: SizedBox(height: 100)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  AppBar _buildAppBar() => AppBar(
    backgroundColor: Colors.white,
    elevation: 0,
    scrolledUnderElevation: 0,
    leading: IconButton(
      icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
      onPressed: () => Navigator.pop(context),
    ),
    title: Text(
      context.tr('expenses'),
      style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
    ),
    actions: [
      IconButton(
        onPressed: _exportCsv,
        icon: const Icon(Icons.download_outlined, color: _kBlue),
        tooltip: context.tr('export_csv'),
      ),
      Padding(
        padding: const EdgeInsets.only(right: 12),
        child: ElevatedButton.icon(
          onPressed: _openRecordExpenseModal,
          icon: const Icon(Icons.add, size: 16, color: Colors.white),
          label: Text(
            context.tr('record_expense'),
            style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: _kBlue,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ),
    ],
  );

  Widget _buildSummaryCards() {
    final totalCost = (_summary['totalExpenseAmount'] as num? ?? 0).toDouble();
    final totalUnits = (_summary['totalUnits'] as num? ?? 0).toInt();
    final recordCount = (_summary['recordCount'] as num? ?? 0).toInt();
    final avg = recordCount > 0 ? totalCost / recordCount : 0.0;

    final cards = [
      _SummaryCard(
        label: context.tr('total_expenses'),
        value: _fmtCurrency(totalCost),
        icon: Icons.payments_outlined,
        color: const Color(0xFF025EA7),
        bg: const Color(0xFFEFF6FF),
      ),
      _SummaryCard(
        label: 'Items / Units Purchased',
        value: totalUnits.toString(),
        icon: Icons.inventory_2_outlined,
        color: const Color(0xFF059669),
        bg: const Color(0xFFECFDF5),
      ),
      _SummaryCard(
        label: 'Expense Records',
        value: recordCount.toString(),
        icon: Icons.receipt_long_outlined,
        color: const Color(0xFF7C3AED),
        bg: const Color(0xFFF5F3FF),
      ),
      _SummaryCard(
        label: 'Avg Expense',
        value: _fmtCurrency(avg),
        icon: Icons.trending_up_outlined,
        color: const Color(0xFFD97706),
        bg: const Color(0xFFFFFBEB),
      ),
    ];

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: GridView.count(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.7,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: cards.map(_buildSummaryCardWidget).toList(),
      ),
    );
  }

  Widget _buildSummaryCardWidget(_SummaryCard c) => Container(
    decoration: BoxDecoration(
      color: c.bg,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: c.color.withValues(alpha: 0.15)),
    ),
    padding: const EdgeInsets.all(14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(c.icon, color: c.color, size: 22),
        const Spacer(),
        Text(
          c.value,
          style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: _kInk),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Text(
          c.label,
          style: GoogleFonts.outfit(fontSize: 10, color: _kSlate, fontWeight: FontWeight.w500),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    ),
  );

  Widget _buildFilters() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 44,
            decoration: BoxDecoration(
              color: _kBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            child: TextField(
              controller: _searchCtrl,
              onSubmitted: (_) => _load(reset: true),
              decoration: InputDecoration(
                hintText: 'Search expense item, category, reference, supplier...',
                hintStyle: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                border: InputBorder.none,
                prefixIcon: const Icon(Icons.search, color: _kSlate, size: 20),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18, color: _kSlate),
                        onPressed: () {
                          _searchCtrl.clear();
                          _load(reset: true);
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              style: GoogleFonts.outfit(fontSize: 13, color: _kInk),
            ),
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final f in [
                  ('all', context.tr('all_time')),
                  ('today', context.tr('today')),
                  ('week', context.tr('this_week')),
                  ('month', context.tr('this_month')),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(f.$2, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600)),
                      selected: _dateFilter == f.$1,
                      onSelected: (_) {
                        setState(() => _dateFilter = f.$1);
                        _load(reset: true);
                      },
                      selectedColor: _kBlue,
                      backgroundColor: _kBg,
                      labelStyle: TextStyle(color: _dateFilter == f.$1 ? Colors.white : _kSlate),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: BorderSide(color: _dateFilter == f.$1 ? _kBlue : _kBorder),
                      ),
                      showCheckmark: false,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: _kBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _locationFilter,
                isExpanded: true,
                icon: const Icon(Icons.expand_more, size: 20, color: _kSlate),
                style: GoogleFonts.outfit(fontSize: 13, color: _kInk),
                onChanged: (v) {
                  setState(() => _locationFilter = v!);
                  _load(reset: true);
                },
                items: [
                  DropdownMenuItem(value: 'all', child: Text(context.tr('all_locations'), style: GoogleFonts.outfit(fontSize: 13))),
                  DropdownMenuItem(value: 'warehouse', child: Text(context.tr('warehouse_only'), style: GoogleFonts.outfit(fontSize: 13))),
                  DropdownMenuItem(value: 'shop', child: Text(context.tr('shop_only'), style: GoogleFonts.outfit(fontSize: 13))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExpenseCard(Map<String, dynamic> p) {
    final isWarehouse = (p['warehouseId'] as String?) != null;
    final branch = p['warehouseName'] ?? p['shopName'] ?? '—';
    final totalCost = (p['totalCost'] as num? ?? 0).toDouble();
    final unitCost = (p['unitCost'] as num? ?? 0).toDouble();
    final qty = p['quantity'] as int? ?? 0;

    return GestureDetector(
      onTap: () => _showDetail(p),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _kBorder),
          boxShadow: [
            BoxShadow(
              color: _kInk.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p['itemName'] ?? 'Expense Item',
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700, color: _kInk),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if ((p['referenceNumber'] as String?)?.isNotEmpty == true)
                        Text('Ref: ${p['referenceNumber']}', style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(_fmtCurrency(totalCost), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: _kBlue)),
                    Text(_fmtDate(p['createdAt']), style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1, color: _kBorder),
            const SizedBox(height: 12),
            Row(
              children: [
                _PillChip(
                  icon: isWarehouse ? Icons.warehouse_outlined : Icons.storefront_outlined,
                  label: branch,
                  color: isWarehouse ? _kBlue : const Color(0xFF059669),
                ),
                if ((p['category'] as String?)?.isNotEmpty == true) ...[
                  const SizedBox(width: 8),
                  _PillChip(
                    icon: Icons.label_outline,
                    label: p['category'],
                    color: const Color(0xFF7C3AED),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _StatBlock(label: 'Qty', value: '$qty'),
                const SizedBox(width: 20),
                _StatBlock(label: 'Unit Cost', value: _fmtCurrency(unitCost)),
                const Spacer(),
                if ((p['supplierName'] as String?)?.isNotEmpty == true)
                  Flexible(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.business_outlined, size: 12, color: _kSlate),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            p['supplierName'],
                            style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            if ((p['performedByName'] as String?)?.isNotEmpty == true) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.person_outline, size: 12, color: _kSlate),
                  const SizedBox(width: 4),
                  Text(p['performedByName'], style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showDetail(Map<String, dynamic> p) {
    final totalCost = (p['totalCost'] as num? ?? 0).toDouble();
    final unitCost = (p['unitCost'] as num? ?? 0).toDouble();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        maxChildSize: 0.92,
        minChildSize: 0.5,
        builder: (_, ctrl) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: _kBorder, borderRadius: BorderRadius.circular(2)),
              ),
              Container(
                margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [_kBlue, Color(0xFF0278D4)]),
                  borderRadius: BorderRadius.circular(20),
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr('expense_details'),
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.white70,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      p['itemName'] ?? 'Expense Item',
                      style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(_fmtDate(p['createdAt']), style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    _ReceiptStat(label: 'Quantity', value: '${p['quantity'] ?? 0}', bg: const Color(0xFFF8FAFC)),
                    const SizedBox(width: 8),
                    _ReceiptStat(label: context.tr('unit_cost'), value: _fmtCurrency(unitCost), bg: const Color(0xFFEFF6FF)),
                    const SizedBox(width: 8),
                    _ReceiptStat(label: context.tr('total_cost'), value: _fmtCurrency(totalCost), bg: const Color(0xFFECFDF5)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView(
                  controller: ctrl,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    _detailTile(context.tr('category'), p['category'] ?? 'General'),
                    _detailTile(context.tr('reference'), p['referenceNumber'] ?? '—', mono: true),
                    _detailTile(context.tr('branch'), p['warehouseName'] ?? p['shopName'] ?? '—'),
                    _detailTile(context.tr('supplier'), p['supplierName'] ?? '—'),
                    _detailTile('Staff', p['performedByName'] ?? '—'),
                    if ((p['note'] as String?)?.isNotEmpty == true) _detailTile('Notes', p['note']),
                    const SizedBox(height: 80),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          side: const BorderSide(color: _kBorder),
                        ),
                        child: Text(context.tr('close'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _exportCsv();
                        },
                        icon: const Icon(Icons.download_outlined, size: 18),
                        label: Text(context.tr('export_csv'), style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _kBlue,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 3,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() => Center(
    child: Padding(
      padding: const EdgeInsets.all(40),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.receipt_long_outlined, size: 36, color: _kBlue),
          ),
          const SizedBox(height: 20),
          Text(
            context.tr('no_expenses_found'),
            style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: _kInk),
          ),
          const SizedBox(height: 8),
          Text(
            context.tr('no_expenses_desc'),
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _openRecordExpenseModal,
            icon: const Icon(Icons.add, size: 18),
            label: Text(context.tr('record_expense'), style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(
              backgroundColor: _kBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 3,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _buildPagination() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        TextButton(
          onPressed: _page > 1
              ? () {
                  setState(() => _page--);
                  _load();
                }
              : null,
          child: Text('Previous', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text('Page $_page of $_totalPages', style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
        ),
        TextButton(
          onPressed: _page < _totalPages
              ? () {
                  setState(() => _page++);
                  _load();
                }
              : null,
          child: Text('Next', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        ),
      ],
    ),
  );

  Widget _detailTile(String label, String value, {bool mono = false}) => Container(
    decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _kBorder, width: 0.5))),
    padding: const EdgeInsets.symmetric(vertical: 13),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate, fontWeight: FontWeight.w500)),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: mono
                ? GoogleFonts.firaCode(fontSize: 12, color: _kInk, fontWeight: FontWeight.w600)
                : GoogleFonts.outfit(fontSize: 13, color: _kInk, fontWeight: FontWeight.w600),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    ),
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _SummaryCard {
  final String label, value;
  final IconData icon;
  final Color color, bg;
  const _SummaryCard({required this.label, required this.value, required this.icon, required this.color, required this.bg});
}

class _PillChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _PillChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withValues(alpha: 0.2)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 5),
        Text(label, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: color), maxLines: 1, overflow: TextOverflow.ellipsis),
      ],
    ),
  );
}

class _StatBlock extends StatelessWidget {
  final String label, value;
  const _StatBlock({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: GoogleFonts.outfit(fontSize: 10, color: _kSlate, fontWeight: FontWeight.w500)),
      Text(value, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: _kInk)),
    ],
  );
}

class _ReceiptStat extends StatelessWidget {
  final String label, value;
  final Color bg;
  const _ReceiptStat({required this.label, required this.value, required this.bg});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: _kBorder)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 9, color: _kSlate, fontWeight: FontWeight.w500)),
          const SizedBox(height: 3),
          Text(value, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w800, color: _kInk), maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORD EXPENSE MODAL SHEET
// ─────────────────────────────────────────────────────────────────────────────

class _RecordExpenseSheet extends StatefulWidget {
  const _RecordExpenseSheet();

  @override
  State<_RecordExpenseSheet> createState() => _RecordExpenseSheetState();
}

class _RecordExpenseSheetState extends State<_RecordExpenseSheet> {
  final _expenseService = ExpenseService();

  final _itemNameCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController(text: 'General');
  final _qtyCtrl = TextEditingController(text: '1');
  final _costCtrl = TextEditingController();
  final _supplierCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  final _refCtrl = TextEditingController(
    text: 'EXP-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
  );

  bool _isSubmitting = false;

  @override
  void dispose() {
    _itemNameCtrl.dispose();
    _categoryCtrl.dispose();
    _qtyCtrl.dispose();
    _costCtrl.dispose();
    _supplierCtrl.dispose();
    _noteCtrl.dispose();
    _refCtrl.dispose();
    super.dispose();
  }

  double _totalCost() {
    final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 0;
    final cost = double.tryParse(_costCtrl.text.trim()) ?? 0.0;
    return qty * cost;
  }

  Future<void> _submit() async {
    final name = _itemNameCtrl.text.trim();
    if (name.isEmpty) {
      showAppToast(context, 'Please enter an item or expense name', type: AppToastType.error);
      return;
    }

    final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (qty <= 0) {
      showAppToast(context, 'Quantity must be at least 1', type: AppToastType.error);
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final branchProvider = Provider.of<BranchProvider>(context, listen: false);
      String? wId;
      String? sId;

      if (branchProvider.warehouses.isNotEmpty) {
        wId = branchProvider.warehouses.first.id;
      } else if (branchProvider.shops.isNotEmpty) {
        sId = branchProvider.shops.first.id;
      }

      final unitCost = double.tryParse(_costCtrl.text.trim()) ?? 0.0;
      final category = _categoryCtrl.text.trim().isNotEmpty ? _categoryCtrl.text.trim() : 'General';

      await _expenseService.createExpense(
        itemName: name,
        category: category,
        quantity: qty,
        unitCost: unitCost,
        totalCost: _totalCost(),
        supplierName: _supplierCtrl.text.trim(),
        referenceNumber: _refCtrl.text.trim(),
        note: _noteCtrl.text.trim(),
        warehouseId: wId,
        shopId: sId,
      );

      if (mounted) {
        showAppToast(context, 'Expense recorded successfully!', type: AppToastType.success);
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        showAppToast(context, 'Failed to record expense: $e', type: AppToastType.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _kBlue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.receipt_long_rounded, color: _kBlue, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.tr('record_expense'),
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: _kInk,
                        ),
                      ),
                      Text(
                        'Record a purchase or expense (no stock changes)',
                        style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20, color: _kSlate),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 18),

            Row(
              children: [
                Text(
                  'Expense Item / Description',
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                ),
                const SizedBox(width: 4),
                const Text('*', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 6),
            TextFormField(
              controller: _itemNameCtrl,
              decoration: _sheetInputDecoration('e.g. Sugar, Fuel, Coffee, Rent').copyWith(
                prefixIcon: const Icon(Icons.receipt_outlined, color: _kBlue, size: 18),
              ),
              style: GoogleFonts.outfit(fontSize: 13.5, color: _kInk, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 14),

            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Category', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _categoryCtrl,
                  decoration: _sheetInputDecoration('Category (e.g. General, Supplies, Maintenance, Fuel)'),
                  style: GoogleFonts.outfit(fontSize: 13, color: _kInk),
                ),
              ],
            ),
            const SizedBox(height: 14),

            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Quantity', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          IconButton.outlined(
                            icon: const Icon(Icons.remove, size: 16),
                            onPressed: () {
                              final cur = int.tryParse(_qtyCtrl.text) ?? 1;
                              if (cur > 1) {
                                setState(() => _qtyCtrl.text = (cur - 1).toString());
                              }
                            },
                          ),
                          Expanded(
                            child: TextFormField(
                              controller: _qtyCtrl,
                              keyboardType: TextInputType.number,
                              textAlign: TextAlign.center,
                              decoration: _sheetInputDecoration('Qty'),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          IconButton.outlined(
                            icon: const Icon(Icons.add, size: 16),
                            onPressed: () {
                              final cur = int.tryParse(_qtyCtrl.text) ?? 0;
                              setState(() => _qtyCtrl.text = (cur + 1).toString());
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Unit Cost (ETB)', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _costCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: _sheetInputDecoration('0.00'),
                        onChanged: (_) => setState(() {}),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFBFDBFE)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total Expense Amount:',
                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500, color: const Color(0xFF1E40AF)),
                  ),
                  Text(
                    'ETB ${_totalCost().toStringAsFixed(2)}',
                    style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFF1E3A8A)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Supplier / Vendor', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _supplierCtrl,
                        decoration: _sheetInputDecoration('Supplier (optional)'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Receipt / Ref #', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _refCtrl,
                        decoration: _sheetInputDecoration('Reference'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Notes', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _noteCtrl,
                  maxLines: 2,
                  decoration: _sheetInputDecoration('Optional notes about this expense'),
                ),
              ],
            ),
            const SizedBox(height: 24),

            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kBlue,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                    : Text(
                        'Confirm & Record Expense',
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _sheetInputDecoration(String hint) => InputDecoration(
    hintText: hint,
    hintStyle: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    filled: true,
    fillColor: const Color(0xFFF8FAFC),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBorder)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBorder)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
  );
}
