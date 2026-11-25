import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/transfer/transfer_bloc.dart';
import '../../core/bloc/branch/branch_bloc.dart';
import '../../core/api/api_client.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class CreateTransferScreen extends StatefulWidget {
  final String? fromWarehouseId;
  const CreateTransferScreen({super.key, this.fromWarehouseId});

  @override
  State<CreateTransferScreen> createState() => _CreateTransferScreenState();
}

class _CreateTransferScreenState extends State<CreateTransferScreen> {
  String? _selectedBranchId;
  String? _selectedProductId;
  int _quantity = 1;
  final _quantityController = TextEditingController(text: '1');
  final _noteController = TextEditingController();
  bool _isSubmitting = false;
  List<dynamic> _warehouseProducts = [];

  @override
  void dispose() {
    _quantityController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    context.read<BranchBloc>().add(BranchesLoadRequested());
    _loadWarehouseProducts();
  }

  Future<void> _loadWarehouseProducts() async {
    if (widget.fromWarehouseId == null) return;
    try {
      final api = ApiClient();
      final result = await api.get('/warehouses/${widget.fromWarehouseId}/with-products');
      final data = result is Map ? (result['data'] ?? []) : [];
      if (mounted) setState(() => _warehouseProducts = data as List);
    } catch (_) {}
  }

  void _submit() {
    final parsedQty = int.tryParse(_quantityController.text.trim()) ?? _quantity;
    if (_selectedBranchId == null || _selectedProductId == null || parsedQty < 1) return;

    setState(() {
      _quantity = parsedQty;
      _isSubmitting = true;
    });
    context.read<TransferBloc>().add(TransferCreateRequested(data: {
      'type': 'warehouse_to_shop',
      'productId': _selectedProductId,
      'fromWarehouseId': widget.fromWarehouseId,
      'toShopId': _selectedBranchId,
      'quantity': _quantity,
      'note': _noteController.text.isNotEmpty ? _noteController.text : null,
    }));
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
        title: Text(context.tr('transfer_to_branch'),
            style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
      ),
      body: BlocListener<TransferBloc, TransferState>(
        listener: (context, state) {
          if (state.lastActionSuccess == true) {
            showAppToast(context, context.tr('transfer_created_successfully'), type: AppToastType.success);
            Navigator.pop(context);
          } else if (state.error != null) {
            showAppToast(context, state.error!, type: AppToastType.error);
            setState(() => _isSubmitting = false);
          }
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildBranchDropdown(),
            const SizedBox(height: 16),
            _buildProductDropdown(),
            const SizedBox(height: 16),
            _buildAvailableQty(),
            const SizedBox(height: 16),
            _buildQuantityInput(),
            const SizedBox(height: 16),
            _buildNoteInput(),
            const SizedBox(height: 24),
            _buildSubmitButton(),
          ],
        ),
      ),
    );
  }

  Widget _buildBranchDropdown() {
    return BlocBuilder<BranchBloc, BranchState>(
      builder: (context, state) {
        final shops = state.shops;
        return _dropdownField(
          label: 'Select Branch',
          value: _selectedBranchId,
      items: shops.map((s) => DropdownMenuItem<String>(
        value: s.id,
        child: Text(s.name, style: GoogleFonts.outfit()),
      )).toList(),
          onChanged: (v) => setState(() => _selectedBranchId = v),
        );
      },
    );
  }

  Widget _buildProductDropdown() {
    return _dropdownField(
      label: 'Select Product',
      value: _selectedProductId,
      items: _warehouseProducts.map((p) => DropdownMenuItem<String>(
        value: p['id'],
        child: Text('${p['name'] ?? ''} (${p['sku'] ?? ''})', style: GoogleFonts.outfit()),
      )).toList(),
      onChanged: (v) => setState(() {
        _selectedProductId = v;
        _quantity = 1;
        _quantityController.text = '1';
      }),
    );
  }

  Widget _buildAvailableQty() {
    final selected = _warehouseProducts.firstWhere(
      (p) => p['id'] == _selectedProductId,
      orElse: () => {},
    );
    final qty = selected['stockQuantity'] ?? 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(context.tr('available_quantity'), style: GoogleFonts.outfit(color: _kSlate)),
          Text('$qty', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildQuantityInput() {
    final selected = _warehouseProducts.firstWhere(
      (p) => p['id'] == _selectedProductId,
      orElse: () => {},
    );
    final available = selected['stockQuantity'];
    final maxQty = (available is int) ? available : (available is num ? available.toInt() : null);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(context.tr('transfer_quantity'), style: GoogleFonts.outfit(color: _kSlate, fontSize: 14)),
          Row(
            children: [
              IconButton(
                onPressed: _quantity > 1
                    ? () {
                        setState(() {
                          _quantity--;
                          _quantityController.text = '$_quantity';
                        });
                      }
                    : null,
                icon: const Icon(Icons.remove_circle_outline, color: _kBlue),
              ),
              SizedBox(
                width: 70,
                child: TextField(
                  controller: _quantityController,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk),
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                    border: OutlineInputBorder(
                      borderSide: BorderSide(color: _kBorder),
                      borderRadius: BorderRadius.all(Radius.circular(8)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: _kBlue, width: 1.5),
                      borderRadius: BorderRadius.all(Radius.circular(8)),
                    ),
                  ),
                  onChanged: (val) {
                    final parsed = int.tryParse(val);
                    if (parsed != null && parsed >= 1) {
                      final effectiveMax = maxQty != null && maxQty > 0 ? maxQty : null;
                      if (effectiveMax != null && parsed > effectiveMax) {
                        setState(() => _quantity = effectiveMax);
                        _quantityController.text = '$effectiveMax';
                        _quantityController.selection = TextSelection.collapsed(offset: _quantityController.text.length);
                      } else {
                        setState(() => _quantity = parsed);
                      }
                    }
                  },
                ),
              ),
              IconButton(
                onPressed: (maxQty == null || maxQty <= 0 || _quantity < maxQty)
                    ? () {
                        setState(() {
                          _quantity++;
                          _quantityController.text = '$_quantity';
                        });
                      }
                    : null,
                icon: const Icon(Icons.add_circle_outline, color: _kBlue),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNoteInput() {
    return TextField(
      controller: _noteController,
      maxLines: 3,
      decoration: InputDecoration(
        hintText: context.tr('note_optional'),
        hintStyle: GoogleFonts.outfit(color: _kSlate),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.all(16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _kBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _kBorder),
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return ElevatedButton(
      onPressed: _isSubmitting ? null : _submit,
      style: ElevatedButton.styleFrom(
        backgroundColor: _kBlue,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: _isSubmitting
          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
          : Text(context.tr('transfer'), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600)),
    );
  }

  Widget _dropdownField({
    required String label,
    required String? value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: DropdownButtonFormField<String>(
        value: value,
        hint: Text(label, style: GoogleFonts.outfit(color: _kSlate)),
        isExpanded: true,
        items: items,
        onChanged: onChanged,
        decoration: const InputDecoration(border: InputBorder.none),
      ),
    );
  }
}
