import 'package:equatable/equatable.dart';
import '../../models/user_model.dart';

sealed class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final UserModel user;
  final String token;

  const AuthAuthenticated({required this.user, required this.token});

  @override
  List<Object?> get props => [user, token];
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthAccountBlocked extends AuthState {
  final String reasonCode;
  final String message;
  final String? phone;

  const AuthAccountBlocked({required this.reasonCode, required this.message, this.phone});

  @override
  List<Object?> get props => [reasonCode, message, phone];
}

class AuthError extends AuthState {
  final String message;

  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

class OtpSent extends AuthState {
  final String verificationId;
  final String? code;
  final String? smsError;

  const OtpSent({required this.verificationId, this.code, this.smsError});

  @override
  List<Object?> get props => [verificationId, code, smsError];
}

class OtpVerified extends AuthState {
  const OtpVerified();
}

class PasswordChangeSuccess extends AuthState {
  const PasswordChangeSuccess();
}

class PasswordChangeError extends AuthState {
  final String message;

  const PasswordChangeError(this.message);

  @override
  List<Object?> get props => [message];
}

class AccountDeleteFailed extends AuthState {
  final String message;

  const AccountDeleteFailed(this.message);

  @override
  List<Object?> get props => [message];
}
