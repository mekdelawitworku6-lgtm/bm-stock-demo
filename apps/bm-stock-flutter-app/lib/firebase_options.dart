import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase configuration for BM Stock (project: bmstock-bc004).
///
/// Web push also requires `--dart-define=FIREBASE_WEB_APP_ID=...` and
/// `--dart-define=FIREBASE_VAPID_KEY=...` from the Firebase console after
/// registering a Web app under Cloud Messaging.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      default:
        return web;
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAzTsr7j-KODQkh5ouajc5BFnSsUKK3Ywo',
    appId: '1:109507036406:android:ed7cdda39ebccec1fc98d7',
    messagingSenderId: '109507036406',
    projectId: 'bmstock-bc004',
    storageBucket: 'bmstock-bc004.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAzTsr7j-KODQkh5ouajc5BFnSsUKK3Ywo',
    appId: '1:109507036406:ios:bmstock',
    messagingSenderId: '109507036406',
    projectId: 'bmstock-bc004',
    storageBucket: 'bmstock-bc004.firebasestorage.app',
    iosBundleId: 'com.bmstock',
  );

  static const FirebaseOptions macos = ios;

  static FirebaseOptions get web => FirebaseOptions(
        apiKey: 'AIzaSyAzTsr7j-KODQkh5ouajc5BFnSsUKK3Ywo',
        appId: const String.fromEnvironment(
          'FIREBASE_WEB_APP_ID',
          defaultValue: '1:109507036406:web:bmstock',
        ),
        messagingSenderId: '109507036406',
        projectId: 'bmstock-bc004',
        storageBucket: 'bmstock-bc004.firebasestorage.app',
        authDomain: 'bmstock-bc004.firebaseapp.com',
      );
}
