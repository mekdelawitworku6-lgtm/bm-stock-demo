import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/localization/app_localizations.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class RequestMoreCompaniesScreen extends StatefulWidget {
  const RequestMoreCompaniesScreen({super.key});

  @override
  State<RequestMoreCompaniesScreen> createState() => _RequestMoreCompaniesScreenState();
}

class _RequestMoreCompaniesScreenState extends State<RequestMoreCompaniesScreen> {
  final List<TextEditingController> _nameControllers = [TextEditingController()];
  List<Map<String, dynamic>> _plans = [];
  bool _loadingPlans = true;
  bool _submitting = false;
  String? _selectedPlanId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  @override
  void dispose() {
    for (final controller in _nameControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  int? get _currentAllowance {
    final authState = context.read<AuthBloc>().state;
    return authState is AuthAuthenticated ? authState.user.numCompanies : null;
  }

  Future<void> _loadPlans() async {
    try {
      final data = await ApiClient().get('/plans');
      final list = (data is List ? data : []).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _plans = list
            .map((p) => {
                  'id': p['id'] ?? p['period'] ?? '',
                  'title': p['title'] ?? '',
                  'price': p['price'] ?? '0',
                  'amount': (p['amount'] as num?)?.toInt() ?? 0,
                  'features': (p['features'] as List?)
                          ?.map((e) => e.toString())
                          .toList() ??
                      <String>[],
                })
            .toList();
        _loadingPlans = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _loadingPlans = false);
      }
    }
  }

  void _addNameField() {
    setState(() {
      _nameControllers.add(TextEditingController());
    });
  }

  void _removeNameField(int index) {
    if (_nameControllers.length <= 1) return;
    setState(() {
      _nameControllers.removeAt(index).dispose();
    });
  }

  Future<void> _submit() async {
    final names = _nameControllers
        .map((controller) => controller.text.trim())
        .where((name) => name.isNotEmpty)
        .toList();

    if (names.isEmpty) {
      setState(() => _error = context.tr('enter_at_least_one_name'));
      return;
    }
    if (_selectedPlanId == null || _selectedPlanId!.isEmpty) {
      setState(() => _error = context.tr('select_a_plan'));
      return;
    }

    setState(() {
      _error = null;
      _submitting = true;
    });

    try {
      await ApiClient().post(
        '/companies/request-limit-upgrade',
        body: {
          'companyNames': names,
          'planId': _selectedPlanId,
        },
      );
      if (!mounted) return;
      setState(() => _submitting = false);

      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          icon: const Icon(Icons.check_circle_outline, color: _kBlue, size: 36),
          title: Text(
            ctx.tr('request_submitted_title'),
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: _kInk,
            ),
          ),
          content: Text(
            ctx.tr('request_submitted_message'),
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              fontSize: 13,
              height: 1.4,
              color: _kSlate,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                ctx.tr('ok'),
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: _kBlue,
                ),
              ),
            ),
          ],
        ),
      );

      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final allowance = _currentAllowance;

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
          context.tr('request_more_companies'),
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _buildInfoCard(allowance),
          const SizedBox(height: 20),
          _buildNamesSection(),
          const SizedBox(height: 24),
          _buildPlanSection(),
          const SizedBox(height: 24),
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Text(
                _error!,
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  color: const Color(0xFFB91C1C),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kBlue,
                foregroundColor: Colors.white,
                elevation: 0,
                disabledBackgroundColor: _kBlue.withValues(alpha: 0.6),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      context.tr('submit_request'),
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildInfoCard(int? allowance) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF025EA7), Color(0xFF024A85)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.apartment_rounded, color: Colors.white, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.tr('request_more_companies_desc'),
                  style: GoogleFonts.outfit(
                    fontSize: 12.5,
                    height: 1.5,
                    color: Colors.white,
                  ),
                ),
                if (allowance != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.25),
                      ),
                    ),
                    child: Text(
                      '${context.tr('current_allowance')}: $allowance',
                      style: GoogleFonts.outfit(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNamesSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('company_names_label'),
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: _kInk,
            ),
          ),
          const SizedBox(height: 12),
          for (int i = 0; i < _nameControllers.length; i++) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: TextField(
                    controller: _nameControllers[i],
                    enabled: !_submitting,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      hintText: context.tr('company_name_hint'),
                      hintStyle: GoogleFonts.outfit(
                        fontSize: 13,
                        color: _kSlate.withValues(alpha: 0.7),
                      ),
                      prefixIcon: const Padding(
                        padding: EdgeInsets.all(12),
                        child: Icon(Icons.business_outlined,
                            color: _kBlue, size: 20),
                      ),
                      filled: true,
                      fillColor: _kBg,
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: _kBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: _kBlue, width: 1.5),
                      ),
                    ),
                  ),
                ),
                if (_nameControllers.length > 1)
                  IconButton(
                    onPressed: _submitting
                        ? null
                        : () => _removeNameField(i),
                    icon: const Icon(Icons.remove_circle_outline,
                        color: Color(0xFFB91C1C)),
                  ),
              ],
            ),
            if (i < _nameControllers.length - 1) const SizedBox(height: 10),
          ],
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _submitting ? null : _addNameField,
              icon: const Icon(Icons.add_circle_outline, color: _kBlue, size: 20),
              label: Text(
                context.tr('add_another_company'),
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _kBlue,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.tr('select_payment_plan'),
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: _kInk,
          ),
        ),
        const SizedBox(height: 12),
        if (_loadingPlans)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: CircularProgressIndicator(color: _kBlue),
            ),
          )
        else if (_plans.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _kBorder),
            ),
            child: Text(
              context.tr('select_a_plan'),
              style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
            ),
          )
        else
          for (final plan in _plans) ...[
            _buildPlanCard(plan),
            const SizedBox(height: 10),
          ],
      ],
    );
  }

  Widget _buildPlanCard(Map<String, dynamic> plan) {
    final id = plan['id'] as String;
    final isSelected = id == _selectedPlanId;
    final features = plan['features'] as List<String>;

    return InkWell(
      onTap: _submitting
          ? null
          : () => setState(() => _selectedPlanId = id),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? _kBlue : _kBorder,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              isSelected
                  ? Icons.radio_button_checked
                  : Icons.radio_button_off,
              color: isSelected ? _kBlue : _kBorder,
              size: 22,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          plan['title'] as String,
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: _kInk,
                          ),
                        ),
                      ),
                      Text(
                        'ETB ${plan['price']}',
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: _kBlue,
                        ),
                      ),
                    ],
                  ),
                  if (features.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    for (final feature in features)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.check_circle_outline,
                                size: 14, color: Color(0xFF16A34A)),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                feature,
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  color: _kSlate,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
