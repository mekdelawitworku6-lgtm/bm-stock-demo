import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/user_model.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/widgets/refreshable_scroll.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class MoreScreen extends StatefulWidget {
  const MoreScreen({super.key, this.embedded = false});

  /// When true the screen is hosted inside the persistent [MainShell] bottom
  /// nav, so its own back button and bottom bar are hidden.
  final bool embedded;

  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  UserModel? _currentUser() {
    final authState = context.read<AuthBloc>().state;
    return authState is AuthAuthenticated ? authState.user : null;
  }

  @override
  Widget build(BuildContext context) {
    final user = _currentUser();
    final items = <_MoreItemData>[
      _MoreItemData(
        icon: Icons.add_box_outlined,
        label: context.tr('add_product'),
        route: '/add_product',
        module: ModuleKeys.addProduct,
        requiresEdit: true,
      ),
      _MoreItemData(
        icon: Icons.arrow_downward_rounded,
        label: context.tr('stock_out'),
        route: '/stock_out',
        module: ModuleKeys.stockOut,
      ),
      _MoreItemData(
        icon: Icons.arrow_upward_rounded,
        label: context.tr('stock_in'),
        route: '/stock_in',
        module: ModuleKeys.stockIn,
      ),
      _MoreItemData(
        icon: Icons.receipt_long_outlined,
        label: context.tr('expenses'),
        route: '/purchases',
        module: ModuleKeys.stockIn,
      ),
      _MoreItemData(
        icon: Icons.qr_code_scanner_rounded,
        label: context.tr('scan_item'),
        route: '/scan_item',
        module: ModuleKeys.stockInOut,
      ),
      _MoreItemData(
        icon: Icons.group_outlined,
        label: context.tr('customer_management'),
        route: '/customers',
        module: ModuleKeys.viewSales,
      ),
      _MoreItemData(
        icon: Icons.settings_outlined,
        label: context.tr('settings'),
        route: '/settings',
        module: ModuleKeys.settings,
      ),
      _MoreItemData(
        icon: Icons.handshake_outlined,
        label: context.tr('product_borrowing'),
        route: '/borrowings',
        module: ModuleKeys.stockIn,
        visible: (u) => u?.canUseBorrowing ?? false,
      ),
      _MoreItemData(
        icon: Icons.swap_horiz_outlined,
        label: context.tr('transfer_request'),
        route: '/transfer_request',
        module: ModuleKeys.branchTransfers,
      ),
      _MoreItemData(
        icon: Icons.account_balance_outlined,
        label: context.tr('bank_management'),
        route: '/bank_accounts',
        module: ModuleKeys.bankAccounts,
      ),
      _MoreItemData(
        icon: Icons.percent_outlined,
        label: context.tr('commission_management'),
        route: '/commission',
        module: ModuleKeys.commission,
        visible: (u) => u?.canUseCommission ?? false,
      ),
      _MoreItemData(
        icon: Icons.verified_user_outlined,
        label: context.tr('verify_receipt'),
        route: '/verify_receipt',
      ),
      _MoreItemData(
        icon: Icons.workspace_premium_outlined,
        label: context.tr('upgrade_plan'),
        onTap: () {
          Navigator.pushNamed(
            context,
            '/choose_plan',
            arguments: {
              'upgrade': true,
              'phone': user?.phone,
              'numCompanies': user?.numCompanies ?? 1,
            },
          );
        },
        visible: (u) => u?.isAdmin ?? false,
      ),
      _MoreItemData(
        icon: Icons.apartment_rounded,
        label: context.tr('request_more_companies'),
        route: '/request_more_companies',
      ),
      _MoreItemData(
        icon: Icons.admin_panel_settings_outlined,
        label: context.tr('permissions_access'),
        route: '/staff-access',
        module: ModuleKeys.staffManagement,
        requiresEdit: true,
      ),
    ].where((item) {
      if (item.visible != null && !item.visible!(user)) return false;
      if (item.module == null) return true;
      if (item.requiresEdit) return user?.canEditModule(item.module!) ?? false;
      return user?.canViewModule(item.module!) ?? true;
    }).toList();

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
        title: Text(
          context.tr('more'),
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => setState(() {}),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: GridView.builder(
            physics: refreshScrollPhysics,
            itemCount: items.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 0.95,
          ),
          itemBuilder: (context, index) {
            final item = items[index];
            return _buildGridCard(context, item);
          },
        ),
        ),
      ),
      bottomNavigationBar: widget.embedded ? null : _buildBottomNav(),
    );
  }

  Widget _buildGridCard(BuildContext context, _MoreItemData item) {
    return InkWell(
      onTap: () {
        if (item.onTap != null) {
          item.onTap!();
        } else if (item.route != null) {
          Navigator.pushNamed(context, item.route!);
        }
      },
      borderRadius: BorderRadius.circular(20),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _kBorder.withValues(alpha: 0.8)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: _kBlue,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                item.icon,
                color: Colors.white,
                size: 26,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              item.label,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _kInk,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    final user = _currentUser();
    final canViewStock = user?.canViewModule(ModuleKeys.stockInOut) ?? true;
    final canViewCredit = user?.canViewModule(ModuleKeys.creditManagement) ?? true;
    final entries = <_NavEntry>[
      _NavEntry(
        icon: Icons.home_outlined,
        activeIcon: Icons.home,
        label: context.tr('home'),
        onTap: () => Navigator.pushNamedAndRemoveUntil(context, '/home', (r) => false),
      ),
      _NavEntry(
        icon: Icons.warehouse_outlined,
        activeIcon: Icons.warehouse,
        label: context.tr('store'),
        onTap: () => Navigator.pushNamed(context, '/branch'),
        visible: canViewStock,
      ),
      _NavEntry(
        icon: Icons.storefront_outlined,
        activeIcon: Icons.storefront,
        label: context.tr('shop'),
        onTap: () => Navigator.pushNamed(context, '/shop'),
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
        onTap: () => setState(() {}),
      ),
    ].where((entry) => entry.visible).toList();

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _kBorder, width: 1)),
      ),
      child: BottomNavigationBar(
        currentIndex: entries.length - 1,
        onTap: (i) => entries[i].onTap(),
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        elevation: 0,
        selectedItemColor: _kBlue,
        unselectedItemColor: _kSlate,
        selectedLabelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600),
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

class _MoreItemData {
  final IconData icon;
  final String label;
  final String? route;
  final String? module;
  final bool requiresEdit;
  final VoidCallback? onTap;
  final bool Function(UserModel?)? visible;

  const _MoreItemData({
    required this.icon,
    required this.label,
    this.route,
    this.module,
    this.requiresEdit = false,
    this.onTap,
    this.visible,
  });
}
