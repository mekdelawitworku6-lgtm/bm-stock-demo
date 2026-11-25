import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/transfer/transfer_bloc.dart';
import '../../core/bloc/branch/branch_bloc.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_response.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/refreshable_scroll.dart';
import '../../core/providers/dashboard_provider.dart';
import '../transfer/transfer_detail_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class TransferRequestScreen extends StatefulWidget {
  const TransferRequestScreen({super.key});

  @override
  State<TransferRequestScreen> createState() => _TransferRequestScreenState();
}

class _TransferRequestScreenState extends State<TransferRequestScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  String? _companyId(BuildContext context) {
    final companyState = context.read<CompanyBloc>().state;
    return companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
  }

  void _loadPageData() {
    if (!mounted) return;
    final companyId = _companyId(context);
    context.read<BranchBloc>().add(BranchesLoadRequested(companyId: companyId));
    context.read<TransferBloc>().add(const TransfersLoadRequested(status: 'pending', limit: 50));
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadPageData());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<CompanyBloc, CompanyState>(
      listenWhen: (prev, next) {
        if (prev is CompanyLoaded && next is CompanyLoaded) {
          return prev.selectedCompany?.id != next.selectedCompany?.id;
        }
        return next is CompanyLoaded;
      },
      listener: (context, state) => _loadPageData(),
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
          context.tr('transfer_request'),
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.history, color: _kInk),
            tooltip: context.tr('transfer_history'),
            onPressed: () => Navigator.pushNamed(context, '/transfer_history'),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: _kBlue,
          unselectedLabelColor: _kSlate,
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 14),
          unselectedLabelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w500, fontSize: 14),
          indicatorColor: _kBlue,
          indicatorWeight: 2.5,
          tabs: [
            Tab(text: context.tr('create_transfer')),
            Tab(text: context.tr('pending')),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _CreateTransferTab(),
          _PendingTransfersTab(),
        ],
      ),
      ),
    );
  }
}

class _CreateTransferTab extends StatefulWidget {
  const _CreateTransferTab();

  @override
  State<_CreateTransferTab> createState() => _CreateTransferTabState();
}

class _CreateTransferTabState extends State<_CreateTransferTab> {
  static const _warehouseToShop = 'warehouse_to_shop';
  static const _shopToWarehouse = 'shop_to_warehouse';

  String _transferType = _warehouseToShop;
  String? _fromId;
  String? _toId;
  String? _selectedProductId;
  int _quantity = 1;
  final _quantityController = TextEditingController(text: '1');
  final _noteController = TextEditingController();
  bool _isSubmitting = false;
  bool _loadingProducts = false;
  List<Map<String, dynamic>> _sourceProducts = [];

  @override
  void dispose() {
    _quantityController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _onTypeChanged(String type) {
    setState(() {
      _transferType = type;
      _fromId = null;
      _toId = null;
      _selectedProductId = null;
      _quantity = 1;
      _quantityController.text = '1';
      _sourceProducts = [];
    });
  }

  Future<void> _loadSourceProducts() async {
    if (_fromId == null) {
      setState(() {
        _sourceProducts = [];
        _selectedProductId = null;
      });
      return;
    }

    setState(() => _loadingProducts = true);
    try {
      final api = ApiClient();
      final path = _transferType == _warehouseToShop
          ? '/warehouses/$_fromId/with-products'
          : '/shops/$_fromId/with-products';
      final result = await api.get(path);
      final products = parseApiList(result).where((p) {
        final id = p['id']?.toString();
        final stock = p['stockQuantity'];
        final qty = stock is int ? stock : int.tryParse('$stock') ?? 0;
        return id != null && id.isNotEmpty && qty > 0;
      }).toList();
      if (!mounted) return;
      setState(() {
        _sourceProducts = products;
        _selectedProductId = null;
        _quantity = 1;
        _quantityController.text = '1';
        _loadingProducts = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _sourceProducts = [];
          _loadingProducts = false;
        });
        showAppToast(context, e.toString().replaceFirst('Exception: ', ''), type: AppToastType.error);
      }
    }
  }

  Map<String, dynamic>? get _selectedProduct {
    if (_selectedProductId == null) return null;
    for (final product in _sourceProducts) {
      if (product['id']?.toString() == _selectedProductId) return product;
    }
    return null;
  }

  int get _maxQuantity {
    final product = _selectedProduct;
    if (product == null) return 1;
    final qty = product['stockQuantity'];
    if (qty is int) return qty > 0 ? qty : 1;
    return int.tryParse('$qty') ?? 1;
  }

  Map<String, dynamic> _buildPayload() {
    final payload = <String, dynamic>{
      'type': _transferType,
      'productId': _selectedProductId,
      'quantity': _quantity,
    };
    if (_noteController.text.trim().isNotEmpty) {
      payload['note'] = _noteController.text.trim();
    }
    if (_transferType == _warehouseToShop) {
      payload['fromWarehouseId'] = _fromId;
      payload['toShopId'] = _toId;
    } else {
      payload['fromShopId'] = _fromId;
      payload['toWarehouseId'] = _toId;
    }
    return payload;
  }

  void _submit() {
    if (_fromId == null) {
      showAppToast(
        context,
        _transferType == _warehouseToShop
            ? context.tr('select_warehouse')
            : context.tr('select_shop'),
        type: AppToastType.error,
      );
      return;
    }
    if (_toId == null) {
      showAppToast(
        context,
        _transferType == _warehouseToShop
            ? context.tr('select_shop')
            : context.tr('select_warehouse'),
        type: AppToastType.error,
      );
      return;
    }
    if (_selectedProductId == null) {
      showAppToast(context, context.tr('select_product'), type: AppToastType.error);
      return;
    }
    final parsedQty = int.tryParse(_quantityController.text.trim()) ?? _quantity;
    _quantity = parsedQty;
    if (_quantity < 1) {
      showAppToast(context, context.tr('transfer_quantity'), type: AppToastType.error);
      return;
    }
    if (_quantity > _maxQuantity) {
      showAppToast(context, context.tr('insufficient_stock'), type: AppToastType.error);
      return;
    }

    setState(() => _isSubmitting = true);
    context.read<TransferBloc>().add(TransferCreateRequested(data: _buildPayload()));
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<TransferBloc, TransferState>(
      listener: (context, state) {
        if (!_isSubmitting) return;
        if (state.isLoading) return;

        if (state.lastActionSuccess == true) {
          final companyState = context.read<CompanyBloc>().state;
          final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
          final completed = state.lastCreatedTransferStatus == 'completed';
          showAppToast(
            context,
            completed
                ? context.tr('transfer_completed_successfully')
                : context.tr('transfer_created_successfully'),
            type: AppToastType.success,
          );
          setState(() {
            _isSubmitting = false;
            _fromId = null;
            _toId = null;
            _selectedProductId = null;
            _quantity = 1;
            _quantityController.text = '1';
            _sourceProducts = [];
            _noteController.clear();
          });
          context.read<BranchBloc>().add(BranchesLoadRequested(companyId: companyId));
          context.read<TransferBloc>().add(const TransfersLoadRequested(status: 'pending', limit: 50));
          context.read<DashboardProvider>().loadDashboard(companyId: companyId);
          context.read<TransferBloc>().add(TransferActionAcknowledged());
        } else if (state.error != null) {
          showAppToast(context, state.error!, type: AppToastType.error);
          setState(() => _isSubmitting = false);
          context.read<TransferBloc>().add(TransferActionAcknowledged());
        }
      },
      child: BlocBuilder<BranchBloc, BranchState>(
        builder: (context, branchState) {
          final warehouses = branchState.warehouses;
          final shops = branchState.shops;
          final fromItems = (_transferType == _warehouseToShop
                  ? warehouses.map((b) => (id: b.id, name: b.name))
                  : shops.map((b) => (id: b.id, name: b.name)))
              .toList();
          final toItems = (_transferType == _warehouseToShop
                  ? shops.map((b) => (id: b.id, name: b.name))
                  : warehouses.map((b) => (id: b.id, name: b.name)))
              .toList();
          final fromLabel = _transferType == _warehouseToShop
              ? context.tr('from_warehouse')
              : context.tr('shop');
          final toLabel = _transferType == _warehouseToShop
              ? context.tr('shop')
              : context.tr('to_warehouse');

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _segmentedTypePicker(context),
              const SizedBox(height: 16),
              _locationDropdown(
                label: fromLabel,
                value: _fromId,
                items: fromItems,
                onChanged: (val) {
                  setState(() {
                    _fromId = val;
                    _selectedProductId = null;
                    _quantity = 1;
                  });
                  _loadSourceProducts();
                },
              ),
              const SizedBox(height: 16),
              _locationDropdown(
                label: toLabel,
                value: _toId,
                items: toItems,
                onChanged: (val) => setState(() => _toId = val),
              ),
              const SizedBox(height: 16),
              if (_loadingProducts)
                const Center(child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(color: _kBlue),
                ))
              else if (_fromId != null && _sourceProducts.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    context.tr('no_products_found'),
                    style: GoogleFonts.outfit(color: _kSlate),
                  ),
                )
              else ...[
                _productDropdown(context),
                if (_selectedProductId != null) ...[
                  const SizedBox(height: 12),
                  _availableQtyCard(context),
                  const SizedBox(height: 12),
                  _quantityControl(context),
                ],
              ],
              const SizedBox(height: 16),
              TextField(
                controller: _noteController,
                maxLines: 3,
                style: GoogleFonts.outfit(fontSize: 14),
                decoration: _inputDecoration(context.tr('notes')),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isSubmitting ||
                        _fromId == null ||
                        _toId == null ||
                        _selectedProductId == null
                    ? null
                    : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kBlue,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(
                        context.tr('create_transfer'),
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _segmentedTypePicker(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: _typeChip(
              label: '${context.tr('from_warehouse')} → ${context.tr('shop')}',
              selected: _transferType == _warehouseToShop,
              onTap: () => _onTypeChanged(_warehouseToShop),
            ),
          ),
          Expanded(
            child: _typeChip(
              label: '${context.tr('shop')} → ${context.tr('to_warehouse')}',
              selected: _transferType == _shopToWarehouse,
              onTap: () => _onTypeChanged(_shopToWarehouse),
            ),
          ),
        ],
      ),
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
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: selected ? _kBlue.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? _kBlue : _kSlate,
          ),
        ),
      ),
    );
  }

  Widget _productDropdown(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: _selectedProductId,
      decoration: _inputDecoration(context.tr('products')),
      items: _sourceProducts.map((p) {
        final id = p['id']?.toString();
        if (id == null || id.isEmpty) return null;
        final stock = p['stockQuantity'] ?? 0;
        return DropdownMenuItem<String>(
          value: id,
          child: Text(
            '${p['name'] ?? ''} (${context.tr('stock')}: $stock)',
            style: GoogleFonts.outfit(fontSize: 14),
          ),
        );
      }).whereType<DropdownMenuItem<String>>().toList(),
      onChanged: _fromId == null
          ? null
          : (val) => setState(() {
                _selectedProductId = val;
                _quantity = 1;
              }),
    );
  }

  Widget _availableQtyCard(BuildContext context) {
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
          Text(
            '$_maxQuantity',
            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk, fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _quantityControl(BuildContext context) {
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
                icon: const Icon(Icons.remove_circle_outline, color: _kBlue, size: 28),
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
                      if (parsed > _maxQuantity) {
                        setState(() => _quantity = _maxQuantity);
                        _quantityController.text = '$_maxQuantity';
                        _quantityController.selection = TextSelection.collapsed(offset: _quantityController.text.length);
                      } else {
                        setState(() => _quantity = parsed);
                      }
                    }
                  },
                ),
              ),
              IconButton(
                onPressed: _quantity < _maxQuantity
                    ? () {
                        setState(() {
                          _quantity++;
                          _quantityController.text = '$_quantity';
                        });
                      }
                    : null,
                icon: const Icon(Icons.add_circle_outline, color: _kBlue, size: 28),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PendingTransfersTab extends StatefulWidget {
  const _PendingTransfersTab();

  @override
  State<_PendingTransfersTab> createState() => _PendingTransfersTabState();
}

class _PendingTransfersTabState extends State<_PendingTransfersTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TransferBloc>().add(const TransfersLoadRequested(status: 'pending', limit: 50));
    });
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed':
        return _kGreen;
      case 'pending':
        return _kAmber;
      case 'rejected':
        return _kRed;
      default:
        return _kSlate;
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<TransferBloc, TransferState>(
      builder: (context, state) {
        Future<void> onRefresh() async {
          context.read<TransferBloc>().add(const TransfersLoadRequested(status: 'pending', limit: 50));
          await context.read<TransferBloc>().stream.firstWhere((s) => !s.isLoading);
        }

        if (state.isLoading && state.transfers.isEmpty) {
          return const Center(child: CircularProgressIndicator(color: _kBlue));
        }

        if (state.error != null && state.transfers.isEmpty) {
          return RefreshIndicator(
            onRefresh: onRefresh,
            child: refreshableScrollChild(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    state.error!,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(color: _kRed),
                  ),
                ),
              ),
            ),
          );
        }

        final pending = state.transfers.where((t) => t.status == 'pending').toList();

        if (pending.isEmpty) {
          return RefreshIndicator(
            onRefresh: onRefresh,
            child: refreshableScrollChild(
              child: Center(
                child: Text(
                  context.tr('no_transfers_found'),
                  style: GoogleFonts.outfit(color: _kSlate),
                ),
              ),
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView.builder(
            physics: refreshScrollPhysics,
            padding: const EdgeInsets.all(16),
            itemCount: pending.length,
            itemBuilder: (_, i) {
              final t = pending[i];
              return GestureDetector(
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TransferDetailScreen(transferId: t.id),
                    ),
                  );
                  if (context.mounted) {
                    context.read<TransferBloc>().add(const TransfersLoadRequested(status: 'pending', limit: 50));
                  }
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
                          color: _statusColor(t.status).withValues(alpha: 0.1),
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
                            Text(
                              '${t.fromName} → ${t.toName}',
                              style: GoogleFonts.outfit(
                                fontWeight: FontWeight.w600,
                                color: _kInk,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${t.productName}  |  Qty: ${t.quantity}',
                              style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                            ),
                            Text(t.createdAt, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: _statusColor(t.status).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          t.status.toUpperCase(),
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _statusColor(t.status),
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.chevron_right, size: 18, color: _kSlate.withValues(alpha: 0.6)),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

Widget _locationDropdown({
  required String label,
  required String? value,
  required List<({String id, String name})> items,
  required ValueChanged<String?> onChanged,
}) {
  final selectedValue = items.any((item) => item.id == value) ? value : null;
  return DropdownButtonFormField<String>(
    initialValue: selectedValue,
    decoration: InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 14),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _kBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _kBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _kBlue, width: 1.5),
      ),
    ),
    items: items
        .map<DropdownMenuItem<String>>((b) => DropdownMenuItem(
              value: b.id,
              child: Text(b.name, style: GoogleFonts.outfit(fontSize: 14)),
            ))
        .toList(),
    onChanged: onChanged,
  );
}

InputDecoration _inputDecoration(String hint) {
  return InputDecoration(
    hintText: hint,
    hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _kBorder),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _kBorder),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _kBlue, width: 1.5),
    ),
  );
}
