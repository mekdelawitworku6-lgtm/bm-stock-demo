import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../products/product_detail_screen.dart';
import '../../core/localization/app_localizations.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kRed = Color(0xFFDC2626);

class ScanItemScreen extends StatefulWidget {
  const ScanItemScreen({super.key});

  @override
  State<ScanItemScreen> createState() => _ScanItemScreenState();
}

class _ScanItemScreenState extends State<ScanItemScreen> {
  final _barcodeController = TextEditingController();
  bool _isLookingUp = false;
  bool _hasSearched = false;
  bool _isCameraMode = false;
  MobileScannerController? _cameraController;
  bool _isProcessingScan = false;

  @override
  void dispose() {
    _barcodeController.dispose();
    _cameraController?.dispose();
    super.dispose();
  }

  void _startCamera() {
    _cameraController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );
    setState(() => _isCameraMode = true);
  }

  void _stopCamera() {
    _cameraController?.dispose();
    _cameraController = null;
    setState(() => _isCameraMode = false);
  }

  void _onBarcodeDetected(BarcodeCapture capture) {
    if (_isProcessingScan) return;
    final barcode = capture.barcodes.first.rawValue;
    if (barcode == null || barcode.isEmpty) return;

    _isProcessingScan = true;
    _barcodeController.text = barcode;
    _stopCamera();
    _lookupBarcode();
  }

  Future<void> _lookupBarcode() async {
    final barcode = _barcodeController.text.trim();
    if (barcode.isEmpty) return;

    setState(() {
      _isLookingUp = true;
      _hasSearched = true;
    });

    context.read<ProductBloc>().add(ProductFindByBarcode(barcode: barcode));
    await context.read<ProductBloc>().stream.firstWhere((s) => !s.isLoading);
    setState(() {
      _isLookingUp = false;
      _isProcessingScan = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () {
            if (_isCameraMode) {
              _stopCamera();
            } else {
              Navigator.pop(context);
            }
          },
        ),
        title: Text(_isCameraMode ? 'Scan Barcode' : 'Scan Item',
            style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          if (!_isCameraMode)
            IconButton(
              icon: const Icon(Icons.camera_alt_outlined, color: _kBlue, size: 24),
              onPressed: _startCamera,
              tooltip: context.tr('open_camera_scanner'),
            ),
        ],
      ),
      body: _isCameraMode ? _buildCameraView() : _buildManualView(),
    );
  }

  Widget _buildCameraView() {
    return Column(
      children: [
        Expanded(
          flex: 4,
          child: Stack(
            alignment: Alignment.center,
            children: [
              MobileScanner(
                controller: _cameraController!,
                onDetect: _onBarcodeDetected,
              ),
              // Scanning overlay
              Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  border: Border.all(color: _kBlue, width: 3),
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              Positioned(
                bottom: 20,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Align barcode within the frame',
                    style: GoogleFonts.outfit(fontSize: 13, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          flex: 1,
          child: Container(
            color: Colors.white,
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(context.tr('point_camera_barcode'),
                    style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _stopCamera,
                      icon: const Icon(Icons.keyboard_outlined, size: 18),
                      label: Text(context.tr('type_instead'), style: GoogleFonts.outfit(fontSize: 13)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _kSlate,
                        side: const BorderSide(color: _kBorder),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildManualView() {
    final productState = context.watch<ProductBloc>().state;
    final foundProduct = productState.foundProduct;
    final error = productState.error;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Search input
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _kBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(context.tr('enter_barcode'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kSlate)),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: _startCamera,
                      icon: const Icon(Icons.camera_alt_outlined, size: 18),
                      label: Text(context.tr('scan_button'), style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600)),
                      style: TextButton.styleFrom(
                        foregroundColor: _kBlue,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _barcodeController,
                        style: GoogleFonts.outfit(fontSize: 15),
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          hintText: context.tr('type_barcode_number'),
                          hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8)),
                          prefixIcon: const Icon(Icons.qr_code_2_outlined, color: _kSlate, size: 22),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: _kBorder),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: _kBorder),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: _kBlue, width: 1.5),
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        ),
                        onSubmitted: (_) => _lookupBarcode(),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      height: 48, width: 48,
                      decoration: BoxDecoration(
                        color: _kBlue,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: IconButton(
                        icon: const Icon(Icons.search, color: Colors.white, size: 22),
                        onPressed: _isLookingUp ? null : _lookupBarcode,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Loading
          if (_isLookingUp)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _kBorder),
              ),
              child: Column(
                children: [
                  const CircularProgressIndicator(strokeWidth: 2.5),
                  const SizedBox(height: 12),
                  Text(context.tr('looking_up_product'), style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
                ],
              ),
            ),

          // Error
          if (!_isLookingUp && error != null && foundProduct == null)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _kRed.withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  Icon(Icons.search_off_rounded, size: 48, color: _kRed.withValues(alpha: 0.5)),
                  const SizedBox(height: 10),
                  Text(error!, style: GoogleFonts.outfit(fontSize: 14, color: _kRed), textAlign: TextAlign.center),
                ],
              ),
            ),

          // Product found
          if (foundProduct != null) ...[
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _kBlue),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: _kBlue.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.inventory_2_outlined, color: _kBlue, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(foundProduct!.name, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                            Text('SKU: ${foundProduct!.sku}', style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _InfoChip(label: context.tr('price'), value: 'ETB ${foundProduct!.price.toStringAsFixed(2)}'),
                      const SizedBox(width: 8),
                      _InfoChip(label: context.tr('stock'), value: '${foundProduct!.stockQuantity}'),
                      const SizedBox(width: 8),
                      _InfoChip(label: context.tr('min'), value: '${foundProduct!.minStockLevel}'),
                    ],
                  ),
                  if (foundProduct!.isLowStock) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFD97706).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFD97706)),
                          const SizedBox(width: 4),
                          Text(context.tr('low_stock'), style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFFD97706))),
                        ],
                      ),
                    ),
                  ],
                  if (foundProduct!.isExpired) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _kRed.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.event_busy, size: 14, color: _kRed),
                          const SizedBox(width: 4),
                          Text(context.tr('expired'), style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kRed)),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => ProductDetailScreen(product: foundProduct!)),
                          ),
                          icon: const Icon(Icons.info_outline, size: 18),
                          label: Text(context.tr('view_details'), style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _kBlue,
                            side: const BorderSide(color: _kBlue),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            Navigator.pushNamed(context, '/new_sale', arguments: foundProduct);
                          },
                          icon: const Icon(Icons.shopping_cart_outlined, size: 18),
                          label: Text(context.tr('add_to_sale'), style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _kBlue,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],

          // Initial state hint
          if (!_isLookingUp && !_hasSearched && foundProduct == null)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _kBorder),
              ),
              child: Column(
                children: [
                  Icon(Icons.qr_code_scanner_outlined, size: 56, color: _kSlate.withValues(alpha: 0.4)),
                  const SizedBox(height: 12),
                  Text(context.tr('scan_or_enter_barcode'), style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
                  const SizedBox(height: 4),
                  Text(context.tr('scan_hint_detail'),
                      style: GoogleFonts.outfit(fontSize: 13, color: _kSlate.withValues(alpha: 0.7)),
                      textAlign: TextAlign.center),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final String label;
  final String value;
  const _InfoChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
            const SizedBox(height: 2),
            Text(value, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
          ],
        ),
      ),
    );
  }
}
