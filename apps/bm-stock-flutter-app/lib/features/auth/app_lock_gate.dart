import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_event.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/app_lock_service.dart';
import '../../core/services/biometric_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kBlue = Color(0xFF025EA7);

/// Wraps the app and shows a lock screen when the app
/// has been in the background for 3+ minutes.
/// Supports both Fingerprint / Biometric and 4-Digit PIN.
/// If biometric hardware is not supported or enrolled on the device,
/// it seamlessly defaults to the normal 4-digit PIN unlock.
class AppLockGate extends StatefulWidget {
  final Widget child;
  const AppLockGate({super.key, required this.child});

  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> {
  bool _locked = false;
  bool _authenticating = false;
  String? _error;
  String? _displayName;
  String? _companyName;
  String? _savedRole;
  String? _savedAccountId;
  bool _biometricAvailable = false;
  bool _usePin = true;

  final TextEditingController _pinController = TextEditingController();
  final FocusNode _pinFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    AppLockService.instance.isLocked.addListener(_onLockChanged);
  }

  @override
  void dispose() {
    AppLockService.instance.isLocked.removeListener(_onLockChanged);
    _pinController.dispose();
    _pinFocusNode.dispose();
    super.dispose();
  }

  void _onLockChanged() {
    final locked = AppLockService.instance.isLocked.value;
    if (locked && !_locked) {
      _loadUserInfo();
    }
    if (mounted) {
      setState(() => _locked = locked);
    }
  }

  Future<void> _loadUserInfo() async {
    final prefs = await SharedPreferences.getInstance();
    final displayName = prefs.getString('auth_display_name');
    final companyName = prefs.getString('auth_company_name');
    final role = prefs.getString('auth_role') ?? 'staff';
    final accountId = prefs.getString('auth_account_id') ?? '';

    bool biometricAvailable = false;
    try {
      final isSupported = await BiometricService.instance.isDeviceSupported();
      final isEnrolled = await BiometricService.instance.isBiometricEnrolled();
      biometricAvailable = isSupported && isEnrolled;
    } catch (_) {
      biometricAvailable = false;
    }

    if (!mounted) return;
    setState(() {
      _displayName = displayName;
      _companyName = companyName;
      _savedRole = role;
      _savedAccountId = accountId;
      _biometricAvailable = biometricAvailable;
      // If biometric is NOT supported on the device, default to normal PIN!
      _usePin = !biometricAvailable;
      _error = null;
      _authenticating = false;
      _pinController.clear();
    });

    if (biometricAvailable && !_usePin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _triggerBiometricUnlock();
      });
    }
  }

  Future<void> _triggerBiometricUnlock() async {
    if (_authenticating) return;
    setState(() {
      _authenticating = true;
      _error = null;
    });

    final result = await BiometricService.instance.authenticate(
      localizedReason: 'Scan your fingerprint to unlock BM Stock',
    );

    if (!mounted) return;

    if (result.isSuccess) {
      final prefs = await SharedPreferences.getInstance();
      final role = _savedRole ?? prefs.getString('auth_role') ?? 'admin';
      final accountId = _savedAccountId ?? prefs.getString('auth_account_id') ?? '';

      if (!mounted) return;
      context.read<AuthBloc>().add(BiometricUnlockEvent(
            role: role,
            accountId: accountId,
          ));
    } else {
      setState(() {
        _authenticating = false;
        _error = result.errorMessage;
      });
    }
  }

  void _triggerPinUnlock(String pin) {
    if (pin.length != 4 || _authenticating) return;
    setState(() {
      _authenticating = true;
      _error = null;
    });

    context.read<AuthBloc>().add(PinUnlockEvent(
          role: _savedRole ?? 'staff',
          accountId: _savedAccountId ?? '',
          pin: pin,
        ));
  }

  void _handleDigitInput(String digit) {
    if (_pinController.text.length < 4) {
      setState(() {
        _pinController.text += digit;
      });
      if (_pinController.text.length == 4 && !_authenticating) {
        _triggerPinUnlock(_pinController.text);
      }
    }
  }

  void _handleBackspace() {
    if (_pinController.text.isNotEmpty) {
      setState(() {
        _pinController.text =
            _pinController.text.substring(0, _pinController.text.length - 1);
      });
    }
  }

  void _handleClear() {
    setState(() {
      _pinController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (_locked && state is AuthAuthenticated) {
          AppLockService.instance.unlock();
          setState(() {
            _locked = false;
            _authenticating = false;
            _error = null;
            _pinController.clear();
          });
        }
        if (_locked && state is AuthError) {
          setState(() {
            _authenticating = false;
            _error = state.message;
            _pinController.clear();
          });
        }
      },
      child: Stack(
        children: [
          widget.child,
          if (_locked) _buildLockOverlay(context),
        ],
      ),
    );
  }

  Widget _buildLockOverlay(BuildContext context) {
    return Positioned.fill(
      child: Material(
        color: Colors.white,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Lock icon
                  Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      color: _kBlue.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _usePin ? Icons.pin_outlined : Icons.lock_outline_rounded,
                      color: _kBlue,
                      size: 38,
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Title
                  Text(
                    context.tr('app_locked'),
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Subtitle (Display Name • Company)
                  if (_displayName != null || _companyName != null)
                    Text(
                      '${_displayName ?? ''} ${_companyName != null ? '• $_companyName' : ''}',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _kBlue,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  const SizedBox(height: 4),
                  Text(
                    _usePin
                        ? context.tr('enter_pin')
                        : context.tr('session_expired_message'),
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: const Color(0xFF94A3B8),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),

                  // Error message banner
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline,
                              color: Color(0xFFDC2626), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  color: const Color(0xFFDC2626)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // MODE 1: PIN UNLOCK
                  if (_usePin) ...[
                    _buildPinView(context),
                  ]
                  // MODE 2: BIOMETRIC UNLOCK
                  else ...[
                    _buildBiometricView(context),
                  ],

                  const SizedBox(height: 20),

                  // Sign out / switch account option
                  TextButton.icon(
                    onPressed: () async {
                      final prefs = await SharedPreferences.getInstance();
                      await prefs.remove('auth_device_configured');
                      await prefs.remove('auth_role');
                      await prefs.remove('auth_account_id');
                      await prefs.remove('auth_display_name');
                      await prefs.remove('auth_company_name');
                      await prefs.remove('refresh_token');
                      await prefs.remove('biometric_token');

                      AppLockService.instance.unlock();
                      if (!mounted) return;
                      this.context.read<AuthBloc>().add(const LogoutEvent());
                    },
                    icon: const Icon(Icons.swap_horiz_rounded,
                        size: 16, color: Color(0xFF64748B)),
                    label: Text(
                      context.tr('switch_account'),
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPinView(BuildContext context) {
    return Column(
      children: [
        // 4-dot PIN indicators
        GestureDetector(
          onTap: () => _pinFocusNode.requestFocus(),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (index) {
              final filled = _pinController.text.length > index;
              final isCurrent = _pinController.text.length == index;
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 8),
                width: 52,
                height: 56,
                decoration: BoxDecoration(
                  color: filled ? _kBlue.withValues(alpha: 0.08) : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isCurrent
                        ? _kBlue
                        : (filled
                            ? _kBlue.withValues(alpha: 0.5)
                            : const Color(0xFFCBD5E1)),
                    width: isCurrent ? 2.2 : 1.5,
                  ),
                  boxShadow: isCurrent
                      ? [
                          BoxShadow(
                            color: _kBlue.withValues(alpha: 0.15),
                            blurRadius: 10,
                            spreadRadius: 1,
                          )
                        ]
                      : null,
                ),
                alignment: Alignment.center,
                child: Text(
                  filled ? '●' : '',
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: _kBlue,
                  ),
                ),
              );
            }),
          ),
        ),

        // Hidden input for hardware keyboard / soft input
        SizedBox(
          width: 0,
          height: 0,
          child: TextField(
            controller: _pinController,
            focusNode: _pinFocusNode,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(4),
            ],
            obscureText: true,
            onChanged: (val) {
              setState(() {});
              if (val.length == 4 && !_authenticating) {
                _triggerPinUnlock(val);
              }
            },
          ),
        ),

        const SizedBox(height: 20),

        // On-screen numeric keypad
        _buildNumericKeypad(),

        const SizedBox(height: 16),

        // Unlock Button
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            onPressed: (_pinController.text.length != 4 || _authenticating)
                ? null
                : () => _triggerPinUnlock(_pinController.text),
            icon: _authenticating
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.lock_open_rounded, size: 20),
            label: Text(
              _authenticating
                  ? context.tr('authenticating')
                  : context.tr('unlock_with_pin'),
              style: GoogleFonts.outfit(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: _kBlue,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              elevation: 0,
              disabledBackgroundColor: const Color(0xFFE2E8F0),
              disabledForegroundColor: const Color(0xFF94A3B8),
            ),
          ),
        ),

        // Toggle back to Fingerprint if device supports it
        if (_biometricAvailable) ...[
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: _authenticating
                ? null
                : () {
                    setState(() {
                      _usePin = false;
                      _error = null;
                    });
                    _triggerBiometricUnlock();
                  },
            icon: const Icon(Icons.fingerprint_rounded,
                size: 18, color: _kBlue),
            label: Text(
              context.tr('use_fingerprint_instead'),
              style: GoogleFonts.outfit(
                fontSize: 13,
                color: _kBlue,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildBiometricView(BuildContext context) {
    return Column(
      children: [
        // Biometric Unlock Button
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton.icon(
            onPressed: _authenticating ? null : _triggerBiometricUnlock,
            icon: _authenticating
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.fingerprint_rounded, size: 24),
            label: Text(
              _authenticating
                  ? context.tr('authenticating')
                  : context.tr('unlock_with_fingerprint'),
              style: GoogleFonts.outfit(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: _kBlue,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
          ),
        ),

        const SizedBox(height: 12),

        // Switch to PIN mode
        TextButton.icon(
          onPressed: _authenticating
              ? null
              : () {
                  setState(() {
                    _usePin = true;
                    _error = null;
                  });
                },
          icon: const Icon(Icons.pin_rounded, size: 18, color: _kBlue),
          label: Text(
            context.tr('use_pin_instead'),
            style: GoogleFonts.outfit(
              fontSize: 13,
              color: _kBlue,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNumericKeypad() {
    final rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['C', '0', '⌫'],
    ];

    return Column(
      children: rows.map((row) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: row.map((key) {
              VoidCallback? onTap;
              Widget content;

              if (key == 'C') {
                content = Text(
                  'C',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF64748B),
                  ),
                );
                onTap = _pinController.text.isEmpty ? null : _handleClear;
              } else if (key == '⌫') {
                content = const Icon(Icons.backspace_outlined,
                    size: 20, color: Color(0xFF64748B));
                onTap = _pinController.text.isEmpty ? null : _handleBackspace;
              } else {
                content = Text(
                  key,
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                );
                onTap = () => _handleDigitInput(key);
              }

              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 10),
                width: 68,
                height: 48,
                child: Material(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: _authenticating ? null : onTap,
                    child: Center(child: content),
                  ),
                ),
              );
            }).toList(),
          ),
        );
      }).toList(),
    );
  }
}
