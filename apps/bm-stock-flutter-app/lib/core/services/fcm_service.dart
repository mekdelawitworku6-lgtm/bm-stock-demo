import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../firebase_options.dart';
import '../api/api_client.dart';
import '../widgets/company_scope_listener.dart';

const _androidChannelId = 'bm_stock_alerts';
const _vapidKey = String.fromEnvironment('FIREBASE_VAPID_KEY');

bool get _isIos =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS);

bool get _isAndroid => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

String get _deviceType {
  if (kIsWeb) return 'web';
  if (_isIos) return 'ios';
  return 'android';
}

/// Top-level background handler required by Firebase Messaging.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

/// Handles Firebase Cloud Messaging (push notifications).
class FcmService {
  FcmService._internal();

  static final FcmService instance = FcmService._internal();

  final ApiClient _api = ApiClient();
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  FirebaseMessaging? _messaging;
  bool _initialized = false;
  String? _currentToken;
  Future<void>? _initFuture;

  final _inAppRefresh = StreamController<void>.broadcast();
  Stream<void> get inAppRefresh => _inAppRefresh.stream;

  bool get isInitialized => _initialized;

  Future<void> init() {
    return _initFuture ??= _doInit();
  }

  Future<void> _doInit() async {
    if (_initialized) return;

    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      }
    } catch (error) {
      debugPrint('[FCM] Firebase init failed: $error');
      return;
    }

    if (Firebase.apps.isEmpty) {
      debugPrint('[FCM] Firebase is not initialized, skipping FCM setup');
      return;
    }

    try {
      final messaging = _messaging = FirebaseMessaging.instance;

      if (_isIos) {
        try {
          await messaging.setForegroundNotificationPresentationOptions(
            alert: true,
            badge: true,
            sound: true,
          );
        } catch (e) {
          debugPrint('[FCM] setForegroundNotificationPresentationOptions failed: $e');
        }
      }

      try {
        await _initLocalNotifications();
      } catch (e) {
        debugPrint('[FCM] initLocalNotifications failed: $e');
      }

      try {
        await _requestNotificationPermission();
      } catch (e) {
        debugPrint('[FCM] requestNotificationPermission failed: $e');
      }

      try {
        if (kIsWeb) {
          if (_vapidKey.isEmpty) {
            debugPrint(
              '[FCM] Web push requires --dart-define=FIREBASE_VAPID_KEY=... '
              'and FIREBASE_WEB_APP_ID from Firebase Console.',
            );
          }
          _currentToken = await _safeGetToken();
        } else {
          _currentToken = await messaging.getToken();
        }
      } catch (e) {
        debugPrint('[FCM] getToken failed: $e');
      }

      messaging.onTokenRefresh.listen((token) {
        _currentToken = token;
        unawaited(_syncTokenNow());
      }, onError: (e) {
        debugPrint('[FCM] onTokenRefresh error: $e');
      });

      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);

      try {
        final initialMessage = await messaging.getInitialMessage();
        if (initialMessage != null) {
          _inAppRefresh.add(null);
          _openNotificationsPage();
        }
      } catch (e) {
        debugPrint('[FCM] getInitialMessage failed: $e');
      }

      _initialized = true;
      unawaited(_syncTokenNow());
    } catch (error) {
      debugPrint('[FCM] Messaging init failed: $error');
      _initialized = false;
    }
  }

  Future<void> _initLocalNotifications() async {
    if (kIsWeb) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _localNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: (response) => _handleLocalNotificationTap(response),
    );

    if (_isAndroid) {
      const channel = AndroidNotificationChannel(
        _androidChannelId,
        'BM Stock Alerts',
        description: 'Low stock, payments, and business alerts',
        importance: Importance.high,
      );
      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  Future<void> syncToken() async {
    await init();
    if (!_initialized) return;
    if (!await _pushEnabled()) return;

    // Token can lag behind permission grant on first launch — retry briefly.
    for (var attempt = 0; attempt < 3; attempt++) {
      await _syncTokenNow();
      if (_currentToken != null && _currentToken!.isNotEmpty) return;
      await Future<void>.delayed(Duration(milliseconds: 500 * (attempt + 1)));
      _currentToken = await _safeGetToken();
    }
  }

  Future<bool> _pushEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('push_notifications_enabled') ?? true;
  }

  Future<void> _syncTokenNow() async {
    if (!await _pushEnabled()) return;
    final token = _currentToken ?? await _safeGetToken();
    if (token == null || token.isEmpty) return;
    if (_api.accessToken == null) return;

    try {
      await _api.post('/notifications/fcm-token', body: {
        'token': token,
        'deviceType': _deviceType,
      });
      debugPrint('[FCM] Token registered with backend');
    } catch (error) {
      debugPrint('[FCM] Token registration failed: $error');
    }
  }

  Future<void> unregister() async {
    await init();
    if (!_initialized) return;
    final token = _currentToken ?? await _safeGetToken();
    if (token == null || token.isEmpty) return;
    if (_api.accessToken == null) return;

    try {
      await _api.delete('/notifications/fcm-token', body: {'token': token});
    } catch (error) {
      debugPrint('[FCM] Token unregister failed: $error');
    }
  }

  Future<String?> _safeGetToken() async {
    try {
      if (kIsWeb) {
        if (_vapidKey.isEmpty) return null;
        return await _messaging?.getToken(vapidKey: _vapidKey);
      }
      return await _messaging?.getToken();
    } catch (error) {
      debugPrint('[FCM] getToken failed: $error');
      return null;
    }
  }

  Future<void> _requestNotificationPermission() async {
    try {
      if (kIsWeb || _isIos) {
        await _messaging?.requestPermission(alert: true, badge: true, sound: true);
      } else if (_isAndroid) {
        await Permission.notification.request();
      }
    } catch (error) {
      debugPrint('[FCM] Permission request failed: $error');
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    _inAppRefresh.add(null);

    final title = message.notification?.title ?? message.data['title']?.toString();
    final body = message.notification?.body ?? message.data['body']?.toString();
    if (title == null && body == null) return;

    if (kIsWeb) return;

    final id = message.hashCode & 0x7fffffff;
    await _localNotifications.show(
      id,
      title ?? 'BM Stock',
      body ?? '',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannelId,
          'BM Stock Alerts',
          channelDescription: 'Low stock, payments, and business alerts',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }

  void _handleOpenedMessage(RemoteMessage message) {
    _inAppRefresh.add(null);
    _openNotificationsPage();
  }

  void _handleLocalNotificationTap(NotificationResponse response) {
    _inAppRefresh.add(null);
    _openNotificationsPage();
  }

  void _openNotificationsPage() {
    if (_api.accessToken == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final nav = appNavigatorKey.currentState;
      if (nav == null) return;
      nav.pushNamed('/notifications');
    });
  }
}
