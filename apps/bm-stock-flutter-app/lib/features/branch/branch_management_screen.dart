import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/models/shop_model.dart';
import '../../core/models/warehouse_model.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/refreshable_scroll.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/utils/branch_access_helper.dart';

class BranchManagementScreen extends StatefulWidget {
  const BranchManagementScreen({super.key});

  @override
  State<BranchManagementScreen> createState() => _BranchManagementScreenState();
}

class _BranchManagementScreenState extends State<BranchManagementScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final companyState = context.read<CompanyBloc>().state;
      final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
      final branchProvider = Provider.of<BranchProvider>(context, listen: false);
      if (branchProvider.activeCompanyId != companyId) {
        branchProvider.loadBranches(companyId: companyId);
      }
    });
  }

  void _showAddDialog() {
    final companyState = context.read<CompanyBloc>().state;
    final companyName = companyState is CompanyLoaded ? companyState.selectedCompany?.name ?? '' : '';
    final branchProv = Provider.of<BranchProvider>(context, listen: false);
    final isFirstStore = branchProv.shops.isEmpty && branchProv.warehouses.isEmpty;
    final nameController = TextEditingController(text: isFirstStore ? companyName : '');
    final addressController = TextEditingController();
    String branchType = 'Shop';
    String? selectedWarehouseId;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) {
          final branchProv = Provider.of<BranchProvider>(context, listen: false);
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Text(context.tr('add_branch'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    value: branchType,
                    decoration: _inputDecoration(context.tr('branch')),
                    items: [
                      DropdownMenuItem(value: 'Shop', child: Text(context.tr('shop'))),
                      DropdownMenuItem(value: 'Warehouse', child: Text(context.tr('store'))),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => branchType = val);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: nameController,
                    decoration: _inputDecoration(context.tr('store_name')),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: addressController,
                    decoration: _inputDecoration(context.tr('address_location')),
                    maxLines: 2,
                  ),
                  if (branchType == 'Shop') ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String?>(
                      value: selectedWarehouseId,
                      decoration: _inputDecoration(context.tr('store')),
                      items: [
                        DropdownMenuItem(value: null, child: Text(context.tr('none'))),
                        ...branchProv.warehouses.map((w) => DropdownMenuItem(value: w.id, child: Text(w.name))),
                      ],
                      onChanged: (val) {
                        setState(() => selectedWarehouseId = val);
                      },
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: const Color(0xFF64748B))),
              ),
              ElevatedButton(
                onPressed: () async {
                  if (nameController.text.isNotEmpty) {
                    final branchProv = Provider.of<BranchProvider>(context, listen: false);
                    Navigator.pop(ctx);
                    try {
                      bool success;
                      if (branchType == 'Shop') {
                        final Map<String, dynamic> data = {
                          'name': nameController.text,
                          'location': addressController.text.trim(),
                        };
                        if (selectedWarehouseId != null) {
                          data['warehouseId'] = selectedWarehouseId;
                        }
                        success = await branchProv.addShop(data);
                      } else {
                        success = await branchProv.addWarehouse({
                          'name': nameController.text,
                          'location': addressController.text.trim(),
                        });
                      }
                      if (mounted) {
                        _showSnackBar(success ? context.tr('add_branch') : context.tr('branch_add_failed'), success);
                      }
                    } catch (e) {
                      if (mounted) {
                        _showSnackBar('${context.tr('error')}: ${e.toString()}', false);
                      }
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D5C96),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: Text(context.tr('add'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ],
          );
        }
      ),
    );
  }

  void _showEditDialog(dynamic branch) {
    final bool isShop = branch is ShopModel;
    final String branchName = isShop ? branch.name : branch.name;
    final String branchLocation = (isShop ? branch.location : branch.location) ?? '';
    final String branchId = branch.id;

    final nameController = TextEditingController(text: branchName);
    final locationController = TextEditingController(text: branchLocation);
    String? selectedWarehouseId;

    if (isShop) {
      final branchProv = Provider.of<BranchProvider>(context, listen: false);
      selectedWarehouseId = branchProv.warehouses.any((w) => w.name == branch.warehouseName)
          ? branchProv.warehouses.firstWhere((w) => w.name == branch.warehouseName).id
          : null;
    }

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) {
          final branchProv = Provider.of<BranchProvider>(context, listen: false);
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(context.tr('edit'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
                  onPressed: () => _confirmDelete(branchId, isShop, fromEditDialog: true),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameController,
                    decoration: _inputDecoration(context.tr('company_name')),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: locationController,
                    decoration: _inputDecoration(context.tr('location')),
                  ),
                  if (isShop) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String?>(
                      value: selectedWarehouseId,
                      decoration: _inputDecoration(context.tr('store')),
                      items: [
                        DropdownMenuItem(value: null, child: Text(context.tr('none'))),
                        ...branchProv.warehouses.map((w) => DropdownMenuItem(value: w.id, child: Text(w.name))),
                      ],
                      onChanged: (val) {
                        setState(() => selectedWarehouseId = val);
                      },
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: const Color(0xFF64748B))),
              ),
              ElevatedButton(
                onPressed: () async {
                  if (nameController.text.isNotEmpty) {
                    final branchProv = Provider.of<BranchProvider>(context, listen: false);
                    Navigator.pop(ctx);
                    try {
                      bool success;
                      if (isShop) {
                        final Map<String, dynamic> data = {
                          'name': nameController.text,
                          'location': locationController.text,
                          'warehouseId': selectedWarehouseId,
                        };
                        success = await branchProv.updateShop(branchId, data);
                      } else {
                        success = await branchProv.updateWarehouse(branchId, {
                          'name': nameController.text,
                          'location': locationController.text,
                        });
                      }
                      if (mounted) {
                        _showSnackBar(success ? context.tr('save') : context.tr('branch_update_failed'), success);
                      }
                    } catch (e) {
                      if (mounted) {
                        _showSnackBar('${context.tr('error')}: ${e.toString()}', false);
                      }
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D5C96),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: Text(context.tr('save'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ],
          );
        }
      ),
    );
  }

  void _confirmDelete(String branchId, bool isShop, {bool fromEditDialog = false}) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          isShop ? 'Delete Shop' : 'Delete Warehouse',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
        ),
        content: Text(
          'Are you sure you want to delete this ${isShop ? 'shop' : 'warehouse'}? This confirmation requires no OTP.',
          style: GoogleFonts.outfit(color: const Color(0xFF64748B)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: const Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () async {
              final branchProv = Provider.of<BranchProvider>(context, listen: false);
              Navigator.pop(ctx);
              if (fromEditDialog) {
                Navigator.pop(context);
              }
              try {
                bool success;
                if (isShop) {
                  success = await branchProv.deleteShop(branchId);
                } else {
                  success = await branchProv.deleteWarehouse(branchId);
                }
                if (mounted) {
                  _showSnackBar(
                    success
                        ? '${isShop ? 'Shop' : 'Warehouse'} deleted successfully'
                        : context.tr('branch_delete_failed'),
                    success,
                  );
                }
              } catch (e) {
                if (mounted) {
                  _showSnackBar('${context.tr('error')}: ${e.toString()}', false);
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: Text(context.tr('delete'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String message, bool success) {
    showAppToast(context, message, type: success ? AppToastType.success : AppToastType.error);
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.outfit(color: const Color(0xFF64748B)),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF1D5C96), width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canManageBranches = user?.isAdmin == true ||
        (user?.canEditModule(ModuleKeys.addStore) ?? false) ||
        (user?.canEditModule(ModuleKeys.addShop) ?? false) ||
        (user?.canEditModule(ModuleKeys.shopStore) ?? false) ||
        (user?.canEditModule(ModuleKeys.warehouse) ?? false);
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAFC),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: BlocBuilder<CompanyBloc, CompanyState>(
          builder: (_, companyState) {
            final companyName = companyState is CompanyLoaded ? companyState.selectedCompany?.name : null;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.tr('branch_management'),
                  style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                ),
                if (companyName != null && companyName.isNotEmpty)
                  Text(
                    companyName,
                    style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
                  ),
              ],
            );
          },
        ),
        actions: [
          if (canManageBranches)
            Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: SizedBox(
                height: 38,
                child: ElevatedButton.icon(
                  onPressed: _showAddDialog,
                  icon: const Icon(Icons.add_business_outlined, size: 16, color: Colors.white),
                  label: Text(context.tr('add_branch'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D5C96),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: BlocBuilder<CompanyBloc, CompanyState>(
        builder: (_, companyState) {
          return Consumer<BranchProvider>(
            builder: (_, provider, __) {
              final authState = context.read<AuthBloc>().state;
              final user = authState is AuthAuthenticated ? authState.user : null;
              final accessibleShops = BranchAccessHelper.accessibleShops(user, provider.shops);
              final combined = accessibleShops;
              final companyKey = companyState is CompanyLoaded ? companyState.selectedCompany?.id ?? 'none' : 'none';

              if (provider.isLoading && combined.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }

              if (combined.isEmpty) {
                return RefreshIndicator(
                  onRefresh: () {
                    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
                    return provider.loadBranches(companyId: companyId);
                  },
                  child: refreshableScrollChild(
                    child: Center(
                      child: Text(context.tr('no_results_found'), style: GoogleFonts.outfit(fontSize: 16, color: const Color(0xFF64748B))),
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () {
                  final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
                  return provider.loadBranches(companyId: companyId);
                },
                child: ListView.builder(
                  physics: refreshScrollPhysics,
                  key: ValueKey('branch-list-$companyKey'),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: combined.length,
                  itemBuilder: (context, index) {
                    final item = combined[index];
                    if (item is ShopModel) {
                      return _buildBranchCard(
                        context: context,
                        name: item.name,
                        location: item.location ?? '',
                        unitsInStock: item.unitsInStock,
                        unitsStored: item.unitsStored,
                        managerName: item.managerName ?? context.tr('not_assigned'),
                        onEdit: canManageBranches ? () => _showEditDialog(item) : null,
                        onDelete: canManageBranches ? () => _confirmDelete(item.id, true) : null,
                      );
                    } else if (item is WarehouseModel) {
                      return _buildBranchCard(
                        context: context,
                        name: item.name,
                        location: item.location ?? '',
                        unitsInStock: item.unitsInStock,
                        unitsStored: item.unitsStored,
                        managerName: item.managerName ?? context.tr('not_assigned'),
                        onEdit: canManageBranches ? () => _showEditDialog(item) : null,
                        onDelete: canManageBranches ? () => _confirmDelete(item.id, false) : null,
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildBranchCard({
    required BuildContext context,
    required String name,
    required String location,
    required int unitsInStock,
    required int unitsStored,
    required String managerName,
    VoidCallback? onEdit,
    VoidCallback? onDelete,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: Color(0xFF1D5C96),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(Icons.business_outlined, color: Colors.white, size: 24),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined, color: Color(0xFF64748B), size: 14),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            location,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (onEdit != null)
                GestureDetector(
                  onTap: onEdit,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(8),
                      color: Colors.white,
                    ),
                    child: const Icon(Icons.edit_outlined, color: Color(0xFF1D5C96), size: 16),
                  ),
                ),
              if (onDelete != null) ...[
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: onDelete,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFFECACA)),
                      borderRadius: BorderRadius.circular(8),
                      color: const Color(0xFFFEF2F2),
                    ),
                    child: const Icon(Icons.delete_outline, color: Color(0xFFDC2626), size: 16),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.storefront_outlined, color: Color(0xFF1D5C96), size: 14),
                          const SizedBox(width: 4),
                          Text(
                            context.tr('shop').toUpperCase(),
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF1D5C96),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$unitsInStock',
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        context.tr('units_in_stock'),
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warehouse_outlined, color: Color(0xFF1D5C96), size: 14),
                          const SizedBox(width: 4),
                          Text(
                            context.tr('store').toUpperCase(),
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF1D5C96),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$unitsStored',
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        context.tr('units_stored'),
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.person_outline, color: Color(0xFF64748B), size: 16),
              const SizedBox(width: 4),
              Text(
                '${context.tr('manager')}:',
                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
              ),
              const SizedBox(width: 4),
              Text(
                managerName,
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF1D5C96),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}