import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/notification/notification_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/notification_model.dart';
import '../../core/widgets/refreshable_scroll.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationBloc>().add(NotificationsLoadRequested());
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
          context.tr('notifications'),
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
        actions: [
          BlocBuilder<NotificationBloc, NotificationState>(
            builder: (_, state) {
              if (state.unreadCount == 0) return const SizedBox.shrink();
              return TextButton(
                onPressed: () => context.read<NotificationBloc>().add(NotificationMarkAllAsRead()),
                child: Text(
                  context.tr('mark_all_read'),
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _kBlue,
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: BlocBuilder<NotificationBloc, NotificationState>(
        builder: (_, state) {
          if (state.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state.notifications.isEmpty) {
            return RefreshIndicator(
              onRefresh: () async {
                context.read<NotificationBloc>().add(NotificationsLoadRequested());
              },
              child: refreshableScrollChild(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none_outlined, size: 64, color: _kSlate.withValues(alpha: 0.4)),
                      const SizedBox(height: 16),
                      Text(
                        context.tr('no_notifications'),
                        style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w600, color: _kInk),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          final today = state.todayNotifications;
          final thisWeek = state.thisWeekNotifications;
          final older = state.olderNotifications;

          return RefreshIndicator(
            onRefresh: () async {
              context.read<NotificationBloc>().add(NotificationsLoadRequested());
            },
            child: ListView(
              physics: refreshScrollPhysics,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              children: [
                if (today.isNotEmpty) ...[
                  _SectionHeader(title: context.tr('today')),
                  const SizedBox(height: 8),
                  ...today.map((n) => _NotificationTile(notification: n)),
                  const SizedBox(height: 20),
                ],
                if (thisWeek.isNotEmpty) ...[
                  _SectionHeader(title: context.tr('this_week')),
                  const SizedBox(height: 8),
                  ...thisWeek.map((n) => _NotificationTile(notification: n)),
                  const SizedBox(height: 20),
                ],
                if (older.isNotEmpty) ...[
                  _SectionHeader(title: context.tr('earlier')),
                  const SizedBox(height: 8),
                  ...older.map((n) => _NotificationTile(notification: n)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: GoogleFonts.outfit(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: _kSlate,
        letterSpacing: 0.3,
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification notification;
  const _NotificationTile({required this.notification});

  Color get _iconBg {
    switch (notification.type) {
      case 'new_sale':
        return _kGreen;
      case 'credit':
        return _kAmber;
      case 'low_stock':
        return _kRed;
      case 'payment':
        return _kBlue;
      case 'transfer':
        return const Color(0xFF8B5CF6);
      case 'commission':
        return const Color(0xFF06B6D4);
      case 'borrowing':
        return const Color(0xFF0891B2);
      default:
        return _kSlate;
    }
  }

  IconData get _iconData {
    switch (notification.type) {
      case 'new_sale':
        return Icons.receipt_long_outlined;
      case 'credit':
        return Icons.credit_card_outlined;
      case 'low_stock':
        return Icons.inventory_2_outlined;
      case 'payment':
        return Icons.payments_outlined;
      case 'transfer':
        return Icons.swap_horiz_outlined;
      case 'commission':
        return Icons.analytics_outlined;
      case 'borrowing':
        return Icons.assignment_return_outlined;
      default:
        return Icons.info_outline;
    }
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} minute${diff.inMinutes > 1 ? 's' : ''} ago';
    if (diff.inHours < 24) return '${diff.inHours} hour${diff.inHours > 1 ? 's' : ''} ago';
    if (diff.inDays < 7) return '${diff.inDays} day${diff.inDays > 1 ? 's' : ''} ago';
    return '${date.day}/${date.month}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        if (!notification.isRead) {
          context.read<NotificationBloc>().add(NotificationMarkAsRead(id: notification.id));
        }
      },
      child: Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: notification.isRead ? Colors.white : _kBlue.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: notification.isRead ? _kBorder : _kBlue.withValues(alpha: 0.15),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _iconBg.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(_iconData, size: 20, color: _iconBg),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        notification.title,
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _kInk,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _timeAgo(notification.createdAt),
                      style: GoogleFonts.outfit(fontSize: 11, color: _kSlate.withValues(alpha: 0.7)),
                    ),
                    if (!notification.isRead) ...[
                      const SizedBox(width: 6),
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: _kBlue,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  notification.message,
                  style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}
