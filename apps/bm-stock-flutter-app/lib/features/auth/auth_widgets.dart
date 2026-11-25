import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';

class FieldLabel extends StatelessWidget {
  final String text;
  const FieldLabel({super.key, required this.text});

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: GoogleFonts.outfit(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: const Color(0xFF475569),
        ),
      );
}

class ErrorBanner extends StatelessWidget {
  final String message;
  const ErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFFCA5A5)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: GoogleFonts.outfit(
                  color: const Color(0xFFB91C1C),
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      );
}

class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox(
        width: 22,
        height: 22,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
        ),
      );
}

/// Popup that shows the support contact details with quick actions.
class ContactUsDialog extends StatelessWidget {
  final String supportPhone;
  final String? telegramHandle;
  const ContactUsDialog({
    super.key,
    this.supportPhone = '0911578793',
    this.telegramHandle,
  });

  static Future<void> show(
    BuildContext context, {
    String supportPhone = '0911578793',
    String? telegramHandle,
  }) {
    return showDialog(
      context: context,
      builder: (_) => ContactUsDialog(
        supportPhone: supportPhone,
        telegramHandle: telegramHandle,
      ),
    );
  }

  Future<void> _call(BuildContext context, String phone) async {
    final uri = Uri(scheme: 'tel', path: phone.replaceAll(' ', ''));
    try {
      await launchUrl(uri);
    } catch (_) {}
  }

  Future<void> _openTelegram(BuildContext context) async {
    final handle = (telegramHandle ?? '').replaceFirst('@', '');
    if (handle.isEmpty) return;
    final uri = Uri.parse('https://t.me/$handle');
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  Future<void> _copy(BuildContext context, String phone) async {
    await Clipboard.setData(ClipboardData(text: phone));
    if (!context.mounted) return;
    showAppToast(
      context,
      context.tr('contact_copied'),
      duration: const Duration(seconds: 1),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tr = (String key) => context.tr(key);
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFF025EA7).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.support_agent, color: Color(0xFF025EA7), size: 28),
            ),
            const SizedBox(height: 12),
            Text(
              tr('contact_us'),
              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
            ),
            const SizedBox(height: 4),
            Text(
              tr('contact_us_dialog_desc'),
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.phone_in_talk_outlined, color: Color(0xFF025EA7), size: 18),
                  const SizedBox(width: 8),
                  Text(
                    supportPhone,
                    style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A)),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => _copy(context, supportPhone),
                    child: const Icon(Icons.copy_outlined, color: Color(0xFF64748B), size: 16),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _call(context, supportPhone),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: Color(0xFF025EA7), width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.call_outlined, color: Color(0xFF025EA7), size: 18),
                    label: Text(tr('call_now'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: const Color(0xFF025EA7))),
                  ),
                ),
                if (telegramHandle != null && telegramHandle!.isNotEmpty) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _openTelegram(context),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Color(0xFF16A34A), width: 1.5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.send_outlined, color: Color(0xFF16A34A), size: 18),
                      label: Text(tr('telegram'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: const Color(0xFF16A34A))),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(tr('done'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: const Color(0xFF64748B))),
            ),
          ],
        ),
      ),
    );
  }
}
