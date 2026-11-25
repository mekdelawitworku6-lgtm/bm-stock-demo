import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/transfer/transfer_bloc.dart';
import '../../core/services/transfer_service.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class TransferDetailScreen extends StatefulWidget {
  final String transferId;
  const TransferDetailScreen({super.key, required this.transferId});

  @override
  State<TransferDetailScreen> createState() => _TransferDetailScreenState();
}

class _TransferDetailScreenState extends State<TransferDetailScreen> {
  final TransferService _service = TransferService();
  bool _loading = true;
  bool _actionPending = false;
  Map<String, dynamic>? _transfer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final t = await _service.getById(widget.transferId);
      if (mounted) {
        setState(() {
          _transfer = {
            'id': t.id, 'type': t.type, 'status': t.status, 'quantity': t.quantity,
            'note': t.note, 'rejectionReason': t.rejectionReason,
            'productName': t.productName, 'productSku': t.productSku,
            'fromName': t.fromName, 'toName': t.toName,
            'requestedByName': t.requestedByName, 'approvedByName': t.approvedByName,
            'createdAt': t.createdAt,
          };
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _canManageTransfer(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    if (authState is! AuthAuthenticated) return false;
    final role = authState.user.role;
    return authState.user.isAdmin || role == 'manager';
  }

  void _approve() {
    setState(() => _actionPending = true);
    context.read<TransferBloc>().add(TransferApproveRequested(id: widget.transferId));
  }

  Future<void> _reject() async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('reject'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: TextField(
          controller: reasonController,
          maxLines: 3,
          decoration: InputDecoration(hintText: context.tr('rejection_reason')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(context.tr('cancel'))),
          TextButton(
            onPressed: () => Navigator.pop(ctx, reasonController.text.trim()),
            child: Text(context.tr('reject'), style: const TextStyle(color: _kRed)),
          ),
        ],
      ),
    );
    reasonController.dispose();
    if (!mounted || reason == null) return;

    setState(() => _actionPending = true);
    context.read<TransferBloc>().add(
          TransferRejectRequested(
            id: widget.transferId,
            reason: reason.isEmpty ? null : reason,
          ),
        );
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
    final canManage = _canManageTransfer(context);

    return BlocListener<TransferBloc, TransferState>(
      listener: (context, state) {
        if (!_actionPending || state.isLoading) return;

        if (state.lastActionSuccess == true) {
          showAppToast(context, context.tr('transfer_success'), type: AppToastType.success);
          context.read<TransferBloc>().add(TransferActionAcknowledged());
          Navigator.pop(context, true);
        } else if (state.error != null) {
          showAppToast(context, state.error!, type: AppToastType.error);
          if (mounted) setState(() => _actionPending = false);
          context.read<TransferBloc>().add(TransferActionAcknowledged());
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
        title: Text(context.tr('transfer_detail'),
            style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kBlue))
          : _transfer == null
              ? Center(child: Text(context.tr('transfer_not_found'), style: GoogleFonts.outfit(color: _kSlate)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildStatusBanner(),
                    const SizedBox(height: 16),
                    _buildInfoCard(),
                    const SizedBox(height: 16),
                    _buildDetailsCard(),
                    if (_transfer!['rejectionReason'] != null) ...[
                      const SizedBox(height: 12),
                      _buildRejectionCard(),
                    ],
                    if (_transfer!['status'] == 'pending' && canManage) ...[
                      const SizedBox(height: 24),
                      _buildActionButtons(),
                    ],
                  ],
                ),
    ),
    );
  }

  Widget _buildStatusBanner() {
    final status = _transfer!['status'] ?? '';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _statusColor(status).withOpacity(0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _statusColor(status).withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(_statusIcon(status), color: _statusColor(status), size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(status.toUpperCase(),
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _statusColor(status), fontSize: 16)),
                Text(_transfer!['createdAt'] ?? '',
                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'completed': return Icons.check_circle;
      case 'pending': return Icons.hourglass_empty;
      case 'rejected': return Icons.cancel;
      default: return Icons.info;
    }
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        children: [
          _row('Product', _transfer!['productName'] ?? ''),
          _row('SKU', _transfer!['productSku'] ?? ''),
          _row('Quantity', '${_transfer!['quantity']}'),
          _row('From', _transfer!['fromName'] ?? ''),
          _row('To', _transfer!['toName'] ?? ''),
          if (_transfer!['note'] != null && (_transfer!['note'] as String).isNotEmpty)
            _row('Note', _transfer!['note']),
        ],
      ),
    );
  }

  Widget _buildDetailsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        children: [
          _row('Requested By', _transfer!['requestedByName'] ?? ''),
          if (_transfer!['approvedByName'] != null)
            _row('Approved By', _transfer!['approvedByName']),
        ],
      ),
    );
  }

  Widget _buildRejectionCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kRed.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.tr('rejection_reason'),
              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kRed)),
          const SizedBox(height: 6),
          Text(_transfer!['rejectionReason'] ?? '',
              style: GoogleFonts.outfit(color: _kInk)),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton(
            onPressed: _actionPending ? null : _approve,
            style: ElevatedButton.styleFrom(
              backgroundColor: _kGreen,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(context.tr('approve'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton(
            onPressed: _actionPending ? null : _reject,
            style: ElevatedButton.styleFrom(
              backgroundColor: _kRed,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(context.tr('reject'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
          Flexible(
            child: Text(value, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                textAlign: TextAlign.end),
          ),
        ],
      ),
    );
  }
}
