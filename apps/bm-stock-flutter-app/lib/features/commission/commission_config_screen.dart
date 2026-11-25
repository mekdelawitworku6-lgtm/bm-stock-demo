import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/employee_model.dart';
import '../../core/models/product_model.dart';
import '../../core/services/employee_service.dart';
import '../../core/services/product_service.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class CommissionConfigScreen extends StatefulWidget {
  const CommissionConfigScreen({super.key});

  @override
  State<CommissionConfigScreen> createState() => _CommissionConfigScreenState();
}

class _CommissionConfigScreenState extends State<CommissionConfigScreen> {
  final _productService = ProductService();
  final _employeeService = EmployeeService();

  bool _loading = true;
  bool _error = false;
  int _tabIndex = 0;

  List<ProductModel> _products = [];
  List<EmployeeModel> _employees = [];

  final Map<String, TextEditingController> _productControllers = {};
  final Map<String, TextEditingController> _employeeControllers = {};
  final Map<String, String> _productTypes = {};
  final Map<String, String> _employeeTypes = {};
  final Map<String, double> _baseRates = {};
  final Map<String, String> _baseTypes = {};
  bool _savingAll = false;

  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _productControllers.values) {
      c.dispose();
    }
    for (final c in _employeeControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final results = await Future.wait([
        _productService.getAll(limit: 100),
        _employeeService.getAll(),
      ]);
      final products = results[0] as List<ProductModel>;
      final employees = results[1] as List<EmployeeModel>;
      if (!mounted) return;
      setState(() {
        _products = products;
        _employees = employees;
        _baseRates
          ..clear()
          ..addEntries(products.map((p) => MapEntry('p:${p.id}', p.commissionRate)))
          ..addEntries(employees.map((e) => MapEntry('e:${e.id}', e.baseCommissionRate)));
        _baseTypes
          ..clear()
          ..addEntries(products.map((p) => MapEntry('p:${p.id}', p.commissionType.isNotEmpty ? p.commissionType : ((p.metadata['commissionType']?.toString()) ?? 'percent'))))
          ..addEntries(employees.map((e) => MapEntry('e:${e.id}', e.baseCommissionType.isNotEmpty ? e.baseCommissionType : ((e.permissions?['baseCommissionType']?.toString()) ?? 'percent'))));
        for (final p in products) {
          _productTypes[p.id] = _baseTypes['p:${p.id}'] ?? 'percent';
        }
        for (final e in employees) {
          _employeeTypes[e.id] = _baseTypes['e:${e.id}'] ?? 'percent';
        }
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  double? _parseRate(String? raw) {
    if (raw == null) return null;
    final cleaned = raw.trim().replaceAll(',', '.');
    if (cleaned.isEmpty) return 0.0;
    return double.tryParse(cleaned);
  }

  TextEditingController _controllerFor(Map<String, TextEditingController> map, String id, String initial) {
    return map.putIfAbsent(id, () => TextEditingController(text: initial));
  }

  List<ProductModel> get _filteredProducts {
    if (_query.isEmpty) return _products;
    final q = _query.toLowerCase();
    return _products
        .where((p) =>
            p.name.toLowerCase().contains(q) ||
            p.sku.toLowerCase().contains(q))
        .toList();
  }

  List<EmployeeModel> get _filteredEmployees {
    final list = _employees.where((e) => !e.isOwner).toList();
    if (_query.isEmpty) return list;
    final q = _query.toLowerCase();
    return list
        .where((e) =>
            e.name.toLowerCase().contains(q) ||
            (e.jobTitle?.toLowerCase().contains(q) ?? false))
        .toList();
  }

  int get _dirtyCount {
    var count = 0;
    for (final p in _products) {
      final controller = _productControllers[p.id];
      final type = _productTypes[p.id] ?? 'percent';
      if (controller == null) continue;
      final rate = _parseRate(controller.text);
      final baseRate = _baseRates['p:${p.id}'] ?? p.commissionRate;
      final baseType = _baseTypes['p:${p.id}'] ?? (p.commissionType.isNotEmpty ? p.commissionType : 'percent');
      if (rate != null && (rate != baseRate || type != baseType)) {
        count++;
      }
    }
    for (final e in _employees) {
      final controller = _employeeControllers[e.id];
      final type = _employeeTypes[e.id] ?? 'percent';
      if (controller == null) continue;
      final rate = _parseRate(controller.text);
      final baseRate = _baseRates['e:${e.id}'] ?? e.baseCommissionRate;
      final baseType = _baseTypes['e:${e.id}'] ?? e.baseCommissionType;
      if (rate != null && (rate != baseRate || type != baseType)) {
        count++;
      }
    }
    return count;
  }

  Future<void> _saveAll() async {
    final updated = <String, Map<String, dynamic>>{};
    for (final p in _products) {
      final controller = _productControllers[p.id];
      final type = _productTypes[p.id] ?? (p.commissionType.isNotEmpty ? p.commissionType : 'percent');
      if (controller == null) continue;
      final rate = _parseRate(controller.text);
      if (rate == null || rate < 0) {
        showAppToast(context, context.tr('invalid_number'), type: AppToastType.error);
        return;
      }
      if (type == 'percent' && rate > 100) {
        showAppToast(
          context,
          '${context.tr('commission_percent_max')}: ${p.name} ($rate%)',
          type: AppToastType.error,
        );
        return;
      }
      if (type == 'fixed' && p.price > 0 && rate > p.price) {
        showAppToast(
          context,
          context.tr('commission_fixed_max_product')
              .replaceAll('{name}', p.name)
              .replaceAll('{price}', _formatRate(p.price)),
          type: AppToastType.error,
        );
        return;
      }
      final baseRate = _baseRates['p:${p.id}'] ?? p.commissionRate;
      final baseType = _baseTypes['p:${p.id}'] ?? (p.commissionType.isNotEmpty ? p.commissionType : 'percent');
      if (rate != baseRate || type != baseType) {
        updated['p:${p.id}'] = {'commissionRate': rate, 'commissionType': type};
      }
    }
    for (final e in _employees) {
      final controller = _employeeControllers[e.id];
      final type = _employeeTypes[e.id] ?? e.baseCommissionType;
      if (controller == null) continue;
      final rate = _parseRate(controller.text);
      if (rate == null || rate < 0) {
        showAppToast(context, context.tr('invalid_number'), type: AppToastType.error);
        return;
      }
      if (type == 'percent' && rate > 100) {
        showAppToast(
          context,
          '${context.tr('commission_percent_max')}: ${e.name} ($rate%)',
          type: AppToastType.error,
        );
        return;
      }
      final baseRate = _baseRates['e:${e.id}'] ?? e.baseCommissionRate;
      final baseType = _baseTypes['e:${e.id}'] ?? e.baseCommissionType;
      if (rate != baseRate || type != baseType) {
        updated['e:${e.id}'] = {
          'baseCommissionRate': rate,
          'baseCommissionType': type,
          'permissions': {
            ...(e.permissions ?? {}),
            'baseCommissionType': type,
          },
        };
      }
    }
    if (updated.isEmpty) {
      showAppToast(context, context.tr('no_changes_to_save'), type: AppToastType.info);
      return;
    }
    setState(() => _savingAll = true);
    var successCount = 0;
    String? lastError;
    for (final entry in updated.entries) {
      final key = entry.key;
      final payload = entry.value;
      try {
        if (key.startsWith('p:')) {
          await _productService.update(key.substring(2), payload);
        } else {
          await _employeeService.update(key.substring(2), payload);
        }
        _baseRates[key] = ((payload['commissionRate'] ?? payload['baseCommissionRate']) as num).toDouble();
        _baseTypes[key] = (payload['commissionType'] ?? payload['baseCommissionType']) as String;
        successCount++;
      } catch (e) {
        lastError = e.toString();
        debugPrint('[CommissionConfig] Error updating $key: $e');
      }
    }
    if (!mounted) return;
    setState(() => _savingAll = false);
    if (successCount == updated.length) {
      showAppToast(context, context.tr('save'), type: AppToastType.success);
    } else if (successCount > 0) {
      showAppToast(context, '${context.tr('save')} ($successCount/${updated.length})', type: AppToastType.info);
    } else {
      showAppToast(
        context,
        lastError != null ? '${context.tr('failed')}: $lastError' : context.tr('failed'),
        type: AppToastType.error,
      );
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
        title: Text(
          context.tr('commission_config'),
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kBlue))
          : _error
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.cloud_off_outlined, size: 48, color: _kSlate.withValues(alpha: 0.5)),
                      const SizedBox(height: 12),
                      Text(context.tr('failed'), style: GoogleFonts.outfit(color: _kSlate)),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: _load,
                        child: Text(context.tr('retry'),
                            style: GoogleFonts.outfit(color: _kBlue, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    _buildTabToggle(),
                    _buildSearchField(),
                    Expanded(child: _buildContent()),
                  ],
                ),
      bottomNavigationBar: _loading || _error ? null : _buildBottomBar(),
    );
  }

  Widget _buildBottomBar() {
    final count = _dirtyCount;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _kBorder)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _savingAll ? null : _saveAll,
              icon: _savingAll
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.save_rounded, size: 18),
              label: Text(
                count > 0 ? '${context.tr('save')} ($count)' : context.tr('save'),
                style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _kBlue,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabToggle() {
    final tabs = [
      (context.tr('products'), Icons.inventory_2_outlined),
      (context.tr('staff'), Icons.people_outline),
    ];
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: tabs.asMap().entries.map((entry) {
          final i = entry.key;
          final tab = entry.value;
          final isSelected = _tabIndex == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _tabIndex = i),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? _kBlue : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(tab.$2, size: 16, color: isSelected ? Colors.white : _kSlate),
                    const SizedBox(width: 6),
                    Text(
                      tab.$1,
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isSelected ? Colors.white : _kSlate,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSearchField() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: TextField(
        onChanged: (v) => setState(() => _query = v.trim()),
        style: GoogleFonts.outfit(fontSize: 14),
        decoration: InputDecoration(
          hintText: context.tr('search'),
          hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
          prefixIcon: const Icon(Icons.search, color: _kSlate, size: 20),
          suffixIcon: _query.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, color: _kSlate, size: 18),
                  onPressed: () => setState(() => _query = ''),
                )
              : null,
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _kBlue, width: 1.5),
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_tabIndex == 0) {
      final items = _filteredProducts;
      if (items.isEmpty) {
        return Center(
          child: Text(
            context.tr('no_results_found'),
            style: GoogleFonts.outfit(fontSize: 14, color: _kSlate),
          ),
        );
      }
      return ListView.builder(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        itemCount: items.length,
        itemBuilder: (_, i) => _buildProductRow(items[i]),
      );
    }
    final staff = _filteredEmployees;
    if (staff.isEmpty) {
      return Center(
        child: Text(
          context.tr('no_results_found'),
          style: GoogleFonts.outfit(fontSize: 14, color: _kSlate),
        ),
      );
    }
    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      itemCount: staff.length,
      itemBuilder: (_, i) => _buildEmployeeRow(staff[i]),
    );
  }

  String _formatRate(double rate) {
    return rate % 1 == 0 ? rate.toInt().toString() : rate.toString();
  }

  Widget _buildProductRow(ProductModel product) {
    final controller =
        _controllerFor(_productControllers, product.id, _formatRate(product.commissionRate));
    final type = _productTypes[product.id] ?? 'percent';
    return _rowCard(
      title: product.name,
      subtitle: product.sku.isNotEmpty ? 'SKU: ${product.sku}' : null,
      controller: controller,
      commissionType: type,
      onChanged: (_) => setState(() {}),
      onTypeChanged: (t) => setState(() => _productTypes[product.id] = t),
    );
  }

  Widget _buildEmployeeRow(EmployeeModel employee) {
    final controller =
        _controllerFor(_employeeControllers, employee.id, _formatRate(employee.baseCommissionRate));
    final type = _employeeTypes[employee.id] ?? 'percent';
    return _rowCard(
      title: employee.name,
      subtitle: employee.jobTitle != null && employee.jobTitle!.isNotEmpty
          ? employee.jobTitle
          : null,
      controller: controller,
      commissionType: type,
      onChanged: (_) => setState(() {}),
      onTypeChanged: (t) => setState(() => _employeeTypes[employee.id] = t),
    );
  }

  Widget _rowCard({
    required String title,
    String? subtitle,
    required TextEditingController controller,
    required String commissionType,
    required ValueChanged<String> onChanged,
    required ValueChanged<String> onTypeChanged,
  }) {
    final isPercent = commissionType == 'percent';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
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
                Text(
                  title,
                  style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Commission type toggle
          Container(
            decoration: BoxDecoration(
              color: _kBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _kBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _typeToggleButton(
                  label: '%',
                  isActive: isPercent,
                  onTap: () => onTypeChanged('percent'),
                  isLeft: true,
                ),
                _typeToggleButton(
                  label: 'ETB',
                  isActive: !isPercent,
                  onTap: () => onTypeChanged('fixed'),
                  isLeft: false,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 90,
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                suffixText: isPercent ? '%' : 'ETB',
                suffixStyle: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                filled: true,
                fillColor: _kBg,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _typeToggleButton({
    required String label,
    required bool isActive,
    required VoidCallback onTap,
    required bool isLeft,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? _kBlue : Colors.transparent,
          borderRadius: BorderRadius.horizontal(
            left: isLeft ? const Radius.circular(7) : Radius.zero,
            right: !isLeft ? const Radius.circular(7) : Radius.zero,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isActive ? Colors.white : _kSlate,
          ),
        ),
      ),
    );
  }
}
