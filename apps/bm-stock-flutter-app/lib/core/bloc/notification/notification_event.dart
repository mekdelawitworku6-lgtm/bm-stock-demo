import 'package:equatable/equatable.dart';

abstract class NotificationEvent extends Equatable {
  const NotificationEvent();
  @override
  List<Object?> get props => [];
}

class NotificationsLoadRequested extends NotificationEvent {}

class NotificationLoadUnreadCount extends NotificationEvent {}

class NotificationPollingStarted extends NotificationEvent {}

class NotificationPollingStopped extends NotificationEvent {}

class NotificationPollRequested extends NotificationEvent {
  final bool initializing;

  const NotificationPollRequested({this.initializing = false});

  @override
  List<Object?> get props => [initializing];
}

class NotificationBannerDismissed extends NotificationEvent {}

class NotificationMarkAsRead extends NotificationEvent {
  final String id;
  const NotificationMarkAsRead({required this.id});
  @override
  List<Object?> get props => [id];
}

class NotificationMarkAllAsRead extends NotificationEvent {}
