import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/employee_model.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/providers/staff_provider.dart';
import '../../core/utils/phone_util.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/plan_limit_dialog.dart';
import '../../core/widgets/refreshable_scroll.dart';
import 'staff_permissions_screen.dart';

const _kBlue = Color(0xFF1D5C96);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

/// Dedicated hub where admins pick a staff member and configure module access.
class StaffAccessScreen extends StatefulWidget {
  const StaffAccessScreen({super.key});

  @override
  State<StaffAccessScreen> createState() => _StaffAccessScreenState();
}

class _StaffAccessScreenState extends State<StaffAccessScreen> {
  static const List<Map<String, String>> _staffRoles = [
    {'key': 'role_staff', 'title': 'Staff', 'role': 'user'},
    {'key': 'role_manager', 'title': 'Manager', 'role': 'manager'},
    {'key': 'role_admin', 'title': 'Admin', 'role': 'company_admin'},
    {'key': 'role_storekeeper', 'title': 'Storekeeper', 'role': 'warehouse_employee'},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadStaff());
  }

  Future<void> _loadStaff() async {
    final companyState = context.read<CompanyBloc>().state;
    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    await context.read<StaffProvider>().loadEmployees(companyId: companyId);
  }

  Future<void> _ensureBranchesLoaded() async {
    final companyState = context.read<CompanyBloc>().state;
    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    final branchProvider = Provider.of<BranchProvider>(context, listen: false);
    await branchProvider.loadBranches(companyId: companyId);
  }

  bool _roleRequiresBranchAssignment(String role) => role != 'company_admin';

  ({String? shopId, String? warehouseId}) _idsFromBranchAssignment(String? assignment) {
    if (assignment == null) return (shopId: null, warehouseId: null);
    if (assignment.startsWith('shop:')) {
      return (shopId: assignment.substring(5), warehouseId: null);
    }
    if (assignment.startsWith('warehouse:')) {
      return (shopId: null, warehouseId: assignment.substring(10));
    }
    return (shopId: null, warehouseId: null);
  }

  Widget _buildBranchAssignmentField({
    required BuildContext context,
    required BranchProvider branchProv,
    required String? branchAssignment,
    required ValueChanged<String?> onChanged,
    required bool allowUnassigned,
  }) {
    if (branchProv.isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }

    final items = <DropdownMenuItem<String?>>[];
    if (allowUnassigned) {
      items.add(DropdownMenuItem(value: null, child: Text(context.tr('none'))));
    }
    for (final shop in branchProv.shops) {
      items.add(DropdownMenuItem(
        value: 'shop:${shop.id}',
        child: Text('${context.tr('shop')} — ${shop.name}', overflow: TextOverflow.ellipsis),
      ));
    }
    for (final warehouse in branchProv.warehouses) {
      items.add(DropdownMenuItem(
        value: 'warehouse:${warehouse.id}',
        child: Text('${context.tr('warehouse')} — ${warehouse.name}', overflow: TextOverflow.ellipsis),
      ));
    }

    if (branchProv.shops.isEmpty && branchProv.warehouses.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(
          context.tr('no_branches_found'),
          style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
        ),
      );
    }

    return DropdownButtonFormField<String?>(
      value: branchAssignment,
      isExpanded: true,
      decoration: _inputDecoration(context.tr('assigned_store')),
      hint: Text(context.tr('select_branch')),
      items: items,
      onChanged: onChanged,
    );
  }

  InputDecoration _inputDecoration(String label, {String? errorText}) {
    final hasError = errorText != null && errorText.isNotEmpty;
    return InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.outfit(color: hasError ? const Color(0xFFDC2626) : const Color(0xFF64748B)),
      filled: true,
      fillColor: hasError ? const Color(0xFFFFF5F5) : const Color(0xFFF8FAFC),
      errorText: errorText,
      errorMaxLines: 2,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(
          color: hasError ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0),
          width: hasError ? 1.5 : 1,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF1D5C96), width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.8),
      ),
      errorStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFFDC2626)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    );
  }

  Future<void> _showInviteDialog() async {
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final staffProv = Provider.of<StaffProvider>(context, listen: false);
    final currentStaff = staffProv.employees.where((e) => !e.isOwner).toList();
    if (user != null && currentStaff.length >= user.maxStaff) {
      showPlanLimitDialog(
        context,
        resourceName: 'staff account',
        limit: user.maxStaff,
        planTitle: user.planTitle,
      );
      return;
    }

    await _ensureBranchesLoaded();
    if (!mounted) return;

    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final passwordController = TextEditingController();
    final pinController = TextEditingController();
    String jobTitle = 'Staff';
    String role = 'user';
    String authMethod = 'password';
    String? branchAssignment;
    bool passwordObscured = true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) {
          final branchProv = Provider.of<BranchProvider>(context);
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Text(context.tr('add_staff'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameController,
                    decoration: _inputDecoration(context.tr('first_name')),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneController,
                    decoration: _inputDecoration(context.tr('phone_number')).copyWith(
                      hintText: '09xxxxxxxx',
                    ),
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: jobTitle,
                    decoration: _inputDecoration(context.tr('job_title')),
                    items: _staffRoles
                        .map((r) => DropdownMenuItem(
                              value: r['title'],
                              child: Text(context.tr(r['key']!)),
                            ))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) {
                        final selected = _staffRoles.firstWhere((r) => r['title'] == val);
                        setState(() {
                          jobTitle = selected['title']!;
                          role = selected['role']!;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: authMethod,
                    decoration: _inputDecoration(context.tr('auth_method')),
                    items: [
                      DropdownMenuItem(value: 'password', child: Text(context.tr('auth_password'))),
                      DropdownMenuItem(value: 'pin', child: Text(context.tr('auth_pin'))),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => authMethod = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  if (authMethod == 'password')
                    TextField(
                      controller: passwordController,
                      obscureText: passwordObscured,
                      decoration: _inputDecoration(context.tr('password')).copyWith(
                        suffixIcon: IconButton(
                          icon: Icon(
                            passwordObscured ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                            color: const Color(0xFF94A3B8),
                            size: 20,
                          ),
                          onPressed: () => setState(() => passwordObscured = !passwordObscured),
                        ),
                      ),
                    )
                  else
                    TextField(
                      controller: pinController,
                      obscureText: passwordObscured,
                      keyboardType: TextInputType.number,
                      maxLength: 4,
                      decoration: _inputDecoration(context.tr('enter_pin')).copyWith(
                        counterText: '',
                        suffixIcon: IconButton(
                          icon: Icon(
                            passwordObscured ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                            color: const Color(0xFF94A3B8),
                            size: 20,
                          ),
                          onPressed: () => setState(() => passwordObscured = !passwordObscured),
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  _buildBranchAssignmentField(
                    context: context,
                    branchProv: branchProv,
                    branchAssignment: branchAssignment,
                    allowUnassigned: !_roleRequiresBranchAssignment(role),
                    onChanged: (val) => setState(() => branchAssignment = val),
                  ),
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
                  final password = passwordController.text.trim();
                  final pin = pinController.text.trim();
                  final authOk = authMethod == 'pin'
                      ? pin.length == 4
                      : password.length >= 6;
                  final rawPhone = phoneController.text.trim();
                  final phone = PhoneUtil.toTenDigit(rawPhone);
                  final phoneOk = phone.isNotEmpty && PhoneUtil.isValidEthiopian(phone) && phone.length == 10;
                  final branchIds = _idsFromBranchAssignment(branchAssignment);
                  final branchOk = !_roleRequiresBranchAssignment(role) ||
                      branchIds.shopId != null ||
                      branchIds.warehouseId != null;
                  if (nameController.text.isNotEmpty &&
                      phoneOk &&
                      authOk &&
                      branchOk) {
                    final staffProv = Provider.of<StaffProvider>(context, listen: false);
                    Navigator.pop(ctx);
                    try {
                      final Map<String, dynamic> data = {
                        'name': nameController.text,
                        'phoneNumber': phone,
                        'jobTitle': jobTitle,
                        'role': role,
                        'authMethod': authMethod,
                      };
                      if (authMethod == 'password') {
                        data['password'] = password;
                      } else {
                        data['pin'] = pin;
                      }
                      if (branchIds.shopId != null) data['shopId'] = branchIds.shopId;
                      if (branchIds.warehouseId != null) data['warehouseId'] = branchIds.warehouseId;

                      final newEmployee = await staffProv.addEmployee(data);
                      if (mounted && newEmployee != null) {
                        showAppToast(context, context.tr('staff_added'), type: AppToastType.success);
                        _openPermissions(newEmployee, isNewStaff: true);
                      } else if (mounted) {
                        showAppToast(context, context.tr('staff_add_failed'), type: AppToastType.error);
                      }
                    } on ForbiddenException {
                      if (mounted) {
                        showAppToast(context, context.tr('permission_denied_add_staff'), type: AppToastType.error);
                      }
                    } catch (e) {
                      if (mounted) {
                        showAppToast(context, '${context.tr('error')}: ${e.toString()}', type: AppToastType.error);
                      }
                    }
                  } else if (_roleRequiresBranchAssignment(role) && !branchOk) {
                    showAppToast(context, context.tr('select_branch'), type: AppToastType.error);
                  } else if (!phoneOk) {
                    showAppToast(context, context.tr('invalid_phone'), type: AppToastType.error);
                  } else if (authMethod == 'password' && password.length < 6) {
                    showAppToast(context, context.tr('min_characters'), type: AppToastType.error);
                  } else if (authMethod == 'pin' && pin.length != 4) {
                    showAppToast(context, context.tr('enter_pin'), type: AppToastType.error);
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

  void _openPermissions(EmployeeModel employee, {bool isNewStaff = false}) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => PermissionsScreen(employee: employee, isNewStaff: isNewStaff)),
    );
  }

  String _initials(String name) {
    if (name.isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length > 1) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.substring(0, name.length > 1 ? 2 : 1).toUpperCase();
  }

  Widget _summaryChip(String label, int enabled, int total) {
    final active = enabled > 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: active ? _kBlue.withValues(alpha: 0.08) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '$label $enabled/$total',
        style: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: active ? _kBlue : _kSlate,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canManage = user?.canEditModule(ModuleKeys.staffManagement) ?? user?.isAdmin ?? false;

    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: _kBg,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              context.tr('permissions_access'),
              style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
            ),
            Text(
              context.tr('permissions_access_subtitle'),
              style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
            ),
          ],
        ),
        actions: [
          if (canManage)
            Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: SizedBox(
                height: 36,
                child: ElevatedButton.icon(
                  onPressed: _showInviteDialog,
                  icon: const Icon(Icons.person_add_alt_1_outlined, size: 16, color: Colors.white),
                  label: Text(
                    context.tr('add_staff'),
                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: !canManage
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  context.tr('permissions_admin_only'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(fontSize: 15, color: _kSlate),
                ),
              ),
            )
          : BlocBuilder<CompanyBloc, CompanyState>(
              builder: (_, companyState) {
                final companyKey = companyState is CompanyLoaded ? companyState.selectedCompany?.id ?? 'none' : 'none';
                return Consumer<StaffProvider>(
                  builder: (_, provider, __) {
                    if (provider.isLoading && provider.employees.isEmpty) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    final employees = provider.employees.where((e) => !e.isOwner).toList();
                    if (employees.isEmpty) {
                      return RefreshIndicator(
                        onRefresh: _loadStaff,
                        child: refreshableScrollChild(
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.people_outline, size: 56, color: _kSlate.withValues(alpha: 0.4)),
                                  const SizedBox(height: 12),
                                  Text(
                                    context.tr('no_results_found'),
                                    style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600, color: _kInk),
                                  ),
                                  const SizedBox(height: 16),
                                  if (canManage)
                                    ElevatedButton.icon(
                                      onPressed: _showInviteDialog,
                                      icon: const Icon(Icons.person_add_alt_1_outlined, size: 18, color: Colors.white),
                                      label: Text(
                                        context.tr('add_staff'),
                                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                                      ),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: _kBlue,
                                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    }

                    return RefreshIndicator(
                      onRefresh: _loadStaff,
                      child: ListView(
                        physics: refreshScrollPhysics,
                        key: ValueKey('staff-access-$companyKey'),
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: _kBorder),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: _kBlue.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(Icons.admin_panel_settings_outlined, color: _kBlue, size: 24),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Text(
                                    context.tr('permissions_access_desc'),
                                    style: GoogleFonts.outfit(fontSize: 13, color: _kSlate, height: 1.4),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          ...employees.map((member) {
                            final perms = member.permissions;
                            final stock = ModuleKeys.countEnabledModules(perms, ModuleKeys.stockGroup);
                            final location = ModuleKeys.countEnabledModules(perms, ModuleKeys.locationGroup);
                            final sales = ModuleKeys.countEnabledModules(perms, ModuleKeys.salesGroup);
                            final products = ModuleKeys.countEnabledModules(perms, ModuleKeys.productGroup);
                            final roleLabel = member.jobTitle?.isNotEmpty == true
                                ? member.jobTitle!
                                : context.tr('role_staff');

                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: _kBorder),
                              ),
                              child: InkWell(
                                onTap: () => _openPermissions(member),
                                borderRadius: BorderRadius.circular(16),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          CircleAvatar(
                                            radius: 22,
                                            backgroundColor: _kBlue,
                                            child: Text(
                                              _initials(member.name),
                                              style: GoogleFonts.outfit(
                                                color: Colors.white,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  member.name,
                                                  style: GoogleFonts.outfit(
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.bold,
                                                    color: _kInk,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  roleLabel,
                                                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Icon(Icons.chevron_right, color: _kSlate.withValues(alpha: 0.6)),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 6,
                                        children: [
                                          _summaryChip(context.tr('perm_stock'), stock, ModuleKeys.stockGroup.length),
                                          _summaryChip(context.tr('perm_location'), location, ModuleKeys.locationGroup.length),
                                          _summaryChip(context.tr('perm_sales'), sales, ModuleKeys.salesGroup.length),
                                          _summaryChip(context.tr('perm_products'), products, ModuleKeys.productGroup.length),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      SizedBox(
                                        width: double.infinity,
                                        height: 40,
                                        child: OutlinedButton.icon(
                                          onPressed: () => _openPermissions(member),
                                          icon: const Icon(Icons.tune_outlined, size: 18, color: _kBlue),
                                          label: Text(
                                            context.tr('configure_access'),
                                            style: GoogleFonts.outfit(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: _kBlue,
                                            ),
                                          ),
                                          style: OutlinedButton.styleFrom(
                                            side: const BorderSide(color: _kBlue),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
    );
  }
}
