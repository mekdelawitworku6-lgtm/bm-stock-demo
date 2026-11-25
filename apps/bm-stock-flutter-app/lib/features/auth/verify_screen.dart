import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_event.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/language_selector.dart';
import 'auth_widgets.dart';

class VerifyScreen extends StatefulWidget {
  const VerifyScreen({super.key});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  int _secondsRemaining = 20;
  Timer? _timer;
  bool _canResend = false;
  bool _dispatchedRegister = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_focusNodes.isNotEmpty) {
        _focusNodes[0].requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _startTimer() {
    setState(() {
      _secondsRemaining = 20;
      _canResend = false;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() {
        if (_secondsRemaining > 0) {
          _secondsRemaining--;
        } else {
          _canResend = true;
          t.cancel();
        }
      });
    });
  }

  void _handleVerify(Map<String, dynamic> args) {
    final code = _controllers.map((c) => c.text).join();
    if (code.length < 6) {
      showAppToast(context, context.tr('enter_all_digits'));
      return;
    }

    context.read<AuthBloc>().add(VerifyOtpEvent(
      phone: args['phone'] ?? '',
      code: code,
    ));
  }

  void _handleResend(Map<String, dynamic> args) {
    context.read<AuthBloc>().add(SendOtpEvent(phone: args['phone'] ?? ''));
  }

  @override
  Widget build(BuildContext context) {
    final tr = (String key) => context.tr(key);

    final args =
        ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
    final String phone = args['phone'] ?? '';

    String masked = phone;
    if (phone.length > 6) {
      masked =
          '${phone.substring(0, 4)}*-****-${phone.substring(phone.length - 4)}';
    }

    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is OtpVerified && !_dispatchedRegister) {
          _dispatchedRegister = true;
          showAppToast(
            context,
            context.tr('otp_verified_choose_plan'),
            type: AppToastType.success,
          );
          Navigator.of(context).pushReplacementNamed(
            '/choose_plan',
            arguments: args,
          );
        }

        if (state is OtpSent) {
          if (state.code != null && state.code!.isNotEmpty) {
            args['devCode'] = state.code;
          }
          if (state.smsError != null && state.smsError!.isNotEmpty) {
            args['smsError'] = state.smsError;
          }
          setState(() {
            _startTimer();
          });
          showAppToast(context, 'Verification code sent', type: AppToastType.success);
        }

        if (state is AuthError) {
          _dispatchedRegister = false;
          for (final c in _controllers) {
            c.clear();
          }
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_focusNodes.isNotEmpty) {
              _focusNodes[0].requestFocus();
            }
          });
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Image.asset(
                        'assets/images/logo/icon.png',
                        height: 56,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Image.asset(
                          'assets/images/logo/gelagle_logo.png',
                          height: 48,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    Text(
                      tr('verify_number'),
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${tr("enter_otp_code")} $masked',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    if (args['devCode'] != null && (args['devCode'] as String).isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            if (args['smsError'] != null && (args['smsError'] as String).isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(
                                  'SMS Notice: ${args['smsError']}',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: const Color(0xFF92400E),
                                  ),
                                ),
                              ),
                            Text(
                              'Verification Code: ${args['devCode']}',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF92400E),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 28),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(6, (i) {
                        return SizedBox(
                          width: 46,
                          height: 56,
                          child: TextFormField(
                            controller: _controllers[i],
                            focusNode: _focusNodes[i],
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
                              contentPadding: EdgeInsets.zero,
                              filled: true,
                              fillColor: errorMessage != null ? const Color(0xFFFFF5F5) : Colors.white,
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: BorderSide(
                                  color: errorMessage != null ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0),
                                  width: errorMessage != null ? 1.5 : 1,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: BorderSide(
                                  color: errorMessage != null ? const Color(0xFFDC2626) : const Color(0xFF025EA7),
                                  width: 1.5,
                                ),
                              ),
                            ),
                            onChanged: (v) {
                              if (v.length == 1 && i < 5) {
                                _focusNodes[i + 1].requestFocus();
                              }
                              if (v.isEmpty && i > 0) {
                                _focusNodes[i - 1].requestFocus();
                              }
                              if (i == 5 && v.isNotEmpty) {
                                final allFilled =
                                    _controllers.every((c) => c.text.isNotEmpty);
                                if (allFilled && !isLoading) {
                                  _handleVerify(args);
                                }
                              }
                            },
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 32),
                    if (errorMessage != null) ...[
                      ErrorBanner(message: errorMessage),
                      const SizedBox(height: 16),
                    ],
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: isLoading
                            ? null
                            : () => _handleVerify(args),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF025EA7),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(30),
                          ),
                          elevation: 0,
                        ),
                        child: isLoading
                            ? const LoadingIndicator()
                            : Text(
                                tr('verify'),
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (!_canResend)
                            Text(
                              '${tr("resend_code_in")} $_secondsRemaining s',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                color: const Color(0xFF64748B),
                              ),
                            )
                          else
                            GestureDetector(
                              onTap: () => _handleResend(args),
                              child: Text(
                                tr('resend_code'),
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF025EA7),
                                ),
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
