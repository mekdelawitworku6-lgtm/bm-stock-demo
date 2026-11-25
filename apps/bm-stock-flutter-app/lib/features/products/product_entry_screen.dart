import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/localization/app_localizations.dart';
import 'add_product_screen.dart';
import 'bulk_products_screen.dart';
import 'import_products_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class ProductEntryScreen extends StatefulWidget {
  final String? warehouseId;
  final String? shopId;
  final String? shopName;
  const ProductEntryScreen({super.key, this.warehouseId, this.shopId, this.shopName});

  @override
  State<ProductEntryScreen> createState() => _ProductEntryScreenState();
}

class _ProductEntryScreenState extends State<ProductEntryScreen> {
  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthBloc>().user;
    final canBulk = user?.canBulkAddProducts ?? false;
    final canImport = user?.canImportProducts ?? false;

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
        title: Text(context.tr('add_product'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            context.tr('product_entry_subtitle'),
            style: GoogleFonts.outfit(fontSize: 14, color: _kSlate),
          ),
          const SizedBox(height: 20),
          _EntryCard(
            icon: Icons.edit_note_outlined,
            color: _kBlue,
            title: context.tr('entry_single'),
            subtitle: context.tr('entry_single_desc'),
            actionLabel: context.tr('continue'),
            onTap: () => _open(() => AddProductScreen(
                  warehouseId: widget.warehouseId,
                  shopId: widget.shopId,
                  shopName: widget.shopName,
                )),
          ),
          if (canBulk) ...[
            const SizedBox(height: 14),
            _EntryCard(
              icon: Icons.table_rows_outlined,
              color: const Color(0xFF7C3AED),
              title: context.tr('entry_bulk'),
              subtitle: context.tr('entry_bulk_desc'),
              actionLabel: context.tr('continue'),
              onTap: () => _open(() => BulkProductsScreen(
                warehouseId: widget.warehouseId,
                initialLocationId: widget.shopId ?? widget.warehouseId,
                initialIsWarehouse: widget.shopId == null,
              )),
            ),
          ],
          const SizedBox(height: 14),
          _EntryCard(
            icon: Icons.upload_file_outlined,
            color: const Color(0xFF16A34A),
            title: context.tr('entry_import'),
            subtitle: canImport
                ? context.tr('entry_import_desc')
                : 'Importing products from PDF & CSV is exclusively available on the Large Business plan.',
            actionLabel: canImport ? context.tr('continue') : context.tr('upgrade_plan'),
            onTap: () {
              if (canImport) {
                _open(() => const ImportProductsScreen());
              } else {
                Navigator.pushNamed(context, '/choose_plan', arguments: {'upgrade': true});
              }
            },
          ),
        ],
      ),
    );
  }

  Future<void> _open(Widget Function() builder) async {
    final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => builder()));
    if (result == true && mounted) Navigator.pop(context, true);
  }
}

class _EntryCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onTap;
  const _EntryCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Icon(Icons.arrow_forward_ios, color: color, size: 18),
          ],
        ),
      ),
    );
  }
}
