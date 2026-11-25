import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/supplier/supplier_bloc.dart';
import '../../core/models/supplier_model.dart';
import '../../core/localization/app_localizations.dart';

import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kBorder = Color(0xFFE2E8F0);

class AddSupplierScreen extends StatefulWidget {
  final SupplierModel? supplier;
  const AddSupplierScreen({super.key, this.supplier});

  @override
  State<AddSupplierScreen> createState() => _AddSupplierScreenState();
}

class _AddSupplierScreenState extends State<AddSupplierScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _contactController;
  late final TextEditingController _emailController;
  late final TextEditingController _addressController;
  late final TextEditingController _contactPersonController;
  bool _isSubmitting = false;

  bool get _isEditing => widget.supplier != null;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.supplier?.name ?? '');
    _contactController = TextEditingController(text: widget.supplier?.contact ?? '');
    _emailController = TextEditingController(text: widget.supplier?.email ?? '');
    _addressController = TextEditingController(text: widget.supplier?.address ?? '');
    _contactPersonController = TextEditingController(text: widget.supplier?.contactPerson ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _contactController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _contactPersonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);

    final data = <String, dynamic>{
      'name': _nameController.text.trim(),
      'contact': _contactController.text.trim(),
    };
    if (_emailController.text.trim().isNotEmpty) data['email'] = _emailController.text.trim();
    if (_addressController.text.trim().isNotEmpty) data['address'] = _addressController.text.trim();
    if (_contactPersonController.text.trim().isNotEmpty) data['contactPerson'] = _contactPersonController.text.trim();

    bool success;
    if (_isEditing) {
      context.read<SupplierBloc>().add(SupplierUpdateRequested(id: widget.supplier!.id, data: data));
      final s = await context.read<SupplierBloc>().stream.firstWhere((s) => !s.isLoading);
      success = s.error == null;
    } else {
      context.read<SupplierBloc>().add(SupplierAddRequested(data: data));
      final s = await context.read<SupplierBloc>().stream.firstWhere((s) => !s.isLoading);
      success = s.error == null;
    }

    if (mounted) {
      if (success) {
        Navigator.pop(context, true);
      } else {
        setState(() => _isSubmitting = false);
        showAppToast(
          context,
          context.read<SupplierBloc>().state.error ?? context.tr('failed'),
          type: AppToastType.error,
        );
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
          context.tr(_isEditing ? 'edit_supplier' : 'add_supplier'),
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
              _field(context.tr('name'), _nameController, validator: (v) => (v == null || v.trim().isEmpty) ? context.tr('required') : null),
              const SizedBox(height: 16),
              _field(context.tr('contact_number'), _contactController, keyboardType: TextInputType.phone),
              const SizedBox(height: 16),
              _field(context.tr('email'), _emailController,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return null;
                    final email = v.trim();
                    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
                      return context.tr('invalid_email');
                    }
                    return null;
                  }),
              const SizedBox(height: 16),
              _field(context.tr('address'), _addressController),
              const SizedBox(height: 16),
              _field(context.tr('contact_person'), _contactPersonController),
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
                          context.tr(_isEditing ? 'save_changes' : 'add_supplier'),
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

  Widget _field(String label, TextEditingController controller,
      {TextInputType? keyboardType, List<TextInputFormatter>? inputFormatters, String? Function(String?)? validator}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          style: GoogleFonts.outfit(fontSize: 14),
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          decoration: InputDecoration(
            hintText: label.replaceAll(' (Optional)', ''),
            hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
            errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFFCA5A5))),
            focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.5)),
            errorStyle: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFFDC2626)),
          ),
          validator: validator,
        ),
      ],
    );
  }
}
