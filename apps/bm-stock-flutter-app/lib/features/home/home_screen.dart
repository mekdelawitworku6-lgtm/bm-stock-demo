import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/bloc/notification/notification_bloc.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/providers/dashboard_provider.dart';
import '../../core/models/recent_activity_model.dart';
import '../../core/models/sale_model.dart';
import '../products/add_product_screen.dart';
import '../../core/permissions/app_permissions.dart';
import '../sales/sale_detail_screen.dart';
import '../stock/stock_transaction_detail_screen.dart';
import '../transfer/transfer_detail_screen.dart';
import 'widgets/company_switcher.dart';
import '../../core/widgets/refreshable_scroll.dart';
import '../../core/widgets/payment_due_dialog.dart';

const _kBlue = Color(0xFF025EA7);
const _kBlueDark = Color(0xFF024A85);
const _kSlate = Color(0xFF64748B);
const _kInk = Color(0xFF0F172A);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.embedded = false});

  /// When true the screen is hosted inside the persistent [MainShell] bottom
  /// nav, so its own bottom bar is hidden to avoid a double bar.
  final bool embedded;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _paymentDueDialogShown = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshDashboard();
      context.read<NotificationBloc>().add(NotificationLoadUnreadCount());
    });
  }

  void _refreshDashboard() {
    if (!mounted) return;
    final companyState = context.read<CompanyBloc>().state;
    final companyId =
        companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    context.read<DashboardProvider>().loadDashboard(companyId: companyId);
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final firstName =
        authState is AuthAuthenticated ? authState.user.firstName : 'User';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: _kBg,
        body: SafeArea(
          child: _buildHome(firstName),
        ),
        bottomNavigationBar: widget.embedded ? null : _buildBottomNav(),
      ),
    );
  }

  Widget _buildHome(String firstName) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;

    bool isPaymentDue = false;
    String paymentDueMessage =
        context.tr('payment_due_desc');
    if (user != null) {
      final userStatus = user.status.toUpperCase();
      final paymentStatus = user.paymentStatus?.toUpperCase();
      if (userStatus == 'EXPIRED' || paymentStatus == 'EXPIRED') {
        isPaymentDue = true;
        paymentDueMessage =
            context.tr('subscription_expired_message');
      }
      if (!isPaymentDue &&
          (userStatus == 'PAYMENT_DUE' ||
              paymentStatus == 'DUE' ||
              paymentStatus == 'PAYMENT_DUE')) {
        isPaymentDue = true;
        paymentDueMessage =
            context.tr('payment_due_desc');
      }
      if (!isPaymentDue && user.subscriptionExpiresAt != null) {
        final exp = DateTime.tryParse(user.subscriptionExpiresAt!);
        if (exp != null && exp.isBefore(DateTime.now())) {
          isPaymentDue = true;
          paymentDueMessage =
              'Your subscription expired on ${exp.toLocal().toString().split(' ')[0]}. Renew your plan to restore full access.';
        }
      }
      if (!isPaymentDue && user.subscriptionNextPaymentDate != null) {
        final nextPay = DateTime.tryParse(user.subscriptionNextPaymentDate!);
        if (nextPay != null &&
            nextPay.isBefore(DateTime.now().add(const Duration(days: 3)))) {
          isPaymentDue = true;
          paymentDueMessage =
              'Subscription payment due: ${nextPay.toLocal().toString().split(' ')[0]}. Renew your plan to prevent service interruption.';
        }
      }
    }

    if (isPaymentDue && !_paymentDueDialogShown) {
      _paymentDueDialogShown = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        showPaymentDueDialog(
          context,
          message: paymentDueMessage,
          phone: user?.phone,
        );
      });
    }

    return RefreshIndicator(
      onRefresh: () {
        final companyState = context.read<CompanyBloc>().state;
        final companyId = companyState is CompanyLoaded
            ? companyState.selectedCompany?.id
            : null;
        return Provider.of<DashboardProvider>(context, listen: false)
            .loadDashboard(companyId: companyId);
      },
      child: CustomScrollView(
        physics: refreshScrollPhysics,
        slivers: [
          SliverToBoxAdapter(child: _buildTopBar(firstName)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: BlocBuilder<CompanyBloc, CompanyState>(
                builder: (context, companyState) {
                  final companyId = companyState is CompanyLoaded
                      ? companyState.selectedCompany?.id
                      : null;
                  return Consumer<DashboardProvider>(
                    builder: (context, dash, _) {
                      return KeyedSubtree(
                        key: ValueKey(companyId ?? 'no-company'),
                        child: Column(
                          children: [
                            if (isPaymentDue) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFFBEB),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                      color: const Color(0xFFF59E0B),
                                      width: 1.2),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFDE68A),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: const Icon(Icons.payment_outlined,
                                          color: Color(0xFFB45309), size: 22),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            context.tr('payment_due'),
                                            style: GoogleFonts.outfit(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 14,
                                                color: const Color(0xFF92400E)),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            paymentDueMessage,
                                            style: GoogleFonts.outfit(
                                                fontSize: 12,
                                                color: const Color(0xFFB45309)),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    ElevatedButton(
                                      onPressed: () {
                                        Navigator.pushNamed(
                                          context,
                                          '/choose_plan',
                                          arguments: {
                                            'renewal': true,
                                            if (user?.phone != null &&
                                                user!.phone!.isNotEmpty)
                                              'phone': user.phone,
                                          },
                                        );
                                      },
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor:
                                            const Color(0xFF025EA7),
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 12, vertical: 8),
                                        shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(10)),
                                      ),
                                      child: Text(
                                        context.tr('renew_plan'),
                                        style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            _StatsCard(dash: dash),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
              child: _SectionHeader(
                title: context.tr('quick_actions'),
                actionLabel: '',
                onAction: null,
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: _QuickActionsRow(),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
              child: _SectionHeader(
                title: context.tr('recent_activity'),
                actionLabel:
                    (user?.canViewModule(ModuleKeys.salesAndInvoices) ?? true)
                        ? context.tr('view_all')
                        : '',
                onAction:
                    (user?.canViewModule(ModuleKeys.salesAndInvoices) ?? true)
                        ? () => Navigator.pushNamed(context, '/sales')
                        : null,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            sliver: BlocBuilder<CompanyBloc, CompanyState>(
              builder: (context, companyState) {
                final companyId = companyState is CompanyLoaded
                    ? companyState.selectedCompany?.id
                    : null;
                return Consumer<DashboardProvider>(
                  builder: (context, dash, _) {
                    final activities = dash.recentActivities;
                    if (activities.isEmpty) {
                      return SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 24),
                          child: Center(
                            child: Text(
                              context.tr('no_recent_activity'),
                              style: GoogleFonts.outfit(
                                  fontSize: 14, color: _kSlate),
                            ),
                          ),
                        ),
                      );
                    }
                    return SliverList(
                      key: ValueKey('activity-${companyId ?? 'none'}'),
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _RecentActivityRow(activity: activities[i]),
                        childCount: activities.length,
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar(String firstName) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: _kBlue.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.asset(
                'assets/images/logo/compact_logo.png',
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.inventory_2,
                  color: _kBlue,
                  size: 20,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            firstName,
            style: GoogleFonts.outfit(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: _kInk,
            ),
          ),
          const SizedBox(width: 10),
          const Spacer(),
          if (user?.canViewModule(ModuleKeys.settings) ?? true) ...[
            _IconBtn(
              icon: Icons.settings_outlined,
              onTap: () => Navigator.pushNamed(context, '/settings'),
            ),
            const SizedBox(width: 4),
          ],
          BlocBuilder<NotificationBloc, NotificationState>(
            buildWhen: (prev, next) => prev.unreadCount != next.unreadCount,
            builder: (context, notificationState) {
              return _IconBtn(
                icon: Icons.notifications_none_outlined,
                onTap: () => Navigator.pushNamed(context, '/notifications'),
                badgeCount: notificationState.unreadCount,
              );
            },
          ),
          if (user?.canViewModule(ModuleKeys.companies) ?? true) ...[
            const SizedBox(width: 10),
            const CompanySwitcher(),
          ],
          const SizedBox(width: 8),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canViewStock = (user?.canViewModule(ModuleKeys.stockIn) ?? false) ||
        (user?.canViewModule(ModuleKeys.stockOut) ?? false) ||
        (user?.canViewModule(ModuleKeys.stockInOut) ?? true);
    final canViewCredit =
        (user?.canViewModule(ModuleKeys.viewCredit) ?? false) ||
            (user?.canViewModule(ModuleKeys.creditManagement) ?? true);
    final canViewShop = user?.canViewModule(ModuleKeys.shopStore) ?? true;
    final canViewWarehouse =
        user?.canViewModule(ModuleKeys.warehouse) ?? canViewStock;
    final entries = <_NavEntry>[
      _NavEntry(
        icon: Icons.home_outlined,
        activeIcon: Icons.home,
        label: context.tr('home'),
        onTap: () => setState(() {}),
      ),
      _NavEntry(
        icon: Icons.warehouse_outlined,
        activeIcon: Icons.warehouse,
        label: context.tr('store'),
        onTap: () => Navigator.pushNamed(context, '/warehouses'),
        visible: canViewWarehouse,
      ),
      _NavEntry(
        icon: Icons.storefront_outlined,
        activeIcon: Icons.storefront,
        label: context.tr('shop'),
        onTap: () => Navigator.pushNamed(context, '/shop_list'),
        visible: canViewShop,
      ),
      _NavEntry(
        icon: Icons.credit_card_outlined,
        activeIcon: Icons.credit_card,
        label: context.tr('credit'),
        onTap: () => Navigator.pushNamed(context, '/outstanding_credit'),
        visible: canViewCredit,
      ),
      _NavEntry(
        icon: Icons.more_horiz_rounded,
        activeIcon: Icons.more_horiz_rounded,
        label: context.tr('more'),
        onTap: () => Navigator.pushNamed(context, '/more'),
      ),
    ].where((entry) => entry.visible).toList();
    final homeIndex =
        entries.indexWhere((entry) => entry.label == context.tr('home'));

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _kBorder, width: 1)),
      ),
      child: BottomNavigationBar(
        currentIndex: homeIndex,
        onTap: (i) => entries[i].onTap(),
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        elevation: 0,
        selectedItemColor: _kBlue,
        unselectedItemColor: _kSlate,
        selectedLabelStyle:
            GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.outfit(fontSize: 11),
        items: entries
            .map((entry) => BottomNavigationBarItem(
                  icon: Icon(entry.icon),
                  activeIcon: Icon(entry.activeIcon),
                  label: entry.label,
                ))
            .toList(),
      ),
    );
  }
}

class _NavEntry {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final VoidCallback onTap;
  final bool visible;

  const _NavEntry({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.onTap,
    this.visible = true,
  });
}

class _StatsCard extends StatelessWidget {
  final DashboardProvider dash;
  const _StatsCard({required this.dash});

  @override
  Widget build(BuildContext context) {
    if (dash.isLoading) {
      return Container(
        height: 140,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _kBlue, width: 1.5),
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canViewProducts =
        (user?.canViewModule(ModuleKeys.viewProducts) ?? false) ||
            (user?.canViewModule(ModuleKeys.products) ?? true);
    final stats = dash.stats;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBlue, width: 1.5),
      ),
      child: Column(
        children: [
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => Navigator.pushNamed(context, '/sales'),
                    child: _StatCell(
                      label: context.tr('total_sales'),
                      value: stats != null
                          ? 'ETB ${stats.totalSales.toStringAsFixed(0)}'
                          : '--',
                      sub: stats != null
                          ? '${stats.totalInvoices} ${context.tr('invoices')}'
                          : '',
                      valueBold: true,
                      isTappable: true,
                    ),
                  ),
                ),
                const _Divider(horizontal: false),
                Expanded(
                  child: GestureDetector(
                    onTap: () =>
                        Navigator.pushNamed(context, '/outstanding_credit'),
                    child: _StatCell(
                      label: context.tr('outstanding_credit'),
                      value: stats != null && stats.totalOutstandingCredit > 0
                          ? 'ETB ${stats.totalOutstandingCredit.toStringAsFixed(0)}'
                          : (stats != null ? 'ETB 0' : '--'),
                      sub: stats != null
                          ? '${stats.creditCustomersWithBalance > 0 ? stats.creditCustomersWithBalance : stats.creditCustomers} ${context.tr('customers')}'
                          : '',
                      valueBold: true,
                      valueColor:
                          stats != null && stats.totalOutstandingCredit > 0
                              ? const Color(0xFFDC2626)
                              : _kInk,
                      isTappable: true,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const _Divider(horizontal: true),
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: canViewProducts &&
                            stats != null &&
                            stats.lowStockCount > 0
                        ? () => Navigator.pushNamed(context, '/products',
                            arguments: {'filter': 'low_stock'})
                        : null,
                    child: _StatCell(
                      label: context.tr('stock_reminder'),
                      value: stats != null
                          ? (stats.lowStockCount > 0
                              ? '${stats.lowStockCount} ${context.tr('low')}'
                              : context.tr('good'))
                          : '--',
                      sub: '',
                      valueColor: stats != null && stats.lowStockCount > 0
                          ? const Color(0xFFD97706)
                          : const Color(0xFF16A34A),
                      valueBold: true,
                      isTappable: canViewProducts &&
                          stats != null &&
                          stats.lowStockCount > 0,
                    ),
                  ),
                ),
                const _Divider(horizontal: false),
                Expanded(
                  child: GestureDetector(
                    onTap: canViewProducts
                        ? () => Navigator.pushNamed(context, '/products',
                            arguments: {'filter': 'expired'})
                        : null,
                    child: _StatCell(
                      label: context.tr('to_be_expired'),
                      value:
                          stats != null ? stats.expiredCount.toString() : '--',
                      sub: '',
                      valueBold: true,
                      valueColor: stats != null && stats.expiredCount > 0
                          ? const Color(0xFFDC2626)
                          : _kInk,
                      isTappable: canViewProducts,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final Color valueColor;
  final bool valueBold;
  final bool isTappable;

  const _StatCell({
    required this.label,
    required this.value,
    required this.sub,
    this.valueColor = _kInk,
    this.valueBold = false,
    this.isTappable = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
          const SizedBox(height: 4),
          Row(
            children: [
              Text(
                value,
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: valueBold ? FontWeight.w700 : FontWeight.w400,
                  color: valueColor,
                ),
              ),
              if (isTappable) ...[
                const SizedBox(width: 4),
                Icon(Icons.arrow_forward_ios, size: 10, color: valueColor),
              ],
            ],
          ),
          if (sub.isNotEmpty)
            Text(sub, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  final bool horizontal;
  const _Divider({required this.horizontal});

  @override
  Widget build(BuildContext context) {
    if (horizontal) return Container(height: 1, color: _kBorder);
    return Container(width: 1, color: _kBorder);
  }
}

class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow();

  void _refresh(BuildContext context) {
    final companyState = context.read<CompanyBloc>().state;
    final companyId =
        companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    context.read<DashboardProvider>().loadDashboard(companyId: companyId);
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final actions = <_QuickActionBtn>[
      _QuickActionBtn(
        icon: Icons.receipt_long_outlined,
        label: context.tr('new_sale'),
        onTap: () async {
          await Navigator.pushNamed(context, '/new_sale');
          if (context.mounted) _refresh(context);
        },
        visible: (user?.canEditModule(ModuleKeys.createSale) ?? false) ||
            (user?.canEditModule(ModuleKeys.salesAndInvoices) ?? true),
      ),
      _QuickActionBtn(
        icon: Icons.people_outline,
        label: context.tr('staff'),
        onTap: () => Navigator.pushNamed(context, '/staff'),
        visible: user?.canViewModule(ModuleKeys.staffManagement) ?? true,
      ),
      _QuickActionBtn(
        icon: Icons.apartment_outlined,
        label: context.tr('branch'),
        onTap: () => Navigator.pushNamed(context, '/branch'),
        visible: (user?.canViewModule(ModuleKeys.branch) ?? false) ||
            (user?.canViewModule(ModuleKeys.branchTransfers) ?? true),
      ),
      _QuickActionBtn(
        icon: Icons.bar_chart_outlined,
        label: context.tr('reports'),
        onTap: () => Navigator.pushNamed(context, '/reports'),
        visible: user?.canViewModule(ModuleKeys.reports) ?? true,
      ),
    ].where((action) => action.visible).toList();

    if (actions.isEmpty) return const SizedBox.shrink();

    if (actions.length > 4) {
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        child: Row(
          children: actions.asMap().entries.map((entry) {
            final isLast = entry.key == actions.length - 1;
            return Padding(
              padding: EdgeInsets.only(right: isLast ? 0 : 16),
              child: entry.value,
            );
          }).toList(),
        ),
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: actions,
    );
  }
}

class _QuickActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool visible;

  const _QuickActionBtn({
    required this.icon,
    required this.label,
    required this.onTap,
    this.visible = true,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: _kBlueDark,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: Colors.white, size: 26),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              color: _kInk,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _RecentActivityRow extends StatelessWidget {
  final RecentActivityItem activity;
  const _RecentActivityRow({required this.activity});

  String _title(BuildContext context) {
    switch (activity.type) {
      case RecentActivityType.sale:
        return context.tr('sale_completed_label');
      case RecentActivityType.stockIn:
        return context.tr('stock_in');
      case RecentActivityType.stockOut:
        return context.tr('stock_out');
      case RecentActivityType.productAdded:
        return context.tr('product_added');
      case RecentActivityType.transfer:
        return context.tr('transfer');
    }
  }

  IconData _icon() {
    switch (activity.type) {
      case RecentActivityType.sale:
        return Icons.receipt_outlined;
      case RecentActivityType.stockIn:
        return Icons.add_box_outlined;
      case RecentActivityType.stockOut:
        return Icons.indeterminate_check_box_outlined;
      case RecentActivityType.productAdded:
        return Icons.inventory_2_outlined;
      case RecentActivityType.transfer:
        return Icons.swap_horiz_rounded;
    }
  }

  Color _iconColor() {
    switch (activity.type) {
      case RecentActivityType.sale:
        return _kBlue;
      case RecentActivityType.stockIn:
        return const Color(0xFF16A34A);
      case RecentActivityType.stockOut:
        return const Color(0xFFDC2626);
      case RecentActivityType.productAdded:
        return const Color(0xFF7C3AED);
      case RecentActivityType.transfer:
        return const Color(0xFF0EA5E9);
    }
  }

  String? _badgeLabel(BuildContext context) {
    if (activity.type == RecentActivityType.sale && activity.sale != null) {
      final sale = activity.sale!;
      if (!sale.hasOutstanding) return context.tr('paid');
      switch (sale.creditStatusKey()) {
        case 'partially_paid':
          return context.tr('partially_paid');
        case 'paid':
          return context.tr('paid');
        default:
          return context.tr('credit');
      }
    }
    if (activity.quantity != null) {
      return '${activity.quantity}';
    }
    return null;
  }

  Color? _badgeColor() {
    if (activity.type != RecentActivityType.sale || activity.sale == null) {
      return _kSlate;
    }
    final sale = activity.sale!;
    if (!sale.hasOutstanding) return const Color(0xFF16A34A);
    final statusKey = sale.creditStatusKey();
    if (statusKey == 'paid') return const Color(0xFF16A34A);
    if (statusKey == 'partially_paid') return const Color(0xFFD97706);
    return const Color(0xFFDC2626);
  }

  Future<void> _onTap(BuildContext context) async {
    switch (activity.type) {
      case RecentActivityType.sale:
        if (activity.sale != null) {
          await Navigator.push(
            context,
            MaterialPageRoute(
                builder: (_) => SaleDetailScreen(sale: activity.sale!)),
          );
          if (context.mounted) {
            final companyState = context.read<CompanyBloc>().state;
            final companyId = companyState is CompanyLoaded
                ? companyState.selectedCompany?.id
                : null;
            context
                .read<DashboardProvider>()
                .loadDashboard(companyId: companyId);
          }
        }
        break;
      case RecentActivityType.productAdded:
        if (activity.product != null) {
          await Navigator.push(
            context,
            MaterialPageRoute(
                builder: (_) => AddProductScreen(product: activity.product)),
          );
        }
        break;
      case RecentActivityType.stockIn:
      case RecentActivityType.stockOut:
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => StockTransactionDetailScreen(activity: activity),
          ),
        );
        break;
      case RecentActivityType.transfer:
        if (activity.transactionId != null &&
            activity.transactionId!.isNotEmpty) {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) =>
                  TransferDetailScreen(transferId: activity.transactionId!),
            ),
          );
        }
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final badgeLabel = _badgeLabel(context);
    final badgeColor = _badgeColor() ?? _kSlate;
    final iconColor = _iconColor();

    return GestureDetector(
      onTap: () => _onTap(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_icon(), size: 18, color: iconColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _title(context),
                        style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: _kInk),
                      ),
                      if (activity.productName.isNotEmpty)
                        Text(activity.productName,
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: _kSlate)),
                    ],
                  ),
                ),
                if (badgeLabel != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: badgeColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: badgeColor.withValues(alpha: 0.3), width: 0.8),
                    ),
                    child: Text(
                      badgeLabel,
                      style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: badgeColor),
                    ),
                  ),
                if (activity.type == RecentActivityType.sale ||
                    activity.type == RecentActivityType.productAdded ||
                    activity.type == RecentActivityType.stockIn ||
                    activity.type == RecentActivityType.stockOut ||
                    activity.type == RecentActivityType.transfer) ...[
                  const SizedBox(width: 4),
                  Icon(Icons.chevron_right,
                      size: 18, color: _kSlate.withValues(alpha: 0.6)),
                ],
              ],
            ),
            const SizedBox(height: 10),
            if (activity.type == RecentActivityType.sale &&
                activity.sale != null) ...[
              _activityDetail(context.tr('customer'),
                  _formatCustomerName(context, activity.sale!.customerName)),
              _activityDetail(context.tr('amount'),
                  'ETB ${activity.sale!.totalAmount.toStringAsFixed(2)}'),
              _activityDetail(context.tr('salesperson'),
                  activity.sale!.salespersonName ?? '--'),
              _activityDetail(context.tr('store'), _storeLabel(activity.sale!)),
            ] else ...[
              if (activity.quantity != null)
                _activityDetail(context.tr('quantity'), '${activity.quantity}'),
              if (activity.locationName != null &&
                  activity.locationName!.isNotEmpty)
                _activityDetail(
                  activity.type == RecentActivityType.transfer
                      ? '${context.tr('from_warehouse')} → ${context.tr('shop')}'
                      : context.tr('store'),
                  activity.locationName!,
                ),
              if (activity.performedByName != null &&
                  activity.performedByName!.isNotEmpty)
                _activityDetail(
                    context.tr('salesperson'), activity.performedByName!),
              if (activity.reason != null && activity.reason!.isNotEmpty)
                _activityDetail(context.tr('reason'), activity.reason!),
            ],
          ],
        ),
      ),
    );
  }

  String _formatCustomerName(BuildContext context, String customerName) {
    final name = customerName.trim();
    if (name.isEmpty ||
        name.toLowerCase() == 'walk-in' ||
        name.toLowerCase() == 'walk-in customer' ||
        name.toLowerCase() == 'walk in' ||
        name.toLowerCase() == 'walk in customer' ||
        name.toLowerCase() == 'default walk-in sale') {
      return context.tr('walk_in');
    }
    return name;
  }

  String _storeLabel(SaleModel sale) {
    if (sale.shopName != null && sale.shopName!.isNotEmpty) {
      return sale.shopName!;
    }
    if (sale.warehouseName.isNotEmpty) return sale.warehouseName;
    return '--';
  }

  Widget _activityDetail(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        children: [
          SizedBox(
              width: 90,
              child: Text(label,
                  style: GoogleFonts.outfit(fontSize: 11, color: _kSlate))),
          Expanded(
              child: Text(value,
                  style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: _kInk))),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String actionLabel;
  final VoidCallback? onAction;

  const _SectionHeader({
    required this.title,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
        if (actionLabel.isNotEmpty && onAction != null)
          GestureDetector(
            onTap: onAction,
            child: Text(
              actionLabel,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _kBlue,
              ),
            ),
          ),
      ],
    );
  }
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final int badgeCount;

  const _IconBtn({
    required this.icon,
    required this.onTap,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final showBadge = badgeCount > 0;
    final badgeLabel = badgeCount > 99 ? '99+' : '$badgeCount';

    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: _kBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _kBorder),
            ),
            child: Icon(icon, size: 20, color: _kSlate),
          ),
          if (showBadge)
            Positioned(
              top: -4,
              right: -4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFDC2626),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Text(
                  badgeLabel,
                  style: GoogleFonts.outfit(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    height: 1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
