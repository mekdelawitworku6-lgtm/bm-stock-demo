import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/warehouse/warehouse_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/warehouse_model.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/utils/branch_access_helper.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/plan_limit_dialog.dart';
import 'warehouse_dashboard_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class WarehouseListScreen extends StatefulWidget {
  const WarehouseListScreen({super.key, this.embedded = false});

  /// When true the screen is hosted inside the [MainShell] bottom nav tab,
  /// so its back button is hidden.
  final bool embedded;

  @override
  State<WarehouseListScreen> createState() => _WarehouseListScreenState();
}

class _WarehouseListScreenState extends State<WarehouseListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WarehouseBloc>().add(WarehousesLoadRequested());
    });
  }

  void _showAddDialog() {
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final currentWarehouses = context.read<WarehouseBloc>().state.warehouses;
    if (user != null && currentWarehouses.length >= user.maxWarehouses) {
      showPlanLimitDialog(
        context,
        resourceName: 'warehouse',
        limit: user.maxWarehouses,
        planTitle: user.planTitle,
      );
      return;
    }

    final nameController = TextEditingController();
    final locationController = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(context.tr('add_warehouse'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _dialogField(context.tr('store_name'), nameController),
                const SizedBox(height: 12),
                _dialogField('${context.tr('location')} (${context.tr('optional')})', locationController),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate))),
            TextButton(
              onPressed: () async {
                if (nameController.text.trim().isEmpty) return;
                setDialogState(() => isSubmitting = true);
                final bloc = context.read<WarehouseBloc>();
                final data = <String, dynamic>{
                  'name': nameController.text.trim(),
                };
                if (locationController.text.trim().isNotEmpty) {
                  data['location'] = locationController.text.trim();
                }

                try {
                  bloc.add(WarehouseAddRequested(data: data));
                  await bloc.stream.firstWhere((s) => !s.isLoading);
                  if (context.mounted) Navigator.pop(ctx);
                } catch (e) {
                  setDialogState(() => isSubmitting = false);
                }
              },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(context.tr('add'), style: GoogleFonts.outfit(color: _kBlue, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteDialog(WarehouseModel warehouse) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.tr('delete'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk)),
        content: Text(context.tr('delete_warehouse_confirm').replaceAll('{name}', warehouse.name), style: GoogleFonts.outfit(color: _kSlate)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate))),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final bloc = context.read<WarehouseBloc>();
              bloc.add(WarehouseDeleteRequested(id: warehouse.id));
              final s = await bloc.stream.firstWhere((s) => !s.isLoading);
              final success = s.error == null;
              if (mounted) {
                showAppToast(context, success ? context.tr('delete') : (s.error ?? 'Failed'),
                    type: success ? AppToastType.success : AppToastType.error);
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
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canManageBranches = user?.isAdmin ?? false;
    final canAddWarehouse = canManageBranches ||
        (user?.canEditModule(ModuleKeys.addStore) ?? false) ||
        (user?.canEditModule(ModuleKeys.warehouse) ?? false);

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
        title: Text(context.tr('store'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          if (canAddWarehouse)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: SizedBox(
                height: 38,
                child: ElevatedButton.icon(
                  onPressed: _showAddDialog,
                  icon: const Icon(Icons.add, size: 18, color: Colors.white),
                  label: Text(context.tr('add_warehouse'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
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
      body: BlocBuilder<WarehouseBloc, WarehouseState>(
        builder: (_, state) {
          if (state.isLoading) return const Center(child: CircularProgressIndicator());
          final warehouses = BranchAccessHelper.accessibleWarehouses(user, state.warehouses);
          if (warehouses.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.warehouse_outlined, size: 56, color: _kSlate.withValues(alpha: 0.4)),
                  const SizedBox(height: 12),
                  Text(
                    state.warehouses.isEmpty ? context.tr('no_results_found') : context.tr('no_branches_found'),
                    style: GoogleFonts.outfit(fontSize: 16, color: _kSlate),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async { context.read<WarehouseBloc>().add(WarehousesLoadRequested()); },
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: warehouses.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _WarehouseCard(
                warehouse: warehouses[i],
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => WarehouseDashboardScreen(
                    warehouseId: warehouses[i].id,
                    warehouseName: warehouses[i].name,
                  )),
                ),
                onLongPress: canManageBranches ? () => _showDeleteDialog(warehouses[i]) : () {},
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _dialogField(String label, TextEditingController controller) {
    return TextField(
      controller: controller,
      style: GoogleFonts.outfit(fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.outfit(color: _kSlate),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
      ),
    );
  }
}

class _WarehouseCard extends StatelessWidget {
  final WarehouseModel warehouse;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const _WarehouseCard({required this.warehouse, required this.onTap, required this.onLongPress});

  @override
  Widget build(BuildContext context) {
    final utilization = warehouse.capacity != null && warehouse.capacity! > 0
        ? (warehouse.unitsStored / warehouse.capacity! * 100).clamp(0, 100)
        : 0.0;

    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42, height: 42,
                  decoration: BoxDecoration(
                    color: _kBlue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.warehouse_outlined, color: _kBlue, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(warehouse.name, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk)),
                      if (warehouse.location != null && warehouse.location!.isNotEmpty)
                        Text(warehouse.location!, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: _kSlate.withValues(alpha: 0.5), size: 20),
              ],
            ),
            if (warehouse.capacity != null && warehouse.capacity! > 0) ...[
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${warehouse.unitsStored} / ${warehouse.capacity} ${context.tr('units')}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                  Text('${utilization.toStringAsFixed(0)}%', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kBlue)),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: utilization / 100,
                  backgroundColor: _kBorder,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    utilization > 80 ? const Color(0xFFD97706) : _kBlue,
                  ),
                  minHeight: 6,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
