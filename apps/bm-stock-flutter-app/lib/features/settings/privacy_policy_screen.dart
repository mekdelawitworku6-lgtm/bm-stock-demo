import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/legal/privacy_policy_content.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const kInk = Color(0xFF0F172A);
    const kSlate = Color(0xFF64748B);
    const kBorder = Color(0xFFE2E8F0);
    const kBg = Color(0xFFF8FAFC);

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Privacy Policy',
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: kInk),
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kBorder),
              ),
              child: Text(
                'Version $kPrivacyPolicyVersion · Gelagle (BM Stock)',
                style: GoogleFonts.outfit(fontSize: 13, color: kSlate),
              ),
            ),
            const SizedBox(height: 16),
            ...kPrivacyPolicySections.map(
              (section) => Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      section.title,
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: kInk,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...section.blocks.map(
                      (block) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(
                          block,
                          style: GoogleFonts.outfit(fontSize: 13.5, height: 1.5, color: kSlate),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
