import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_event.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/widgets/account_blocked_dialog.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  bool _navigated = false;
  bool _timerDone = false;
  bool _authDone = false;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeIn),
    );

    _animationController.forward();
    _startTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthBloc>().add(const CheckAuthEvent());
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _startTimer() {
    Timer(const Duration(milliseconds: 2800), () {
      _timerDone = true;
      _tryNavigate();
    });
  }

  void _tryNavigate() {
    if (_navigated || !_timerDone || !_authDone) return;
    _navigated = true;
    if (!mounted) return;
    SharedPreferences.getInstance().then((prefs) {
      final hasSeenOnboarding = prefs.getBool('hasSeenOnboarding') ?? false;
      final authState = context.read<AuthBloc>().state;
      if (!mounted) return;
      if (!hasSeenOnboarding) {
        Navigator.pushReplacementNamed(context, '/onboarding');
      } else if (authState is AuthAccountBlocked) {
        Navigator.pushReplacementNamed(context, '/auth').then((_) {
          if (!mounted) return;
          final reason = accountBlockReasonFromCode(authState.reasonCode);
          if (reason != null) {
            showAccountBlockedDialog(
              context,
              reason: reason,
              message: authState.message,
              phone: authState.phone,
              onDismiss: () => context.read<AuthBloc>().add(const ClearAuthError()),
            );
          }
        });
      } else if (authState is AuthAuthenticated) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        Navigator.pushReplacementNamed(context, '/auth');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated || state is AuthUnauthenticated || state is AuthAccountBlocked) {
          _authDone = true;
          _tryNavigate();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset(
                  'assets/images/logo/gelagle_logo.png',
                  width: 220,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    const webStyle = TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF025EA7),
                    );
                    const mobileStyle = TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF025EA7),
                    );
                    if (kIsWeb) {
                      return const Text(
                        'BM Stock',
                        style: webStyle,
                      );
                    } else {
                      return const Text(
                        'BM Stock',
                        style: mobileStyle,
                      );
                    }
                  },
                ),
                const SizedBox(height: 24),
                const SizedBox(
                  width: 32,
                  height: 32,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF025EA7)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}