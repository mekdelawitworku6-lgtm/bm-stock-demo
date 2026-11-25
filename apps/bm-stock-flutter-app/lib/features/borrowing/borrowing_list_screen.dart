import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/bloc/borrowing/borrowing_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/borrowing_model.dart';
import '../../core/widgets/refreshable_scroll.dart';
import 'add_borrowing_screen.dart';
import 'borrowing_detail_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);

class BorrowingListScreen extends StatefulWidget {
  const BorrowingListScreen({super.key});

  @override
  State<BorrowingListScreen> createState() => _BorrowingListScreenState();
}

class _BorrowingListScreenState extends State<BorrowingListScreen> {
  String _statusFilter = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _load() {
    context.read<BorrowingBloc>().add(BorrowingsLoadRequested(
          status: _statusFilter.isEmpty ? null : _statusFilter,
          search: _searchController.text.trim().isEmpty ? null : _searchController.text.trim(),
        ));
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'fully_returned':
        return _kGreen;
      case 'partially_returned':
        return _kAmber;
      default:
        return _kBlue;
    }
  }

  String _statusText(BuildContext context, String status) {
    switch (status) {
      case 'fully_returned':
        return context.tr('fully_returned');
      case 'partially_returned':
        return context.tr('partially_returned');
      default:
        return context.tr('active');
    }
  }

  String _formatDate(String raw) {
    if (raw.isEmpty) return '--';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw.split('T').first;
    return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthBloc>().user;
    if (!(user?.canUseBorrowing ?? false)) {
      return Scaffold(
        backgroundColor: _kBg,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(context.tr('product_borrowing'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
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
                  'Product borrowing is exclusively available on the Large Business Plan (15,999 ETB). Upgrade to track items borrowed from partners.',
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
          context.tr('product_borrowing'),
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: _kBlue),
            onPressed: () async {
              final created = await Navigator.push<bool>(
                context,
                MaterialPageRoute(builder: (_) => const AddBorrowingScreen()),
              );
              if (mounted && created == true) _load();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              controller: _searchController,
              style: GoogleFonts.outfit(fontSize: 14),
              decoration: InputDecoration(
                hintText: context.tr('search'),
                prefixIcon: const Icon(Icons.search, color: _kSlate, size: 20),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: _kBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: _kBorder),
                ),
              ),
              onSubmitted: (_) => _load(),
            ),
          ),
          const SizedBox(height: 10),
          _buildFilterChips(context),
          Expanded(
            child: BlocBuilder<BorrowingBloc, BorrowingState>(
              builder: (context, state) {
                Future<void> onRefresh() async {
                  _load();
                  await context.read<BorrowingBloc>().stream.firstWhere((s) => !s.isLoading);
                }

                if (state.isLoading && state.records.isEmpty) {
                  return const Center(child: CircularProgressIndicator(color: _kBlue));
                }

                final records = state.records;
                if (records.isEmpty) {
                  return RefreshIndicator(
                    onRefresh: onRefresh,
                    child: refreshableScrollChild(
                      child: Center(
                        child: Text(
                          context.tr('no_borrowing_records'),
                          style: GoogleFonts.outfit(color: _kSlate),
                        ),
                      ),
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: onRefresh,
                  child: ListView.builder(
                    physics: refreshScrollPhysics,
                    padding: const EdgeInsets.all(16),
                    itemCount: records.length + 1,
                    itemBuilder: (_, i) {
                      if (i == 0) return _buildTableHeader(context);
                      return _buildRow(context, records[i - 1]);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: _kBlue,
        onPressed: () async {
          final created = await Navigator.push<bool>(
            context,
            MaterialPageRoute(builder: (_) => const AddBorrowingScreen()),
          );
          if (mounted && created == true) _load();
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildFilterChips(BuildContext context) {
    final filters = [
      ('', context.tr('all')),
      ('active', context.tr('active')),
      ('partially_returned', context.tr('partially_returned')),
      ('fully_returned', context.tr('fully_returned')),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: filters.map((f) {
          final selected = _statusFilter == f.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(f.$2, style: GoogleFonts.outfit(fontSize: 12)),
              selected: selected,
              onSelected: (_) {
                setState(() => _statusFilter = f.$1);
                _load();
              },
              selectedColor: _kBlue.withValues(alpha: 0.15),
              checkmarkColor: _kBlue,
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTableHeader(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: [
          Expanded(flex: 3, child: _headerCell(context.tr('product_name'))),
          Expanded(flex: 2, child: _headerCell(context.tr('taken_from'))),
          Expanded(child: _headerCell(context.tr('qty_taken'), align: TextAlign.center)),
          Expanded(child: _headerCell(context.tr('qty_returned'), align: TextAlign.center)),
          Expanded(child: _headerCell(context.tr('remaining'), align: TextAlign.center)),
        ],
      ),
    );
  }

  Widget _headerCell(String text, {TextAlign align = TextAlign.start}) {
    return Text(
      text,
      textAlign: align,
      style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: _kSlate),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }

  Widget _buildRow(BuildContext context, BorrowingModel record) {
    final statusColor = _statusColor(record.status);

    return GestureDetector(
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => BorrowingDetailScreen(recordId: record.id)),
        );
        if (mounted) _load();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        record.productName,
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _kInk,
                        ),
                      ),
                      if (record.productCategory != null && record.productCategory!.isNotEmpty)
                        Text(
                          record.productCategory!,
                          style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    record.sellerName,
                    style: GoogleFonts.outfit(fontSize: 12, color: _kInk),
                  ),
                ),
                Expanded(
                  child: Text(
                    '${record.quantityTaken}',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
                Expanded(
                  child: Text(
                    '${record.quantityReturned}',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                  ),
                ),
                Expanded(
                  child: Text(
                    '${record.remainingQuantity}',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: record.remainingQuantity > 0 ? _kAmber : _kGreen,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  _formatDate(record.dateTaken),
                  style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                ),
                if (record.note != null && record.note!.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      record.note!,
                      style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _statusText(context, record.status),
                    style: GoogleFonts.outfit(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: statusColor,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.chevron_right, size: 16, color: _kSlate.withValues(alpha: 0.6)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
