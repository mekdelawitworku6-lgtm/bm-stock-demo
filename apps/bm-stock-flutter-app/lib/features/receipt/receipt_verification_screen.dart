import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/api/api_client.dart';
import 'receipt_banks.dart';

/// Represents a verified receipt response from the backend.
class VerifiedReceipt {
  final bool valid;
  final String status;
  final String message;
  final String bank;
  final double? amount;
  final String? currency;
  final String? senderName;
  final String? receiverName;
  final String? payerAccount;
  final String? receiverAccount;
  final String? reference;
  final String? receiptNumber;
  final String? receiptUrl;
  final String? transactionDate;
  final String? reason;

  const VerifiedReceipt({
    required this.valid,
    required this.status,
    required this.message,
    required this.bank,
    this.amount,
    this.currency,
    this.senderName,
    this.receiverName,
    this.payerAccount,
    this.receiverAccount,
    this.reference,
    this.receiptNumber,
    this.receiptUrl,
    this.transactionDate,
    this.reason,
  });

  factory VerifiedReceipt.fromJson(Map<String, dynamic> json) {
    return VerifiedReceipt(
      valid: json['valid'] == true,
      status: json['status']?.toString() ?? 'invalid',
      message: json['message']?.toString() ?? '',
      bank: json['bank']?.toString() ?? 'cbe',
      amount: (json['amount'] is num) ? (json['amount'] as num).toDouble() : null,
      currency: json['currency']?.toString(),
      senderName: json['senderName']?.toString(),
      receiverName: json['receiverName']?.toString(),
      payerAccount: json['payerAccount']?.toString(),
      receiverAccount: json['receiverAccount']?.toString(),
      reference: json['reference']?.toString(),
      receiptNumber: json['receiptNumber']?.toString(),
      receiptUrl: json['receiptUrl']?.toString(),
      transactionDate: json['transactionDate']?.toString(),
      reason: json['reason']?.toString(),
    );
  }
}

// ── Colors ──────────────────────────────────────────────────────────────
const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBg = Color(0xFFF8FAFC);
const _kBorder = Color(0xFFE2E8F0);

class ReceiptVerificationScreen extends StatefulWidget {
  /// Optional initial link/reference to pre-fill.
  final String? initialLink;

  /// Optional default bank id.
  final String defaultBank;

  const ReceiptVerificationScreen({
    super.key,
    this.initialLink,
    this.defaultBank = 'cbe',
  });

  @override
  State<ReceiptVerificationScreen> createState() => _ReceiptVerificationScreenState();
}

class _ReceiptVerificationScreenState extends State<ReceiptVerificationScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _linkController = TextEditingController();
  final TextEditingController _suffixController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  late String _selectedBankId;
  bool _loading = false;
  String? _error;
  VerifiedReceipt? _result;
  bool _showScanner = false;

  ReceiptBankInfo get _bank => receiptBankInfo(_selectedBankId);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _selectedBankId = widget.defaultBank;
    if (widget.initialLink != null) {
      _linkController.text = widget.initialLink!;
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _linkController.dispose();
    _suffixController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  TextEditingController _fieldController(String key) =>
      key == 'suffix' ? _suffixController : _phoneController;

  String _normalizePhone(String value) {
    final digits = value.replaceAll(RegExp(r'[^\d]'), '');
    if (digits.isEmpty) return '';
    if (digits.startsWith('251')) return digits;
    if (digits.startsWith('0')) return '251${digits.substring(1)}';
    if (digits.length == 9 && digits.startsWith('9')) return '251$digits';
    return digits;
  }

  bool get _isUrl =>
      RegExp(r'^https?://', caseSensitive: false).hasMatch(_linkController.text.trim());

  String? _validate() {
    if (_linkController.text.trim().isEmpty) {
      return 'Please enter the ${_bank.primaryLabel.toLowerCase()}.';
    }
    for (final field in _bank.fields) {
      if (field.required && _fieldController(field.key).text.trim().isEmpty) {
        return 'Please enter the ${field.label.toLowerCase()}.';
      }
    }
    return null;
  }

  Future<void> _verifyLink([String? overrideLink]) async {
    final link = (overrideLink ?? _linkController.text).trim();
    if (link.isEmpty) return;

    final validationError = _validate();
    if (validationError != null) {
      setState(() {
        _error = validationError;
        _result = null;
      });
      return;
    }

    setState(() {
      _loading = true;
      _result = null;
      _error = null;
    });

    try {
      final body = <String, dynamic>{
        'bank': _selectedBankId,
        'reference': link,
      };
      if (_isUrl) {
        body['receiptUrl'] = link;
      }
      final suffix = _suffixController.text.trim();
      if (suffix.isNotEmpty) {
        body['suffix'] = suffix;
      }
      final phone = _phoneController.text.trim();
      if (phone.isNotEmpty) {
        body['phoneNumber'] = _normalizePhone(phone);
      }
      final response = await ApiClient().post('/receipts/verify', body: body);
      if (response is Map<String, dynamic>) {
        setState(() => _result = VerifiedReceipt.fromJson(response));
      } else {
        setState(() => _result = VerifiedReceipt(
              valid: false,
              status: 'error',
              message: 'Unexpected server response.',
              bank: _selectedBankId,
            ));
      }
    } catch (e) {
      setState(() => _result = VerifiedReceipt(
            valid: false,
            status: 'error',
            message: e.toString(),
            bank: _selectedBankId,
          ));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text?.isNotEmpty == true) {
      setState(() {
        _linkController.text = data!.text!.trim();
      });
    }
  }

  void _handleQrDetected(String value) {
    setState(() {
      _showScanner = false;
      _linkController.text = value;
      _tabController.animateTo(0); // Switch back to link tab
    });
    // Auto verify the scanned link
    _verifyLink(value);
  }

  void _selectBank(String id) {
    setState(() {
      _selectedBankId = id;
      _result = null;
      _error = null;
      _suffixController.clear();
      _phoneController.clear();
    });
  }

  void _reset() {
    setState(() {
      _linkController.clear();
      _suffixController.clear();
      _phoneController.clear();
      _result = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      body: CustomScrollView(
        slivers: [
          _buildAppBar(),
          SliverToBoxAdapter(
            child: Column(
              children: [
                _buildBankSelector(),
                _buildTabs(),
                const SizedBox(height: 4),
                AnimatedSize(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                  child: _tabController.index == 0
                      ? _buildLinkTab()
                      : _buildScanTab(),
                ),
                if (_loading) _buildLoadingIndicator(),
                if (_result != null && !_loading) _buildResultCard(),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      pinned: true,
      expandedHeight: 130,
      backgroundColor: _kBlue,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
        onPressed: () => Navigator.pop(context),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          color: _kBlue,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(56, 8, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2),
                          ),
                        ),
                        child: const Icon(
                          Icons.verified_user_outlined,
                          color: Color(0xFFFFC107),
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Receipt Verification',
                                  style: GoogleFonts.outfit(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFC107),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    'Official',
                                    style: GoogleFonts.outfit(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w900,
                                      color: _kBlue,
                                      letterSpacing: 0.6,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Verify CBE, Telebirr, Dashen, M-Pesa & more',
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: Colors.white.withValues(alpha: 0.7),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBankSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            'Bank / Wallet',
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: _kInk,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _kBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedBankId,
                isExpanded: true,
                borderRadius: BorderRadius.circular(14),
                icon: const Icon(Icons.keyboard_arrow_down, color: _kSlate),
                items: kSupportedReceiptBanks
                    .map(
                      (b) => DropdownMenuItem<String>(
                        value: b.id,
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: b.color,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                b.name,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: _kInk,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (id) {
                  if (id != null) _selectBank(id);
                },
              ),
            ),
          ),
        ),
        if (_bank.note != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline, size: 15, color: Color(0xFFB45309)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      _bank.note!,
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        color: const Color(0xFFB45309),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildTabs() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFE2E8F0),
        borderRadius: BorderRadius.circular(16),
      ),
      child: TabBar(
        controller: _tabController,
        onTap: (index) {
          setState(() {
            if (index == 1) _showScanner = true;
          });
        },
        dividerColor: Colors.transparent,
        indicatorSize: TabBarIndicatorSize.tab,
        indicator: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        labelStyle: GoogleFonts.outfit(
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: GoogleFonts.outfit(
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        labelColor: _kInk,
        unselectedLabelColor: _kSlate,
        tabs: const [
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.link, size: 16),
                SizedBox(width: 6),
                Text('Link / Reference'),
              ],
            ),
          ),
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.qr_code_scanner, size: 16),
                SizedBox(width: 6),
                Text('Scan QR Code'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLinkTab() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _bank.primaryLabel,
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: _kInk,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _kBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _linkController,
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) => _verifyLink(),
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: _kInk,
                    ),
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 14),
                      hintText: _bank.primaryPlaceholder,
                      hintStyle: GoogleFonts.outfit(
                        fontSize: 12,
                        color: const Color(0xFF94A3B8),
                      ),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                InkWell(
                  onTap: _pasteFromClipboard,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      'Paste',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _kBlue,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Paste the official ${_bank.shortName} link or type the reference exactly as printed.',
            style: GoogleFonts.outfit(
              fontSize: 11,
              color: const Color(0xFF94A3B8),
            ),
          ),

          // Dynamic secondary fields
          ..._bank.fields.map((field) {
            final required = field.required;
            return Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: required
                      ? const Color(0xFFFFF1F2)
                      : const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: required
                        ? const Color(0xFFFECACA)
                        : const Color(0xFFFDE68A),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      field.label,
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: required
                            ? const Color(0xFF991B1B)
                            : const Color(0xFF78350F),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _fieldController(field.key),
                      maxLength: field.maxLength,
                      keyboardType: field.numeric
                          ? TextInputType.number
                          : TextInputType.text,
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: _kInk,
                      ),
                      decoration: InputDecoration(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        hintText: field.placeholder,
                        hintStyle: GoogleFonts.outfit(
                          fontSize: 12,
                          color: const Color(0xFF94A3B8),
                        ),
                        fillColor: Colors.white,
                        filled: true,
                        counterText: '',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(
                            color: required
                                ? const Color(0xFFFCA5A5)
                                : const Color(0xFFFCD34D),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(
                            color: required
                                ? const Color(0xFFFCA5A5)
                                : const Color(0xFFFCD34D),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          if (_error != null) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF1F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 16, color: Color(0xFFDC2626)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF991B1B),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _loading || _linkController.text.trim().isEmpty
                  ? null
                  : _verifyLink,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kBlue,
                disabledBackgroundColor: const Color(0xFFCBD5E1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 3,
              ),
              child: _loading
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Verifying with ${_bank.shortName}...',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.search, color: Colors.white, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'Verify ${_bank.shortName} Receipt',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScanTab() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        children: [
          Container(
            height: 300,
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _kBorder),
            ),
            clipBehavior: Clip.antiAlias,
            child: _showScanner
                ? Stack(
                    children: [
                      MobileScanner(
                        onDetect: (capture) {
                          final List<Barcode> barcodes = capture.barcodes;
                          for (final barcode in barcodes) {
                            final value = barcode.rawValue;
                            if (value != null && value.isNotEmpty) {
                              _handleQrDetected(value);
                              return;
                            }
                          }
                        },
                      ),
                      Center(
                        child: Container(
                          width: 200,
                          height: 200,
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.6),
                              width: 2,
                            ),
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: 16,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'Point camera at the ${_bank.shortName} receipt QR code',
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  )
                : Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.qr_code_scanner,
                          size: 48,
                          color: Colors.white.withValues(alpha: 0.5),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Tap to start scanning',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.7),
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          onPressed: () => setState(() => _showScanner = true),
                          icon: const Icon(Icons.camera_alt, size: 18),
                          label: Text(
                            'Open Camera',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _kBlue,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, size: 16, color: _kBlue),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Scan the QR code on the receipt screenshot or printed receipt. The link will be automatically verified.',
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      color: const Color(0xFF1E40AF),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingIndicator() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 32),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          children: [
            const SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: _kBlue,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Checking with Bank Rails...',
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _kInk,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Authenticating with ${_bank.shortName}',
              style: GoogleFonts.outfit(
                fontSize: 11,
                color: _kSlate,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard() {
    final r = _result!;
    if (r.status == 'pending') {
      return _buildPendingCard(r);
    }
    if (r.valid) {
      return _buildValidCard(r);
    }
    return _buildInvalidCard(r);
  }

  Widget _buildPendingCard(VerifiedReceipt r) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBEB),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF59E0B), width: 2),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.hourglass_top,
                      color: Colors.white, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'STILL PROCESSING',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.8,
                          color: const Color(0xFFB45309),
                        ),
                      ),
                      Text(
                        receiptBankInfo(r.bank).name,
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFFD97706),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Text(
                r.message,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF92400E),
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: _verifyLink,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Check Again',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildValidCard(VerifiedReceipt r) {
    final bank = receiptBankInfo(r.bank);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFF22C55E), width: 2),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFF22C55E),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.check_circle,
                      color: Colors.white, size: 26),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'VALID RECEIPT',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.8,
                              color: const Color(0xFF166534),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Color(0xFF22C55E),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        bank.name,
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF16A34A),
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Amount',
                      style: GoogleFonts.outfit(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                        color: _kSlate,
                      ),
                    ),
                    Text(
                      'ETB ${r.amount?.toStringAsFixed(2) ?? '0.00'}',
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF15803D),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              height: 1,
              color: const Color(0xFFBBF7D0),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                    child: _detailBox(
                        'Payer / Sender', r.senderName, r.payerAccount)),
                const SizedBox(width: 10),
                Expanded(
                    child: _detailBox(
                        'Receiver', r.receiverName, r.receiverAccount)),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                    child: _detailBox('Reference',
                        r.reference ?? r.receiptNumber, null)),
                const SizedBox(width: 10),
                Expanded(
                  child: _detailBox(
                    'Transaction Date',
                    r.transactionDate != null
                        ? _formatDate(r.transactionDate!)
                        : 'Confirmed',
                    null,
                  ),
                ),
              ],
            ),
            if (r.reason != null && r.reason!.isNotEmpty) ...[
              const SizedBox(height: 10),
              _detailBox('Remark / Reason', '"${r.reason}"', null),
            ],
          ],
        ),
      ),
    );
  }

  Widget _detailBox(String label, String? value, String? sub) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFDCFCE7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.outfit(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: _kSlate,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value ?? 'N/A',
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: _kInk,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (sub != null && sub.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              'Acc: $sub',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 10,
                color: _kSlate,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInvalidCard(VerifiedReceipt r) {
    final bank = receiptBankInfo(r.bank);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF1F2),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFEF4444), width: 2),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.cancel, color: Colors.white, size: 26),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'INVALID RECEIPT',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.8,
                          color: const Color(0xFF991B1B),
                        ),
                      ),
                      Text(
                        '${bank.name} — Transaction Not Verified',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFFDC2626),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.message,
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF991B1B),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'This receipt was not found in ${bank.name} official records. Do NOT fulfill this order until payment is verified.',
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      color: _kSlate,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: _reset,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE2E8F0),
                  foregroundColor: _kInk,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  'Try Another Receipt',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      final months = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[dt.month]} ${dt.day}, ${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return isoDate;
    }
  }
}
