import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Compact renew CTA — distinct from the primary login button.
class RenewSubscriptionButton extends StatelessWidget {
  final VoidCallback onPressed;
  final String label;

  const RenewSubscriptionButton({
    super.key,
    required this.onPressed,
    required this.label,
  });

  static const Color _renewColor = Color(0xFF0891B2);

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.center,
      child: TextButton.icon(
        onPressed: onPressed,
        icon: const Icon(Icons.autorenew_rounded, size: 16),
        label: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        style: TextButton.styleFrom(
          foregroundColor: _renewColor,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          minimumSize: const Size(0, 36),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: _renewColor, width: 1),
          ),
        ),
      ),
    );
  }
}
