import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/customer/customer_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/customer_model.dart';
import '../../core/utils/phone_util.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kBorder = Color(0xFFE2E8F0);

class AddCustomerScreen extends StatefulWidget {
  final CustomerModel? customer;
  const AddCustomerScreen({super.key, this.customer});

  @override
  State<AddCustomerScreen> createState() => _AddCustomerScreenState();
}

class _AddCustomerScreenState extends State<AddCustomerScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _addressController;
  bool _isSubmitting = false;

  bool get _isEditing => widget.customer != null;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.customer?.name ?? '');
    _phoneController = TextEditingController(text: widget.customer?.phoneNumber ?? '');
    _addressController = TextEditingController(text: widget.customer?.address ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);

    final data = <String, dynamic>{
      'name': _nameController.text.trim(),
      'address': _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
    };
    final phone = _phoneController.text.trim();
    if (phone.isNotEmpty) {
      data['phoneNumber'] = PhoneUtil.toTenDigit(phone);
    }

    bool success;
    if (_isEditing) {
      context.read<CustomerBloc>().add(CustomerUpdateRequested(id: widget.customer!.id, data: data));
      final s = await context.read<CustomerBloc>().stream.firstWhere((s) => !s.isLoading);
      success = s.error == null;
    } else {
      context.read<CustomerBloc>().add(CustomerAddRequested(data: data));
      final s = await context.read<CustomerBloc>().stream.firstWhere((s) => !s.isLoading);
      success = s.error == null;
    }

    if (mounted) {
      if (success) {
        Navigator.pop(context, true);
      } else {
        setState(() => _isSubmitting = false);
        showAppToast(context, context.read<CustomerBloc>().state.error ?? 'Failed', type: AppToastType.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _isEditing ? 'Edit Customer' : 'Add Customer',
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(context.tr('name'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
              const SizedBox(height: 6),
              TextFormField(
                controller: _nameController,
                style: GoogleFonts.outfit(fontSize: 14),
                textInputAction: TextInputAction.next,
                decoration: _inputDecoration(context.tr('customer_name_label')),
                validator: (v) => (v == null || v.trim().isEmpty) ? context.tr('required') : null,
              ),
              const SizedBox(height: 16),

              Text(context.tr('phone_optional'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
              const SizedBox(height: 6),
              TextFormField(
                controller: _phoneController,
                style: GoogleFonts.outfit(fontSize: 14),
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(10),
                ],
                decoration: _inputDecoration('09XXXXXXXX or 07XXXXXXXX'),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  if (!PhoneUtil.isValidOptionalEthiopian(v)) {
                    return context.tr('invalid_phone');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              Text(context.tr('address_optional'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
              const SizedBox(height: 6),
              TextFormField(
                controller: _addressController,
                style: GoogleFonts.outfit(fontSize: 14),
                textInputAction: TextInputAction.done,
                decoration: _inputDecoration('Address'),
              ),
              const SizedBox(height: 32),

              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                    elevation: 0,
                  ),
                  child: _isSubmitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(
                          _isEditing ? 'Save Changes' : 'Add Customer',
                          style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint, {String? errorText}) {
    final hasError = errorText != null && errorText.isNotEmpty;
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
      filled: true,
      fillColor: hasError ? const Color(0xFFFFF5F5) : Colors.white,
      errorText: errorText,
      errorMaxLines: 2,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _kBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(
          color: hasError ? const Color(0xFFFCA5A5) : _kBorder,
          width: hasError ? 1.5 : 1,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _kBlue, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.8),
      ),
      errorStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFFDC2626)),
    );
  }
}
