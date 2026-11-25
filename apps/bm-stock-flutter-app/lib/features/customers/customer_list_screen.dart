import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/customer/customer_bloc.dart';
import '../../core/models/customer_model.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';
import 'add_customer_screen.dart';
import 'customer_detail_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class CustomerListScreen extends StatefulWidget {
  const CustomerListScreen({super.key});

  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CustomerBloc>().add(CustomersLoadRequested());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<CustomerModel> _filtered(List<CustomerModel> list) {
    if (_searchQuery.isEmpty) return list;
    final q = _searchQuery.toLowerCase();
    return list.where((c) =>
      c.name.toLowerCase().contains(q) ||
      (c.phoneNumber?.contains(q) ?? false)
    ).toList();
  }

  void _showDeleteDialog(CustomerModel customer) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.tr('delete_customer'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk)),
        content: Text('${context.tr('confirm_delete_customer')}', style: GoogleFonts.outfit(color: _kSlate)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              context.read<CustomerBloc>().add(CustomerDeleteRequested(id: customer.id));
              final s = await context.read<CustomerBloc>().stream.firstWhere((s) => !s.isLoading);
              final success = s.error == null;
              if (mounted) {
                showAppToast(
                  context,
                  success ? 'Customer deleted' : (s.error ?? 'Failed'),
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
        title: Text(context.tr('customers'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12.0),
            child: Center(
              child: ElevatedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AddCustomerScreen()),
                  );
                  if (result == true && mounted) {
                    context.read<CustomerBloc>().add(CustomersLoadRequested());
                  }
                },
                icon: const Icon(Icons.person_add_rounded, size: 16),
                label: Text(
                  context.tr('add_customer'),
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kBlue,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
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
                hintText: context.tr('search_name_phone'),
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
            child: BlocBuilder<CustomerBloc, CustomerState>(
              builder: (context, state) {
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
                          onPressed: () => context.read<CustomerBloc>().add(CustomersLoadRequested()),
                          child: Text(context.tr('retry'), style: GoogleFonts.outfit(color: _kBlue, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  );
                }
                final filtered = _filtered(state.customers);
                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.people_outline, size: 56, color: _kSlate.withValues(alpha: 0.4)),
                        const SizedBox(height: 12),
                        Text(
                          _searchQuery.isEmpty ? context.tr('no_customers_yet') : context.tr('no_results_found'),
                          style: GoogleFonts.outfit(fontSize: 16, color: _kSlate),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _searchQuery.isEmpty ? '' : '',
                          style: GoogleFonts.outfit(fontSize: 13, color: _kSlate.withValues(alpha: 0.7)),
                        ),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async { context.read<CustomerBloc>().add(CustomersLoadRequested()); },
                  child: ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _CustomerCard(
                      customer: filtered[i],
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => CustomerDetailScreen(customer: filtered[i])),
                        );
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

class _CustomerCard extends StatelessWidget {
  final CustomerModel customer;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const _CustomerCard({required this.customer, required this.onTap, required this.onLongPress});

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
                  customer.name.isNotEmpty ? customer.name[0].toUpperCase() : '?',
                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kBlue),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    customer.name,
                    style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    customer.displayPhone,
                    style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                  ),
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
