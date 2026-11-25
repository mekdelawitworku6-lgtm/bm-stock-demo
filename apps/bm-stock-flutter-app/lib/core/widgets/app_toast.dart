import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum AppToastType { success, error, info }

class _ToastStyle {
  final Color background;
  final Color iconColor;
  final IconData icon;
  const _ToastStyle({
    required this.background,
    required this.iconColor,
    required this.icon,
  });
}

const _styles = <AppToastType, _ToastStyle>{
  AppToastType.success: _ToastStyle(
    background: Color(0xFF16A34A),
    iconColor: Colors.white,
    icon: Icons.check_circle_rounded,
  ),
  AppToastType.error: _ToastStyle(
    background: Color(0xFFDC2626),
    iconColor: Colors.white,
    icon: Icons.error_rounded,
  ),
  AppToastType.info: _ToastStyle(
    background: Color(0xFF0F172A),
    iconColor: Color(0xFF38BDF8),
    icon: Icons.info_rounded,
  ),
};

OverlayEntry? _toastEntry;
Timer? _toastTimer;

/// Shows a polished, animated toast that floats over the whole app.
///
/// Unlike SnackBars, this uses the root [Overlay] so it works from any context
/// (dialogs, forms, listeners above the [MaterialApp]) and never collides with
/// bottom navigation bars, FABs or the keyboard. Only one toast is visible at a
/// time — a new one replaces the current one.
void showAppToast(
  BuildContext context,
  String message, {
  AppToastType type = AppToastType.info,
  Duration? duration,
  VoidCallback? onTap,
}) {
  final overlay = _findOverlay(context);
  if (overlay == null) return;

  _dismissCurrent();

  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => _AppToast(
      message: message,
      type: type,
      duration: duration ?? const Duration(milliseconds: 2600),
      onTap: onTap,
      onDismissed: () => _removeEntry(entry),
    ),
  );
  _toastEntry = entry;
  overlay.insert(entry);
}

OverlayState? _findOverlay(BuildContext context) {
  try {
    return Overlay.of(context, rootOverlay: true);
  } catch (_) {
    return null;
  }
}

void _dismissCurrent() {
  _toastTimer?.cancel();
  _toastTimer = null;
  final entry = _toastEntry;
  if (entry != null && entry.mounted) {
    entry.remove();
  }
  _toastEntry = null;
}

void _removeEntry(OverlayEntry entry) {
  if (entry.mounted) entry.remove();
  if (identical(_toastEntry, entry)) _toastEntry = null;
}

class _AppToast extends StatefulWidget {
  final String message;
  final AppToastType type;
  final Duration duration;
  final VoidCallback? onTap;
  final VoidCallback onDismissed;

  const _AppToast({
    required this.message,
    required this.type,
    required this.duration,
    this.onTap,
    required this.onDismissed,
  });

  @override
  State<_AppToast> createState() => _AppToastState();
}

class _AppToastState extends State<_AppToast>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;
  Timer? _autoDismiss;
  bool _exiting = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
      reverseDuration: const Duration(milliseconds: 200),
    );
    _opacity = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _offset = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));
    _controller.forward();
    _autoDismiss = Timer(widget.duration, _exit);
  }

  @override
  void dispose() {
    _autoDismiss?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _exit() {
    if (_exiting || !mounted) return;
    _exiting = true;
    _autoDismiss?.cancel();
    _controller.reverse().whenCompleteOrCancel(() {
      if (mounted) widget.onDismissed();
    });
  }

  @override
  Widget build(BuildContext context) {
    final style = _styles[widget.type]!;
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: FadeTransition(
          opacity: _opacity,
          child: SlideTransition(
            position: _offset,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      widget.onTap?.call();
                      _exit();
                    },
                    borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: style.background,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.18),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.22),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(style.icon, color: style.iconColor, size: 16),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            widget.message,
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              height: 1.3,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: _exit,
                          child: const Icon(Icons.close_rounded, color: Colors.white70, size: 18),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
