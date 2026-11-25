import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/widgets/account_blocked_dialog.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_event.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/biometric_service.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/language_selector.dart';
import '../../core/widgets/ethiopian_phone_field.dart';
import '../../core/utils/phone_util.dart';
import 'forgot_password_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _adminFormKey = GlobalKey<FormState>();
  final _staffFormKey = GlobalKey<FormState>();

  bool _checkedBlockedArgs = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_checkedBlockedArgs) {
      _checkedBlockedArgs = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final args =
            ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
        if (args != null && args['blockedReason'] != null) {
          final reason = args['blockedReason'] as AccountBlockReason;
          final msg = args['blockedMessage'] as String?;
          final phone = args['phone'] as String?;
          showAccountBlockedDialog(
            context,
            reason: reason,
            message: msg,
            phone: phone,
            onDismiss: () =>
                context.read<AuthBloc>().add(const ClearAuthError()),
          );
        }
      });
    }
  }

  // Mode: true = Device configured (Biometric Unlock), false = First-time setup
  bool _deviceConfigured = false;
  bool _loadingConfig = true;

  // Saved device credentials
  String? _savedRole;
  String? _savedAccountId;
  String? _savedDisplayName;
  String? _savedCompanyName;

  // Biometric state
  bool _biometricAvailable = false;
  bool _biometricAuthInProgress = false;
  String? _biometricError;

  // First-Time Setup State
  String _activeTab = 'admin'; // 'admin' or 'staff'

  // Admin Form Controllers
  final _adminPhoneController = TextEditingController();
  final _adminEmailController = TextEditingController();
  final _adminPasswordController = TextEditingController();
  bool _showAdminPassword = false;

  // Staff Form Controllers
  final _staffCompanyController = TextEditingController();
  final _staffCompanyPasswordController = TextEditingController();
  final _staffPhoneController = TextEditingController();
  final _staffPinController = TextEditingController();
  bool _showStaffCompanyPassword = false;

  // Quick Unlock with PIN state
  bool _usePinForQuickUnlock = false;
  final _quickUnlockPinController = TextEditingController();



  @override
  void initState() {
    super.initState();
    _loadDeviceConfiguration();
  }

  Future<void> _loadDeviceConfiguration() async {
    final prefs = await SharedPreferences.getInstance();
    final isConfigured = prefs.getBool('auth_device_configured') ?? false;
    final role = prefs.getString('auth_role');
    final accountId = prefs.getString('auth_account_id');
    final displayName = prefs.getString('auth_display_name');
    final companyName = prefs.getString('auth_company_name');

    final deviceConfigured =
        isConfigured && accountId != null && accountId.isNotEmpty;

    // Check biometric availability
    bool biometricAvailable = false;
    if (deviceConfigured) {
      try {
        final isSupported = await BiometricService.instance.isDeviceSupported();
        final isEnrolled = await BiometricService.instance.isBiometricEnrolled();
        biometricAvailable = isSupported && isEnrolled;
      } catch (_) {
        biometricAvailable = false;
      }
    }

    if (!mounted) return;
    setState(() {
      _deviceConfigured = deviceConfigured;
      _savedRole = role;
      _savedAccountId = accountId;
      _savedDisplayName = displayName;
      _savedCompanyName = companyName;
      _biometricAvailable = biometricAvailable;
      // If biometric is NOT supported on device, default to normal PIN!
      _usePinForQuickUnlock = !biometricAvailable;
      _loadingConfig = false;
    });

    if (_deviceConfigured && _biometricAvailable && !_usePinForQuickUnlock) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _triggerBiometricAuth();
      });
    }
  }

  Future<void> _handleSwitchAccount() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_device_configured');
    await prefs.remove('auth_role');
    await prefs.remove('auth_account_id');
    await prefs.remove('auth_display_name');
    await prefs.remove('auth_company_name');
    await prefs.remove('refresh_token');
    await prefs.remove('biometric_token');

    if (!mounted) return;
    setState(() {
      _deviceConfigured = false;
      _savedRole = null;
      _savedAccountId = null;
      _savedDisplayName = null;
      _savedCompanyName = null;
      _biometricError = null;
    });
  }

  @override
  void dispose() {
    _adminPhoneController.dispose();
    _adminEmailController.dispose();
    _adminPasswordController.dispose();
    _staffCompanyController.dispose();
    _staffCompanyPasswordController.dispose();
    _staffPhoneController.dispose();
    _staffPinController.dispose();
    _quickUnlockPinController.dispose();
    super.dispose();
  }

  Future<void> _triggerBiometricAuth() async {
    if (_biometricAuthInProgress || _savedAccountId == null) return;

    setState(() {
      _biometricAuthInProgress = true;
      _biometricError = null;
    });

    final result = await BiometricService.instance.authenticate(
      localizedReason: 'Scan your fingerprint to sign in to BM Stock',
    );

    if (!mounted) return;

    if (result.isSuccess) {
      context.read<AuthBloc>().add(BiometricUnlockEvent(
            role: _savedRole ?? 'admin',
            accountId: _savedAccountId!,
          ));
    } else {
      setState(() {
        _biometricAuthInProgress = false;
        _biometricError = result.errorMessage;
      });
    }
  }

  void _submitAdminLogin() async {
    if (!_adminFormKey.currentState!.validate()) return;
    final identifier = _adminPhoneController.text.trim();
    final password = _adminPasswordController.text;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_phone', identifier);

    if (!mounted) return;
    context.read<AuthBloc>().add(CAdminFirstLoginEvent(
          email: identifier,
          password: password,
        ));
  }

  void _submitStaffLogin() async {
    if (!_staffFormKey.currentState!.validate()) return;
    final companyName = _staffCompanyController.text.trim();
    final companyPassword = _staffCompanyPasswordController.text;
    final phone = _staffPhoneController.text.trim();
    final pin = _staffPinController.text.trim();

    if (phone.isNotEmpty) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_phone', phone);
    }

    if (!mounted) return;
    context.read<AuthBloc>().add(StaffFirstLoginEvent(
          companyName: companyName,
          companyPassword: companyPassword.isNotEmpty ? companyPassword : null,
          phone: phone.isNotEmpty ? phone : null,
          pin: pin,
        ));
  }

  @override
  Widget build(BuildContext context) {
    String tr(String key) => context.tr(key);

    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          Navigator.pushReplacementNamed(context, '/home');
        } else if (state is AuthAccountBlocked) {
          final reason = accountBlockReasonFromCode(state.reasonCode);
          final enteredPhone = _activeTab == 'staff'
              ? _staffPhoneController.text.trim()
              : _adminPhoneController.text.trim();
          final phone = (state.phone != null && state.phone!.isNotEmpty)
              ? state.phone!
              : (enteredPhone.isNotEmpty ? enteredPhone : null);
          showAccountBlockedDialog(
            context,
            reason: reason ?? AccountBlockReason.subscriptionExpired,
            message: state.message,
            phone: phone,
            onDismiss: () =>
                context.read<AuthBloc>().add(const ClearAuthError()),
          );
        } else if (state is AuthError) {
          showAppToast(context, state.message, type: AppToastType.error);
          if (_deviceConfigured) {
            setState(() {
              _biometricAuthInProgress = false;
              _biometricError = state.message;
            });
          }
        }
      },
      builder: (context, state) {
        final isLoading = state is AuthLoading;

        String headerTitle;
        String headerSubtitle;
        if (_deviceConfigured) {
          if (_usePinForQuickUnlock) {
            headerTitle = tr('enter_pin');
            headerSubtitle = tr('please_enter_pin');
          } else {
            headerTitle = tr('fingerprint_unlock');
            headerSubtitle = tr('use_fingerprint_to_sign_in');
          }
        } else {
          headerTitle = tr('welcome_title');
          headerSubtitle = tr('welcome_subtitle');
        }

        return Scaffold(
          backgroundColor: Colors.white,
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0,
            actions: const [
              Padding(
                padding: EdgeInsets.only(right: 16.0),
                child: Center(child: LanguageSelectorDropdown()),
              ),
            ],
          ),
          body: _loadingConfig
              ? const Center(child: CircularProgressIndicator())
              : SafeArea(
                  child: Center(
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 8),
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
                          const SizedBox(height: 16),
                          Center(
                            child: Text(
                              headerTitle,
                              style: GoogleFonts.outfit(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Center(
                            child: Text(
                              headerSubtitle,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          if (_deviceConfigured)
                            if (_usePinForQuickUnlock)
                              _buildPinQuickUnlockView(isLoading, tr)
                            else
                              _buildBiometricUnlockView(isLoading, tr)
                          else
                            _buildFirstTimeSetupView(isLoading, tr),
                        ],
                      ),
                    ),
                  ),
                ),
        );
      },
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW 1: BIOMETRIC / FINGERPRINT UNLOCK (DEVICE CONFIGURED)
  // ══════════════════════════════════════════════════════════
  Widget _buildBiometricUnlockView(bool isLoading, String Function(String) tr) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // User profile badge
        Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFFE0F2FE),
                child: Text(
                  (_savedDisplayName?.isNotEmpty ?? false)
                      ? _savedDisplayName![0].toUpperCase()
                      : 'U',
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF025EA7),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _savedDisplayName ?? 'User',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF0F172A),
                ),
              ),
              if (_savedCompanyName != null &&
                  _savedCompanyName!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.business_rounded,
                          size: 12, color: Color(0xFF025EA7)),
                      const SizedBox(width: 4),
                      Text(
                        _savedCompanyName!,
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF025EA7),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 32),

        // Fingerprint icon & tap-to-retry area
        Center(
          child: GestureDetector(
            onTap: (isLoading || _biometricAuthInProgress)
                ? null
                : _triggerBiometricAuth,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: _biometricError != null
                    ? const Color(0xFFFEF2F2)
                    : const Color(0xFFE0F2FE),
                shape: BoxShape.circle,
                border: Border.all(
                  color: _biometricError != null
                      ? const Color(0xFFFCA5A5)
                      : const Color(0xFF025EA7).withValues(alpha: 0.3),
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: (_biometricError != null
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF025EA7))
                        .withValues(alpha: 0.12),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Center(
                child: isLoading || _biometricAuthInProgress
                    ? const SizedBox(
                        width: 32,
                        height: 32,
                        child: CircularProgressIndicator(
                          color: Color(0xFF025EA7),
                          strokeWidth: 3,
                        ),
                      )
                    : Icon(
                        Icons.fingerprint_rounded,
                        size: 48,
                        color: _biometricError != null
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF025EA7),
                      ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Status text
        Center(
          child: Text(
            isLoading || _biometricAuthInProgress
                ? tr('verifying_fingerprint')
                : (_biometricError != null
                    ? tr('tap_to_try_again')
                    : tr('touch_fingerprint_sensor')),
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: _biometricError != null
                  ? const Color(0xFFEF4444)
                  : const Color(0xFF64748B),
            ),
          ),
        ),

        // Error message if any
        if (_biometricError != null) ...[
          const SizedBox(height: 8),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _biometricError!,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: const Color(0xFFEF4444),
                ),
              ),
            ),
          ),
        ],

        const SizedBox(height: 24),

        // Retry button
        SizedBox(
          height: 48,
          child: ElevatedButton.icon(
            onPressed: (isLoading || _biometricAuthInProgress)
                ? null
                : _triggerBiometricAuth,
            icon: const Icon(Icons.fingerprint_rounded, size: 20),
            label: Text(
              tr('sign_in_with_fingerprint'),
              style: GoogleFonts.outfit(
                  fontSize: 15, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF025EA7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              disabledBackgroundColor: const Color(0xFFE2E8F0),
              disabledForegroundColor: const Color(0xFF94A3B8),
            ),
          ),
        ),

        const SizedBox(height: 12),

        // Switch to PIN mode
        Center(
          child: TextButton.icon(
            onPressed: (isLoading || _biometricAuthInProgress)
                ? null
                : () => setState(() {
                    _usePinForQuickUnlock = true;
                    _biometricError = null;
                  }),
            icon: const Icon(Icons.pin_rounded,
                size: 18, color: Color(0xFF025EA7)),
            label: Text(
              tr('use_pin_instead'),
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF025EA7),
              ),
            ),
          ),
        ),

        const SizedBox(height: 12),

        // Switch Account Button
        Center(
          child: TextButton.icon(
            onPressed: isLoading ? null : _handleSwitchAccount,
            icon: const Icon(Icons.swap_horiz_rounded,
                size: 18, color: Color(0xFF64748B)),
            label: Text(
              tr('switch_account'),
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF64748B),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW 2: PIN QUICK UNLOCK (DEVICE CONFIGURED - PIN MODE)
  // ══════════════════════════════════════════════════════════
  Widget _buildPinQuickUnlockView(bool isLoading, String Function(String) tr) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // User profile badge
        Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFFE0F2FE),
                child: Text(
                  (_savedDisplayName?.isNotEmpty ?? false)
                      ? _savedDisplayName![0].toUpperCase()
                      : 'U',
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF025EA7),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _savedDisplayName ?? 'User',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF0F172A),
                ),
              ),
              if (_savedCompanyName != null &&
                  _savedCompanyName!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.business_rounded,
                          size: 12, color: Color(0xFF025EA7)),
                      const SizedBox(width: 4),
                      Text(
                        _savedCompanyName!,
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF025EA7),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 24),

        // 4-dot PIN indicators
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(4, (index) {
            final filled = _quickUnlockPinController.text.length > index;
            final isCurrent = _quickUnlockPinController.text.length == index;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 8),
              width: 52,
              height: 56,
              decoration: BoxDecoration(
                color: filled
                    ? const Color(0xFF025EA7).withValues(alpha: 0.08)
                    : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isCurrent
                      ? const Color(0xFF025EA7)
                      : (filled
                          ? const Color(0xFF025EA7).withValues(alpha: 0.5)
                          : const Color(0xFFCBD5E1)),
                  width: isCurrent ? 2.2 : 1.5,
                ),
                boxShadow: isCurrent
                    ? [
                        BoxShadow(
                          color: const Color(0xFF025EA7).withValues(alpha: 0.15),
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
                  color: const Color(0xFF025EA7),
                ),
              ),
            );
          }),
        ),

        const SizedBox(height: 20),

        // Numeric Keypad
        _buildLoginNumericKeypad(isLoading),

        const SizedBox(height: 16),

        // Submit Button
        SizedBox(
          height: 48,
          child: ElevatedButton.icon(
            onPressed: (isLoading || _quickUnlockPinController.text.length != 4)
                ? null
                : () => _submitQuickPinUnlock(_quickUnlockPinController.text),
            icon: isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.lock_open_rounded, size: 20),
            label: Text(
              isLoading ? tr('authenticating') : tr('unlock_with_pin'),
              style: GoogleFonts.outfit(
                  fontSize: 15, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF025EA7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              disabledBackgroundColor: const Color(0xFFE2E8F0),
              disabledForegroundColor: const Color(0xFF94A3B8),
            ),
          ),
        ),

        // Toggle back to Fingerprint if available
        if (_biometricAvailable) ...[
          const SizedBox(height: 12),
          Center(
            child: TextButton.icon(
              onPressed: isLoading
                  ? null
                  : () {
                      setState(() {
                        _usePinForQuickUnlock = false;
                        _biometricError = null;
                      });
                      _triggerBiometricAuth();
                    },
              icon: const Icon(Icons.fingerprint_rounded,
                  size: 18, color: Color(0xFF025EA7)),
              label: Text(
                tr('use_fingerprint_instead'),
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF025EA7),
                ),
              ),
            ),
          ),
        ],

        const SizedBox(height: 12),

        // Switch Account Button
        Center(
          child: TextButton.icon(
            onPressed: isLoading ? null : _handleSwitchAccount,
            icon: const Icon(Icons.swap_horiz_rounded,
                size: 18, color: Color(0xFF64748B)),
            label: Text(
              tr('switch_account'),
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF64748B),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _submitQuickPinUnlock(String pin) {
    if (pin.length != 4) return;
    context.read<AuthBloc>().add(PinUnlockEvent(
          role: _savedRole ?? 'staff',
          accountId: _savedAccountId ?? '',
          pin: pin,
        ));
  }

  Widget _buildLoginNumericKeypad(bool isLoading) {
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
                onTap = _quickUnlockPinController.text.isEmpty
                    ? null
                    : () => setState(() => _quickUnlockPinController.clear());
              } else if (key == '⌫') {
                content = const Icon(Icons.backspace_outlined,
                    size: 20, color: Color(0xFF64748B));
                onTap = _quickUnlockPinController.text.isEmpty
                    ? null
                    : () {
                        setState(() {
                          _quickUnlockPinController.text =
                              _quickUnlockPinController.text.substring(
                                  0, _quickUnlockPinController.text.length - 1);
                        });
                      };
              } else {
                content = Text(
                  key,
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                );
                onTap = () {
                  if (_quickUnlockPinController.text.length < 4) {
                    setState(() {
                      _quickUnlockPinController.text += key;
                    });
                    if (_quickUnlockPinController.text.length == 4) {
                      _submitQuickPinUnlock(_quickUnlockPinController.text);
                    }
                  }
                };
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
                    onTap: isLoading ? null : onTap,
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

  // ══════════════════════════════════════════════════════════
  // VIEW 3: FIRST-TIME SETUP (ADMIN / STAFF)
  // ══════════════════════════════════════════════════════════
  Widget _buildFirstTimeSetupView(bool isLoading, String Function(String) tr) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Role Segmented Tabs
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _activeTab = 'admin'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _activeTab == 'admin'
                          ? Colors.white
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: _activeTab == 'admin'
                          ? [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.business_center_rounded,
                          size: 16,
                          color: _activeTab == 'admin'
                              ? const Color(0xFF025EA7)
                              : const Color(0xFF64748B),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          tr('company_admin'),
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: _activeTab == 'admin'
                                ? FontWeight.bold
                                : FontWeight.w500,
                            color: _activeTab == 'admin'
                                ? const Color(0xFF025EA7)
                                : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _activeTab = 'staff'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _activeTab == 'staff'
                          ? Colors.white
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: _activeTab == 'staff'
                          ? [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.badge_rounded,
                          size: 16,
                          color: _activeTab == 'staff'
                              ? const Color(0xFF025EA7)
                              : const Color(0xFF64748B),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          tr('staff_sign_in'),
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: _activeTab == 'staff'
                                ? FontWeight.bold
                                : FontWeight.w500,
                            color: _activeTab == 'staff'
                                ? const Color(0xFF025EA7)
                                : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        if (_activeTab == 'admin')
          _buildAdminForm(isLoading, tr)
        else
          _buildStaffForm(isLoading, tr),
      ],
    );
  }

  // ───── Admin Form (Phone or Email + Password) ─────
  Widget _buildAdminForm(bool isLoading, String Function(String) tr) {
    return Form(
      key: _adminFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Identifier input (Phone)
          EthiopianPhoneField(
            controller: _adminPhoneController,
            label: tr('phone_number'),
            hint: '912 345 678',
            validator: (v) {
              if (v == null || v.trim().isEmpty) {
                return tr('please_enter_phone');
              }
              if (!PhoneUtil.isValidEthiopian(v)) {
                return tr('valid_ethiopian_phone');
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Password
          TextFormField(
            controller: _adminPasswordController,
            obscureText: !_showAdminPassword,
            decoration: InputDecoration(
              labelText: tr('password'),
              hintText: tr('enter_password'),
              prefixIcon: const Icon(Icons.lock_outline_rounded,
                  color: Color(0xFF025EA7)),
              suffixIcon: IconButton(
                icon: Icon(
                  _showAdminPassword ? Icons.visibility_off : Icons.visibility,
                  color: const Color(0xFF94A3B8),
                ),
                onPressed: () =>
                    setState(() => _showAdminPassword = !_showAdminPassword),
              ),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            validator: (v) =>
                (v == null || v.isEmpty) ? tr('please_enter_password') : null,
          ),
          const SizedBox(height: 18),

          // Submit Button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: isLoading ? null : _submitAdminLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF025EA7),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : Text(tr('sign_in_as_admin'),
                      style: GoogleFonts.outfit(
                          fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(height: 14),

          // Links
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ForgotPasswordScreen(
                        phone: _adminPhoneController.text.trim(),
                      ),
                    ),
                  );
                },
                child: Text(
                  tr('forget_password'),
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF025EA7),
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/register'),
                child: Text(
                  tr('sign_up'),
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
    );
  }

  // ───── Staff Form ─────
  Widget _buildStaffForm(bool isLoading, String Function(String) tr) {
    return Form(
      key: _staffFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Company Name
          TextFormField(
            controller: _staffCompanyController,
            decoration: InputDecoration(
              labelText: tr('company_name'),
              hintText: tr('eg_company_name'),
              prefixIcon:
                  const Icon(Icons.business_rounded, color: Color(0xFF025EA7)),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            validator: (v) => (v == null || v.trim().isEmpty)
                ? tr('enter_company_name')
                : null,
          ),
          const SizedBox(height: 14),

          // Master Company Password
          TextFormField(
            controller: _staffCompanyPasswordController,
            obscureText: !_showStaffCompanyPassword,
            decoration: InputDecoration(
              labelText: tr('company_password'),
              hintText: '••••••••',
              prefixIcon:
                  const Icon(Icons.lock_outline_rounded, color: Color(0xFF025EA7)),
              suffixIcon: IconButton(
                icon: Icon(
                  _showStaffCompanyPassword
                      ? Icons.visibility_off_rounded
                      : Icons.visibility_rounded,
                  color: const Color(0xFF64748B),
                ),
                onPressed: () {
                  setState(() {
                    _showStaffCompanyPassword = !_showStaffCompanyPassword;
                  });
                },
              ),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            validator: (v) => (v == null || v.isEmpty)
                ? tr('please_enter_company_password')
                : null,
          ),
          const SizedBox(height: 14),


          // Ethiopian Phone Field for Staff
          EthiopianPhoneField(
            controller: _staffPhoneController,
            label: tr('staff_phone_number'),
            hint: '912 345 678',
            validator: (v) {
              if (v == null || v.trim().isEmpty) {
                return tr('please_enter_staff_phone');
              }
              if (!PhoneUtil.isValidEthiopian(v)) {
                return tr('valid_ethiopian_phone');
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Assigned 4-Digit PIN
          TextFormField(
            controller: _staffPinController,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            decoration: InputDecoration(
              labelText: tr('assigned_pin'),
              hintText: '••••',
              counterText: '',
              prefixIcon:
                  const Icon(Icons.pin_outlined, color: Color(0xFF025EA7)),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) {
                return tr('please_enter_pin');
              }
              if (v.trim().length != 4) {
                return tr('pin_must_be_4_digits');
              }
              return null;
            },
          ),
          const SizedBox(height: 6),
          Text(
            tr('staff_pin_hint'),
            style: GoogleFonts.outfit(
                fontSize: 11, color: const Color(0xFF94A3B8)),
          ),
          const SizedBox(height: 18),

          // Submit Button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: isLoading ? null : _submitStaffLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF025EA7),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text(tr('sign_in_as_staff'),
                      style: GoogleFonts.outfit(
                          fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}
