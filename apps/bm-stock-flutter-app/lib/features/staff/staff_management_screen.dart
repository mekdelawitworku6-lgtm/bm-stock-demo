import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/providers/staff_provider.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/models/employee_model.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/utils/phone_util.dart';
import '../../core/utils/branch_access_helper.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/plan_limit_dialog.dart';
import '../../core/widgets/refreshable_scroll.dart';
import 'staff_permissions_screen.dart';

class StaffManagementScreen extends StatefulWidget {
  const StaffManagementScreen({super.key});

  @override
  State<StaffManagementScreen> createState() => _StaffManagementScreenState();
}

class _StaffManagementScreenState extends State<StaffManagementScreen> {
  static const List<Map<String, String>> _staffRoles = [
    {'key': 'role_staff', 'title': 'Staff', 'role': 'user'},
    {'key': 'role_manager', 'title': 'Manager', 'role': 'manager'},
    {'key': 'role_admin', 'title': 'Admin', 'role': 'company_admin'},
    {'key': 'role_storekeeper', 'title': 'Storekeeper', 'role': 'warehouse_employee'},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _reloadStaffAndBranches();
    });
  }

  Future<void> _reloadStaffAndBranches() async {
    final companyState = context.read<CompanyBloc>().state;
    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    final staffProvider = Provider.of<StaffProvider>(context, listen: false);
    final branchProvider = Provider.of<BranchProvider>(context, listen: false);
    await Future.wait([
      staffProvider.loadEmployees(companyId: companyId),
      branchProvider.loadBranches(companyId: companyId),
    ]);
  }

  Future<void> _ensureBranchesLoaded() async {
    final companyState = context.read<CompanyBloc>().state;
    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    final branchProvider = Provider.of<BranchProvider>(context, listen: false);
    await branchProvider.loadBranches(companyId: companyId);
  }

  String? _branchAssignmentFromIds(String? shopId, String? warehouseId) {
    if (shopId != null && shopId.isNotEmpty) return 'shop:$shopId';
    if (warehouseId != null && warehouseId.isNotEmpty) return 'warehouse:$warehouseId';
    return null;
  }

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

  bool _roleRequiresBranchAssignment(String role) => role != 'company_admin';

  Widget _buildBranchAssignmentField({
    required BuildContext context,
    required BranchProvider branchProv,
    required String? branchAssignment,
    required ValueChanged<String?> onChanged,
    required bool allowUnassigned,
    EmployeeModel? targetEmployee,
  }) {
    if (branchProv.isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }

    final authState = context.read<AuthBloc>().state;
    final currentUser = authState is AuthAuthenticated ? authState.user : null;
    var accessibleShops = BranchAccessHelper.accessibleShops(currentUser, branchProv.shops);
    var accessibleWarehouses = BranchAccessHelper.accessibleWarehouses(currentUser, branchProv.warehouses);

    // If target staff member has configured branch permissions, strictly limit
    // the selectable branches to the ones explicitly allowed for them!
    final empBranchPerms = targetEmployee?.permissions?['branchPermissions'];
    if (empBranchPerms is Map && empBranchPerms.isNotEmpty) {
      final allowedShopIds = <String>{};
      final allowedWarehouseIds = <String>{};
      for (final entry in empBranchPerms.entries) {
        final bId = entry.key.toString();
        final access = entry.value;
        if (access is Map) {
          if (access['shop'] == true) allowedShopIds.add(bId);
          if (access['warehouse'] == true) allowedWarehouseIds.add(bId);
        }
      }
      if (allowedShopIds.isNotEmpty || allowedWarehouseIds.isNotEmpty) {
        accessibleShops = accessibleShops.where((s) => allowedShopIds.contains(s.id)).toList();
        accessibleWarehouses = accessibleWarehouses.where((w) => allowedWarehouseIds.contains(w.id)).toList();
      }
    }

    final items = <DropdownMenuItem<String?>>[];
    if (allowUnassigned) {
      items.add(DropdownMenuItem(value: null, child: Text(context.tr('none'))));
    }
    for (final shop in accessibleShops) {
      items.add(DropdownMenuItem(
        value: 'shop:${shop.id}',
        child: Text('${context.tr('shop')} — ${shop.name}', overflow: TextOverflow.ellipsis),
      ));
    }
    for (final warehouse in accessibleWarehouses) {
      items.add(DropdownMenuItem(
        value: 'warehouse:${warehouse.id}',
        child: Text('${context.tr('warehouse')} — ${warehouse.name}', overflow: TextOverflow.ellipsis),
      ));
    }

    if (accessibleShops.isEmpty && accessibleWarehouses.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(
          context.tr('no_branches_found'),
          style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
        ),
      );
    }

    // Guard against selected value not existing in items to prevent Flutter runtime assertion failure
    final safeValue = items.any((item) => item.value == branchAssignment) ? branchAssignment : null;

    return DropdownButtonFormField<String?>(
      value: safeValue,
      isExpanded: true,
      decoration: _inputDecoration(context.tr('assigned_store')),
      hint: Text(context.tr('select_branch')),
      items: items,
      onChanged: onChanged,
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
                        _showSnackBar(context.tr('staff_added'), true);
                        _openPermissions(newEmployee, isNewStaff: true);
                      } else if (mounted) {
                        _showSnackBar(context.tr('staff_add_failed'), false);
                      }
                    } on ForbiddenException catch (e) {
                      if (mounted) {
                        _showSnackBar(e.message.isNotEmpty ? e.message : context.tr('permission_denied_add_staff'), false);
                      }
                    } catch (e) {
                      if (mounted) {
                        final msg = e is ApiException ? e.message : e.toString();
                        _showSnackBar('${context.tr('error')}: $msg', false);
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

  Future<void> _showEditDialog(EmployeeModel employee) async {
    await _ensureBranchesLoaded();
    if (!mounted) return;

    final nameController = TextEditingController(text: employee.name);
    final phoneController = TextEditingController(text: employee.phoneNumber);
    final passwordController = TextEditingController(text: employee.assignedPassword ?? '');
    final pinController = TextEditingController(text: employee.assignedPin ?? '');
    String jobTitle = _resolveJobTitle(employee);
    String role = employee.role ?? _roleForTitle(jobTitle);
    String authMethod = employee.authMethod ?? 'password';
    final hasAssignedCredential =
        (employee.assignedPassword?.isNotEmpty == true) || (employee.assignedPin?.isNotEmpty == true);
    bool passwordObscured = !hasAssignedCredential;

    final branchProvider = Provider.of<BranchProvider>(context, listen: false);
    String? branchAssignment = _branchAssignmentFromIds(
      employee.shopId ??
          (branchProvider.shops.any((s) => s.name == employee.shopName)
              ? branchProvider.shops.firstWhere((s) => s.name == employee.shopName).id
              : null),
      employee.warehouseId ??
          (branchProvider.warehouses.any((w) => w.name == employee.warehouseName)
              ? branchProvider.warehouses.firstWhere((w) => w.name == employee.warehouseName).id
              : null),
    );

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) {
          final branchProv = Provider.of<BranchProvider>(context);

          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(context.tr('edit'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
                  onPressed: () => _confirmDelete(employee.id),
                ),
              ],
            ),
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
                      decoration: _inputDecoration(
                        passwordController.text.isEmpty
                            ? '${context.tr('password')} (${context.tr('optional')})'
                            : context.tr('password'),
                      ).copyWith(
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
                  _buildBranchAssignmentField(
                    context: context,
                    branchProv: branchProv,
                    branchAssignment: branchAssignment,
                    allowUnassigned: !_roleRequiresBranchAssignment(role),
                    targetEmployee: employee,
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
                  final branchIds = _idsFromBranchAssignment(branchAssignment);
                  final branchOk = !_roleRequiresBranchAssignment(role) ||
                      branchIds.shopId != null ||
                      branchIds.warehouseId != null;
                  final rawPhone = phoneController.text.trim();
                  final phone = PhoneUtil.toTenDigit(rawPhone);
                  final phoneOk = phone.isNotEmpty && PhoneUtil.isValidEthiopian(phone) && phone.length == 10;
                  if (nameController.text.isNotEmpty &&
                      phoneOk &&
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
                        'shopId': branchIds.shopId,
                        'warehouseId': branchIds.warehouseId,
                      };
                      if (authMethod == 'password' && passwordController.text.trim().length >= 6) {
                        data['password'] = passwordController.text.trim();
                      }
                      if (authMethod == 'pin' && pinController.text.trim().length == 4) {
                        data['pin'] = pinController.text.trim();
                      }

                      final success = await staffProv.updateEmployee(employee.id, data);
                      if (mounted) {
                        _showSnackBar(success ? context.tr('save') : context.tr('staff_update_failed'), success);
                      }
                    } catch (e) {
                      if (mounted) {
                        _showSnackBar('${context.tr('error')}: ${e.toString()}', false);
                      }
                    }
                  } else if (_roleRequiresBranchAssignment(role) && !branchOk) {
                    showAppToast(context, context.tr('select_branch'), type: AppToastType.error);
                  } else if (!phoneOk) {
                    showAppToast(context, context.tr('invalid_phone'), type: AppToastType.error);
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

  void _confirmDelete(String employeeId) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('delete'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text(context.tr('delete'), style: GoogleFonts.outfit()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: const Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () async {
              final staffProv = Provider.of<StaffProvider>(context, listen: false);
              Navigator.pop(ctx);
              Navigator.pop(context);
              try {
                final success = await staffProv.deleteEmployee(employeeId);
                if (mounted) {
                  _showSnackBar(success ? context.tr('delete') : context.tr('staff_delete_failed'), success);
                }
              } catch (e) {
                if (mounted) {
                  _showSnackBar('${context.tr('error')}: ${e.toString()}', false);
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: Text(context.tr('delete'), style: GoogleFonts.outfit(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _openPermissions(EmployeeModel employee, {bool isNewStaff = false}) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PermissionsScreen(employee: employee, isNewStaff: isNewStaff),
      ),
    );
    if (mounted) {
      _reloadStaffAndBranches();
    }
  }

  String _resolveJobTitle(EmployeeModel employee) {
    final title = employee.jobTitle?.trim();
    if (title != null && title.isNotEmpty && _staffRoles.any((r) => r['title'] == title)) {
      return title;
    }
    for (final r in _staffRoles) {
      if (r['role'] == employee.role) return r['title']!;
    }
    return 'Staff';
  }

  String _roleForTitle(String title) {
    for (final r in _staffRoles) {
      if (r['title'] == title) return r['role']!;
    }
    return 'user';
  }

  void _showSnackBar(String message, bool success) {
    showAppToast(context, message, type: success ? AppToastType.success : AppToastType.error);
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
      errorStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFFDC2626)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canEditStaff = user?.canEditModule(ModuleKeys.staffManagement) ?? true;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAFC),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: Text(
          context.tr('staff_management'),
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
        ),
        actions: [
          if (canEditStaff)
            Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: SizedBox(
                height: 36,
                child: ElevatedButton.icon(
                  onPressed: _showInviteDialog,
                  icon: const Icon(Icons.person_add_alt_1_outlined, size: 16, color: Colors.white),
                  label: Text(
                    context.tr('invite'),
                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D5C96),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: BlocBuilder<CompanyBloc, CompanyState>(
        builder: (_, companyState) {
          final companyKey = companyState is CompanyLoaded ? companyState.selectedCompany?.id ?? 'none' : 'none';
          return Consumer2<StaffProvider, BranchProvider>(
            builder: (_, provider, branchProv, __) {
              final employees = provider.employees.where((e) => !e.isOwner).toList();
              if (provider.isLoading && employees.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }

              if (employees.isEmpty) {
                return RefreshIndicator(
                  onRefresh: _reloadStaffAndBranches,
                  child: refreshableScrollChild(
                    child: Center(
                      child: Text(context.tr('no_results_found'), style: GoogleFonts.outfit(fontSize: 16, color: const Color(0xFF64748B))),
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: _reloadStaffAndBranches,
                child: ListView.builder(
                  physics: refreshScrollPhysics,
                  key: ValueKey('staff-list-$companyKey'),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  itemCount: employees.length,
                  itemBuilder: (context, index) {
                    final member = employees[index];

                    String initials = '';
                    if (member.name.isNotEmpty) {
                      final parts = member.name.trim().split(' ');
                      if (parts.length > 1) {
                        initials = '${parts[0][0]}${parts[1][0]}';
                      } else {
                        initials = parts[0].substring(0, parts[0].length > 1 ? 2 : 1);
                      }
                    }
                    initials = initials.toUpperCase();

                    final bool isManager = member.jobTitle?.toLowerCase().contains('manager') ?? false;
                    final bool isAdmin = member.jobTitle?.toLowerCase() == 'admin';
                    final bool isHighlighted = isManager || isAdmin;
                    final String roleLabel = member.jobTitle?.isNotEmpty == true ? member.jobTitle! : context.tr('role_staff');

                    // Extract allowed branch info
                    final branchPerms = member.permissions?['branchPermissions'];
                    final List<({String name, String type, bool isPrimary})> allowedBranches = [];

                    // 1. Primary assigned shop or warehouse
                    if (member.shopName?.trim().isNotEmpty ?? false) {
                      allowedBranches.add((name: member.shopName!.trim(), type: 'Shop', isPrimary: true));
                    } else if (member.warehouseName?.trim().isNotEmpty ?? false) {
                      allowedBranches.add((name: member.warehouseName!.trim(), type: 'Warehouse', isPrimary: true));
                    }

                    // 2. Additional allowed branches from branchPermissions
                    if (branchPerms is Map && branchPerms.isNotEmpty) {
                      for (final entry in branchPerms.entries) {
                        final bId = entry.key.toString().trim();
                        final bAccess = entry.value;
                        bool hasShopAccess = false;
                        bool hasWarehouseAccess = false;

                        if (bAccess is Map) {
                          hasShopAccess = bAccess['shop'] == true || bAccess['shop'] == 'true';
                          hasWarehouseAccess = bAccess['warehouse'] == true || bAccess['warehouse'] == 'true';
                        } else if (bAccess == true || bAccess == 'true') {
                          hasShopAccess = true;
                          hasWarehouseAccess = true;
                        }

                        if (hasShopAccess) {
                          final s = branchProv.shops.where((x) => x.id == bId).firstOrNull;
                          if (s != null && !allowedBranches.any((b) => b.name == s.name)) {
                            allowedBranches.add((name: s.name, type: 'Shop', isPrimary: false));
                          }
                        }
                        if (hasWarehouseAccess) {
                          final w = branchProv.warehouses.where((x) => x.id == bId).firstOrNull;
                          if (w != null && !allowedBranches.any((b) => b.name == w.name)) {
                            allowedBranches.add((name: w.name, type: 'Warehouse', isPrimary: false));
                          }
                        }
                      }
                    }

                    final String fallbackBranch = member.shopName?.trim().isNotEmpty == true
                        ? member.shopName!.trim()
                        : (member.warehouseName?.trim().isNotEmpty == true
                            ? member.warehouseName!.trim()
                            : (isAdmin || isManager ? context.tr('all_branches') : context.tr('unassigned')));

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0F172A).withValues(alpha: 0.02),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF1D5C96),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    initials,
                                    style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
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
                                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                                    ),
                                    const SizedBox(height: 4),
                                    Wrap(
                                      crossAxisAlignment: WrapCrossAlignment.center,
                                      spacing: 8,
                                      runSpacing: 4,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: isHighlighted ? const Color(0xFF1D5C96) : const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            roleLabel,
                                            style: GoogleFonts.outfit(
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                              color: isHighlighted ? Colors.white : const Color(0xFF64748B),
                                            ),
                                          ),
                                        ),
                                        if (member.phoneNumber.isNotEmpty)
                                          Text(
                                            member.phoneNumber,
                                            style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              Row(
                                children: [
                                  if (canEditStaff) ...[
                                    GestureDetector(
                                      onTap: () => _openPermissions(member),
                                      child: Container(
                                        width: 34,
                                        height: 34,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF8FAFC),
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: const Color(0xFFE2E8F0)),
                                        ),
                                        child: const Icon(Icons.shield_outlined, color: Color(0xFF0F172A), size: 16),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    GestureDetector(
                                      onTap: () => _showEditDialog(member),
                                      child: Container(
                                        width: 34,
                                        height: 34,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF8FAFC),
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: const Color(0xFFE2E8F0)),
                                        ),
                                        child: const Icon(Icons.edit_outlined, color: Color(0xFF0F172A), size: 16),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          // Branch Section: Clearly show allowed branches as tags or fallback assigned branch
                          if (allowedBranches.isNotEmpty) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.storefront_outlined, size: 14, color: Color(0xFF1D5C96)),
                                      const SizedBox(width: 6),
                                      Text(
                                        '${context.tr('allowed_branches')} (${allowedBranches.length}):',
                                        style: GoogleFonts.outfit(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF1D5C96),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: allowedBranches.map((b) {
                                      return Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(
                                            color: b.isPrimary ? const Color(0xFF1D5C96) : const Color(0xFFCBD5E1),
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              b.type == 'Shop' ? Icons.storefront_outlined : Icons.warehouse_outlined,
                                              size: 12,
                                              color: b.isPrimary ? const Color(0xFF1D5C96) : const Color(0xFF64748B),
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              b.isPrimary ? '${b.name} (${context.tr('primary')})' : b.name,
                                              style: GoogleFonts.outfit(
                                                fontSize: 12,
                                                fontWeight: b.isPrimary ? FontWeight.w600 : FontWeight.w500,
                                                color: b.isPrimary ? const Color(0xFF1D5C96) : const Color(0xFF0F172A),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),
                          ] else ...[
                            Row(
                              children: [
                                Icon(
                                  isAdmin || isManager ? Icons.business_outlined : Icons.location_on_outlined,
                                  size: 14,
                                  color: const Color(0xFF94A3B8),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  fallbackBranch,
                                  style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                          ],
                          Row(
                            children: [
                              RichText(
                                text: TextSpan(
                                  style: GoogleFonts.outfit(fontSize: 13),
                                  children: [
                                    TextSpan(text: '${context.tr('sales')}: ', style: const TextStyle(color: Color(0xFF94A3B8))),
                                    TextSpan(
                                      text: 'ETB ${member.salesAmount.toStringAsFixed(2)}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                    ),
                                  ],
                                ),
                              ),
                              const Spacer(),
                              Text(
                                member.authMethod == 'pin' ? context.tr('auth_pin') : context.tr('auth_password'),
                                style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}

