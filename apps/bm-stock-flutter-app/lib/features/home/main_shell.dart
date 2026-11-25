import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/bloc/notification/notification_bloc.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/permissions/app_permissions.dart';
import '../credit/outstanding_credit_screen.dart';
import '../more/more_screen.dart';
import '../../core/utils/branch_access_helper.dart';
import '../shop/shop_list_screen.dart';
import '../warehouse/warehouse_list_screen.dart';
import 'home_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);

enum MainTab { home, store, shop, credit, more }

class MainShell extends StatefulWidget {
  const MainShell({super.key, this.initialTab = MainTab.home});

  static const String routeName = '/home';
  static final ValueNotifier<MainTab> _targetTab = ValueNotifier<MainTab>(MainTab.home);

  /// Switch to a main tab from a pushed sub-screen (e.g. Settings).
  /// Pops back to the shell first, then switches the tab in place.
  static void goTo(BuildContext context, MainTab tab) {
    Navigator.of(context).popUntil(
      (route) => route.settings.name == MainShell.routeName,
    );
    _targetTab.value = tab;
  }

  final MainTab initialTab;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  late MainTab _currentTab = widget.initialTab;

  @override
  void initState() {
    super.initState();
    MainShell._targetTab.value = widget.initialTab;
    MainShell._targetTab.addListener(_onTabChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<NotificationBloc>().add(NotificationLoadUnreadCount());
    });
  }

  void _onTabChanged() {
    if (!mounted) return;
    setState(() => _currentTab = MainShell._targetTab.value);
  }

  @override
  void dispose() {
    MainShell._targetTab.removeListener(_onTabChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canViewWarehouse = BranchAccessHelper.canAccessWarehouseTab(user);
    final canViewShop = BranchAccessHelper.canAccessShopTab(user);
    final canViewCredit = user?.canViewModule(ModuleKeys.viewCredit) ??
        user?.canViewModule(ModuleKeys.creditManagement) ??
        true;

    final tabs = <_ShellTab>[
      _ShellTab(MainTab.home, Icons.home_outlined, Icons.home, context.tr('home')),
      if (canViewWarehouse)
        _ShellTab(MainTab.store, Icons.warehouse_outlined, Icons.warehouse, context.tr('store')),
      if (canViewShop)
        _ShellTab(MainTab.shop, Icons.storefront_outlined, Icons.storefront, context.tr('shop')),
      if (canViewCredit)
        _ShellTab(MainTab.credit, Icons.credit_card_outlined, Icons.credit_card, context.tr('credit')),
      _ShellTab(MainTab.more, Icons.more_horiz_rounded, Icons.more_horiz_rounded, context.tr('more')),
    ];

    final pages = <Widget>[
      const HomeScreen(embedded: true),
      if (canViewWarehouse) const WarehouseListScreen(embedded: true),
      if (canViewShop) const ShopListScreen(embedded: true),
      if (canViewCredit) const OutstandingCreditScreen(embedded: true),
      const MoreScreen(embedded: true),
    ];

    int currentIndex = tabs.indexWhere((t) => t.tab == _currentTab);
    if (currentIndex < 0) currentIndex = 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: IndexedStack(
        index: currentIndex,
        children: pages,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: _kBorder, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: (i) => setState(() => _currentTab = tabs[i].tab),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          elevation: 0,
          selectedItemColor: _kBlue,
          unselectedItemColor: _kSlate,
          selectedLabelStyle: GoogleFonts.outfit(
              fontSize: 11, fontWeight: FontWeight.w600),
          unselectedLabelStyle: GoogleFonts.outfit(fontSize: 11),
          items: tabs
              .map((t) => BottomNavigationBarItem(
                    icon: Icon(t.icon),
                    activeIcon: Icon(t.activeIcon),
                    label: t.label,
                  ))
              .toList(),
        ),
      ),
    );
  }
}

class _ShellTab {
  final MainTab tab;
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const _ShellTab(this.tab, this.icon, this.activeIcon, this.label);
}
