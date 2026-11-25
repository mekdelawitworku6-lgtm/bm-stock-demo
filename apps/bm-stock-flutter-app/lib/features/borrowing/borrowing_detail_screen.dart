import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/bloc/borrowing/borrowing_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/borrowing_model.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);

class BorrowingDetailScreen extends StatefulWidget {
  final String recordId;
  const BorrowingDetailScreen({super.key, required this.recordId});

  @override
  State<BorrowingDetailScreen> createState() => _BorrowingDetailScreenState();
}

class _BorrowingDetailScreenState extends State<BorrowingDetailScreen> {
  final _returnedController = TextEditingController();
  bool _isSaving = false;
  bool _controllerInitialized = false;

  @override
  void initState() {
    super.initState();
    context.read<BorrowingBloc>().add(BorrowingDetailLoadRequested(id: widget.recordId));
  }

  @override
  void dispose() {
    _returnedController.dispose();
    super.dispose();
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'fully_returned':
        return _kGreen;
      case 'partially_returned':
        return _kAmber;
      default:
        return _kBlue;
    }
  }

  String _statusText(BuildContext context, String status) {
    switch (status) {
      case 'fully_returned':
        return context.tr('fully_returned');
      case 'partially_returned':
        return context.tr('partially_returned');
      default:
        return context.tr('active');
    }
  }

  String _formatDate(String raw) {
    if (raw.isEmpty) return '--';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw.split('T').first;
    return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
  }

  void _saveReturned(BorrowingModel record) {
    final returned = int.tryParse(_returnedController.text.trim());
    if (returned == null || returned < 0) {
      showAppToast(context, context.tr('required'), type: AppToastType.error);
      return;
    }
    if (returned > record.quantityTaken) {
      showAppToast(context, context.tr('return_exceeds_taken'), type: AppToastType.error);
      return;
    }

    setState(() => _isSaving = true);
    context.read<BorrowingBloc>().add(BorrowingUpdateRequested(
          id: record.id,
          data: {'quantityReturned': returned},
        ));
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<BorrowingBloc, BorrowingState>(
      listenWhen: (previous, current) =>
          _isSaving &&
          !current.isLoading &&
          previous.lastActionSuccess != current.lastActionSuccess,
      listener: (context, state) {
        if (!mounted) return;
        if (state.lastActionSuccess == true) {
          context.read<ProductBloc>().add(const ProductsLoadRequested());
          showAppToast(context, context.tr('borrowing_updated'), type: AppToastType.success);
          setState(() => _isSaving = false);
        } else if (state.lastActionSuccess == false && state.error != null) {
          showAppToast(context, state.error!, type: AppToastType.error);
          setState(() => _isSaving = false);
        }
      },
      child: Scaffold(
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
            context.tr('borrowing_detail'),
            style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
          ),
        ),
        body: BlocBuilder<BorrowingBloc, BorrowingState>(
          builder: (context, state) {
            if (state.isLoading && state.selected == null) {
              return const Center(child: CircularProgressIndicator(color: _kBlue));
            }

            final record = state.selected;
            if (record == null) {
              return Center(
                child: Text(context.tr('borrowing_not_found'), style: GoogleFonts.outfit(color: _kSlate)),
              );
            }

            if (!_controllerInitialized) {
              _controllerInitialized = true;
              final initialValue = '${record.quantityReturned}';
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) _returnedController.value = TextEditingValue(text: initialValue);
              });
            }

            final statusColor = _statusColor(record.status);

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.inventory_2_outlined, color: statusColor, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              record.productName,
                              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: _kInk),
                            ),
                            Text(
                              _statusText(context, record.status).toUpperCase(),
                              style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: statusColor),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _infoCard(context, record),
                const SizedBox(height: 16),
                _quantityCard(context, record),
                if (!record.isFullyReturned) ...[
                  const SizedBox(height: 16),
                  _updateReturnCard(context, record),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _infoCard(BuildContext context, BorrowingModel record) {
    return _card([
      _row(context.tr('product_category'), record.productCategory ?? '--'),
      _row(context.tr('taken_from'), record.sellerName),
      if (record.sellerPhone != null && record.sellerPhone!.isNotEmpty)
        _row(context.tr('phone_number'), record.sellerPhone!),
      _row(context.tr('date_taken'), _formatDate(record.dateTaken)),
      _row(
        context.tr('expected_return_date'),
        record.expectedReturnDate != null ? _formatDate(record.expectedReturnDate!) : '--',
      ),
      _row(context.tr('receiving_location'), record.locationName),
      if (record.note != null && record.note!.isNotEmpty) _row(context.tr('notes'), record.note!),
      if (record.recordedByName != null) _row(context.tr('recorded_by'), record.recordedByName!),
    ]);
  }

  Widget _quantityCard(BuildContext context, BorrowingModel record) {
    return _card([
      _row(context.tr('qty_taken'), '${record.quantityTaken}'),
      _row(context.tr('qty_returned'), '${record.quantityReturned}'),
      _row(
        context.tr('remaining'),
        '${record.remainingQuantity}',
        valueColor: record.remainingQuantity > 0 ? _kAmber : _kGreen,
        valueBold: true,
      ),
    ]);
  }

  Widget _updateReturnCard(BuildContext context, BorrowingModel record) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            context.tr('update_returned_quantity'),
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 15, color: _kInk),
          ),
          const SizedBox(height: 12),
          ListenableBuilder(
            listenable: _returnedController,
            builder: (_, __) {
              final current = int.tryParse(_returnedController.text) ?? record.quantityReturned;
              return Row(
                children: [
                  IconButton(
                    onPressed: current > 0
                        ? () {
                            _returnedController.text = '${current - 1}';
                          }
                        : null,
                    icon: const Icon(Icons.remove_circle_outline, color: _kBlue, size: 32),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _returnedController,
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
                      decoration: InputDecoration(
                        hintText: context.tr('qty_returned'),
                        filled: true,
                        fillColor: _kBg,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: current < record.quantityTaken
                        ? () {
                            _returnedController.text = '${current + 1}';
                          }
                        : null,
                    icon: const Icon(Icons.add_circle_outline, color: _kBlue, size: 32),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 8),
          ListenableBuilder(
            listenable: _returnedController,
            builder: (_, __) {
              final current = int.tryParse(_returnedController.text) ?? record.quantityReturned;
              return Text(
                '${context.tr('remaining')}: ${(record.quantityTaken - current).clamp(0, record.quantityTaken)}',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(color: _kSlate, fontSize: 13),
              );
            },
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isSaving ? null : () => _saveReturned(record),
            style: ElevatedButton.styleFrom(
              backgroundColor: _kBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _isSaving
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(context.tr('save'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _card(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kBorder),
      ),
      child: Column(children: children),
    );
  }

  Widget _row(String label, String value, {Color? valueColor, bool valueBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(label, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: valueBold ? FontWeight.w700 : FontWeight.w600,
                color: valueColor ?? _kInk,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
