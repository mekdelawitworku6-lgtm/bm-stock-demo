import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/transfer/transfer_bloc.dart';
import '../../core/localization/app_localizations.dart';
import 'transfer_detail_screen.dart';
import '../../core/widgets/refreshable_scroll.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class TransferHistoryScreen extends StatefulWidget {
  const TransferHistoryScreen({super.key});

  @override
  State<TransferHistoryScreen> createState() => _TransferHistoryScreenState();
}

class _TransferHistoryScreenState extends State<TransferHistoryScreen> {
  String _filterStatus = '';

  @override
  void initState() {
    super.initState();
    context.read<TransferBloc>().add(TransfersLoadRequested());
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed': return _kGreen;
      case 'pending': return _kAmber;
      case 'rejected': return _kRed;
      default: return _kSlate;
    }
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
        title: Text(context.tr('transfer_history'),
            style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
      ),
      body: Column(
        children: [
          _buildFilterChips(),
          Expanded(
            child: BlocBuilder<TransferBloc, TransferState>(
              builder: (context, state) {
                Future<void> onRefresh() async {
                  context.read<TransferBloc>().add(TransfersLoadRequested());
                }

                if (state.isLoading && state.transfers.isEmpty) {
                  return const Center(child: CircularProgressIndicator(color: _kBlue));
                }
                final transfers = _filterStatus.isEmpty
                    ? state.transfers
                    : state.transfers.where((t) => t.status == _filterStatus).toList();
                if (transfers.isEmpty) {
                  return RefreshIndicator(
                    onRefresh: onRefresh,
                    child: refreshableScrollChild(
                      child: Center(
                        child: Text(context.tr('no_transfers_found'), style: GoogleFonts.outfit(color: _kSlate)),
                      ),
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: onRefresh,
                  child: ListView.builder(
                    physics: refreshScrollPhysics,
                    padding: const EdgeInsets.all(16),
                  itemCount: transfers.length,
                  itemBuilder: (_, i) {
                    final t = transfers[i];
                    return GestureDetector(
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(
                          builder: (_) => TransferDetailScreen(transferId: t.id),
                        ));
                      },
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: _kBorder),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: _statusColor(t.status).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                t.type == 'warehouse_to_shop' ? Icons.store : Icons.warehouse,
                                color: _statusColor(t.status),
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${t.fromName} → ${t.toName}',
                                      style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk, fontSize: 14)),
                                  const SizedBox(height: 2),
                                  Text('${t.productName}  |  Qty: ${t.quantity}',
                                      style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                                  Text(t.createdAt,
                                      style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: _statusColor(t.status).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(t.status.toUpperCase(),
                                  style: GoogleFonts.outfit(
                                      fontSize: 11, fontWeight: FontWeight.w600, color: _statusColor(t.status))),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      {'label': 'All', 'value': ''},
      {'label': 'Pending', 'value': 'pending'},
      {'label': 'Completed', 'value': 'completed'},
      {'label': 'Rejected', 'value': 'rejected'},
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: filters.map((f) {
          final selected = _filterStatus == f['value'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(f['label']!, style: GoogleFonts.outfit(
                  fontSize: 13, fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  color: selected ? Colors.white : _kSlate)),
              selected: selected,
              selectedColor: _kBlue,
              backgroundColor: Colors.white,
              side: BorderSide(color: selected ? _kBlue : _kBorder),
              onSelected: (_) => setState(() => _filterStatus = f['value']!),
            ),
          );
        }).toList(),
      ),
    );
  }
}
