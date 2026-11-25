import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum BiometricAuthStatus {
  success,
  failed,
  notEnrolled,
  notAvailable,
  lockedOut,
  permanentlyLockedOut,
  cancelled,
  error,
}

class BiometricAuthResult {
  final bool isSuccess;
  final BiometricAuthStatus status;
  final String? errorMessage;

  const BiometricAuthResult({
    required this.isSuccess,
    required this.status,
    this.errorMessage,
  });

  factory BiometricAuthResult.success() => const BiometricAuthResult(
        isSuccess: true,
        status: BiometricAuthStatus.success,
      );

  factory BiometricAuthResult.failure(BiometricAuthStatus status,
          [String? message]) =>
      BiometricAuthResult(
        isSuccess: false,
        status: status,
        errorMessage: message,
      );
}

class BiometricService {
  BiometricService._();
  static final BiometricService instance = BiometricService._();

  final LocalAuthentication _auth = LocalAuthentication();

  static const String prefKeyBiometricEnabled = 'auth_biometric_enabled';
  static const String prefKeyStoredRefreshToken = 'auth_refresh_token';

  /// Check if hardware supports biometrics
  Future<bool> isDeviceSupported() async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      return isSupported || canCheck;
    } catch (e) {
      debugPrint('[BIOMETRIC] isDeviceSupported error: $e');
      return false;
    }
  }

  /// Check if the user has enrolled biometrics (e.g. fingerprint)
  Future<bool> isBiometricEnrolled() async {
    try {
      final available = await _auth.getAvailableBiometrics();
      return available.isNotEmpty;
    } catch (e) {
      debugPrint('[BIOMETRIC] isBiometricEnrolled error: $e');
      return false;
    }
  }

  /// Check if device supports fingerprint specifically
  Future<bool> hasFingerprintHardware() async {
    try {
      final available = await _auth.getAvailableBiometrics();
      return available.contains(BiometricType.fingerprint) ||
          available.contains(BiometricType.strong) ||
          available.contains(BiometricType.weak);
    } catch (e) {
      debugPrint('[BIOMETRIC] hasFingerprintHardware error: $e');
      return false;
    }
  }

  /// Get list of available biometric types
  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (e) {
      debugPrint('[BIOMETRIC] getAvailableBiometrics error: $e');
      return [];
    }
  }

  /// Check if fingerprint/biometric sign-in is enabled by user preference
  Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    // If not set, check if device configured and biometric is enrolled
    if (!prefs.containsKey(prefKeyBiometricEnabled)) {
      final configured = prefs.getBool('auth_device_configured') ?? false;
      if (configured) {
        final enrolled = await isBiometricEnrolled();
        if (enrolled) {
          await prefs.setBool(prefKeyBiometricEnabled, true);
          return true;
        }
      }
      return false;
    }
    return prefs.getBool(prefKeyBiometricEnabled) ?? false;
  }

  /// Toggle fingerprint/biometric sign-in preference
  Future<void> setBiometricEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(prefKeyBiometricEnabled, enabled);
  }

  /// Authenticate with fingerprint/biometric
  Future<BiometricAuthResult> authenticate({
    required String localizedReason,
    bool biometricOnly = true,
  }) async {
    try {
      final isSupported = await isDeviceSupported();
      if (!isSupported) {
        return BiometricAuthResult.failure(
          BiometricAuthStatus.notAvailable,
          'Biometric hardware is not supported or available on this device.',
        );
      }

      final enrolled = await isBiometricEnrolled();
      if (!enrolled) {
        return BiometricAuthResult.failure(
          BiometricAuthStatus.notEnrolled,
          'No fingerprint or biometric credentials enrolled on this device. Please set up a fingerprint in device Settings.',
        );
      }

      final bool didAuthenticate = await _auth.authenticate(
        localizedReason: localizedReason,
        biometricOnly: biometricOnly,
        persistAcrossBackgrounding: true,
      );

      if (didAuthenticate) {
        return BiometricAuthResult.success();
      } else {
        return BiometricAuthResult.failure(
          BiometricAuthStatus.failed,
          'Fingerprint not recognized. Please try again.',
        );
      }
    } on LocalAuthException catch (e) {
      debugPrint('[BIOMETRIC] LocalAuthException: code=${e.code}, msg=${e.description}');
      switch (e.code) {
        case LocalAuthExceptionCode.noBiometricsEnrolled:
        case LocalAuthExceptionCode.noCredentialsSet:
          return BiometricAuthResult.failure(
            BiometricAuthStatus.notEnrolled,
            'No fingerprint registered in device settings.',
          );
        case LocalAuthExceptionCode.temporaryLockout:
          return BiometricAuthResult.failure(
            BiometricAuthStatus.lockedOut,
            'Too many failed attempts. Fingerprint sensor is temporarily locked.',
          );
        case LocalAuthExceptionCode.biometricLockout:
          return BiometricAuthResult.failure(
            BiometricAuthStatus.permanentlyLockedOut,
            'Fingerprint sensor locked. Please unlock using your device passcode first.',
          );
        case LocalAuthExceptionCode.noBiometricHardware:
        case LocalAuthExceptionCode.biometricHardwareTemporarilyUnavailable:
          return BiometricAuthResult.failure(
            BiometricAuthStatus.notAvailable,
            'Fingerprint hardware is currently unavailable.',
          );
        case LocalAuthExceptionCode.userCanceled:
        case LocalAuthExceptionCode.systemCanceled:
          return BiometricAuthResult.failure(
            BiometricAuthStatus.cancelled,
            'Fingerprint verification cancelled.',
          );
        default:
          return BiometricAuthResult.failure(
            BiometricAuthStatus.error,
            (e.description?.isNotEmpty == true)
                ? e.description!
                : 'Biometric authentication failed.',
          );
      }
    } on PlatformException catch (e) {
      debugPrint('[BIOMETRIC] PlatformException: code=${e.code}, msg=${e.message}');
      switch (e.code) {
        case 'NotEnrolled':
          return BiometricAuthResult.failure(
            BiometricAuthStatus.notEnrolled,
            'No fingerprint registered in device settings.',
          );
        case 'LockedOut':
          return BiometricAuthResult.failure(
            BiometricAuthStatus.lockedOut,
            'Too many failed attempts. Fingerprint sensor is temporarily locked.',
          );
        case 'PermanentlyLockedOut':
          return BiometricAuthResult.failure(
            BiometricAuthStatus.permanentlyLockedOut,
            'Fingerprint sensor permanently locked. Please unlock using your device passcode first.',
          );
        case 'PasscodeNotSet':
          return BiometricAuthResult.failure(
            BiometricAuthStatus.notEnrolled,
            'Device screen lock or passcode is not set.',
          );
        case 'NotAvailable':
          return BiometricAuthResult.failure(
            BiometricAuthStatus.notAvailable,
            'Fingerprint hardware is currently unavailable.',
          );
        case 'UserCancel':
        case 'SystemCancel':
          return BiometricAuthResult.failure(
            BiometricAuthStatus.cancelled,
            'Fingerprint verification cancelled.',
          );
        default:
          return BiometricAuthResult.failure(
            BiometricAuthStatus.error,
            e.message ?? 'Biometric authentication failed.',
          );
      }
    } catch (e) {
      debugPrint('[BIOMETRIC] Unknown error: $e');
      return BiometricAuthResult.failure(
        BiometricAuthStatus.error,
        'Failed to authenticate: $e',
      );
    }
  }

  /// Cancel any ongoing authentication
  Future<void> stopAuthentication() async {
    try {
      await _auth.stopAuthentication();
    } catch (_) {}
  }
}
