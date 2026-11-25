import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../localization/app_localizations.dart';



const _kBlue = Color(0xFF025EA7);

const _kRenew = Color(0xFF0891B2);

const _kInk = Color(0xFF0F172A);

const _kSlate = Color(0xFF64748B);

const _kAmber = Color(0xFFD97706);

const _kRed = Color(0xFFDC2626);



enum AccountBlockReason {

  subscriptionExpired,

  companyDeactivated,

}



AccountBlockReason? accountBlockReasonFromCode(String? code) {

  switch (code) {

    case 'SUBSCRIPTION_EXPIRED':

      return AccountBlockReason.subscriptionExpired;

    case 'COMPANY_DEACTIVATED':

      return AccountBlockReason.companyDeactivated;

    default:

      return null;

  }

}



bool _isShowingBlockedDialog = false;

Future<void> showAccountBlockedDialog(
  BuildContext context, {
  required AccountBlockReason reason,
  String? message,
  String? phone,
  VoidCallback? onDismiss,
}) async {
  if (_isShowingBlockedDialog) return;
  _isShowingBlockedDialog = true;

  final isSubscription = reason == AccountBlockReason.subscriptionExpired;
  final title = isSubscription
      ? context.tr('subscription_expired_title')
      : context.tr('account_deactivated_title');
  final body = message?.isNotEmpty == true
      ? message!
      : isSubscription
          ? context.tr('subscription_expired_message')
          : context.tr('account_deactivated_message');

  try {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => PopScope(
        canPop: false,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: (isSubscription ? _kAmber : _kRed).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  isSubscription ? Icons.payment_outlined : Icons.block_outlined,
                  color: isSubscription ? _kAmber : _kRed,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk, fontSize: 18),
                ),
              ),
            ],
          ),
          content: Text(body, style: GoogleFonts.outfit(color: _kSlate, fontSize: 14, height: 1.5)),
          actionsAlignment: MainAxisAlignment.spaceBetween,
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                onDismiss?.call();
              },
              child: Text(context.tr('ok'), style: GoogleFonts.outfit(color: _kSlate, fontWeight: FontWeight.w600)),
            ),
            if (isSubscription)
              TextButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  onDismiss?.call();
                  var resolvedPhone = phone;
                  if (resolvedPhone == null || resolvedPhone.isEmpty) {
                    final prefs = await SharedPreferences.getInstance();
                    resolvedPhone = prefs.getString('auth_phone');
                    if (resolvedPhone == null || resolvedPhone.isEmpty) {
                      final userJson = prefs.getString('user');
                      if (userJson != null) {
                        try {
                          final parsed = json.decode(userJson);
                          resolvedPhone = parsed['phone']?.toString();
                        } catch (_) {}
                      }
                    }
                  }
                  if (!context.mounted) return;
                  Navigator.pushNamed(
                    context,
                    '/choose_plan',
                    arguments: {
                      'renewal': true,
                      if (resolvedPhone != null && resolvedPhone.isNotEmpty)
                        'phone': resolvedPhone,
                    },
                  );
                },
                icon: const Icon(Icons.autorenew_rounded, size: 16),
                label: Text(
                  context.tr('renew_subscription'),
                  style: GoogleFonts.outfit(color: _kRenew, fontWeight: FontWeight.w600, fontSize: 13),
                ),
                style: TextButton.styleFrom(
                  foregroundColor: _kRenew,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  minimumSize: const Size(0, 36),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
          ],
        ),
      ),
    );
  } finally {
    _isShowingBlockedDialog = false;
  }
}

