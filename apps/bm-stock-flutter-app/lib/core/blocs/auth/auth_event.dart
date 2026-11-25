import 'package:equatable/equatable.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class CheckAuthEvent extends AuthEvent {
  const CheckAuthEvent();
}

class LoginEvent extends AuthEvent {
  final String email;
  final String password;

  const LoginEvent({required this.email, required this.password});

  @override
  List<Object?> get props => [email, password];
}

class RegisterEvent extends AuthEvent {
  final String email;
  final String password;
  final String firstName;
  final String lastName;
  final String? phone;
  final String? companyName;

  const RegisterEvent({
    required this.email,
    required this.password,
    required this.firstName,
    required this.lastName,
    this.phone,
    this.companyName,
  });

  @override
  List<Object?> get props => [email, password, firstName, lastName, phone, companyName];
}

class SendOtpEvent extends AuthEvent {
  final String phone;

  const SendOtpEvent({required this.phone});

  @override
  List<Object?> get props => [phone];
}

class VerifyOtpEvent extends AuthEvent {
  final String phone;
  final String code;

  const VerifyOtpEvent({required this.phone, required this.code});

  @override
  List<Object?> get props => [phone, code];
}

class LogoutEvent extends AuthEvent {
  const LogoutEvent();
}

class DeleteAccountEvent extends AuthEvent {
  final String? otp;
  final String? phone;

  const DeleteAccountEvent({this.otp, this.phone});

  @override
  List<Object?> get props => [otp, phone];
}

class ClearAuthError extends AuthEvent {
  const ClearAuthError();
}

class AccountBlockedEvent extends AuthEvent {
  final String reasonCode;
  final String message;
  final String? phone;

  const AccountBlockedEvent({required this.reasonCode, required this.message, this.phone});

  @override
  List<Object?> get props => [reasonCode, message, phone];
}

class UpdateProfileEvent extends AuthEvent {
  final String? companyName;
  final String? firstName;
  final String? lastName;
  final bool? pushNotificationsEnabled;
  final bool? emailNotificationsEnabled;

  const UpdateProfileEvent({
    this.companyName,
    this.firstName,
    this.lastName,
    this.pushNotificationsEnabled,
    this.emailNotificationsEnabled,
  });

  @override
  List<Object?> get props => [companyName, firstName, lastName, pushNotificationsEnabled, emailNotificationsEnabled];
}

class ChangePasswordEvent extends AuthEvent {
  final String currentPassword;
  final String newPassword;

  const ChangePasswordEvent({required this.currentPassword, required this.newPassword});

  @override
  List<Object?> get props => [currentPassword, newPassword];
}

class StaffFirstLoginEvent extends AuthEvent {
  final String companyName;
  final String? companyPassword;
  final String pin;
  final String? phone;

  const StaffFirstLoginEvent({
    required this.companyName,
    this.companyPassword,
    required this.pin,
    this.phone,
  });

  @override
  List<Object?> get props => [companyName, companyPassword, pin, phone];
}

class CAdminFirstLoginEvent extends AuthEvent {
  final String email;
  final String password;
  final String? pin;

  const CAdminFirstLoginEvent({
    required this.email,
    required this.password,
    this.pin,
  });

  @override
  List<Object?> get props => [email, password, pin];
}

class PinUnlockEvent extends AuthEvent {
  final String role;
  final String accountId;
  final String pin;

  const PinUnlockEvent({
    required this.role,
    required this.accountId,
    required this.pin,
  });

  @override
  List<Object?> get props => [role, accountId, pin];
}

class ChangeAdminPinEvent extends AuthEvent {
  final String currentPassword;
  final String newPin;

  const ChangeAdminPinEvent({
    required this.currentPassword,
    required this.newPin,
  });

  @override
  List<Object?> get props => [currentPassword, newPin];
}

class SetAdminPinEvent extends AuthEvent {
  final String pin;

  const SetAdminPinEvent({required this.pin});

  @override
  List<Object?> get props => [pin];
}

class BiometricUnlockEvent extends AuthEvent {
  final String role;
  final String accountId;
  final String? refreshToken;
  final String? pin;

  const BiometricUnlockEvent({
    required this.role,
    required this.accountId,
    this.refreshToken,
    this.pin,
  });

  @override
  List<Object?> get props => [role, accountId, refreshToken, pin];
}

class EnableBiometricEvent extends AuthEvent {
  final bool enabled;

  const EnableBiometricEvent({required this.enabled});

  @override
  List<Object?> get props => [enabled];
}


