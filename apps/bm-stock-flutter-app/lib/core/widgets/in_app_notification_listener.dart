import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/auth/auth_bloc.dart';
import '../bloc/notification/notification_bloc.dart';
import '../widgets/app_toast.dart';
import '../widgets/company_scope_listener.dart';

/// Keeps in-app notifications fresh without relying on browser push (Chrome/web).
///
/// - Polls the backend every 30s while the user is logged in
/// - Shows a floating in-app banner when a new unread notification arrives
/// - Works on web, Android, and iOS even when FCM/VAPID is not configured
class InAppNotificationListener extends StatefulWidget {
  const InAppNotificationListener({super.key, required this.child});

  final Widget child;

  @override
  State<InAppNotificationListener> createState() => _InAppNotificationListenerState();
}

class _InAppNotificationListenerState extends State<InAppNotificationListener> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncPolling());
  }

  void _syncPolling() {
    if (!mounted) return;
    final authState = context.read<AuthBloc>().state;
    if (authState is AuthAuthenticated) {
      context.read<NotificationBloc>().add(NotificationPollingStarted());
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocListener(
      listeners: [
        BlocListener<AuthBloc, AuthState>(
          listener: (context, authState) {
            final notifications = context.read<NotificationBloc>();
            if (authState is AuthAuthenticated) {
              notifications.add(NotificationPollingStarted());
            } else if (authState is AuthUnauthenticated) {
              notifications.add(NotificationPollingStopped());
            }
          },
        ),
        BlocListener<NotificationBloc, NotificationState>(
          listenWhen: (previous, current) =>
              current.bannerNotification != null &&
              current.bannerNotification != previous.bannerNotification,
          listener: (context, state) {
            final notification = state.bannerNotification;
            if (notification == null) return;

            final toastContext = appNavigatorKey.currentContext ?? context;
            final message = notification.title.isNotEmpty
                ? '${notification.title} — ${notification.message}'
                : notification.message;

            showAppToast(
              toastContext,
              message,
              type: AppToastType.info,
              duration: const Duration(seconds: 4),
              onTap: () => _openNotificationsPage(),
            );
            context.read<NotificationBloc>().add(NotificationBannerDismissed());
          },
        ),
      ],
      child: widget.child,
    );
  }

  void _openNotificationsPage() {
    final nav = appNavigatorKey.currentState;
    if (nav == null) return;
    nav.pushNamed('/notifications');
  }
}
