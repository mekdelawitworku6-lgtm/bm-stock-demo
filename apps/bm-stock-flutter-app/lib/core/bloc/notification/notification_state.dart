import 'package:equatable/equatable.dart';
import '../../models/notification_model.dart';

class NotificationState extends Equatable {
  final List<AppNotification> notifications;
  final int unreadCount;
  final bool isLoading;
  final String? error;
  /// Set when a new unread notification should show an in-app banner.
  final AppNotification? bannerNotification;

  const NotificationState({
    this.notifications = const [],
    this.unreadCount = 0,
    this.isLoading = false,
    this.error,
    this.bannerNotification,
  });

  List<AppNotification> get todayNotifications {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    return notifications.where((n) => n.createdAt.isAfter(startOfDay)).toList();
  }

  List<AppNotification> get thisWeekNotifications {
    final now = DateTime.now();
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final startOfDay = DateTime(startOfWeek.year, startOfWeek.month, startOfWeek.day);
    final startOfToday = DateTime(now.year, now.month, now.day);
    return notifications.where((n) =>
      n.createdAt.isAfter(startOfDay) && n.createdAt.isBefore(startOfToday)
    ).toList();
  }

  List<AppNotification> get olderNotifications {
    final now = DateTime.now();
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final startOfDay = DateTime(startOfWeek.year, startOfWeek.month, startOfWeek.day);
    return notifications.where((n) => n.createdAt.isBefore(startOfDay)).toList();
  }

  NotificationState copyWith({
    List<AppNotification>? notifications,
    int? unreadCount,
    bool? isLoading,
    String? Function()? error,
    AppNotification? Function()? bannerNotification,
  }) {
    return NotificationState(
      notifications: notifications ?? this.notifications,
      unreadCount: unreadCount ?? this.unreadCount,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
      bannerNotification:
          bannerNotification != null ? bannerNotification() : this.bannerNotification,
    );
  }

  @override
  List<Object?> get props => [notifications, unreadCount, isLoading, error, bannerNotification];
}
