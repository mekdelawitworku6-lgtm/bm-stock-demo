import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../localization/app_localizations.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kAmber = Color(0xFFD97706);

bool _isShowingPaymentDueDialog = false;

/// Shows a persistent modal dialog warning the user that their payment is due.
/// It has `barrierDismissible: false` and `PopScope(canPop: false)` so it will
/// last until the user explicitly taps "Remind Later" or "Renew Plan".
Future<void> showPaymentDueDialog(
  BuildContext context, {
  required String message,
  String? phone,
  VoidCallback? onDismiss,
}) async {
  if (_isShowingPaymentDueDialog) return;
  _isShowingPaymentDueDialog = true;

  try {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => PopScope(
        canPop: false,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          contentPadding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _kAmber.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.payment_outlined,
                  color: _kAmber,
                  size: 26,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  context.tr('payment_due'),
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.bold,
                    color: _kInk,
                    fontSize: 18,
                  ),
                ),
              ),
            ],
          ),
          content: Text(
            message,
            style: GoogleFonts.outfit(
              color: _kSlate,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          actionsAlignment: MainAxisAlignment.spaceBetween,
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                onDismiss?.call();
              },
              child: Text(
                context.tr('remind_later'),
                style: GoogleFonts.outfit(
                  color: _kSlate,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                onDismiss?.call();
                Navigator.pushNamed(
                  context,
                  '/choose_plan',
                  arguments: {
                    'renewal': true,
                    if (phone != null && phone.isNotEmpty) 'phone': phone,
                  },
                );
              },
              icon: const Icon(Icons.autorenew_rounded, size: 16),
              label: Text(
                context.tr('renew_plan'),
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _kBlue,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  } finally {
    _isShowingPaymentDueDialog = false;
  }
}
