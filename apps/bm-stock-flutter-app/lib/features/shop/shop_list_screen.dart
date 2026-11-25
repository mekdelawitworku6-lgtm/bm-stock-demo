import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/branch/branch_bloc.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/shop_model.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/utils/branch_access_helper.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/plan_limit_dialog.dart';
import 'shop_dashboard_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class ShopListScreen extends StatefulWidget {
  const ShopListScreen({super.key, this.embedded = false});

  /// When true the screen is hosted inside the [MainShell] bottom nav tab,
  /// so its back button is hidden.
  final bool embedded;

  @override
  State<ShopListScreen> createState() => _ShopListScreenState();
}

class _ShopListScreenState extends State<ShopListScreen> {
  String? _companyId(BuildContext context) {
    final companyState = context.read<CompanyBloc>().state;
    return companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
  }

  void _loadShops() {
    context.read<BranchBloc>().add(BranchesLoadRequested(companyId: _companyId(context)));
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadShops());
  }

  Future<void> _showAddShopDialog() async {
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final currentShops = context.read<BranchBloc>().state.shops;
    if (user != null && currentShops.length >= user.maxStores) {
      showPlanLimitDialog(
        context,
        resourceName: 'store',
        limit: user.maxStores,
        planTitle: user.planTitle,
      );
      return;
    }

    final nameController = TextEditingController();
    final locationController = TextEditingController();
    String? selectedWarehouseId;
    bool isSubmitting = false;

    final appContext = context;
    if (appContext.mounted) {
      appContext.read<BranchBloc>().add(BranchesLoadRequested(companyId: _companyId(appContext)));
      await appContext.read<BranchBloc>().stream.firstWhere((s) => !s.isLoading);
    }
    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final warehouses = context.read<BranchBloc>().state.warehouses;
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Text(context.tr('add_shop'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _dialogField(context.tr('shop_name'), nameController),
                  const SizedBox(height: 12),
                  _dialogField('${context.tr('location')} (${context.tr('optional')})', locationController),
                  if (warehouses.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String?>(
                      value: selectedWarehouseId,
                      isExpanded: true,
                      decoration: _dialogDecoration('${context.tr('store')} (${context.tr('optional')})'),
                      items: [
                        DropdownMenuItem(value: null, child: Text(context.tr('none'))),
                        ...warehouses.map((w) => DropdownMenuItem(value: w.id, child: Text(w.name))),
                      ],
                      onChanged: (val) => setDialogState(() => selectedWarehouseId = val),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
                child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
              ),
              TextButton(
                onPressed: isSubmitting
                    ? null
                    : () async {
                        if (nameController.text.trim().isEmpty) return;
                        setDialogState(() => isSubmitting = true);
                        final data = <String, dynamic>{'name': nameController.text.trim()};
                        if (locationController.text.trim().isNotEmpty) {
                          data['location'] = locationController.text.trim();
                        }
                        if (selectedWarehouseId != null) {
                          data['warehouseId'] = selectedWarehouseId;
                        }
                        final bloc = context.read<BranchBloc>();
                        bloc.add(ShopAddRequested(data: data));
                        final next = await bloc.stream.firstWhere((s) => !s.isLoading);
                        if (!context.mounted) return;
                        Navigator.pop(ctx);
                        showAppToast(
                          context,
                          next.lastActionSuccess == true ? context.tr('add_shop') : (next.error ?? context.tr('failed')),
                          type: next.lastActionSuccess == true ? AppToastType.success : AppToastType.error,
                        );
                      },
                child: isSubmitting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(context.tr('add'), style: GoogleFonts.outfit(color: _kBlue, fontWeight: FontWeight.w600)),
              ),
            ],
          );
        },
      ),
    );
  }

  InputDecoration _dialogDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.outfit(color: _kSlate),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
    );
  }

  Widget _dialogField(String label, TextEditingController controller) {
    return TextField(
      controller: controller,
      style: GoogleFonts.outfit(fontSize: 14),
      decoration: _dialogDecoration(label),
    );
  }

  void _showDeleteDialog(ShopModel shop) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Delete Shop',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk),
        ),
        content: Text(
          'Are you sure you want to delete "${shop.name}"? This action requires no OTP.',
          style: GoogleFonts.outfit(color: _kSlate),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final bloc = context.read<BranchBloc>();
              bloc.add(ShopDeleteRequested(id: shop.id));
              final s = await bloc.stream.firstWhere((s) => !s.isLoading);
              final success = s.lastActionSuccess == true || s.error == null;
              if (mounted) {
                showAppToast(
                  context,
                  success ? 'Shop "${shop.name}" deleted successfully' : (s.error ?? 'Failed to delete shop'),
                  type: success ? AppToastType.success : AppToastType.error,
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text(
              context.tr('delete'),
              style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canManageBranches = user?.isAdmin ?? false;
    final canAddShop = canManageBranches ||
        (user?.canEditModule(ModuleKeys.addShop) ?? false) ||
        (user?.canEditModule(ModuleKeys.shopStore) ?? false);

    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: widget.embedded
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
        title: Text(context.tr('shop'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          if (canAddShop)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: SizedBox(
                height: 38,
                child: ElevatedButton.icon(
                  onPressed: _showAddShopDialog,
                  icon: const Icon(Icons.add_business_outlined, size: 16, color: Colors.white),
                  label: Text(context.tr('add_shop'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: BlocBuilder<BranchBloc, BranchState>(
        builder: (_, state) {
          if (state.isLoading) return const Center(child: CircularProgressIndicator(color: _kBlue));
          final shops = BranchAccessHelper.accessibleShops(user, state.shops);
          if (shops.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.storefront_outlined, size: 56, color: _kSlate.withValues(alpha: 0.4)),
                  const SizedBox(height: 12),
                  Text(
                    state.shops.isEmpty ? context.tr('no_results_found') : context.tr('no_branches_found'),
                    style: GoogleFonts.outfit(fontSize: 16, color: _kSlate),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              _loadShops();
              await context.read<BranchBloc>().stream.firstWhere((s) => !s.isLoading);
            },
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: shops.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _ShopCard(
                shop: shops[i],
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ShopDashboardScreen(
                      shopId: shops[i].id,
                      shopName: shops[i].name,
                    )),
                  );
                  if (mounted) _loadShops();
                },
                onDelete: canAddShop ? () => _showDeleteDialog(shops[i]) : null,
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ShopCard extends StatelessWidget {
  final ShopModel shop;
  final VoidCallback onTap;
  final VoidCallback? onDelete;
  const _ShopCard({required this.shop, required this.onTap, this.onDelete});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                color: _kBlue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.storefront_outlined, color: _kBlue, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(shop.name, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk)),
                  if (shop.location != null && shop.location!.isNotEmpty)
                    Text(shop.location!, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                  Text('${context.tr('in_stock')}: ${shop.unitsInStock}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                ],
              ),
            ),
            if (onDelete != null)
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626), size: 20),
                onPressed: onDelete,
                tooltip: 'Delete Shop (No OTP)',
              )
            else
              Icon(Icons.chevron_right, color: _kSlate.withValues(alpha: 0.5), size: 20),
          ],
        ),
      ),
    );
  }
}
