import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/bloc/borrowing/borrowing_bloc.dart';
import '../../core/bloc/branch/branch_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/utils/phone_util.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class AddBorrowingScreen extends StatefulWidget {
  const AddBorrowingScreen({super.key});

  @override
  State<AddBorrowingScreen> createState() => _AddBorrowingScreenState();
}

class _AddBorrowingScreenState extends State<AddBorrowingScreen> {
  final _productNameController = TextEditingController();
  final _categoryController = TextEditingController();
  final _sellerNameController = TextEditingController();
  final _sellerPhoneController = TextEditingController();
  final _noteController = TextEditingController();
  final _quantityController = TextEditingController(text: '1');

  DateTime _dateTaken = DateTime.now();
  DateTime? _expectedReturnDate;
  String _locationType = 'warehouse';
  String? _locationId;
  String? _selectedProductId;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    context.read<BranchBloc>().add(BranchesLoadRequested());
    context.read<ProductBloc>().add(ProductsLoadRequested());
  }

  @override
  void dispose() {
    _productNameController.dispose();
    _categoryController.dispose();
    _sellerNameController.dispose();
    _sellerPhoneController.dispose();
    _noteController.dispose();
    _quantityController.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isExpectedReturn}) async {
    final initial = isExpectedReturn ? (_expectedReturnDate ?? DateTime.now()) : _dateTaken;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (isExpectedReturn) {
        _expectedReturnDate = picked;
      } else {
        _dateTaken = picked;
      }
    });
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  void _submit() {
    final productName = _productNameController.text.trim();
    final sellerName = _sellerNameController.text.trim();
    final quantity = int.tryParse(_quantityController.text.trim()) ?? 0;
    final sellerPhone = _sellerPhoneController.text.trim();

    if (productName.isEmpty || sellerName.isEmpty || quantity < 1 || quantity > 9999 || _locationId == null) {
      showAppToast(context, context.tr('required'), type: AppToastType.error);
      return;
    }

    if (_expectedReturnDate != null && _expectedReturnDate!.isBefore(_dateTaken)) {
      showAppToast(
        context,
        context.tr('expected_return_date') + ' ' + context.tr('invalid_number'),
        type: AppToastType.error,
      );
      return;
    }

    if (!PhoneUtil.isValidOptionalEthiopian(sellerPhone)) {
      showAppToast(context, context.tr('invalid_phone'), type: AppToastType.error);
      return;
    }

    final payload = <String, dynamic>{
      'productName': productName,
      'quantityTaken': quantity,
      'sellerName': sellerName,
      'dateTaken': _formatDate(_dateTaken),
    };

    if (_categoryController.text.trim().isNotEmpty) {
      payload['productCategory'] = _categoryController.text.trim();
    }
    if (_selectedProductId != null) payload['productId'] = _selectedProductId;
    if (sellerPhone.isNotEmpty) {
      payload['sellerPhone'] = PhoneUtil.normalize(sellerPhone);
    }
    if (_expectedReturnDate != null) {
      payload['expectedReturnDate'] = _formatDate(_expectedReturnDate!);
    }
    if (_noteController.text.trim().isNotEmpty) {
      payload['note'] = _noteController.text.trim();
    }
    if (_locationType == 'warehouse') {
      payload['warehouseId'] = _locationId;
    } else {
      payload['shopId'] = _locationId;
    }

    setState(() => _isSubmitting = true);
    context.read<BorrowingBloc>().add(BorrowingCreateRequested(data: payload));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          context.tr('add_borrowing'),
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
        ),
      ),
      body: BlocListener<BorrowingBloc, BorrowingState>(
        listenWhen: (previous, current) =>
            _isSubmitting &&
            !current.isLoading &&
            previous.lastActionSuccess != current.lastActionSuccess,
        listener: (context, state) {
          if (!mounted) return;
          if (state.lastActionSuccess == true) {
            setState(() => _isSubmitting = false);
            context.read<ProductBloc>().add(const ProductsLoadRequested());
            showAppToast(context, context.tr('borrowing_saved'), type: AppToastType.success);
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop(true);
            }
          } else if (state.lastActionSuccess == false && state.error != null) {
            showAppToast(context, state.error!, type: AppToastType.error);
            setState(() => _isSubmitting = false);
          }
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _buildProductPicker(context),
            const SizedBox(height: 14),
            _field(_productNameController, context.tr('product_name'), required: true),
            const SizedBox(height: 14),
            _field(_categoryController, context.tr('product_category')),
            const SizedBox(height: 14),
            _quantityField(context),
            const SizedBox(height: 14),
            _field(_sellerNameController, context.tr('taken_from'), required: true),
            const SizedBox(height: 14),
            _field(_sellerPhoneController, context.tr('phone_number'),
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(13),
                ]),
            const SizedBox(height: 14),
            _dateTile(
              label: context.tr('date_taken'),
              value: _formatDate(_dateTaken),
              onTap: () => _pickDate(isExpectedReturn: false),
            ),
            const SizedBox(height: 14),
            _dateTile(
              label: context.tr('expected_return_date'),
              value: _expectedReturnDate != null ? _formatDate(_expectedReturnDate!) : context.tr('optional'),
              onTap: () => _pickDate(isExpectedReturn: true),
            ),
            const SizedBox(height: 14),
            _locationPicker(context),
            const SizedBox(height: 14),
            _field(_noteController, context.tr('notes'), maxLines: 3),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kBlue,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      context.tr('save'),
                      style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductPicker(BuildContext context) {
    return BlocBuilder<ProductBloc, ProductState>(
      builder: (context, state) {
        final productIds = state.products.map((p) => p.id).toSet();
        final selectedProductId =
            _selectedProductId != null && productIds.contains(_selectedProductId)
                ? _selectedProductId
                : null;

        return DropdownButtonFormField<String>(
          value: selectedProductId,
          decoration: _decoration(context.tr('select_product_optional')),
          items: [
            DropdownMenuItem<String>(
              value: null,
              child: Text(context.tr('manual_entry'), style: GoogleFonts.outfit(color: _kSlate)),
            ),
            ...state.products.map((p) => DropdownMenuItem<String>(
                  value: p.id,
                  child: Text(p.name, style: GoogleFonts.outfit()),
                )),
          ],
          onChanged: (val) {
            setState(() {
              _selectedProductId = val;
              if (val != null) {
                final product = state.products.firstWhere((p) => p.id == val);
                _productNameController.text = product.name;
                _categoryController.text = product.category;
              }
            });
          },
        );
      },
    );
  }

  Widget _locationPicker(BuildContext context) {
    return BlocBuilder<BranchBloc, BranchState>(
      builder: (context, state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: _typeChip(
                    label: context.tr('warehouse'),
                    selected: _locationType == 'warehouse',
                    onTap: () => setState(() {
                      _locationType = 'warehouse';
                      _locationId = null;
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _typeChip(
                    label: context.tr('shop'),
                    selected: _locationType == 'shop',
                    onTap: () => setState(() {
                      _locationType = 'shop';
                      _locationId = null;
                    }),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (_locationType == 'warehouse')
              DropdownButtonFormField<String>(
                value: state.warehouses.any((b) => b.id == _locationId) ? _locationId : null,
                decoration: _decoration(context.tr('receiving_location')),
                items: state.warehouses
                    .map((b) => DropdownMenuItem<String>(
                          value: b.id,
                          child: Text(b.name, style: GoogleFonts.outfit()),
                        ))
                    .toList(),
                onChanged: (val) => setState(() => _locationId = val),
              )
            else
              DropdownButtonFormField<String>(
                value: state.shops.any((b) => b.id == _locationId) ? _locationId : null,
                decoration: _decoration(context.tr('receiving_location')),
                items: state.shops
                    .map((b) => DropdownMenuItem<String>(
                          value: b.id,
                          child: Text(b.name, style: GoogleFonts.outfit()),
                        ))
                    .toList(),
                onChanged: (val) => setState(() => _locationId = val),
              ),
          ],
        );
      },
    );
  }

  Widget _typeChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? _kBlue.withValues(alpha: 0.1) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? _kBlue : _kBorder),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            color: selected ? _kBlue : _kSlate,
          ),
        ),
      ),
    );
  }

  Widget _quantityField(BuildContext context) {
    final qty = int.tryParse(_quantityController.text) ?? 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${context.tr('qty_taken')} *',
          style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _kBorder),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: qty > 1
                    ? () {
                        _quantityController.text = '${qty - 1}';
                        setState(() {});
                      }
                    : null,
                icon: const Icon(Icons.remove_circle_outline, color: _kBlue, size: 32),
              ),
              Expanded(
                child: TextField(
                  controller: _quantityController,
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
                  decoration: InputDecoration(
                    hintText: context.tr('qty_taken'),
                    hintStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 14),
                    filled: true,
                    fillColor: _kBg,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    isDense: true,
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              IconButton(
                onPressed: qty < 9999
                    ? () {
                        _quantityController.text = '${qty + 1}';
                        setState(() {});
                      }
                    : null,
                icon: const Icon(Icons.add_circle_outline, color: _kBlue, size: 32),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _field(TextEditingController controller, String label, {bool required = false, int maxLines = 1, List<TextInputFormatter>? inputFormatters}) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      inputFormatters: inputFormatters,
      style: GoogleFonts.outfit(fontSize: 14),
      decoration: _decoration(required ? '$label *' : label),
    );
  }

  Widget _dateTile({required String label, required String value, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _kBorder),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                  const SizedBox(height: 4),
                  Text(value, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                ],
              ),
            ),
            const Icon(Icons.calendar_today_outlined, color: _kBlue, size: 18),
          ],
        ),
      ),
    );
  }

  InputDecoration _decoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 14),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBorder)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBorder)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
    );
  }
}
