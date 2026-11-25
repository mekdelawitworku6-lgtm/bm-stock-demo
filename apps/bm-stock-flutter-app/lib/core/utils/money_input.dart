import 'package:flutter/services.dart';

/// Formats amounts with thousands separators as the user types
/// (e.g. 1234567.50 -> 1,234,567.50) and caps decimals at 2 places.
class ThousandsInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final text = newValue.text;
    if (text.isEmpty) return newValue;

    final sanitized = text.replaceAll(',', '').replaceAll(RegExp(r'[^0-9.]'), '');
    if (sanitized.isEmpty) return const TextEditingValue();

    final dotIndex = sanitized.indexOf('.');
    var intPart = dotIndex == -1 ? sanitized : sanitized.substring(0, dotIndex);
    var decPart = dotIndex == -1 ? '' : sanitized.substring(dotIndex + 1);
    if (decPart.contains('.')) {
      decPart = decPart.replaceAll('.', '');
    }
    if (decPart.length > 2) {
      decPart = decPart.substring(0, 2);
    }

    intPart = intPart.isEmpty ? '0' : intPart;
    final grouped = _groupDigits(intPart);
    final formatted = decPart.isEmpty ? grouped : '$grouped.$decPart';

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }

  String _groupDigits(String digits) {
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }
}

/// Parses a (possibly comma-grouped) amount string into a double, or null if
/// empty/invalid. Use before sending amounts to the backend.
double? parseAmount(String? text) {
  if (text == null) return null;
  final cleaned = text.replaceAll(',', '').trim();
  if (cleaned.isEmpty) return null;
  return double.tryParse(cleaned);
}
