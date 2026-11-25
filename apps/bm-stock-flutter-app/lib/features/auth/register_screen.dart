import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_event.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/language_selector.dart';
import '../../core/utils/phone_util.dart';
import '../../core/widgets/ethiopian_phone_field.dart';
import '../settings/privacy_policy_screen.dart';
import 'auth_widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _companyController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _showPassword = false;
  bool _showConfirm = false;
  bool _checkingPhone = false;
  bool _agreedToPrivacy = false;

  String? _phoneError;

  @override
  void dispose() {
    _companyController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_agreedToPrivacy) {
      showAppToast(
        context,
        context.tr('privacy_policy_accept_error'),
        type: AppToastType.error,
      );
      return;
    }
    final phone = PhoneUtil.normalize(_phoneController.text.trim());
    _phoneController.text = phone;

    setState(() {
      _checkingPhone = true;
      _phoneError = null;
    });

    try {
      // Verify the phone number is not already registered BEFORE sending an OTP.
      await ApiClient().post('/auth/check-phone', body: {'phone': phone}, auth: false);
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException
          ? e.message
          : 'Connection failed: $e';
      setState(() {
        _checkingPhone = false;
        _phoneError = msg;
      });
      return;
    }

    if (!mounted) return;
    setState(() => _checkingPhone = false);

    // Dispatch OTP send for verification before selecting plan & payment
    context.read<AuthBloc>().add(SendOtpEvent(phone: phone));
  }

  void _contactSupport() {
    // TODO: replace with the actual support phone number and telegram handle
    ContactUsDialog.show(context, supportPhone: '0911578793', telegramHandle: 'bmstock');
  }

  @override
  Widget build(BuildContext context) {
    final tr = (String key) => context.tr(key);

    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is OtpSent) {
          final phone = _phoneController.text.trim();

          final verifyArgs = <String, dynamic>{
            'companyName': _companyController.text.trim(),
            'phone': phone,
            'password': _passwordController.text,
            'numCompanies': 1,
            'verificationId': state.verificationId,
            if (state.code != null && state.code!.isNotEmpty) 'devCode': state.code,
            if (state.smsError != null && state.smsError!.isNotEmpty) 'smsError': state.smsError,
          };

          Navigator.pushNamed(
            context,
            '/verify',
            arguments: verifyArgs,
          );
        }

        if (state is AuthError) {
          showAppToast(context, state.message, type: AppToastType.error);
        }
      },
      builder: (context, state) {
        final isLoading = state is AuthLoading;
        final errorMessage = state is AuthError ? state.message : null;

        return Scaffold(
          backgroundColor: Colors.white,
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0,
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
            child: Center(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Image.asset(
                          'assets/images/logo/icon.png',
                          height: 52,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => Image.asset(
                            'assets/images/logo/gelagle_logo.png',
                            height: 44,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        tr('business_registration'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        tr('register_company_subtitle'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // 1. Company / Business Name
                      FieldLabel(text: '${tr('business_company_name')} *'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _companyController,
                        style: GoogleFonts.outfit(fontSize: 14),
                        textInputAction: TextInputAction.next,
                        decoration: _inputDecoration(tr('eg_company_placeholder')),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? tr('required') : null,
                      ),
                      const SizedBox(height: 14),

                      EthiopianPhoneField(
                        controller: _phoneController,
                        label: '${tr('phone_number')} *',
                        hint: '911234567',
                        errorText: _phoneError,
                        onChanged: (_) {
                          if (_phoneError != null) {
                            setState(() => _phoneError = null);
                          }
                        },
                      ),
                      const SizedBox(height: 14),

                      // 8. Password
                      FieldLabel(text: '${tr('password')} *'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _passwordController,
                        style: GoogleFonts.outfit(fontSize: 14),
                        obscureText: !_showPassword,
                        textInputAction: TextInputAction.next,
                        decoration: _inputDecoration(tr('enter_strong_password')).copyWith(
                          prefixIcon: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Icon(Icons.lock_outline_rounded,
                                color: Color(0xFF94A3B8), size: 20),
                          ),
                          suffixIcon: _EyeToggle(
                            visible: _showPassword,
                            onToggle: () =>
                                setState(() => _showPassword = !_showPassword),
                          ),
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) return tr('required');
                          if (v.length < 6) return tr('min_characters');
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),

                      // 9. Confirm Password
                      FieldLabel(text: '${tr('confirm_password')} *'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _confirmController,
                        style: GoogleFonts.outfit(fontSize: 14),
                        obscureText: !_showConfirm,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _handleRegister(),
                        decoration: _inputDecoration(tr('reenter_password')).copyWith(
                          prefixIcon: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Icon(Icons.lock_outline_rounded,
                                color: Color(0xFF94A3B8), size: 20),
                          ),
                          suffixIcon: _EyeToggle(
                            visible: _showConfirm,
                            onToggle: () =>
                                setState(() => _showConfirm = !_showConfirm),
                          ),
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) return tr('required');
                          if (v != _passwordController.text) {
                            return tr('passwords_dont_match');
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 20),

                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            tr('already_have_account'),
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              context.read<AuthBloc>().add(const ClearAuthError());
                              Navigator.pop(context);
                            },
                            child: Text(
                              ' ${tr("log_in")}',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF025EA7),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Privacy policy consent (required before account creation)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 24,
                            height: 24,
                            child: Checkbox(
                              value: _agreedToPrivacy,
                              onChanged: (val) =>
                                  setState(() => _agreedToPrivacy = val ?? false),
                              activeColor: const Color(0xFF025EA7),
                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _agreedToPrivacy = !_agreedToPrivacy),
                              behavior: HitTestBehavior.opaque,
                              child: Text.rich(
                                TextSpan(
                                  text: tr('privacy_agree_prefix'),
                                  style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF475569)),
                                  children: [
                                    WidgetSpan(
                                      alignment: PlaceholderAlignment.middle,
                                      child: GestureDetector(
                                        onTap: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => const PrivacyPolicyScreen(),
                                            ),
                                          );
                                        },
                                        child: Text(
                                          tr('privacy_policy'),
                                          style: GoogleFonts.outfit(
                                            fontSize: 13,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF025EA7),
                                            decoration: TextDecoration.underline,
                                            decorationColor: const Color(0xFF025EA7),
                                          ),
                                        ),
                                      ),
                                    ),
                                    TextSpan(text: tr('privacy_agree_suffix')),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (errorMessage != null) ...[
                        ErrorBanner(message: errorMessage),
                        const SizedBox(height: 16),
                      ],
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(
                            child: RichText(
                              textAlign: TextAlign.center,
                              text: TextSpan(
                                text: tr('contact_us_prompt'),
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  color: const Color(0xFF64748B),
                                ),
                                children: [
                                  WidgetSpan(
                                    alignment: PlaceholderAlignment.middle,
                                    child: GestureDetector(
                                      onTap: _contactSupport,
                                      child: Text(
                                        tr('contact_us'),
                                        style: GoogleFonts.outfit(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF025EA7),
                                          decoration: TextDecoration.underline,
                                          decorationColor: const Color(0xFF025EA7),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: (isLoading || _checkingPhone) ? null : _handleRegister,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF025EA7),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30),
                            ),
                            elevation: 0,
                          ),
                          child: (isLoading || _checkingPhone)
                              ? const LoadingIndicator()
                              : Text(
                                  context.tr('continue_to_choose_plan'),
                                  style: GoogleFonts.outfit(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  InputDecoration _inputDecoration(String hint, {String? errorText}) {
    final hasError = errorText != null && errorText.isNotEmpty;
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      filled: true,
      fillColor: hasError ? const Color(0xFFFFF5F5) : Colors.white,
      errorText: errorText,
      errorMaxLines: 2,
      errorStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFFDC2626)),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(
          color: hasError ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0),
          width: hasError ? 1.5 : 1,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.8),
      ),
    );
  }
}

class _EyeToggle extends StatelessWidget {
  final bool visible;
  final VoidCallback onToggle;
  const _EyeToggle({required this.visible, required this.onToggle});

  @override
  Widget build(BuildContext context) => IconButton(
        icon: Icon(
          visible
              ? Icons.visibility_off_outlined
              : Icons.visibility_outlined,
          color: const Color(0xFF94A3B8),
          size: 20,
        ),
        onPressed: onToggle,
      );
}
