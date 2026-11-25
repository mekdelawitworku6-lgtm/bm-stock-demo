import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/supplier/supplier_bloc.dart';
import '../../core/models/supplier_model.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';
import 'add_supplier_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class SupplierListScreen extends StatefulWidget {
  const SupplierListScreen({super.key});

  @override
  State<SupplierListScreen> createState() => _SupplierListScreenState();
}

class _SupplierListScreenState extends State<SupplierListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SupplierBloc>().add(SuppliersLoadRequested());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<SupplierModel> _filtered(List<SupplierModel> list) {
    if (_searchQuery.isEmpty) return list;
    final q = _searchQuery.toLowerCase();
    return list.where((s) =>
      s.name.toLowerCase().contains(q) ||
      s.contact.contains(q) ||
      (s.email?.toLowerCase().contains(q) ?? false)
    ).toList();
  }

  void _showDeleteDialog(SupplierModel supplier) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.tr('delete_supplier'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk)),
        content: Text(context.tr('confirm_delete_supplier'), style: GoogleFonts.outfit(color: _kSlate)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              context.read<SupplierBloc>().add(SupplierDeleteRequested(id: supplier.id));
              final s = await context.read<SupplierBloc>().stream.firstWhere((s) => !s.isLoading);
              final success = s.error == null;
              if (mounted) {
                showAppToast(
                  context,
                  success ? 'Supplier deleted' : (s.error ?? 'Failed'),
                  type: success ? AppToastType.success : AppToastType.error,
                );
              }
            },
            child: Text(context.tr('delete'), style: GoogleFonts.outfit(color: const Color(0xFFDC2626), fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'active': return const Color(0xFF16A34A);
      case 'inactive': return const Color(0xFFD97706);
      case 'blacklisted': return const Color(0xFFDC2626);
      default: return _kSlate;
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
        title: Text(context.tr('suppliers_list'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: _kBlue, size: 24),
            onPressed: () async {
              final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddSupplierScreen()));
              if (result == true && mounted) {
      context.read<SupplierBloc>().add(SuppliersLoadRequested());
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              controller: _searchController,
              style: GoogleFonts.outfit(fontSize: 14),
              decoration: InputDecoration(
                hintText: context.tr('search'),
                hintStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 14),
                prefixIcon: const Icon(Icons.search, color: _kSlate, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, color: _kSlate, size: 18),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
                filled: true,
                fillColor: _kBg,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (v) => setState(() => _searchQuery = v.trim()),
            ),
          ),
          Expanded(
            child: BlocBuilder<SupplierBloc, SupplierState>(
              builder: (_, state) {
                if (state.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (state.error != null) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(state.error!, style: GoogleFonts.outfit(color: const Color(0xFFDC2626))),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => context.read<SupplierBloc>().add(SuppliersLoadRequested()),
                          child: Text(context.tr('retry'), style: GoogleFonts.outfit(color: _kBlue, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  );
                }
                final filtered = _filtered(state.suppliers);
                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.local_shipping_outlined, size: 56, color: _kSlate.withValues(alpha: 0.4)),
                        const SizedBox(height: 12),
                        Text(
                          _searchQuery.isEmpty ? context.tr('no_suppliers_yet') : context.tr('no_results_found'),
                          style: GoogleFonts.outfit(fontSize: 16, color: _kSlate),
                        ),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async { context.read<SupplierBloc>().add(SuppliersLoadRequested()); },
                  child: ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _SupplierCard(
                      supplier: filtered[i],
                      statusColor: _statusColor(filtered[i].status),
                      onTap: () async {
                        final result = await Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => AddSupplierScreen(supplier: filtered[i])),
                        );
                        if (result == true && mounted) context.read<SupplierBloc>().add(SuppliersLoadRequested());
                      },
                      onLongPress: () => _showDeleteDialog(filtered[i]),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SupplierCard extends StatelessWidget {
  final SupplierModel supplier;
  final Color statusColor;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const _SupplierCard({required this.supplier, required this.statusColor, required this.onTap, required this.onLongPress});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: _kBlue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  supplier.name.isNotEmpty ? supplier.name[0].toUpperCase() : '?',
                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kBlue),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          supplier.name,
                          style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          supplier.status[0].toUpperCase() + supplier.status.substring(1),
                          style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    supplier.contact,
                    style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                  ),
                  if (supplier.address != null && supplier.address!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      supplier.address!,
                      style: GoogleFonts.outfit(fontSize: 12, color: _kSlate.withValues(alpha: 0.7)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: _kSlate.withValues(alpha: 0.5), size: 20),
          ],
        ),
      ),
    );
  }
}
