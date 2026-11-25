import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/utils/phone_util.dart';
import '../../core/widgets/ethiopian_phone_field.dart';
import '../../core/widgets/language_selector.dart';
import 'auth_widgets.dart';

class ForgotPasswordScreen extends StatefulWidget {
  final String phone;
  const ForgotPasswordScreen({super.key, required this.phone});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  int _step = 1; // 1 = Send OTP, 2 = Verify OTP, 3 = New Password
  bool _isLoading = false;
  String? _error;

  final _phoneController = TextEditingController();
  final List<TextEditingController> _otpControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _passwordFocusNode = FocusNode();
  final _confirmPasswordFocusNode = FocusNode();
  bool _showPassword = false;
  bool _showConfirm = false;

  final _api = ApiClient();

  @override
  void initState() {
    super.initState();
    _phoneController.text = widget.phone;
  }

  @override
  void dispose() {
    _phoneController.dispose();
    for (final c in _otpControllers) c.dispose();
    for (final f in _otpFocusNodes) f.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _passwordFocusNode.dispose();
    _confirmPasswordFocusNode.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final phone = PhoneUtil.normalize(_phoneController.text.trim());
    _phoneController.text = phone;
    if (!PhoneUtil.isValidEthiopian(phone)) {
      setState(() => _error = context.tr('invalid_phone'));
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await _api.post('/auth/send-otp', body: {'phone': phone}, auth: false);
      for (final c in _otpControllers) {
        c.clear();
      }
      setState(() {
        _step = 2;
        _isLoading = false;
      });
      _otpFocusNodes[0].requestFocus();
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  Future<void> _verifyAndProceed() async {
    final otp = _otpControllers.map((c) => c.text).join();
    if (otp.length < 6) {
      setState(() => _error = context.tr('enter_all_digits'));
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final phone = _phoneController.text.trim();
      await _api.post(
        '/auth/verify-otp',
        body: {'phone': phone, 'code': otp},
        auth: false,
      );
      if (!mounted) return;
      setState(() {
        _step = 3;
        _isLoading = false;
      });
      _passwordFocusNode.requestFocus();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
      for (final c in _otpControllers) {
        c.clear();
      }
      _otpFocusNodes[0].requestFocus();
    }
  }

  Future<void> _resetPassword() async {
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (password.length < 6) {
      setState(() => _error = context.tr('min_6_characters'));
      return;
    }
    if (password.length > 32) {
      setState(() => _error = context.tr('max_32_characters'));
      return;
    }
    if (password != confirmPassword) {
      setState(() => _error = context.tr('passwords_dont_match'));
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final phone = _phoneController.text.trim();
      final otp = _otpControllers.map((c) => c.text).join();

      await _api.post('/auth/reset-password', body: {
        'phone': phone,
        'code': otp,
        'newPassword': password,
      }, auth: false);

      if (mounted) {
        showAppToast(
          context,
          context.tr('password_reset_success'),
          type: AppToastType.success,
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (!mounted) return;
      final message = e.toString().replaceAll('Exception: ', '');
      final isOtpError = message.toLowerCase().contains('otp') ||
          message.toLowerCase().contains('code');
      if (isOtpError) {
        setState(() {
          _isLoading = false;
          _error = context.tr('otp_expired_sending_new');
          _step = 2;
          for (final c in _otpControllers) {
            c.clear();
          }
        });
        await _sendOtp();
        if (mounted) {
          setState(() {
            _error = context.tr('new_code_sent_enter');
          });
        }
      } else {
        setState(() {
          _isLoading = false;
          _error = message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = (String key) => context.tr(key);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: Color(0xFF0F172A), size: 20),
          onPressed: () {
            if (_step > 1) {
              setState(() {
                _step = _step - 1;
                _error = null;
              });
            } else {
              Navigator.pop(context);
            }
          },
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Center(
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.lock_reset_rounded,
                        color: Color(0xFF025EA7), size: 32),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  _step == 1
                      ? tr('reset_password')
                      : _step == 2
                          ? tr('verify_otp')
                          : tr('set_new_password'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _step == 1
                      ? tr('enter_phone_to_reset')
                      : _step == 2
                          ? '${tr('enter_otp_code')} ${_phoneController.text}'
                          : tr('create_new_password_hint'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    color: const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 28),

                // Step indicator
                _buildStepIndicator(),
                const SizedBox(height: 24),

                if (_error != null) ...[
                  ErrorBanner(message: _error!),
                  const SizedBox(height: 16),
                ],

                if (_step == 1) _buildPhoneStep(tr),
                if (_step == 2) _buildOtpStep(tr),
                if (_step == 3) _buildNewPasswordStep(tr),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _stepDot(1, context.tr('step_phone')),
        _stepLine(_step >= 2),
        _stepDot(2, context.tr('step_otp')),
        _stepLine(_step >= 3),
        _stepDot(3, context.tr('step_new_password')),
      ],
    );
  }

  Widget _stepDot(int step, String label) {
    final isActive = _step >= step;
    return Column(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFF025EA7) : const Color(0xFFE2E8F0),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: isActive
                ? (_step > step
                    ? const Icon(Icons.check, color: Colors.white, size: 16)
                    : Text('$step',
                        style: GoogleFonts.outfit(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold)))
                : Text('$step',
                    style: GoogleFonts.outfit(
                        color: const Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.bold)),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 10,
            color: isActive ? const Color(0xFF025EA7) : const Color(0xFF94A3B8),
            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ],
    );
  }

  Widget _stepLine(bool active) {
    return Container(
      width: 40,
      height: 2,
      margin: const EdgeInsets.only(bottom: 16),
      color: active ? const Color(0xFF025EA7) : const Color(0xFFE2E8F0),
    );
  }

  Widget _buildPhoneStep(String Function(String) tr) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        EthiopianPhoneField(
          controller: _phoneController,
          label: tr('phone_number'),
          hint: '912345678',
          errorText: _step == 1 ? _error : null,
          onChanged: (_) {
            if (_error != null) setState(() => _error = null);
          },
        ),
        const SizedBox(height: 28),
        SizedBox(
          height: 52,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _sendOtp,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF025EA7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(30)),
              elevation: 0,
            ),
            child: _isLoading
                ? const LoadingIndicator()
                : Text(
                    tr('send_verification_code'),
                    style: GoogleFonts.outfit(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildOtpStep(String Function(String) tr) {
    final hasOtpError = _step == 2 && _error != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 6-digit OTP boxes
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(6, (i) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: SizedBox(
                width: 46,
                height: 54,
                child: TextFormField(
                  controller: _otpControllers[i],
                  focusNode: _otpFocusNodes[i],
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  maxLength: 1,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: '-',
                    hintStyle: GoogleFonts.outfit(
                        color: const Color(0xFF64748B), fontSize: 18),
                    contentPadding: EdgeInsets.zero,
                    filled: true,
                    fillColor: hasOtpError ? const Color(0xFFFFF5F5) : Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: hasOtpError ? const Color(0xFFFCA5A5) : const Color(0xFFCBD5E1),
                        width: hasOtpError ? 1.5 : 1,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: hasOtpError ? const Color(0xFFFCA5A5) : const Color(0xFFCBD5E1),
                        width: hasOtpError ? 1.5 : 1,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: hasOtpError ? const Color(0xFFDC2626) : const Color(0xFF025EA7),
                        width: 1.5,
                      ),
                    ),
                  ),
                  onChanged: (v) {
                    if (_error != null) setState(() => _error = null);
                    if (v.length == 1 && i < 5) {
                      _otpFocusNodes[i + 1].requestFocus();
                    }
                    if (v.isEmpty && i > 0) {
                      _otpFocusNodes[i - 1].requestFocus();
                    }
                    if (i == 5 && v.isNotEmpty && !_isLoading) {
                      final allFilled =
                          _otpControllers.every((c) => c.text.isNotEmpty);
                      if (allFilled) {
                        _verifyAndProceed();
                      }
                    }
                  },
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 28),

        SizedBox(
          height: 52,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _verifyAndProceed,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF025EA7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(30)),
              elevation: 0,
            ),
            child: _isLoading
                ? const LoadingIndicator()
                : Text(
                    tr('verify_and_continue'),
                    style: GoogleFonts.outfit(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
          ),
        ),
        const SizedBox(height: 16),

        Center(
          child: GestureDetector(
            onTap: _isLoading ? null : _sendOtp,
            child: Text(
              tr('resend_code_action'),
              style: GoogleFonts.outfit(
                fontSize: 13,
                color: const Color(0xFF025EA7),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNewPasswordStep(String Function(String) tr) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          tr('new_password'),
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _passwordController,
          focusNode: _passwordFocusNode,
          obscureText: !_showPassword,
          maxLength: 32,
          textInputAction: TextInputAction.next,
          onSubmitted: (_) => _confirmPasswordFocusNode.requestFocus(),
          onChanged: (_) {
            if (_error != null) setState(() => _error = null);
          },
          style: GoogleFonts.outfit(fontSize: 16, color: const Color(0xFF0F172A)),
          decoration: _inputDecoration(tr('enter_new_password'), errorText: _step == 3 ? _error : null).copyWith(
            counterText: '',
            prefixIcon: const Padding(
              padding: EdgeInsets.symmetric(vertical: 14),
              child: Icon(Icons.lock_outline_rounded,
                  color: Color(0xFF94A3B8), size: 20),
            ),
            suffixIcon: IconButton(
              icon: Icon(
                _showPassword
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                color: const Color(0xFF94A3B8),
                size: 20,
              ),
              onPressed: () => setState(() => _showPassword = !_showPassword),
            ),
          ),
        ),
        const SizedBox(height: 20),

        Text(
          tr('confirm_new_password'),
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _confirmPasswordController,
          focusNode: _confirmPasswordFocusNode,
          obscureText: !_showConfirm,
          maxLength: 32,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _resetPassword(),
          onChanged: (_) {
            if (_error != null) setState(() => _error = null);
          },
          style: GoogleFonts.outfit(fontSize: 16, color: const Color(0xFF0F172A)),
          decoration: _inputDecoration(tr('reenter_new_password_hint')).copyWith(
            counterText: '',
            prefixIcon: const Padding(
              padding: EdgeInsets.symmetric(vertical: 14),
              child: Icon(Icons.lock_outline_rounded,
                  color: Color(0xFF94A3B8), size: 20),
            ),
            suffixIcon: IconButton(
              icon: Icon(
                _showConfirm
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                color: const Color(0xFF94A3B8),
                size: 20,
              ),
              onPressed: () => setState(() => _showConfirm = !_showConfirm),
            ),
          ),
        ),
        const SizedBox(height: 28),

        SizedBox(
          height: 52,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _resetPassword,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF025EA7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(30)),
              elevation: 0,
            ),
            child: _isLoading
                ? const LoadingIndicator()
                : Text(
                    tr('reset_password'),
                    style: GoogleFonts.outfit(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
          ),
        ),
      ],
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
