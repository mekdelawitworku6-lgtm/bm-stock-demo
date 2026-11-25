import 'package:flutter/material.dart';

/// A secondary input required/optional for a given provider.
class ReceiptBankField {
  final String key; // 'suffix' | 'phoneNumber'
  final String label;
  final String placeholder;
  final bool required;
  final bool numeric;
  final int? maxLength;

  const ReceiptBankField({
    required this.key,
    required this.label,
    required this.placeholder,
    this.required = false,
    this.numeric = false,
    this.maxLength,
  });
}

/// Supported bank / wallet for receipt verification via verify.et.
class ReceiptBankInfo {
  final String id;
  final String name;
  final String shortName;
  final Color color;
  final String primaryLabel;
  final String primaryPlaceholder;
  final List<ReceiptBankField> fields;
  final String? note;

  const ReceiptBankInfo({
    required this.id,
    required this.name,
    required this.shortName,
    required this.color,
    required this.primaryLabel,
    required this.primaryPlaceholder,
    this.fields = const [],
    this.note,
  });
}

const List<ReceiptBankInfo> kSupportedReceiptBanks = [
  ReceiptBankInfo(
    id: 'cbe',
    name: 'Commercial Bank of Ethiopia',
    shortName: 'CBE',
    color: Color(0xFF025EA7),
    primaryLabel: 'CBE Receipt ID or Link',
    primaryPlaceholder: 'e.g. https://mbreciept.cbe.com.et/fHCxy...',
    fields: [
      ReceiptBankField(
        key: 'suffix',
        label: 'Legacy FT Account Suffix (8 digits)',
        placeholder: 'e.g. 60536171',
        numeric: true,
        maxLength: 8,
      ),
    ],
  ),
  ReceiptBankInfo(
    id: 'telebirr',
    name: 'Telebirr',
    shortName: 'Telebirr',
    color: Color(0xFF7C3AED),
    primaryLabel: 'Telebirr Transaction Number',
    primaryPlaceholder: 'e.g. DET8FJGUJ4',
  ),
  ReceiptBankInfo(
    id: 'dashen',
    name: 'Dashen Bank',
    shortName: 'Dashen',
    color: Color(0xFF0F766E),
    primaryLabel: 'Dashen Reference Number',
    primaryPlaceholder: 'e.g. 1234567890123456',
  ),
  ReceiptBankInfo(
    id: 'boa',
    name: 'Bank of Abyssinia',
    shortName: 'BOA',
    color: Color(0xFFB91C1C),
    primaryLabel: 'Bank of Abyssinia Reference Number',
    primaryPlaceholder: 'e.g. FT2614977L8S',
    fields: [
      ReceiptBankField(
        key: 'suffix',
        label: 'Account Suffix (5 digits)',
        placeholder: 'e.g. 12345',
        required: true,
        numeric: true,
        maxLength: 5,
      ),
    ],
  ),
  ReceiptBankInfo(
    id: 'cbebirr',
    name: 'CBE Birr',
    shortName: 'CBE Birr',
    color: Color(0xFF7C2D12),
    primaryLabel: 'CBE Birr Receipt Number',
    primaryPlaceholder: 'e.g. ABC123DE45',
    fields: [
      ReceiptBankField(
        key: 'phoneNumber',
        label: 'Phone Number (251XXXXXXXXX)',
        placeholder: 'e.g. 251911223344',
        required: true,
        numeric: true,
      ),
    ],
  ),
  ReceiptBankInfo(
    id: 'awash',
    name: 'Awash Bank',
    shortName: 'Awash',
    color: Color(0xFFCA8A04),
    primaryLabel: 'Awash Receipt URL or Token',
    primaryPlaceholder: 'Paste the Awash receipt URL or token',
  ),
  ReceiptBankInfo(
    id: 'mpesa',
    name: 'M-Pesa',
    shortName: 'M-Pesa',
    color: Color(0xFF15803D),
    primaryLabel: 'M-Pesa Transaction Number',
    primaryPlaceholder: 'e.g. QK12ABC34D',
  ),
  ReceiptBankInfo(
    id: 'siinqee',
    name: 'Siinqee Bank',
    shortName: 'Siinqee',
    color: Color(0xFF9D174D),
    primaryLabel: 'Siinqee Receipt URL or Token',
    primaryPlaceholder: 'Paste the Siinqee receipt URL or token',
  ),
  ReceiptBankInfo(
    id: 'kaafiebirr',
    name: 'Kaafi Ebirr',
    shortName: 'Kaafi Ebirr',
    color: Color(0xFF4338CA),
    primaryLabel: 'Kaafi Ebirr Receipt URL or Token',
    primaryPlaceholder: 'Paste the Kaafi Ebirr receipt URL or token',
    fields: [
      ReceiptBankField(
        key: 'phoneNumber',
        label: 'Phone Number (optional)',
        placeholder: 'e.g. 251911223344',
        numeric: true,
      ),
    ],
  ),
  ReceiptBankInfo(
    id: 'coopayebirr',
    name: 'Coopay Ebirr',
    shortName: 'Coopay Ebirr',
    color: Color(0xFFC2410C),
    primaryLabel: 'Coopay Ebirr Receipt Link or Token',
    primaryPlaceholder: 'e.g. https://receipt.ebirr.com/coopay/...',
    fields: [
      ReceiptBankField(
        key: 'phoneNumber',
        label: 'Phone Number (optional)',
        placeholder: 'e.g. 251911223344',
        numeric: true,
      ),
    ],
  ),
  ReceiptBankInfo(
    id: 'zemen',
    name: 'Zemen Bank',
    shortName: 'Zemen',
    color: Color(0xFF1D4ED8),
    primaryLabel: 'Zemen Receipt URL or Token',
    primaryPlaceholder: 'Paste the Zemen receipt URL or token',
    note:
        'Zemen does not accept direct API verification; we submit the receipt for smart routing and surface the provider status.',
  ),
];

ReceiptBankInfo receiptBankInfo(String id) {
  final normalized = id.toLowerCase().trim();
  return kSupportedReceiptBanks.firstWhere(
    (b) => b.id == normalized,
    orElse: () => kSupportedReceiptBanks.first,
  );
}
