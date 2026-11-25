import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../models/notification_model.dart';
import '../../services/fcm_service.dart';
import '../../services/notification_service.dart';
import 'notification_event.dart';
import 'notification_state.dart';

export 'notification_event.dart';
export 'notification_state.dart';

class NotificationBloc extends Bloc<NotificationEvent, NotificationState> {
  final NotificationService _service = NotificationService();
  StreamSubscription<void>? _fcmSubscription;
  Timer? _pollTimer;
  final Set<String> _seenNotificationIds = {};
  bool _pollingActive = false;

  NotificationBloc() : super(const NotificationState()) {
    on<NotificationsLoadRequested>(_onLoad);
    on<NotificationLoadUnreadCount>(_onLoadUnreadCount);
    on<NotificationPollingStarted>(_onPollingStarted);
    on<NotificationPollingStopped>(_onPollingStopped);
    on<NotificationPollRequested>(_onPoll);
    on<NotificationBannerDismissed>(_onBannerDismissed);
    on<NotificationMarkAsRead>(_onMarkAsRead);
    on<NotificationMarkAllAsRead>(_onMarkAllAsRead);

    // When a push arrives (mobile/web), poll immediately for in-app update + banner.
    _fcmSubscription = FcmService.instance.inAppRefresh.listen((_) {
      if (_pollingActive) {
        add(const NotificationPollRequested());
      }
    });
  }

  @override
  Future<void> close() {
    _fcmSubscription?.cancel();
    _pollTimer?.cancel();
    return super.close();
  }

  void _onPollingStarted(NotificationPollingStarted event, Emitter<NotificationState> emit) {
    _pollingActive = true;
    _seenNotificationIds.clear();
    _pollTimer?.cancel();
    add(const NotificationPollRequested(initializing: true));
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      add(const NotificationPollRequested());
    });
  }

  void _onPollingStopped(NotificationPollingStopped event, Emitter<NotificationState> emit) {
    _pollingActive = false;
    _pollTimer?.cancel();
    _pollTimer = null;
    _seenNotificationIds.clear();
    emit(const NotificationState());
  }

  Future<void> _onPoll(NotificationPollRequested event, Emitter<NotificationState> emit) async {
    try {
      final count = await _service.getUnreadCount();
      final notifications = await _service.getAll(limit: 20);

      if (event.initializing) {
        for (final notification in notifications) {
          _seenNotificationIds.add(notification.id);
        }
        emit(state.copyWith(
          notifications: notifications,
          unreadCount: count,
          bannerNotification: () => null,
        ));
        return;
      }

      AppNotification? banner;
      for (final notification in notifications) {
        if (!notification.isRead && !_seenNotificationIds.contains(notification.id)) {
          banner = notification;
          _seenNotificationIds.add(notification.id);
          break;
        }
      }

      emit(state.copyWith(
        notifications: notifications.isNotEmpty ? notifications : state.notifications,
        unreadCount: count,
        bannerNotification: () => banner,
      ));
    } catch (_) {}
  }

  void _onBannerDismissed(NotificationBannerDismissed event, Emitter<NotificationState> emit) {
    emit(state.copyWith(bannerNotification: () => null));
  }

  Future<void> _onLoad(NotificationsLoadRequested event, Emitter<NotificationState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final notifications = await _service.getAll();
      final unreadCount = notifications.where((n) => !n.isRead).length;
      for (final notification in notifications) {
        _seenNotificationIds.add(notification.id);
      }
      emit(state.copyWith(notifications: notifications, unreadCount: unreadCount, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load notifications: $e'));
    }
  }

  Future<void> _onLoadUnreadCount(NotificationLoadUnreadCount event, Emitter<NotificationState> emit) async {
    try {
      final count = await _service.getUnreadCount();
      emit(state.copyWith(unreadCount: count));
    } catch (_) {}
  }

  Future<void> _onMarkAsRead(NotificationMarkAsRead event, Emitter<NotificationState> emit) async {
    try {
      await _service.markAsRead(event.id);
      final updated = state.notifications.map((n) {
        if (n.id == event.id) {
          return n.copyWith(isRead: true);
        }
        return n;
      }).toList();
      final unreadCount = updated.where((n) => !n.isRead).length;
      emit(state.copyWith(notifications: updated, unreadCount: unreadCount));
    } catch (_) {}
  }

  Future<void> _onMarkAllAsRead(NotificationMarkAllAsRead event, Emitter<NotificationState> emit) async {
    try {
      await _service.markAllAsRead();
      final updated = state.notifications.map((n) => n.copyWith(isRead: true)).toList();
      emit(state.copyWith(notifications: updated, unreadCount: 0));
    } catch (_) {}
  }
}
