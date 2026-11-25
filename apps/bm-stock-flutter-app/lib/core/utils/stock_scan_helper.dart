import 'package:flutter/material.dart';
import '../../core/models/product_model.dart';
import '../../core/services/product_service.dart';
import '../../core/widgets/barcode_scan_screen.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/localization/app_localizations.dart';

Future<ProductModel?> pickProductByScan(BuildContext context) async {
  final barcode = await Navigator.push<String>(
    context,
    MaterialPageRoute(builder: (_) => const BarcodeScanScreen()),
  );
  if (barcode == null || barcode.isEmpty || !context.mounted) return null;

  try {
    final product = await ProductService().findByBarcode(barcode);
    if (product == null && context.mounted) {
      showAppToast(context, context.tr('product_not_found'), type: AppToastType.error);
    }
    return product;
  } catch (e) {
    if (context.mounted) {
      showAppToast(context, '${context.tr('error')}: $e', type: AppToastType.error);
    }
    return null;
  }
}
