import 'package:flutter/foundation.dart' show Uint8List;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/api/api_client.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';

/// Result of a manual (Telebirr / CBE) payment submission.
class ManualPaymentResult {
  final bool success;
  final bool receiptVerified;
  final String? paymentMethod;
  final String? paymentRef;
  final String? screenshotUrl;
  final String? receiptUrl;
  final String? error;

  const ManualPaymentResult({
    required this.success,
    this.receiptVerified = false,
    this.paymentMethod,
    this.paymentRef,
    this.screenshotUrl,
    this.receiptUrl,
    this.error,
  });
}

/// Static config for the account details shown in the popup.
class ManualPaymentConfig {
  ManualPaymentConfig._();

  // ── Telebirr ─────────────────────────────────────────────
  static const String telebirrAccountName = 'Possible Tech PLC';
  static const String telebirrAccountPhone = '0911578793';

  // ── CBE ──────────────────────────────────────────────────
  static const String cbeAccountName = 'Possible Tech PLC';
  static const String cbeAccountNumber = '1000301736537';
}

class ManualPaymentPopup extends StatefulWidget {
  final String planTitle;
  final String planPrice;
  final int amount;

  const ManualPaymentPopup({
    super.key,
    required this.planTitle,
    required this.planPrice,
    required this.amount,
  });

  static Future<ManualPaymentResult?> show(
    BuildContext context, {
    required String planTitle,
    required String planPrice,
    required int amount,
  }) {
    return showModalBottomSheet<ManualPaymentResult>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      builder: (_) => ManualPaymentPopup(
        planTitle: planTitle,
        planPrice: planPrice,
        amount: amount,
      ),
    );
  }

  @override
  State<ManualPaymentPopup> createState() => _ManualPaymentPopupState();
}

class _ManualPaymentPopupState extends State<ManualPaymentPopup> {
  final TextEditingController _receiptUrlController = TextEditingController();
  String? _selectedMethod;
  XFile? _screenshot;
  Uint8List? _screenshotBytes;
  String _screenshotName = '';
  bool _isUploading = false;

  static const Color _kSlate = Color(0xFF64748B);
  static const Color _kBlue = Color(0xFF1D5C96);
  static const Color _kBorder = Color(0xFFE2E8F0);

  @override
  void dispose() {
    _receiptUrlController.dispose();
    super.dispose();
  }

  Future<void> _pickScreenshot() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      imageQuality: 80,
    );
    if (file != null && mounted) {
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _screenshot = file;
        _screenshotBytes = bytes;
        _screenshotName = file.name;
      });
    }
  }

  Future<void> _submit() async {
    final method = _selectedMethod;
    final receiptUrl = _receiptUrlController.text.trim();
    if (method == null || (_screenshot == null && receiptUrl.isEmpty)) {
      showAppToast(
        context,
        context.tr('select_payment_method_error'),
        type: AppToastType.error,
      );
      return;
    }

    setState(() => _isUploading = true);

    try {
      bool isVerified = false;
      if (receiptUrl.isNotEmpty) {
        try {
          final bankId = method.toLowerCase().contains('tele') ? 'telebirr' : 'cbe';
          final verifyRes = await ApiClient().post(
            '/receipts/verify',
            body: {
              'bank': bankId,
              'link': receiptUrl,
              'reference': receiptUrl,
              'receiptUrl': receiptUrl,
            },
            auth: false,
          );
          if (verifyRes is Map) {
            if (verifyRes['alreadyUsed'] == true || verifyRes['status'] == 'already_used') {
              _showError(
                verifyRes['message']?.toString() ??
                    'This receipt has already been used and cannot be reused.',
              );
              return;
            }
            if (verifyRes['valid'] == true || verifyRes['status'] == 'valid') {
              isVerified = true;
            }
          }
        } catch (e) {
          final msg = e.toString();
          if (msg.toLowerCase().contains('already been used') || msg.toLowerCase().contains('already used')) {
            _showError('This receipt has already been used and cannot be reused.');
            return;
          }
        }
      }

      String? screenshotUrl;
      if (_screenshot != null) {
        final bytes = _screenshotBytes ?? await _screenshot!.readAsBytes();
        final filename = _screenshotName.isNotEmpty
            ? _screenshotName
            : 'payment-proof.jpg';
        final result = await ApiClient().uploadFile(
          '/auth/upload-payment-proof',
          bytes,
          filename,
          auth: false,
        );

        if (result is Map && result['url'] is String) {
          screenshotUrl = result['url'] as String;
        } else {
          _showError('Upload failed. Please try again.');
          return;
        }
      }

      final refNo = 'GS${DateTime.now().millisecondsSinceEpoch}';
      if (mounted) {
        Navigator.pop(
          context,
          ManualPaymentResult(
            success: true,
            receiptVerified: isVerified,
            paymentMethod: method,
            paymentRef: refNo,
            screenshotUrl: screenshotUrl,
            receiptUrl: receiptUrl.isNotEmpty ? receiptUrl : null,
          ),
        );
      }
    } catch (e) {
      _showError('Submission failed: $e');
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    showAppToast(
      context,
      message,
      type: AppToastType.error,
    );
  }

  Widget _accountCard({
    required String title,
    required String accountName,
    required String detailLabel,
    required String detailValue,
    required IconData icon,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFF0F9FF) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? _kBlue : _kBorder,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: _kBlue, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Name: $accountName',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      color: _kSlate,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          '$detailLabel: $detailValue',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _kSlate,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      InkWell(
                        onTap: () async {
                          await Clipboard.setData(
                            ClipboardData(text: detailValue),
                          );
                          if (!mounted) return;
                          showAppToast(
                            context,
                            '$detailValue copied to clipboard',
                            type: AppToastType.success,
                          );
                        },
                        borderRadius: BorderRadius.circular(6),
                        child: const Padding(
                          padding: EdgeInsets.all(2),
                          child: Icon(
                            Icons.copy_rounded,
                            size: 16,
                            color: _kBlue,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? _kBlue : _kBorder,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Title
            Text(
              context.tr('make_your_payment'),
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF0F2A47),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              context.tr('pay_via_telebirr_cbe'),
              style: GoogleFonts.outfit(
                fontSize: 13,
                color: _kSlate,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),

            // Plan amount
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _kBorder),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.planTitle,
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF0F2A47),
                    ),
                  ),
                  Text(
                    'ETB ${widget.planPrice}',
                    style: GoogleFonts.outfit(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: _kBlue,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Account options
            Text(
              context.tr('select_payment_method'),
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 10),
            _accountCard(
              title: 'Telebirr',
              accountName: ManualPaymentConfig.telebirrAccountName,
              detailLabel: 'Phone',
              detailValue: ManualPaymentConfig.telebirrAccountPhone,
              icon: Icons.phone_android_rounded,
              selected: _selectedMethod == 'Telebirr',
              onTap: () => setState(() => _selectedMethod = 'Telebirr'),
            ),
            const SizedBox(height: 10),
            _accountCard(
              title: 'CBE (Commercial Bank of Ethiopia)',
              accountName: ManualPaymentConfig.cbeAccountName,
              detailLabel: 'Account',
              detailValue: ManualPaymentConfig.cbeAccountNumber,
              icon: Icons.account_balance_rounded,
              selected: _selectedMethod == 'CBE',
              onTap: () => setState(() => _selectedMethod = 'CBE'),
            ),
            const SizedBox(height: 20),

            // Receipt URL or Reference Input
            Text(
              context.tr('receipt_url_link'),
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _kBorder),
              ),
              child: Row(
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: Icon(Icons.link_rounded, color: _kSlate, size: 20),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _receiptUrlController,
                      style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        hintText: context.tr('paste_receipt_url_hint'),
                        hintStyle: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.paste_rounded, color: _kBlue, size: 20),
                    tooltip: 'Paste from clipboard',
                    onPressed: () async {
                      final data = await Clipboard.getData(Clipboard.kTextPlain);
                      if (!context.mounted) return;
                      if (data?.text != null && data!.text!.trim().isNotEmpty) {
                        _receiptUrlController.text = data.text!.trim();
                        showAppToast(context, 'Receipt link pasted from clipboard', type: AppToastType.info);
                      }
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              context.tr('instant_verification_hint'),
              style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
            ),
            const SizedBox(height: 18),

            // Screenshot upload
            Text(
              context.tr('upload_payment_screenshot'),
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: _isUploading ? null : _pickScreenshot,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                height: 120,
                decoration: BoxDecoration(
                  color: _screenshot == null
                      ? const Color(0xFFF8FAFC)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _screenshot == null ? _kBorder : _kBlue,
                    width: _screenshot == null ? 1 : 1.5,
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: _screenshot == null
                    ? Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.add_photo_alternate_outlined,
                            color: _kSlate,
                            size: 32,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            context.tr('tap_to_upload_screenshot'),
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              color: _kSlate,
                            ),
                          ),
                        ],
                      )
                    : Image.memory(
                        _screenshotBytes!,
                        fit: BoxFit.cover,
                        width: double.infinity,
                      ),
              ),
            ),
            const SizedBox(height: 20),

            // Submit button
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _isUploading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kBlue,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isUploading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        context.tr('submit_for_verification'),
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 44,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  context.tr('cancel'),
                  style: GoogleFonts.outfit(fontSize: 14, color: _kSlate),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
