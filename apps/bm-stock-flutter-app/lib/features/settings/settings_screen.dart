import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_event.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/localization/locale_provider.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/language_selector.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/services/issue_report_service.dart';
import '../../core/services/biometric_service.dart';
import '../home/main_shell.dart';
import 'privacy_policy_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kRed = Color(0xFFEF4444);

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _companyController;
  late TextEditingController _phoneController;
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    _companyController = TextEditingController(text: user?.companyName ?? 'BM Stock IMS');
    _phoneController = TextEditingController(text: user?.phone ?? 'Not Provided');
    _firstNameController = TextEditingController(text: user?.firstName ?? '');
    _lastNameController = TextEditingController(text: user?.lastName ?? '');
  }

  @override
  void dispose() {
    _companyController.dispose();
    _phoneController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  void _startEditing() {
    setState(() => _isEditing = true);
  }

  Future<void> _handleSaveCompanyProfile() async {
    final companyName = _companyController.text.trim();
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();

    if (companyName.isEmpty || firstName.isEmpty || lastName.isEmpty) {
      showAppToast(context, 'Please fill in all fields', type: AppToastType.error);
      return;
    }

    context.read<AuthBloc>().add(UpdateProfileEvent(
      companyName: companyName,
      firstName: firstName,
      lastName: lastName,
    ));
    setState(() => _isEditing = false);
    if (mounted) {
      showAppToast(context, 'Profile saved successfully!', type: AppToastType.success);
    }
  }

  Future<void> _showBiometricSettingsDialog() async {
    final tr = (String key) => context.tr(key);
    final isSupported = await BiometricService.instance.isDeviceSupported();
    final isEnrolled = await BiometricService.instance.isBiometricEnrolled();

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              const Icon(Icons.fingerprint_rounded, color: _kBlue, size: 24),
              const SizedBox(width: 8),
              Text(
                tr('fingerprint_unlock'),
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  color: _kInk,
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isEnrolled ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isEnrolled ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      isEnrolled ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                      color: isEnrolled ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        isEnrolled
                            ? 'Fingerprint sensor is ready and active for fast login.'
                            : (isSupported
                                ? 'No fingerprint enrolled in device settings.'
                                : 'Biometric authentication is not supported on this device.'),
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: isEnrolled ? const Color(0xFF166534) : const Color(0xFF991B1B),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'When active, you can sign in instantly by touching your fingerprint sensor instead of typing credentials or a PIN.',
                style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
            ),
            if (isEnrolled)
              ElevatedButton.icon(
                onPressed: () async {
                  final result = await BiometricService.instance.authenticate(
                    localizedReason: 'Testing fingerprint sensor for BM Stock',
                  );
                  if (!ctx.mounted) return;
                  if (result.isSuccess) {
                    Navigator.pop(ctx);
                    if (context.mounted) {
                      showAppToast(context, 'Fingerprint verified successfully!', type: AppToastType.success);
                    }
                  } else if (result.errorMessage != null) {
                    if (context.mounted) {
                      showAppToast(context, result.errorMessage!, type: AppToastType.error);
                    }
                  }
                },
                icon: const Icon(Icons.fingerprint_rounded, size: 18),
                label: const Text('Test Fingerprint'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kBlue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showChangePasswordDialog() {
    final tr = (String key) => context.tr(key);
    final currentPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              const Icon(Icons.lock_reset_outlined, color: _kBlue, size: 24),
              const SizedBox(width: 8),
              Text(
                tr('change_password'),
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  color: _kInk,
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: currentPasswordController,
                  obscureText: true,
                  decoration: _inputDecoration(tr('password')),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: newPasswordController,
                  obscureText: true,
                  decoration: _inputDecoration(tr('password')),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: confirmPasswordController,
                  obscureText: true,
                  decoration: _inputDecoration(tr('confirm_password')),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final curr = currentPasswordController.text.trim();
                      final newPwd = newPasswordController.text.trim();
                      final conf = confirmPasswordController.text.trim();

                      if (curr.isEmpty || newPwd.isEmpty) {
                        showAppToast(context, context.tr('fill_all_password_fields'));
                        return;
                      }
                      if (newPwd != conf) {
                        showAppToast(context, tr('passwords_dont_match'));
                        return;
                      }

                      setDialogState(() => isSubmitting = true);
                      context.read<AuthBloc>().add(ChangePasswordEvent(currentPassword: curr, newPassword: newPwd));
                      await Future.delayed(const Duration(milliseconds: 500));
                      setDialogState(() => isSubmitting = false);

                      if (mounted) {
                        Navigator.pop(ctx);
                        final authState = context.read<AuthBloc>().state;
                        final ok = authState is PasswordChangeSuccess;
                        showAppToast(context, ok ? 'Password updated successfully!' : 'Failed to change password',
                            type: ok ? AppToastType.success : AppToastType.error);
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: _kBlue,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: isSubmitting
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(tr('save'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  void _showLogoutDialog() {
    final tr = (String key) => context.tr(key);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          tr('logout'),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk),
        ),
        content: Text(
          'Are you sure you want to log out of your account?',
          style: GoogleFonts.outfit(fontSize: 14, color: _kSlate),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              context.read<AuthBloc>().add(const LogoutEvent());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _kRed,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text(tr('logout'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  void _showDeleteAccountDialog() {
    final tr = (String key) => context.tr(key);
    final authState = context.read<AuthBloc>().state;
    final currentUser = authState is AuthAuthenticated ? authState.user : null;
    final isCompanyAdmin = currentUser?.isCompanyAdmin ?? false;

    final phoneController = TextEditingController(text: currentUser?.phone ?? '');
    final otpController = TextEditingController();
    final confirmController = TextEditingController();

    int step = 0; // 0 = Phone confirmation, 1 = OTP entry
    bool isMatch = false;
    bool isSendingOtp = false;
    bool isDeleting = false;
    String? errorMessage;
    String? devOtpInfo;
    int resendCountdown = 0;
    Timer? countdownTimer;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          void startTimer() {
            countdownTimer?.cancel();
            resendCountdown = 60;
            countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
              if (resendCountdown <= 1) {
                t.cancel();
                setDialogState(() => resendCountdown = 0);
              } else {
                setDialogState(() => resendCountdown--);
              }
            });
          }

          Future<void> sendOtp() async {
            final targetPhone = phoneController.text.trim();
            if (targetPhone.isEmpty) {
              setDialogState(() => errorMessage = 'Phone number is required for OTP verification.');
              return;
            }
            setDialogState(() {
              isSendingOtp = true;
              errorMessage = null;
            });
            try {
              final res = await ApiClient().post('/users/me/send-delete-otp', body: {'phone': targetPhone});
              final code = res is Map ? res['code']?.toString() : null;
              final msg = res is Map ? res['message']?.toString() : 'Verification code sent to your phone.';
              setDialogState(() {
                step = 1;
                isSendingOtp = false;
                devOtpInfo = code;
              });
              startTimer();
              if (mounted) {
                showAppToast(context, msg ?? 'OTP sent successfully', type: AppToastType.success);
              }
            } catch (err) {
              final msg = err is ApiException ? err.message : err.toString();
              setDialogState(() {
                isSendingOtp = false;
                errorMessage = msg;
              });
            }
          }

          Future<void> confirmDelete() async {
            final otp = otpController.text.trim();
            if (otp.length < 4) {
              setDialogState(() => errorMessage = 'Please enter the 6-digit verification code.');
              return;
            }
            setDialogState(() {
              isDeleting = true;
              errorMessage = null;
            });
            try {
              final targetPhone = phoneController.text.trim();
              await ApiClient().delete('/users/me', body: {
                'otp': otp,
                'phone': targetPhone,
              });
              countdownTimer?.cancel();
              if (mounted) {
                Navigator.pop(ctx);
                showAppToast(context, 'Account deleted permanently.', type: AppToastType.success);
                context.read<AuthBloc>().add(const LogoutEvent());
                Navigator.of(context).pushNamedAndRemoveUntil('/auth', (route) => false);
              }
            } catch (err) {
              final msg = err is ApiException ? err.message : err.toString();
              setDialogState(() {
                isDeleting = false;
                errorMessage = msg;
              });
            }
          }

          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: _kRed, size: 24),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isCompanyAdmin ? 'Delete Account & Erase Data' : 'Delete Account',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                      color: _kRed,
                    ),
                  ),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: isCompanyAdmin
                  ? (step == 0
                      // Step 0: Phone number confirmation for company admin
                      ? Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFFECACA)),
                              ),
                              child: Text(
                                'Permanent Action: Deleting your Company Admin account will permanently erase your business profile, shops, warehouses, inventory records, and staff accounts.',
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: const Color(0xFF991B1B),
                                  height: 1.4,
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              'Phone Number for OTP Verification:',
                              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: phoneController,
                              keyboardType: TextInputType.phone,
                              decoration: _inputDecoration('Phone number (+251...)'),
                            ),
                            if (errorMessage != null) ...[
                              const SizedBox(height: 8),
                              Text(errorMessage!, style: GoogleFonts.outfit(fontSize: 12, color: _kRed, fontWeight: FontWeight.w500)),
                            ],
                          ],
                        )
                      // Step 1: OTP input for company admin
                      : Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFBFDBFE)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Verification code sent to ${phoneController.text.trim()}',
                                    style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF1E40AF)),
                                  ),
                                  if (devOtpInfo != null) ...[
                                    const SizedBox(height: 4),
                                    Text('Demo OTP Code: $devOtpInfo', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF15803D))),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              'Enter 6-Digit OTP Code:',
                              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: otpController,
                              keyboardType: TextInputType.number,
                              maxLength: 6,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 6),
                              decoration: _inputDecoration('000000'),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                TextButton(
                                  onPressed: isSendingOtp
                                      ? null
                                      : () {
                                          setDialogState(() {
                                            step = 0;
                                            errorMessage = null;
                                          });
                                        },
                                  child: Text('Change Phone', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                                ),
                                resendCountdown > 0
                                    ? Text('Resend in ${resendCountdown}s', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate))
                                    : TextButton(
                                        onPressed: isSendingOtp ? null : sendOtp,
                                        child: Text('Resend OTP', style: GoogleFonts.outfit(fontSize: 12, color: _kBlue, fontWeight: FontWeight.w600)),
                                      ),
                              ],
                            ),
                            if (errorMessage != null) ...[
                              const SizedBox(height: 4),
                              Text(errorMessage!, style: GoogleFonts.outfit(fontSize: 12, color: _kRed, fontWeight: FontWeight.w500)),
                            ],
                          ],
                        ))
                  // Non-company admin regular flow
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'This action is permanent and cannot be undone. All your business data, staff assignments, and records will be deleted.',
                          style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Type "delete" below to confirm account deletion:',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _kInk,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: confirmController,
                          autofocus: true,
                          decoration: _inputDecoration('Type delete'),
                          onChanged: (val) {
                            setDialogState(() {
                              isMatch = val.trim().toLowerCase() == 'delete';
                            });
                          },
                        ),
                      ],
                    ),
            ),
            actions: [
              TextButton(
                onPressed: (isSendingOtp || isDeleting)
                    ? null
                    : () {
                        countdownTimer?.cancel();
                        Navigator.pop(ctx);
                      },
                child: Text(tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
              ),
              if (isCompanyAdmin) ...[
                if (step == 0)
                  ElevatedButton(
                    onPressed: isSendingOtp ? null : sendOtp,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kBlue,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: isSendingOtp
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('Send Verification Code', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
                  )
                else
                  ElevatedButton(
                    onPressed: isDeleting ? null : confirmDelete,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kRed,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: isDeleting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('Verify & Delete Account', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
                  ),
              ] else
                ElevatedButton(
                  onPressed: isMatch
                      ? () {
                          Navigator.pop(ctx);
                          context.read<AuthBloc>().add(const DeleteAccountEvent());
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kRed,
                    disabledBackgroundColor: const Color(0xFFFCA5A5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                    'Delete My Account',
                    style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  void _showReportIssueBottomSheet() {
    final titleController = TextEditingController();
    final descriptionController = TextEditingController();
    String selectedCategory = 'Bug Report';
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
            top: 20,
            left: 20,
            right: 20,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.bug_report_outlined, color: _kBlue, size: 24),
                        const SizedBox(width: 8),
                        Text(
                          'Report an Issue',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: _kInk,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: _kSlate),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Have a problem or suggestion? Let our technical support team know.',
                  style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                ),
                const SizedBox(height: 16),
                Text(
                  'Category',
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: selectedCategory,
                  decoration: _inputDecoration('Category'),
                  items: ['Bug Report', 'Feature Request', 'Payment Issue', 'Other']
                      .map((cat) => DropdownMenuItem(value: cat, child: Text(cat, style: GoogleFonts.outfit())))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setSheetState(() => selectedCategory = val);
                  },
                ),
                const SizedBox(height: 14),
                Text(
                  'Subject',
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: titleController,
                  decoration: _inputDecoration('Brief summary of the issue'),
                ),
                const SizedBox(height: 14),
                Text(
                  'Description',
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: descriptionController,
                  maxLines: 4,
                  decoration: _inputDecoration('Describe what happened or what feature you need...'),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final title = titleController.text.trim();
                            final desc = descriptionController.text.trim();
                            if (title.isEmpty || desc.isEmpty) {
                              showAppToast(context, 'Please provide both subject and description', type: AppToastType.error);
                              return;
                            }
                            setSheetState(() => isSubmitting = true);
                            try {
                              await IssueReportService().submitIssueReport(
                                title: title,
                                description: desc,
                                category: selectedCategory,
                                appType: 'flutter',
                              );
                              if (mounted) {
                                Navigator.pop(ctx);
                                showAppToast(context, 'Report submitted successfully! Thank you.', type: AppToastType.success);
                              }
                            } catch (e) {
                              if (mounted) {
                                setSheetState(() => isSubmitting = false);
                                showAppToast(context, 'Failed to submit report. Please try again.', type: AppToastType.error);
                              }
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kBlue,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: isSubmitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('Submit Report', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, {bool readOnly = false}) {
    return InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 14),
      filled: true,
      fillColor: readOnly ? const Color(0xFFF1F5F9) : const Color(0xFFF8FAFC),
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
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  @override
  Widget build(BuildContext context) {
    context.watch<LocaleProvider>();
    final tr = (String key) => context.tr(key);

    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;

    final canAccessSettings = user != null &&
        (user.isAdmin || user.canViewModule(ModuleKeys.settings));

    if (!canAccessSettings) {
      return Scaffold(
        backgroundColor: _kBg,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            tr('settings'),
            style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.lock_outline, size: 52, color: _kSlate.withValues(alpha: 0.4)),
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  tr('no_access'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(fontSize: 15, color: _kSlate),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthUnauthenticated) {
          Navigator.of(context).pushNamedAndRemoveUntil(
            '/auth',
            (route) => false,
          );
        } else if (state is AccountDeleteFailed) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(
              SnackBar(
                backgroundColor: _kRed,
                content: Text(
                  state.message,
                  style: GoogleFonts.outfit(color: Colors.white),
                ),
                behavior: SnackBarBehavior.floating,
              ),
            );
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
          title: Text(
            tr('settings'),
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _kInk,
            ),
          ),
        ),
        body: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              if (user != null && (user.planTitle != null || user.subscriptionExpiresAt != null))
                _buildSectionCard(
                  icon: Icons.card_membership_outlined,
                  title: tr('subscription'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _subscriptionRow(tr('selected_plan'), user.planTitle ?? '—'),
                      _subscriptionRow(tr('subscription_status'), user.paymentStatus ?? user.status),
                      if (user.planAmount != null)
                        _subscriptionRow(tr('amount'), 'ETB ${user.planAmount!.toStringAsFixed(0)}'),
                      if (user.subscriptionStartDate != null)
                        _subscriptionRow(tr('subscription_start'), _formatDate(user.subscriptionStartDate!)),
                      if (user.subscriptionPaymentDate != null)
                        _subscriptionRow(tr('payment_date'), _formatDate(user.subscriptionPaymentDate!)),
                      if (user.subscriptionNextPaymentDate != null)
                        _subscriptionRow(tr('next_payment_date'), _formatDate(user.subscriptionNextPaymentDate!)),
                      if (user.subscriptionExpiresAt != null)
                        _subscriptionRow(tr('subscription_expiry'), _formatDate(user.subscriptionExpiresAt!)),
                    ],
                  ),
                ),
              if (user != null && (user.planTitle != null || user.subscriptionExpiresAt != null))
                const SizedBox(height: 16),
              _buildCompanyProfileCard(tr),
              const SizedBox(height: 16),
              _buildSectionCard(
                icon: Icons.notifications_none_outlined,
                  title: tr('notifications'),
                  child: Column(
                    children: [
                      _buildToggleRow(
                        title: tr('notifications'),
                        subtitle: tr('push_notifications_desc'),
                        value: user?.pushNotificationsEnabled ?? true,
                        onChanged: (val) {
                          context.read<AuthBloc>().add(UpdateProfileEvent(pushNotificationsEnabled: val));
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildSectionCard(
                  icon: Icons.language_outlined,
                  title: tr('language'),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        tr('language'),
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: _kInk,
                        ),
                      ),
                      const LanguageSelectorDropdown(),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              _buildSectionCard(
                icon: Icons.help_outline_rounded,
                title: 'Help & Support',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.bug_report_outlined, color: _kBlue),
                  title: Text('Report an Issue / Feedback', style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk)),
                  subtitle: Text('Submit bugs, payment problems or feature ideas to technical support', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                  trailing: const Icon(Icons.chevron_right, color: _kSlate),
                  onTap: _showReportIssueBottomSheet,
                ),
              ),
              const SizedBox(height: 16),
              _buildSectionCard(
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy Policy',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.privacy_tip_outlined, color: _kBlue),
                  title: Text('How we collect, use and protect your data', style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk)),
                  subtitle: Text('Covers Fayda ID, TIN, payment data and retention', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                  trailing: const Icon(Icons.chevron_right, color: _kSlate),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              _buildSectionCard(
                icon: Icons.lock_outline_rounded,
                title: tr('logout'),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _showLogoutDialog,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kRed,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: Text(
                      tr('logout'),
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
                const SizedBox(height: 16),
              if ((user?.canEditModule(ModuleKeys.staffManagement) ?? user?.isAdmin ?? false)) ...[
                _buildSectionCard(
                  icon: Icons.admin_panel_settings_outlined,
                  title: tr('permissions_access'),
                  child: Column(
                    children: [
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.shield_outlined, color: _kBlue),
                        title: Text(tr('permissions_access'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk)),
                        subtitle: Text(tr('permissions_access_subtitle'), style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                        trailing: const Icon(Icons.chevron_right, color: _kSlate),
                        onTap: () => Navigator.pushNamed(context, '/staff-access'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (user?.isAdmin ?? true) ...[
                _buildSectionCard(
                  icon: Icons.delete_forever_outlined,
                  title: tr('delete_account'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Permanently remove your account and all associated company data.',
                        style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: OutlinedButton.icon(
                          onPressed: _showDeleteAccountDialog,
                          icon: const Icon(Icons.delete_forever_outlined, color: _kRed, size: 20),
                          label: Text(
                            'Delete Account',
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: _kRed,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFFFCA5A5)),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            backgroundColor: const Color(0xFFFEF2F2),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ],
          ),
        ),
        bottomNavigationBar: _buildBottomNav(),
      ),
    );
  }

  String _formatDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso.split('T').first;
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Widget _subscriptionRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: Text(label, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate))),
          Expanded(flex: 3, child: Text(value, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk))),
        ],
      ),
    );
  }

  Widget _buildCompanyProfileCard(String Function(String) tr) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                onPressed: _isEditing ? _handleSaveCompanyProfile : _startEditing,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                visualDensity: VisualDensity.compact,
                tooltip: _isEditing ? 'Save' : 'Edit',
                icon: Icon(
                  _isEditing ? Icons.check_rounded : Icons.edit_outlined,
                  color: _kBlue,
                  size: 20,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.apartment_outlined, color: _kBlue, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Company & Profile',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _kInk,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(tr('company_name'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
          const SizedBox(height: 8),
          TextField(
            controller: _companyController,
            readOnly: !_isEditing,
            decoration: _inputDecoration(tr('company_name'), readOnly: !_isEditing),
          ),
          const SizedBox(height: 16),
          Text(tr('first_name'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
          const SizedBox(height: 8),
          TextField(
            controller: _firstNameController,
            readOnly: !_isEditing,
            decoration: _inputDecoration(tr('first_name'), readOnly: !_isEditing),
          ),
          const SizedBox(height: 16),
          Text(tr('last_name'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
          const SizedBox(height: 8),
          TextField(
            controller: _lastNameController,
            readOnly: !_isEditing,
            decoration: _inputDecoration(tr('last_name'), readOnly: !_isEditing),
          ),
          const SizedBox(height: 16),
          Text(tr('phone_number'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
          const SizedBox(height: 8),
          TextField(
            controller: _phoneController,
            readOnly: true,
            decoration: _inputDecoration(tr('phone_number'), readOnly: true),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton(
              onPressed: _showChangePasswordDialog,
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: _kBorder),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                backgroundColor: const Color(0xFFF8FAFC),
              ),
              child: Text(
                tr('change_password'),
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: _kInk,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton(
              onPressed: _showBiometricSettingsDialog,
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: _kBorder),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                backgroundColor: const Color(0xFFF8FAFC),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.fingerprint_rounded, size: 20, color: _kBlue),
                  const SizedBox(width: 8),
                  Text(
                    tr('fingerprint_unlock'),
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: _kInk,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({
    required IconData icon,
    required String title,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: _kBlue, size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: _kInk,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _buildToggleRow({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: _kInk,
                ),
              ),
              Text(
                subtitle,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: _kSlate,
                ),
              ),
            ],
          ),
        ),
        Switch.adaptive(
          value: value,
          onChanged: onChanged,
          activeColor: _kBlue,
        ),
      ],
    );
  }

  Widget _buildBottomNav() {
    final tr = (String key) => context.tr(key);
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final entries = <_SettingsNavEntry>[
      _SettingsNavEntry(
        icon: Icons.home_outlined,
        label: tr('home'),
        onTap: () => MainShell.goTo(context, MainTab.home),
      ),
      _SettingsNavEntry(
        icon: Icons.inventory_2_outlined,
        label: tr('stock'),
        onTap: () => Navigator.pushReplacementNamed(context, '/stock_in'),
        visible: user?.canViewModule(ModuleKeys.stockInOut) ?? true,
      ),
      _SettingsNavEntry(
        icon: Icons.point_of_sale_outlined,
        label: tr('sales'),
        onTap: () => Navigator.pushReplacementNamed(context, '/new_sale'),
        visible: user?.canViewModule(ModuleKeys.salesAndInvoices) ?? true,
      ),
      _SettingsNavEntry(
        icon: Icons.bar_chart_outlined,
        label: tr('reports'),
        onTap: () => Navigator.pushReplacementNamed(context, '/reports'),
        visible: user?.canViewModule(ModuleKeys.reports) ?? true,
      ),
      _SettingsNavEntry(
        icon: Icons.more_horiz_outlined,
        label: tr('more'),
        onTap: () => MainShell.goTo(context, MainTab.more),
      ),
    ].where((entry) => entry.visible).toList();

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _kBorder)),
      ),
      child: BottomNavigationBar(
        currentIndex: entries.length - 1,
        onTap: (index) {
          if (index == entries.length - 1) return;
          entries[index].onTap();
        },
        type: BottomNavigationBarType.fixed,
        selectedItemColor: _kBlue,
        unselectedItemColor: _kSlate,
        selectedLabelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.outfit(fontSize: 12),
        items: entries
            .map((entry) => BottomNavigationBarItem(icon: Icon(entry.icon), label: entry.label))
            .toList(),
      ),
    );
  }
}

class _SettingsNavEntry {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool visible;

  const _SettingsNavEntry({
    required this.icon,
    required this.label,
    required this.onTap,
    this.visible = true,
  });
}