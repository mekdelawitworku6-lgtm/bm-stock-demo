/// Ethiopian phone normalization (+251).
class PhoneUtil {
  PhoneUtil._();

  static const defaultCountryCode = '+251';

  /// Validates that an input is strictly a valid Ethiopian mobile number:
  /// - 10 digits starting with 09 or 07 (e.g. 0912345678, 0712345678)
  /// - 9 digits starting with 9 or 7 (e.g. 912345678, 712345678)
  /// - 12 digits starting with 2519 or 2517 (e.g. 251912345678)
  /// - 13 chars with + (e.g. +251912345678)
  /// Any input with non-digit characters (other than leading +) or more than 10 digits (when local) is REJECTED.
  static bool isValidEthiopian(String input) {
    final trimmed = input.trim();
    if (trimmed.isEmpty) return false;

    // International format with leading +
    if (trimmed.startsWith('+')) {
      return RegExp(r'^\+251[79]\d{8}$').hasMatch(trimmed);
    }

    // Must be numbers only
    if (!RegExp(r'^\d+$').hasMatch(trimmed)) return false;

    // 10 digits starting with 09 or 07
    if (trimmed.startsWith('0')) {
      return RegExp(r'^0[79]\d{8}$').hasMatch(trimmed);
    }

    // 9 digits starting with 9 or 7
    if (trimmed.startsWith('9') || trimmed.startsWith('7')) {
      return RegExp(r'^[79]\d{8}$').hasMatch(trimmed);
    }

    // 12 digits starting with 251
    if (trimmed.startsWith('251')) {
      return RegExp(r'^251[79]\d{8}$').hasMatch(trimmed);
    }

    return false;
  }

  /// Converts any valid Ethiopian phone number into strictly 10-digit local format (09xxxxxxxx or 07xxxxxxxx)
  static String toTenDigit(String input) {
    final trimmed = input.trim();
    final digits = trimmed.replaceAll(RegExp(r'\D'), '');

    if (digits.startsWith('251') && digits.length == 12) {
      return '0${digits.substring(3)}';
    }
    if (digits.startsWith('0') && digits.length == 10) {
      return digits;
    }
    if ((digits.startsWith('9') || digits.startsWith('7')) && digits.length == 9) {
      return '0$digits';
    }
    return trimmed;
  }

  /// Normalizes Ethiopian numbers to standard +251[79]xxxxxxxx
  static String normalize(String input) {
    final ten = toTenDigit(input);
    if (ten.startsWith('0') && ten.length == 10) {
      return '+251${ten.substring(1)}';
    }
    final digits = input.trim().replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('251') && digits.length == 12) {
      return '+$digits';
    }
    if ((digits.startsWith('9') || digits.startsWith('7')) && digits.length == 9) {
      return '+251$digits';
    }
    return input.trim();
  }

  /// Local part shown after the fixed +251 prefix (9 digits max).
  static String localPart(String input) {
    var digits = input.trim().replaceAll(RegExp(r'\D'), '');
    if (digits == '251') return '';
    if (digits.startsWith('251')) {
      digits = digits.substring(3);
    }
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    if (digits.length > 9) {
      digits = digits.substring(0, 9);
    }
    return digits;
  }

  /// Returns true when the input is blank OR a valid Ethiopian mobile number.
  /// Use this for optional phone fields.
  static bool isValidOptionalEthiopian(String? input) {
    if (input == null || input.trim().isEmpty) return true;
    return isValidEthiopian(input);
  }

  static String display(String input) {
    final n = normalize(input);
    if (n.length == 13 && n.startsWith('+251')) {
      final local = n.substring(4);
      return '+251 ${local.substring(0, 3)} ${local.substring(3, 6)} ${local.substring(6)}';
    }
    return input;
  }
}
