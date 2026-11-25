import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/language_selector.dart';
import '../payment/manual_payment_popup.dart';
import '../auth/auth_widgets.dart';

bool _hasValue(dynamic value) => value?.toString().trim().isNotEmpty == true;

String _optionalDisplayValue(dynamic value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) return 'Not provided';
  return text;
}


String _formatPrice(num value) {
  final text = value.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < text.length; i++) {
    if (i > 0 && (text.length - i) % 3 == 0) buffer.write(',');
    buffer.write(text[i]);
  }
  return buffer.toString();
}

class ChoosePlanScreen extends StatefulWidget {
  const ChoosePlanScreen({super.key});

  @override
  State<ChoosePlanScreen> createState() => _ChoosePlanScreenState();
}

class _ChoosePlanScreenState extends State<ChoosePlanScreen> {
  final PageController _pageController = PageController(viewportFraction: 0.82);
  int _currentPage = 0;
  bool _isSubmitting = false;
  bool _loadingPlans = true;
  List<Map<String, dynamic>> _plans = [];
  int _renewalNumCompanies = 1;
  int _renewalOwnedCompanies = 0;
  bool _loadingRenewalPreview = false;


  static const Color _kNavy = Color(0xFF0F2A47);
  static const Color _kBlue = Color(0xFF1D5C96);

  static const Color _kSlate = Color(0xFF64748B);
  static const Color _kBorder = Color(0xFFCBD5E1);

  static const List<Map<String, dynamic>> _defaultPlans = [
    {
      'id': 'trial',
      'title': 'Free Trial (14 Days)',
      'price': '0',
      'amount': 0,
      'period': 'trial',
      'features': [
        '14-Day Free Trial',
        'Up to 1 store',
        'Up to 1 warehouse',
        'Up to 1 staff account',
        'Single product entry',
        'Basic analytics & reports',
        'Mobile app access only',
        'No credit card required',
      ],
      'moreCount': 0,
    },
    {
      'id': 'small',
      'title': 'Small Business',
      'price': '7,999',
      'amount': 7999,
      'period': 'small',
      'features': [
        'Up to 1 store',
        'Up to 1 warehouse',
        'Up to 1 staff account',
        'Single product entry only',
        'Basic analytics & reports',
        'Mobile app access only',
      ],
      'moreCount': 0,
    },
    {
      'id': 'medium',
      'title': 'Medium Business',
      'price': '10,999',
      'amount': 10999,
      'period': 'medium',
      'features': [
        'Up to 5 stores',
        'Up to 5 shops',
        'Up to 5 staff accounts',
        'Bulk product entry',
        'Advanced analytics & reports',
        'Mobile app access only',
      ],
      'moreCount': 0,
    },
    {
      'id': 'large',
      'title': 'Large Business',
      'price': '15,999',
      'amount': 15999,
      'period': 'large',
      'features': [
        'Unlimited stores',
        'Unlimited shops',
        'Unlimited staff accounts',
        'Bulk product entry',
        'CSV & PDF product importing',
        'Commission management',
        'Product borrowing',
        'Full Web App & Mobile Access',
        'Advanced analytics & custom reports',
        '24/7 priority support',
      ],
      'moreCount': 0,
    },
    {
      'id': 'verification_test',
      'title': 'Verification Test',
      'price': '1',
      'amount': 1,
      'period': 'verification_test',
      'features': [
        'Instant receipt-verified activation',
        'No admin approval required',
        'Up to 1 store',
        'Up to 1 shop',
        'Up to 1 staff account',
      ],
      'moreCount': 0,
    },
  ];

  int _billingCompanyCount(Map<String, dynamic>? regArgs) {
    if (regArgs?['renewal'] == true || regArgs?['upgrade'] == true) {
      return _renewalNumCompanies.clamp(1, 999);
    }
    final fromArgs = regArgs?['numCompanies'];
    if (fromArgs is int && fromArgs > 0) return fromArgs;
    return int.tryParse((regArgs?['numCompanies'] ?? '1').toString()) ?? 1;
  }

  @override
  void initState() {
    super.initState();
    _loadPlans();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRenewalPreview());
  }

  Future<String?> _promptPhoneDialog() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Confirm Phone Number',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Please enter the phone number associated with your business account to complete renewal.',
              style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              keyboardType: TextInputType.phone,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'e.g. 0912345678',
                prefixIcon: const Icon(Icons.phone_outlined, size: 20),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, null),
            child: Text('Cancel', style: GoogleFonts.outfit(color: const Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isNotEmpty) Navigator.pop(ctx, text);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF025EA7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text('Continue', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _loadRenewalPreview() async {
    final regArgs = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final isUpgrade = regArgs?['upgrade'] == true;
    if (regArgs?['renewal'] != true && !isUpgrade) return;

    final fromArgs = regArgs?['numCompanies'];
    if (fromArgs is int && fromArgs > 0) {
      setState(() => _renewalNumCompanies = fromArgs);
    }

    // Upgrades are initiated from an active account, so no renewal preview fetch.
    if (isUpgrade) return;

    var phone = regArgs?['phone']?.toString().trim();
    if (phone == null || phone.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      phone = prefs.getString('auth_phone')?.trim();
      if (phone == null || phone.isEmpty) {
        final userJson = prefs.getString('user');
        if (userJson != null) {
          try {
            final parsed = json.decode(userJson);
            phone = parsed['phone']?.toString().trim();
          } catch (_) {}
        }
      }
    }
    if (phone == null || phone.isEmpty) return;

    setState(() => _loadingRenewalPreview = true);
    try {
      final data = await ApiClient().get(
        '/auth/renewal-preview',
        queryParams: {'phone': phone},
        auth: false,
      );
      if (!mounted) return;
      if (data is Map) {
        setState(() {
          _renewalNumCompanies = (data['numCompanies'] as num?)?.toInt() ?? _renewalNumCompanies;
          _renewalOwnedCompanies = (data['ownedCompanies'] as num?)?.toInt() ?? 0;
          _loadingRenewalPreview = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingRenewalPreview = false);
    }
  }

  Future<void> _loadPlans() async {
    try {
      final data = await ApiClient().get('/plans', auth: false);
      final list = (data is List ? data : []).cast<Map<String, dynamic>>();
      if (list.isNotEmpty && mounted) {
        setState(() {
          _plans = list
              .map((p) => {
                    'id': p['id'] ?? p['period'] ?? '',
                    'title': p['title'] ?? '',
                    'price': p['price'] ?? '0',
                    'amount': (p['amount'] as num?)?.toInt() ?? 0,
                    'period': p['period'] ?? '',
                    'features': (p['features'] as List?)
                            ?.map((e) => e.toString())
                            .toList() ??
                        <String>[],
                    'moreCount': (p['moreCount'] as num?)?.toInt() ?? 0,
                  })
              .toList();
          _loadingPlans = false;
        });
      } else if (mounted) {
        setState(() {
          _plans = List<Map<String, dynamic>>.from(_defaultPlans);
          _loadingPlans = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _plans = List<Map<String, dynamic>>.from(_defaultPlans);
          _loadingPlans = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  int _parseAmount(dynamic val, [String? fallbackPrice]) {
    if (val is num) return val.toInt();
    if (val is String) {
      final parsed = int.tryParse(val.replaceAll(RegExp(r'[^\d]'), ''));
      if (parsed != null) return parsed;
    }
    if (fallbackPrice != null) {
      final parsed = int.tryParse(fallbackPrice.replaceAll(RegExp(r'[^\d]'), ''));
      if (parsed != null) return parsed;
    }
    return 0;
  }

  Future<void> _selectPlanAndPay(Map<String, dynamic> plan, Map<String, dynamic>? regArgs) async {
    if (_isSubmitting) return;

    final planId = (plan['id'] ?? '').toString().toLowerCase();
    final planPeriod = (plan['period'] ?? '').toString().toLowerCase();
    final isTrial = planId.contains('trial') ||
        planPeriod.contains('trial') ||
        planId.contains('free') ||
        plan['amount'] == 0 ||
        plan['price'] == '0';

    if (isTrial) {
      // 14-day Free Trial: NO payment popup!
      await _goToAwaitingApproval(
        plan,
        regArgs,
        paymentRef: 'FREE_TRIAL_${DateTime.now().millisecondsSinceEpoch}',
        paymentMethod: 'Free Trial',
      );
      return;
    }

    final numCompanies = _billingCompanyCount(regArgs);
    final baseAmount = _parseAmount(plan['amount'], plan['price']?.toString());
    final totalAmount = baseAmount * numCompanies;

    final result = await ManualPaymentPopup.show(
      context,
      planTitle: plan['title'] ?? 'Subscription',
      planPrice: totalAmount.toString(),
      amount: totalAmount,
    );

    if (result != null && result.success) {
      final planWithTotal = {...plan, 'amount': totalAmount, 'price': totalAmount.toString()};
      await _goToAwaitingApproval(
        planWithTotal,
        regArgs,
        paymentRef: result.paymentRef,
        paymentMethod: result.paymentMethod,
        paymentScreenshot: result.screenshotUrl,
        receiptUrl: result.receiptUrl,
        initialReceiptVerified: result.receiptVerified,
      );
    }
  }

  Future<void> _goToAwaitingApproval(
    Map<String, dynamic> plan,
    Map<String, dynamic>? regArgs, {
    String? paymentRef,
    String? paymentMethod,
    String? paymentScreenshot,
    String? receiptUrl,
    bool initialReceiptVerified = false,
  }) async {
    if (_isSubmitting) return;
    final refNo = paymentRef ?? 'GS-REG-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}';

    final ownerName = regArgs?['ownerName']?.toString().trim() ?? '';
    final companyNameForOwner = regArgs?['companyName']?.toString().trim() ?? '';
    final nameSource = ownerName.isNotEmpty ? ownerName : companyNameForOwner;
    final nameParts = nameSource.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    final firstName = nameParts.isNotEmpty ? nameParts.first : 'Business';
    final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';
    var phone = regArgs?['phone']?.toString().trim() ?? '';

    if (phone.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      phone = prefs.getString('auth_phone')?.trim() ?? '';
      if (phone.isEmpty) {
        final userJson = prefs.getString('user');
        if (userJson != null) {
          try {
            final parsed = json.decode(userJson);
            phone = parsed['phone']?.toString().trim() ?? '';
          } catch (_) {}
        }
      }
    }

    final isRenewal = regArgs?['renewal'] == true;
    final isUpgrade = regArgs?['upgrade'] == true;

    if ((isRenewal || isUpgrade) && phone.isEmpty) {
      final enteredPhone = await _promptPhoneDialog();
      if (enteredPhone == null || enteredPhone.trim().isEmpty) {
        if (mounted) {
          showAppToast(context, 'Please enter your registered phone number to renew subscription', type: AppToastType.info);
        }
        return;
      }
      phone = enteredPhone.trim();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_phone', phone);
    }

    final cleanPhone = phone.replaceAll(RegExp(r'[^\d]'), '');
    final email = (regArgs?['email']?.toString().trim() ?? '').isNotEmpty
        ? regArgs!['email'].toString()
        : null;
    final password = regArgs?['password'] ?? '1234';
    final companyName = regArgs?['companyName'] ?? '$firstName $lastName\'s Business';
    final numCompanies = (isRenewal || isUpgrade)
        ? _renewalNumCompanies.clamp(1, 999)
        : (regArgs?['numCompanies'] is int
            ? (regArgs!['numCompanies'] as int)
            : (int.tryParse((regArgs?['numCompanies'] ?? '').toString()) ?? 1));

    setState(() => _isSubmitting = true);

    String? regError;

    final parsedPlanAmount = _parseAmount(plan['amount'], plan['price']?.toString());

    // Try receipt auto-verification if receiptUrl is provided
    bool receiptVerified = initialReceiptVerified;
    if (!receiptVerified && receiptUrl != null && receiptUrl.trim().isNotEmpty) {
      try {
        final verifyRes = await ApiClient().post(
          '/receipts/verify',
          body: {
            'bank': (paymentMethod ?? 'cbe').toLowerCase().contains('tele') ? 'telebirr' : 'cbe',
            'link': receiptUrl.trim(),
            'reference': receiptUrl.trim(),
            'receiptUrl': receiptUrl.trim(),
            'phoneNumber': cleanPhone.isNotEmpty ? cleanPhone : null,
          },
          auth: false,
        );
        if (verifyRes is Map) {
          if (verifyRes['alreadyUsed'] == true || verifyRes['status'] == 'already_used') {
            if (mounted) {
              setState(() => _isSubmitting = false);
              showAppToast(
                context,
                verifyRes['message']?.toString() ?? 'This receipt has already been used and cannot be reused.',
                type: AppToastType.error,
              );
            }
            return;
          }
          if (verifyRes['valid'] == true || verifyRes['status'] == 'valid') {
            receiptVerified = true;
          }
        }
      } catch (e) {
        final msg = e.toString();
        if (msg.toLowerCase().contains('already been used') || msg.toLowerCase().contains('already used')) {
          if (mounted) {
            setState(() => _isSubmitting = false);
            showAppToast(
              context,
              'This receipt has already been used and cannot be reused.',
              type: AppToastType.error,
            );
          }
          return;
        }
      }
    }

    try {
      if (isRenewal || isUpgrade) {
        await ApiClient().post(
          '/auth/renew-subscription',
          body: {
            'phone': phone,
            'planId': plan['id'],
            'planTitle': plan['title'],
            'planAmount': parsedPlanAmount,
            'planPeriod': plan['period'] ?? plan['id'],
            'paymentRef': refNo,
            'paymentMethod': paymentMethod ?? 'Telebirr',
            'paymentScreenshot': paymentScreenshot,
            if (receiptUrl != null && receiptUrl.isNotEmpty) 'receiptUrl': receiptUrl,
          },
          auth: false,
        );
      } else {
        // Send registration to backend API to save to DB
        await ApiClient().post(
          '/auth/register',
          body: {
            if (email != null && email.isNotEmpty) 'email': email,
            'password': password,
            'firstName': firstName,
            'lastName': lastName,
            'phone': phone,
            'companyName': companyName,
            'planId': plan['id'],
            'planTitle': plan['title'],
            'planAmount': parsedPlanAmount,
            'planPeriod': plan['period'] ?? plan['id'],
            'numCompanies': numCompanies,
            'paymentRef': refNo,
            'paymentMethod': paymentMethod ?? 'Telebirr',
            'receiptVerified': receiptVerified,
            if (receiptUrl != null && receiptUrl.isNotEmpty) 'receiptUrl': receiptUrl,
            if (paymentScreenshot != null) 'paymentScreenshot': paymentScreenshot,
            if (_hasValue(regArgs?['faydaId'])) 'faydaId': regArgs!['faydaId'],
            if (_hasValue(regArgs?['tinNumber'])) 'tinNumber': regArgs!['tinNumber'],
            if (regArgs?['address'] != null) 'address': regArgs!['address'],
          },
          auth: false,
        );
      }
    } catch (e) {
      regError = e is ApiException ? e.message : 'Connection failed: $e';
      debugPrint('${(isRenewal || isUpgrade) ? 'Renewal' : 'Registration'} call failed: $regError');
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }

    if (regError != null) {
      if (mounted) {
        showAppToast(
          context,
          (isRenewal || isUpgrade)
              ? 'Renewal could not be submitted: $regError'
              : 'Registration could not be submitted: $regError',
          type: AppToastType.error,
        );
      }
      return;
    }

    final isTrial = (plan['id'] ?? '').toString().toLowerCase().contains('trial') ||
        (plan['period'] ?? '').toString().toLowerCase().contains('trial') ||
        plan['amount'] == 0 ||
        plan['price'] == '0';

    if (isTrial) {
      if (mounted) {
        showAppToast(
          context,
          isRenewal || isUpgrade
              ? 'Your 14-day Free Trial is activated!'
              : 'Your 14-day Free Trial is activated! Please sign in to get started.',
          type: AppToastType.success,
        );
        if (isRenewal || isUpgrade) {
          Navigator.pushNamedAndRemoveUntil(context, '/home', (route) => false);
        } else {
          Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
        }
      }
      return;
    }

    if (receiptVerified) {
      if (mounted) {
        showAppToast(
          context,
          isRenewal || isUpgrade
              ? 'Payment verified! Your subscription is now active.'
              : 'Payment receipt verified! Account activated successfully. Please sign in.',
          type: AppToastType.success,
        );
        if (isRenewal || isUpgrade) {
          Navigator.pushNamedAndRemoveUntil(context, '/home', (route) => false);
        } else {
          Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
        }
      }
      return;
    }

    final approvalData = {
      ...?regArgs,
      'planTitle': plan['title'],
      'planPrice': plan['price'],
      'totalAmount': parsedPlanAmount.toString(),
      'numCompanies': numCompanies,
      'paymentMethod': paymentMethod ?? 'Telebirr',
      'paymentRef': refNo,
      'status': 'pending_approval',
      'timestamp': DateTime.now().toIso8601String(),
      if (isRenewal) 'renewal': true,
      if (isUpgrade) 'upgrade': true,
    };

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => AwaitingApprovalScreen(data: approvalData),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final regArgs = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final isRenewal = regArgs?['renewal'] == true;
    final isUpgrade = regArgs?['upgrade'] == true;
    final billingCompanies = _billingCompanyCount(regArgs);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 16.0),
            child: Center(child: LanguageSelectorDropdown()),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isUpgrade
                        ? context.tr('upgrade_your_plan')
                        : (isRenewal
                            ? context.tr('renew_your_plan')
                            : context.tr('choose_your_plan')),
                    style: GoogleFonts.outfit(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isUpgrade
                        ? context.tr('upgrade_plan_subtitle')
                        : (isRenewal
                            ? context.tr('renew_plan_subtitle')
                            : context.tr('choose_plan_subtitle')),
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      color: _kSlate,
                    ),
                  ),
                  if ((isRenewal || isUpgrade) && _loadingRenewalPreview) ...[
                    const SizedBox(height: 8),
                    const LinearProgressIndicator(minHeight: 2),
                  ],
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isUpgrade ? const Color(0xFFFFF8E7) : const Color(0xFFE0F2FE),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isUpgrade ? const Color(0xFFF59E0B) : const Color(0xFF0891B2).withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      isUpgrade
                          ? 'You already have an active 1 Year Plan! Do you want to add more companies to your account? '
                              'Currently configured for $billingCompanies ${billingCompanies == 1 ? 'company' : 'companies'}. Total due = plan price × $billingCompanies.'
                          : ((isRenewal)
                              ? 'Your account covers $billingCompanies ${billingCompanies == 1 ? 'company' : 'companies'}'
                                  '${_renewalOwnedCompanies > 0 ? ' ($_renewalOwnedCompanies registered)' : ''}. '
                                  'Total due = plan price × $billingCompanies.'
                              : 'You selected $billingCompanies ${billingCompanies == 1 ? 'company' : 'companies'}. '
                                  'Total due = plan price × $billingCompanies.'),
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        fontWeight: isUpgrade ? FontWeight.w600 : FontWeight.normal,
                        color: isUpgrade ? const Color(0xFF78350F) : const Color(0xFF0F172A),
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Plan Cards (PageView)
            Expanded(
              child: _loadingPlans || _plans.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(color: _kBlue),
                    )
                  : PageView.builder(
                      controller: _pageController,
                      itemCount: _plans.length,
                      onPageChanged: (i) => setState(() => _currentPage = i),
                      itemBuilder: (context, index) {
                        return AnimatedBuilder(
                          animation: _pageController,
                          builder: (context, child) {
                            double scale = 1.0;
                            if (_pageController.position.haveDimensions) {
                              double page = _pageController.page ?? 0;
                              scale = (1 - (page - index).abs() * 0.08).clamp(0.9, 1.0);
                            }
                      return Transform.scale(
                        scale: scale,
                        child: _buildPlanCard(_plans[index], index == _currentPage, regArgs),
                      );
                    },
                  );
                },
              ),
            ),

            // Page Indicator
            Padding(
              padding: const EdgeInsets.only(top: 16, bottom: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_plans.length, (i) {
                  final isActive = i == _currentPage;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: isActive ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: isActive ? _kBlue : _kBorder,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
            ),

            // Next Button
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
              child: SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _plans.isEmpty
                      ? null
                      : () {
                          _selectPlanAndPay(_plans[_currentPage], regArgs);
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                        child: Text(
                          context.tr('next'),
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Center(
                child: GestureDetector(
                  onTap: () {
                    ContactUsDialog.show(context, supportPhone: '0911578793', telegramHandle: 'bmstock');
                  },
                  child: RichText(
                    text: TextSpan(
                      text: context.tr('need_help_choosing'),
                      style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                      children: [
                        TextSpan(
                          text: context.tr('contact_us'),
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF025EA7),
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanCard(Map<String, dynamic> plan, bool isSelected, Map<String, dynamic>? regArgs) {
    final features = plan['features'] as List<String>;
    final moreCount = plan['moreCount'] as int;
    final numCompanies = _billingCompanyCount(regArgs);
    final baseAmount = (plan['amount'] as num?)?.toInt() ?? 0;
    final totalAmount = baseAmount * numCompanies;
    final displayPrice = _formatPrice(totalAmount);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: isSelected ? _kNavy : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isSelected ? _kBlue : _kBorder,
          width: isSelected ? 2 : 1,
        ),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: _kBlue.withOpacity(0.18),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Plan Title & Price
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plan['title'],
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? Colors.white : _kNavy,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      'ETB ',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: isSelected
                            ? Colors.white.withOpacity(0.7)
                            : _kSlate,
                      ),
                    ),
                    Text(
                      displayPrice,
                      style: GoogleFonts.outfit(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: isSelected ? Colors.white : _kNavy,
                        height: 1,
                      ),
                    ),
                  ],
                ),
                if (numCompanies > 1) ...[
                  const SizedBox(height: 4),
                  Text(
                    'ETB ${_formatPrice(baseAmount)} × $numCompanies companies',
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: isSelected
                          ? Colors.white.withOpacity(0.65)
                          : _kSlate,
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 16),
          Divider(
            color: isSelected
                ? Colors.white.withOpacity(0.12)
                : const Color(0xFFF1F5F9),
            height: 1,
            indent: 20,
            endIndent: 20,
          ),
          const SizedBox(height: 14),

          // Features
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: ListView(
                physics: const NeverScrollableScrollPhysics(),
                padding: EdgeInsets.zero,
                children: [
                  ...features.map((f) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.check_circle,
                              size: 18,
                              color: isSelected
                                  ? const Color(0xFF5BB5F5)
                                  : _kBlue,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                f,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  color: isSelected
                                      ? Colors.white.withOpacity(0.85)
                                      : const Color(0xFF334155),
                                  height: 1.3,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )),
                  if (moreCount > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        '+$moreCount more benefits',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: isSelected
                              ? Colors.white.withOpacity(0.5)
                              : _kSlate,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Confirm & Pay Button
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () {
                  _selectPlanAndPay(plan, regArgs);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      isSelected ? Colors.white : _kBlue,
                  foregroundColor:
                      isSelected ? _kNavy : Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                        child: Text(
                          ((plan['id'] ?? '').toString().toLowerCase().contains('trial') ||
                                  (plan['period'] ?? '').toString().toLowerCase().contains('trial') ||
                                  plan['amount'] == 0 ||
                                  plan['price'] == '0')
                              ? 'START FREE TRIAL'
                              : 'SELECT PLAN',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                          ),
                        ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Awaiting Approval Screen ─────────────────────────────────────────────────

class AwaitingApprovalScreen extends StatelessWidget {
  final Map<String, dynamic>? data;
  const AwaitingApprovalScreen({super.key, this.data});

  @override
  Widget build(BuildContext context) {
    final companyName = data?['companyName'] ?? 'Your Business';
    final faydaId = _optionalDisplayValue(data?['faydaId']);
    final tinNumber = _optionalDisplayValue(data?['tinNumber']);
    final refNo = data?['paymentRef'] ?? 'GS-REG-8942103';
    final planTitle = data?['planTitle'] ?? '1 Month Plan';
    final isRenewal = data?['renewal'] == true;
    final isUpgrade = data?['upgrade'] == true;
    final numCompanies = data?['numCompanies']?.toString() ?? '1';

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4F8),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Checkmark Icon
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1D5C96).withOpacity(0.10),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.check_circle_outline_rounded,
                    color: Color(0xFF1D5C96),
                    size: 48,
                  ),
                ),
                const SizedBox(height: 24),

                // Title
                Text(
                  'Awaiting Approval',
                  style: GoogleFonts.outfit(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 8),

                // Subtitle
                Text(
                  isUpgrade
                      ? "We have received your plan upgrade request. Our team will verify your payment screenshot and notify you once your plan is upgraded."
                      : (isRenewal
                          ? "We have received your renewal payment. Our team will verify your payment screenshot and notify you once your subscription is restored."
                          : "We have received your business registration & payment. Our team will verify your payment screenshot and notify you once your account is approved by the admin."),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    color: const Color(0xFF64748B),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),

                // Details Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      if (!isRenewal) ...[
                        _detailRow('Company Name', companyName),
                        const Divider(height: 20),
                        _detailRow('Fayda Digital ID', faydaId),
                        const Divider(height: 20),
                        _detailRow('TIN Number', tinNumber),
                        const Divider(height: 20),
                      ],
                      _detailRow('Subscription Plan', planTitle),
                      const Divider(height: 20),
                      _detailRow(
                        (isRenewal || isUpgrade) ? 'Companies Covered' : 'Companies to Add',
                        numCompanies,
                      ),
                      const Divider(height: 20),
                      _detailRow('Payment Amount', 'ETB ${data?["totalAmount"] ?? data?["planPrice"] ?? "399"}', isHighlight: true),
                      const Divider(height: 20),
                      _detailRow('Payment Ref', refNo, isHighlight: true),
                      const Divider(height: 20),
                      _detailRow('Payment Method', data?["paymentMethod"] ?? 'Telebirr', isHighlight: true),
                      const Divider(height: 20),
                      _detailRow('Approval Status', 'Pending Admin Review', isStatus: true),
                    ],
                  ),
                ),
                const SizedBox(height: 28),



                // Return to Login Button
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).pushNamedAndRemoveUntil('/auth', (route) => false);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1D5C96),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      'Return to Login',
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Contact support link
                GestureDetector(
                  onTap: () {
                    ContactUsDialog.show(context, supportPhone: '0911578793', telegramHandle: 'bmstock');
                  },
                  child: RichText(
                    text: TextSpan(
                      text: 'Questions? ',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        color: const Color(0xFF64748B),
                      ),
                      children: [
                        TextSpan(
                          text: 'Contact Support',
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF1D5C96),
                          ),
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value, {bool isHighlight = false, bool isStatus = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
        ),
        if (isStatus)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              value,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: const Color(0xFFD97706),
              ),
            ),
          )
        else
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: isHighlight ? FontWeight.bold : FontWeight.w600,
              color: isHighlight ? const Color(0xFF0072CE) : const Color(0xFF0F172A),
            ),
          ),
      ],
    );
  }
}
