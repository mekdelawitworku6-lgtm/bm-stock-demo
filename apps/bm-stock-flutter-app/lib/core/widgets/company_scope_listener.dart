import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../blocs/auth/auth_bloc.dart';
import '../blocs/auth/auth_event.dart';
import '../blocs/auth/auth_state.dart';
import '../widgets/account_blocked_dialog.dart';
import '../blocs/company/company_bloc.dart';
import '../blocs/company/company_event.dart';
import '../blocs/company/company_state.dart';
import '../localization/app_localizations.dart';
import '../models/company_model.dart';
import 'app_toast.dart';
import '../providers/branch_provider.dart';
import '../providers/dashboard_provider.dart';
import '../providers/product_provider.dart';
import '../providers/report_provider.dart';
import '../providers/sale_provider.dart';
import '../providers/staff_provider.dart';
import '../providers/bank_account_provider.dart';
import '../bloc/branch/branch_bloc.dart';
import '../bloc/borrowing/borrowing_bloc.dart';
import '../bloc/commission/commission_bloc.dart';
import '../bloc/customer/customer_bloc.dart';
import '../bloc/notification/notification_bloc.dart';
import '../bloc/product/product_bloc.dart';
import '../bloc/sale/sale_bloc.dart';
import '../bloc/supplier/supplier_bloc.dart';
import '../bloc/transfer/transfer_bloc.dart';
import '../bloc/warehouse/warehouse_bloc.dart';

/// Global keys attached to the root [MaterialApp] so that widgets that live
/// ABOVE it (like this listener) can still show dialogs/snackbars on the
/// app's navigator/scaffold.
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<ScaffoldMessengerState> appScaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

class CompanyScopeListener extends StatefulWidget {
  final Widget child;

  const CompanyScopeListener({super.key, required this.child});

  @override
  State<CompanyScopeListener> createState() => _CompanyScopeListenerState();
}

class _CompanyScopeListenerState extends State<CompanyScopeListener> {
  String? _activeCompanyId;
  bool _wasAuthenticated = false;

  Future<void> _loadCompaniesForUser(AuthAuthenticated auth) async {
    final companyId = auth.user.companyId;
    String? companyName = auth.user.companyName;

    if (companyId != null && companyId.isNotEmpty) {
      if (companyName == null || companyName.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        final companiesJson = prefs.getString('companies');
        if (companiesJson != null) {
          try {
            final cachedList = (json.decode(companiesJson) as List)
                .map((e) => CompanyModel.fromJson(e as Map<String, dynamic>))
                .toList();
            final cached = cachedList.where((c) => c.id == companyId).firstOrNull;
            if (cached != null) companyName = cached.name;
          } catch (_) {}
        }
      }

      final prefs = await SharedPreferences.getInstance();
      if (companyName != null && companyName.isNotEmpty) {
        await prefs.setString('selected_company_id', companyId);
        await prefs.setString('companies', json.encode([
          CompanyModel(id: companyId, name: companyName).toJson()
        ]));
      }
    }

    if (companyId != null && companyId.isNotEmpty && companyName != null && companyName.isNotEmpty) {
      context.read<CompanyBloc>().add(SyncAuthCompany(
            companyId: companyId,
            companyName: companyName,
          ));
    }

    context.read<CompanyBloc>().add(LoadCompanies(
          seedCompanyId: companyId,
          seedCompanyName: companyName,
        ));
  }

  void _applyCompanyScope(String? companyId) {
    if (companyId == _activeCompanyId) return;
    _activeCompanyId = companyId;

    context.read<DashboardProvider>().clear();
    context.read<BranchProvider>().clear();
    context.read<StaffProvider>().clear();
    context.read<ProductProvider>().clear();
    context.read<SaleProvider>().clear();
    context.read<ReportProvider>().clear();

    context.read<DashboardProvider>().loadDashboard(companyId: companyId);
    context.read<BranchProvider>().loadBranches(companyId: companyId);
    context.read<StaffProvider>().loadEmployees(companyId: companyId);
    context.read<ProductProvider>().loadProducts(companyId: companyId);
    context.read<SaleProvider>().loadSales(companyId: companyId);
    context.read<ReportProvider>().loadReports(companyId: companyId);
    context.read<BankAccountProvider>().loadData(companyId: companyId);

    context.read<BranchBloc>().add(BranchesLoadRequested(companyId: companyId));
    context.read<ProductBloc>().add(const ProductsLoadRequested());
    context.read<CustomerBloc>().add(const CustomersLoadRequested());
    context.read<SupplierBloc>().add(const SuppliersLoadRequested());
    context.read<SaleBloc>().add(const SalesLoadRequested(limit: 200));
    context.read<WarehouseBloc>().add(WarehousesLoadRequested());
    context.read<TransferBloc>().add(const TransfersLoadRequested());
    context.read<BorrowingBloc>().add(const BorrowingsLoadRequested());
    context.read<CommissionBloc>().add(const CommissionsLoadRequested());
    context.read<NotificationBloc>().add(NotificationLoadUnreadCount());
  }

  void _clearAllScopedData() {
    _activeCompanyId = null;
    context.read<DashboardProvider>().clear();
    context.read<BranchProvider>().clear();
    context.read<StaffProvider>().clear();
    context.read<ProductProvider>().clear();
    context.read<SaleProvider>().clear();
    context.read<ReportProvider>().clear();
    context.read<BankAccountProvider>().loadData(companyId: null);
  }

  @override
  Widget build(BuildContext context) {
    final authBloc = context.read<AuthBloc>();
    final companyBloc = context.read<CompanyBloc>();
    return BlocListener<AuthBloc, AuthState>(
      bloc: authBloc,
      listener: (context, authState) {
        if (authState is AuthAuthenticated) {
          _wasAuthenticated = true;
          _loadCompaniesForUser(authState);
        } else if (authState is AuthAccountBlocked) {
          context.read<CompanyBloc>().add(const ClearCompanies());
          _clearAllScopedData();
          _wasAuthenticated = false;
          final reason = accountBlockReasonFromCode(authState.reasonCode);
          if (reason != null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              final navState = appNavigatorKey.currentState;
              if (navState == null) return;
              final currentCtx = appNavigatorKey.currentContext;
              final modalRoute = currentCtx != null ? ModalRoute.of(currentCtx) : null;
              final isAlreadyOnAuth = modalRoute?.settings.name == '/auth';

              if (!isAlreadyOnAuth) {
                navState.pushNamedAndRemoveUntil(
                  '/auth',
                  (_) => false,
                  arguments: {
                    'blockedReason': reason,
                    'blockedMessage': authState.message,
                    'phone': authState.phone,
                  },
                );
              } else if (currentCtx != null && currentCtx.mounted) {
                showAccountBlockedDialog(
                  currentCtx,
                  reason: reason,
                  message: authState.message,
                  phone: authState.phone,
                  onDismiss: () => authBloc.add(const ClearAuthError()),
                );
              }
            });
          }
        } else if (authState is AuthUnauthenticated) {
          context.read<CompanyBloc>().add(const ClearCompanies());
          _clearAllScopedData();
          if (_wasAuthenticated) {
            final nav = appNavigatorKey.currentState;
            nav?.pushNamedAndRemoveUntil('/auth', (_) => false);
          }
          _wasAuthenticated = false;
        }
      },
      child: BlocListener<CompanyBloc, CompanyState>(
        bloc: companyBloc,
        listener: (context, companyState) {
          if (companyState is CompanyLimitExceeded) {
            _showLimitExceededDialog(companyState);
            return;
          }
          if (companyState is CompanyError) {
            final nav = appNavigatorKey.currentState;
            if (nav != null) {
              showAppToast(nav.context, companyState.message, type: AppToastType.error);
            }
            return;
          }
          if (companyState is CompanyLoaded) {
            final companyId = companyState.selectedCompany?.id;
            if (companyId != null && companyId.isNotEmpty) {
              _applyCompanyScope(companyId);
            } else {
              _clearAllScopedData();
            }
          }
        },
        child: widget.child,
      ),
    );
  }

  void _showLimitExceededDialog(CompanyLimitExceeded state) {
    final navigator = appNavigatorKey.currentState;
    if (navigator == null) return;

    showDialog<void>(
      context: navigator.context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        icon: const Icon(Icons.upgrade_rounded,
            color: Color(0xFF025EA7), size: 36),
        title: Text(
          ctx.tr('company_limit_title'),
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF0F172A),
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              state.message,
              style: GoogleFonts.outfit(
                fontSize: 13,
                height: 1.4,
                color: const Color(0xFF475569),
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.payments_outlined,
                      size: 20, color: Color(0xFF025EA7)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      ctx.tr('company_limit_payment_hint'),
                      style: GoogleFonts.outfit(
                        fontSize: 12.5,
                        height: 1.4,
                        color: const Color(0xFF1E3A5F),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              ctx.tr('ok'),
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF475569),
              ),
            ),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              navigator.pushNamed('/request_more_companies');
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF025EA7),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            child: Text(
              ctx.tr('request_more_companies'),
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
