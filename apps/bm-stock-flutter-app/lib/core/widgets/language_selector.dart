import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../localization/app_localizations.dart';
import '../localization/locale_provider.dart';

class LanguageSelectorDropdown extends StatelessWidget {
  const LanguageSelectorDropdown({super.key});

  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final currentCode = localeProvider.locale.languageCode;

    String getDisplayLanguage(String code) {
      switch (code) {
        case 'am':
          return 'አማርኛ';
        case 'om':
          return 'Afaan Oromoo';
        case 'en':
        default:
          return 'English';
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFDBEAFE)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: currentCode,
          isDense: true,
          icon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: Color(0xFF475569),
            size: 20,
          ),
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: const Color(0xFF334155),
          ),
          onChanged: (String? newCode) {
            if (newCode != null) {
              localeProvider.setLocale(Locale(newCode));
            }
          },
          items: [
            DropdownMenuItem(
              value: 'en',
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.translate, size: 16, color: Color(0xFF025EA7)),
                  const SizedBox(width: 6),
                  Text(context.tr('english'), style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF1E293B))),
                ],
              ),
            ),
            DropdownMenuItem(
              value: 'am',
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.translate, size: 16, color: Color(0xFF025EA7)),
                  const SizedBox(width: 6),
                  Text(context.tr('amharic'), style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF1E293B))),
                ],
              ),
            ),
            DropdownMenuItem(
              value: 'om',
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.translate, size: 16, color: Color(0xFF025EA7)),
                  const SizedBox(width: 6),
                  Text(context.tr('afan_oromo'), style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF1E293B))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
