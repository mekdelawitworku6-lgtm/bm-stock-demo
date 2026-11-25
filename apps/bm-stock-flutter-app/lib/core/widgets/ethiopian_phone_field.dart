import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/phone_util.dart';

/// Phone input with fixed +251 country code and local digit entry.
class EthiopianPhoneField extends StatefulWidget {
  final TextEditingController controller;
  final String? label;
  final String? hint;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final bool enabled;
  final String? invalidPhoneMessage;
  final String? errorText;

  const EthiopianPhoneField({
    super.key,
    required this.controller,
    this.label,
    this.hint,
    this.validator,
    this.onChanged,
    this.enabled = true,
    this.invalidPhoneMessage,
    this.errorText,
  });

  @override
  State<EthiopianPhoneField> createState() => _EthiopianPhoneFieldState();
}

class _EthiopianPhoneFieldState extends State<EthiopianPhoneField> {
  late final TextEditingController _localController;
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _localController = TextEditingController(text: PhoneUtil.localPart(widget.controller.text));
    _localController.addListener(_syncToParent);
    widget.controller.addListener(_syncFromParent);
  }

  @override
  void didUpdateWidget(covariant EthiopianPhoneField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_syncFromParent);
      widget.controller.addListener(_syncFromParent);
      _syncFromParent();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_syncFromParent);
    _localController.removeListener(_syncToParent);
    _localController.dispose();
    super.dispose();
  }

  void _syncFromParent() {
    if (_isSyncing) return;
    final expectedLocal = PhoneUtil.localPart(widget.controller.text);
    if (_localController.text != expectedLocal) {
      _isSyncing = true;
      _localController.text = expectedLocal;
      _isSyncing = false;
    }
  }

  void _syncToParent() {
    if (_isSyncing) return;
    _isSyncing = true;
    final local = _localController.text.replaceAll(RegExp(r'\D'), '');
    widget.controller.text = local.isEmpty ? '' : '+251$local';
    widget.onChanged?.call(widget.controller.text);
    _isSyncing = false;
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: hasError ? const Color(0xFFDC2626) : const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 6),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              height: 52,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: hasError ? const Color(0xFFFFF5F5) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: hasError ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0),
                  width: hasError ? 1.5 : 1,
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                PhoneUtil.defaultCountryCode,
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: hasError ? const Color(0xFFDC2626) : const Color(0xFF0F172A),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                controller: _localController,
                enabled: widget.enabled,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  _EthiopianLocalPhoneFormatter(),
                ],
                decoration: InputDecoration(
                  hintText: widget.hint ?? '912345678',
                  hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8)),
                  filled: true,
                  fillColor: hasError ? const Color(0xFFFFF5F5) : Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  errorText: widget.errorText,
                  errorMaxLines: 2,
                  errorStyle: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFFDC2626),
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                      color: hasError ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0),
                      width: hasError ? 1.5 : 1,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5),
                  ),
                  errorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5),
                  ),
                  focusedErrorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.8),
                  ),
                ),
                validator: (v) {
                  final full = widget.controller.text;
                  if (widget.validator != null) return widget.validator!(full);
                  if (!PhoneUtil.isValidEthiopian(full)) {
                    return widget.invalidPhoneMessage ?? 'Enter a valid 9-digit mobile number';
                  }
                  return null;
                },
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _EthiopianLocalPhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var text = newValue.text.replaceAll(RegExp(r'\D'), '');

    // Strip leading 251 if user pasted or typed full country code
    if (text.startsWith('251')) {
      text = text.substring(3);
    }
    // Strip leading 0 if user typed or pasted local prefix (e.g. 09... or 07...)
    if (text.startsWith('0')) {
      text = text.substring(1);
    }

    // Limit to 9 digits (local Ethiopian mobile: 9xxxxxxxx or 7xxxxxxxx)
    if (text.length > 9) {
      text = text.substring(0, 9);
    }

    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
