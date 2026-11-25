import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Monitors the app lifecycle and triggers a lock after [lockTimeout]
/// of inactivity (app in background).
///
/// Usage:
///   - Call `AppLockService.instance.init()` once at app start.
///   - Listen to [isLocked] to know when to show the lock screen.
///   - Call `unlock()` after successful re-authentication.
class AppLockService with WidgetsBindingObserver {
  AppLockService._();
  static final AppLockService instance = AppLockService._();

  /// Duration the app can stay in background before locking.
  static const lockTimeout = Duration(minutes: 3);

  final ValueNotifier<bool> isLocked = ValueNotifier<bool>(false);

  DateTime? _pausedAt;
  Timer? _lockTimer;
  bool _initialized = false;

  /// Call once from `main()` after `WidgetsFlutterBinding.ensureInitialized()`.
  void init() {
    if (_initialized) return;
    _initialized = true;
    WidgetsBinding.instance.addObserver(this);
  }

  void dispose() {
    _lockTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
  }

  /// Call after successful biometric/PIN re-authentication.
  void unlock() {
    isLocked.value = false;
    _pausedAt = null;
    _lockTimer?.cancel();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.inactive:
        _onPaused();
        break;
      case AppLifecycleState.resumed:
        _onResumed();
        break;
      case AppLifecycleState.detached:
        break;
    }
  }

  void _onPaused() {
    if (isLocked.value) return; // Already locked
    _pausedAt = DateTime.now();
    // Start a timer — if the app is still backgrounded when it fires, we lock.
    _lockTimer?.cancel();
    _lockTimer = Timer(lockTimeout, () async {
      // Verify the user is logged in before locking.
      final prefs = await SharedPreferences.getInstance();
      final isConfigured = prefs.getBool('auth_device_configured') ?? false;
      if (isConfigured) {
        isLocked.value = true;
      }
    });
  }

  void _onResumed() {
    if (isLocked.value) return; // Stay locked — user must re-authenticate

    // If paused timestamp exists, check elapsed time.
    if (_pausedAt != null) {
      final elapsed = DateTime.now().difference(_pausedAt!);
      if (elapsed >= lockTimeout) {
        // Lock immediately
        _checkAndLock();
      }
    }

    // Cancel the timer since we've resumed and handled the check.
    _lockTimer?.cancel();
    _pausedAt = null;
  }

  Future<void> _checkAndLock() async {
    final prefs = await SharedPreferences.getInstance();
    final isConfigured = prefs.getBool('auth_device_configured') ?? false;
    if (isConfigured) {
      isLocked.value = true;
    }
  }
}
