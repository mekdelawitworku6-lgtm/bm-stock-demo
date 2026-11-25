import 'dart:async';
import 'dart:convert';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../api/api_client.dart';
import '../../api/api_exceptions.dart';
import '../../models/user_model.dart';
import '../../services/fcm_service.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final ApiClient _api = ApiClient();

  /// Convenience getter — returns the current user if authenticated, otherwise null.
  /// Allows callers to write `context.read<AuthBloc>().user` regardless of state subtype.
  UserModel? get user =>
      state is AuthAuthenticated ? (state as AuthAuthenticated).user : null;

  AuthBloc() : super(const AuthInitial()) {
    on<CheckAuthEvent>(_onCheckAuth);
    on<LoginEvent>(_onLogin);
    on<RegisterEvent>(_onRegister);
    on<SendOtpEvent>(_onSendOtp);
    on<VerifyOtpEvent>(_onVerifyOtp);
    on<LogoutEvent>(_onLogout);
    on<DeleteAccountEvent>(_onDeleteAccount);
    on<ClearAuthError>(_onClearError);
    on<UpdateProfileEvent>(_onUpdateProfile);
    on<ChangePasswordEvent>(_onChangePassword);
    on<StaffFirstLoginEvent>(_onStaffFirstLogin);
    on<CAdminFirstLoginEvent>(_onCAdminFirstLogin);
    on<PinUnlockEvent>(_onPinUnlock);
    on<BiometricUnlockEvent>(_onBiometricUnlock);
    on<EnableBiometricEvent>(_onEnableBiometric);
    on<ChangeAdminPinEvent>(_onChangeAdminPin);
    on<SetAdminPinEvent>(_onSetAdminPin);
    on<AccountBlockedEvent>(_onAccountBlocked);

    ApiClient.onUnauthorized = () {
      add(const LogoutEvent());
    };
    ApiClient.onAccountBlocked = (errorCode, message) async {
      final prefs = await SharedPreferences.getInstance();
      final phone = prefs.getString('auth_phone');
      add(AccountBlockedEvent(reasonCode: errorCode, message: message, phone: phone));
    };
  }

  AuthAccountBlocked? _asAccountBlocked(ApiException e, {String? phone}) {
    final code = e.errorCode;
    if (code == 'SUBSCRIPTION_EXPIRED' || code == 'COMPANY_DEACTIVATED') {
      return AuthAccountBlocked(reasonCode: code!, message: e.message, phone: phone);
    }
    final msg = e.message.toLowerCase();
    if (msg.contains('subscription') &&
        (msg.contains('expired') || msg.contains('renew'))) {
      return AuthAccountBlocked(
          reasonCode: 'SUBSCRIPTION_EXPIRED', message: e.message, phone: phone);
    }
    if (msg.contains('company') && msg.contains('deactivated')) {
      return AuthAccountBlocked(
          reasonCode: 'COMPANY_DEACTIVATED', message: e.message, phone: phone);
    }
    return null;
  }

  Future<void> _clearSession() async {
    await FcmService.instance.unregister();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user');
    _api.setToken(null);
  }

  Future<void> _onAccountBlocked(
      AccountBlockedEvent event, Emitter<AuthState> emit) async {
    await _clearSession();
    emit(AuthAccountBlocked(
        reasonCode: event.reasonCode, message: event.message, phone: event.phone));
  }

  Future<void> _onCheckAuth(
      CheckAuthEvent event, Emitter<AuthState> emit) async {
    try {
      await _api.loadToken();
      if (_api.accessToken == null) {
        emit(const AuthUnauthenticated());
        return;
      }

      final profile = await _api.get('/users/me');
      final profileMap = profile is Map
          ? Map<String, dynamic>.from(
              profile['user'] is Map ? profile['user'] as Map : profile,
            )
          : <String, dynamic>{};

      final prefs = await SharedPreferences.getInstance();
      final userJson = profileMap.isNotEmpty
          ? json.encode(profileMap)
          : prefs.getString('user');
      if (userJson != null) {
        if (profileMap.isNotEmpty) {
          await prefs.setString('user', userJson);
        }
        final user = UserModel.fromJson(json.decode(userJson));
        emit(AuthAuthenticated(user: user, token: _api.accessToken!));
        unawaited(FcmService.instance.syncToken());
      } else {
        emit(const AuthUnauthenticated());
      }
    } on ApiException catch (e) {
      final prefs = await SharedPreferences.getInstance();
      String? savedPhone = prefs.getString('auth_phone');
      if (savedPhone == null || savedPhone.isEmpty) {
        final userJson = prefs.getString('user');
        if (userJson != null) {
          try {
            final parsed = json.decode(userJson);
            savedPhone = parsed['phone']?.toString();
          } catch (_) {}
        }
      }
      final blocked = _asAccountBlocked(e, phone: savedPhone);
      if (blocked != null) {
        await _clearSession();
        emit(blocked);
      } else {
        await _clearSession();
        emit(const AuthUnauthenticated());
      }
    } catch (_) {
      emit(const AuthUnauthenticated());
    }
  }

  Future<void> _onLogin(LoginEvent event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_phone', event.email);

      final data = await _api.post('/auth/login',
          body: {
            'email': event.email,
            'password': event.password,
          },
          auth: false);

      final userObj = data['user'];
      final userId = userObj?['id']?.toString();
      final role = userObj?['role']?.toString().toLowerCase().contains('admin') == true ? 'admin' : 'staff';

      await _persistSession(data, emit, role: role, accountId: userId);
    } on ApiException catch (e) {
      final blocked = _asAccountBlocked(e, phone: event.email);
      if (blocked != null) {
        emit(blocked);
      } else {
        emit(AuthError(e.message));
      }
    } catch (e) {
      emit(AuthError('Connection failed: $e'));
    }
  }

  Future<void> _persistSession(
    dynamic data,
    Emitter<AuthState> emit, {
    String? role,
    String? accountId,
    String? companyName,
  }) async {
    final token = data['accessToken'] as String;
    _api.setToken(token);
    final user = UserModel.fromJson(data['user']);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', token);
    final refreshToken = data['refreshToken'] as String?;
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await prefs.setString('refresh_token', refreshToken);
      await prefs.setString('biometric_token', refreshToken);
    }
    await prefs.setString('user', json.encode(data['user']));
    if (user.phone != null && user.phone!.isNotEmpty) {
      await prefs.setString('auth_phone', user.phone!);
    }

    if (role != null) {
      await prefs.setBool('auth_device_configured', true);
      await prefs.setString('auth_role', role);
      if (accountId != null)
        await prefs.setString('auth_account_id', accountId);
      final displayName = user.fullName.isNotEmpty ? user.fullName : 'User';
      await prefs.setString(
          'auth_display_name', displayName.isNotEmpty ? displayName : 'User');
      final comp = companyName ?? user.companyName;
      if (comp != null && comp.isNotEmpty) {
        await prefs.setString('auth_company_name', comp);
      }
    }

    emit(AuthAuthenticated(user: user, token: token));
    unawaited(FcmService.instance.syncToken());
  }

  Future<void> _onStaffFirstLogin(
      StaffFirstLoginEvent event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      if (event.phone != null && event.phone!.trim().isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_phone', event.phone!.trim());
      }

      final data = await _api.post('/auth/staff-first-login',
          body: {
            'companyName': event.companyName,
            if (event.companyPassword != null && event.companyPassword!.isNotEmpty)
              'companyPassword': event.companyPassword,
            'pin': event.pin,
            if (event.phone != null && event.phone!.trim().isNotEmpty)
              'phone': event.phone!.trim(),
          },
          auth: false);

      final userObj = data['user'];
      final employeeId = (userObj != null && userObj['employee'] != null)
          ? userObj['employee']['id']?.toString()
          : userObj?['id']?.toString();

      await _persistSession(
        data,
        emit,
        role: 'staff',
        accountId: employeeId,
        companyName: event.companyName,
      );
    } on ApiException catch (e) {
      final blocked = _asAccountBlocked(e, phone: event.phone);
      if (blocked != null) {
        emit(blocked);
      } else {
        emit(AuthError(e.message));
      }
    } catch (e) {
      emit(AuthError('Connection failed: $e'));
    }
  }

  Future<void> _onCAdminFirstLogin(
      CAdminFirstLoginEvent event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_phone', event.email);

      final body = <String, dynamic>{
        'email': event.email,
        'password': event.password,
      };
      if (event.pin != null && event.pin!.isNotEmpty) {
        body['pin'] = event.pin;
      }
      final data =
          await _api.post('/auth/cadmin-first-login', body: body, auth: false);

      final userObj = data['user'];
      final userId = userObj?['id']?.toString();
      final hasPin = userObj?['hasPin'] == true ||
          (userObj != null && userObj['pin'] != null);

      await _persistSession(
        data,
        emit,
        role: 'admin',
        accountId: userId,
      );
    } on ApiException catch (e) {
      final blocked = _asAccountBlocked(e, phone: event.email);
      if (blocked != null) {
        emit(blocked);
      } else {
        emit(AuthError(e.message));
      }
    } catch (e) {
      emit(AuthError('Connection failed: $e'));
    }
  }

  Future<void> _onSetAdminPin(
      SetAdminPinEvent event, Emitter<AuthState> emit) async {
    try {
      await _api.post('/auth/set-admin-pin', body: {
        'pin': event.pin,
      });

      final prefs = await SharedPreferences.getInstance();
      final userJson = prefs.getString('user');
      if (userJson != null) {
        final userData = json.decode(userJson) as Map<String, dynamic>;
        userData['hasPin'] = true;
        await prefs.setString('user', json.encode(userData));

        final user = UserModel.fromJson(userData);
        await prefs.setBool('auth_device_configured', true);
        await prefs.setString('auth_role', 'admin');
        await prefs.setString('auth_account_id', user.id);
        final displayName = '${user.firstName} ${user.lastName}'.trim();
        await prefs.setString(
            'auth_display_name', displayName.isNotEmpty ? displayName : 'User');
        if (user.companyName != null && user.companyName!.isNotEmpty) {
          await prefs.setString('auth_company_name', user.companyName!);
        }

        emit(AuthAuthenticated(user: user, token: _api.accessToken ?? ''));
      }
    } on ApiException catch (e) {
      emit(AuthError(e.message));
    } catch (e) {
      emit(AuthError('Failed to set PIN: $e'));
    }
  }

  Future<void> _onPinUnlock(
      PinUnlockEvent event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final data = await _api.post('/auth/pin-unlock',
          body: {
            'role': event.role,
            'accountId': event.accountId,
            'pin': event.pin,
          },
          auth: false);

      await _persistSession(
        data,
        emit,
        role: event.role,
        accountId: event.accountId,
      );
    } on ApiException catch (e) {
      final prefs = await SharedPreferences.getInstance();
      final savedPhone = prefs.getString('auth_phone');
      final blocked = _asAccountBlocked(e, phone: savedPhone);
      if (blocked != null) {
        emit(blocked);
      } else {
        emit(AuthError(e.message));
      }
    } catch (e) {
      emit(AuthError('Connection failed: $e'));
    }
  }

  Future<void> _onBiometricUnlock(
      BiometricUnlockEvent event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final prefs = await SharedPreferences.getInstance();
      final refreshToken = event.refreshToken ??
          prefs.getString('biometric_token') ??
          prefs.getString('refresh_token');

      final body = <String, dynamic>{
        'role': event.role,
        'accountId': event.accountId,
      };
      if (refreshToken != null && refreshToken.isNotEmpty) {
        body['refreshToken'] = refreshToken;
      }
      if (event.pin != null && event.pin!.isNotEmpty) {
        body['pin'] = event.pin;
      }

      dynamic data;
      try {
        data = await _api.post(
          '/auth/biometric-unlock',
          body: body,
          auth: false,
        );
      } on ApiException catch (e) {
        if (e.statusCode == 404 && refreshToken != null && refreshToken.isNotEmpty) {
          final refreshData = await _api.post(
            '/auth/refresh',
            body: {'refreshToken': refreshToken},
            auth: false,
          );
          if (refreshData != null && refreshData['accessToken'] != null) {
            final userJson = prefs.getString('user');
            if (userJson != null) {
              data = {
                'accessToken': refreshData['accessToken'],
                'refreshToken': refreshToken,
                'user': json.decode(userJson),
              };
            }
          }
        }
        if (data == null) rethrow;
      }

      await _persistSession(
        data,
        emit,
        role: event.role,
        accountId: event.accountId,
      );
    } on ApiException catch (e) {
      final prefs = await SharedPreferences.getInstance();
      final savedPhone = prefs.getString('auth_phone');
      final blocked = _asAccountBlocked(e, phone: savedPhone);
      if (blocked != null) {
        emit(blocked);
      } else {
        emit(AuthError(e.message));
      }
    } catch (e) {
      emit(AuthError('Biometric sign-in failed: $e'));
    }
  }

  Future<void> _onEnableBiometric(
      EnableBiometricEvent event, Emitter<AuthState> emit) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('auth_biometric_enabled', event.enabled);
  }

  Future<void> _onChangeAdminPin(
      ChangeAdminPinEvent event, Emitter<AuthState> emit) async {
    try {
      await _api.post('/auth/change-admin-pin', body: {
        'currentPassword': event.currentPassword,
        'newPin': event.newPin,
      });
    } on ApiException catch (e) {
      emit(AuthError(e.message));
    } catch (e) {
      emit(AuthError('Failed to change PIN: $e'));
    }
  }

  Future<void> _onRegister(RegisterEvent event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final payload = <String, dynamic>{
        'email': event.email,
        'password': event.password,
        'firstName': event.firstName,
        'lastName': event.lastName,
      };
      if (event.phone != null && event.phone!.isNotEmpty)
        payload['phone'] = event.phone;
      if (event.companyName != null && event.companyName!.isNotEmpty)
        payload['companyName'] = event.companyName;

      final data =
          await _api.post('/auth/register', body: payload, auth: false);

      if (data != null && data['accessToken'] != null) {
        final token = data['accessToken'] as String;
        _api.setToken(token);
        final user = UserModel.fromJson(data['user']);

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access_token', token);
        await prefs.setString('user', json.encode(data['user']));

        emit(AuthAuthenticated(user: user, token: token));
        unawaited(FcmService.instance.syncToken());
      } else {
        // Registration successful but account is PENDING approval
        emit(const AuthUnauthenticated());
      }
    } catch (e) {
      emit(AuthError('Registration failed: $e'));
    }
  }

  Future<void> _onSendOtp(SendOtpEvent event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final data = await _api.post('/auth/send-otp',
          body: {'phone': event.phone}, auth: false);
      final map =
          data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      emit(OtpSent(
        verificationId: map['verificationId']?.toString() ?? '',
        code: map['code']?.toString(),
        smsError: map['smsError']?.toString(),
      ));
    } on ApiException catch (e) {
      emit(AuthError(e.message));
    } catch (e) {
      emit(const AuthError('Failed to send OTP. Please try again.'));
    }
  }

  Future<void> _onVerifyOtp(
      VerifyOtpEvent event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final data = await _api.post('/auth/verify-otp',
          body: {
            'phone': event.phone,
            'code': event.code,
          },
          auth: false);
      final map =
          data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      if (map['verified'] == true) {
        emit(const OtpVerified());
      } else {
        emit(AuthError(
            map['message']?.toString() ?? 'Invalid or expired OTP code'));
      }
    } on ApiException catch (e) {
      emit(AuthError(e.message));
    } catch (_) {
      emit(const AuthError('Invalid or expired OTP code'));
    }
  }

  Future<void> _onLogout(LogoutEvent event, Emitter<AuthState> emit) async {
    await _clearSession();
    emit(const AuthUnauthenticated());
  }

  Future<void> _onDeleteAccount(
      DeleteAccountEvent event, Emitter<AuthState> emit) async {
    await FcmService.instance.unregister();
    final body = <String, dynamic>{};
    if (event.otp != null) body['otp'] = event.otp;
    if (event.phone != null) body['phone'] = event.phone;
    try {
      await _api.delete('/users/me', body: body.isNotEmpty ? body : null);
    } on ApiException catch (e) {
      emit(AccountDeleteFailed(
        e.message.isEmpty ? 'Account deletion failed. Please try again.' : e.message,
      ));
      return;
    } catch (_) {
      emit(const AccountDeleteFailed(
        'Could not reach the server. Your account was not deleted, please try again.',
      ));
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user');
    _api.setToken(null);
    emit(const AuthUnauthenticated());
  }

  void _onClearError(ClearAuthError event, Emitter<AuthState> emit) {
    if (state is AuthError || state is AuthAccountBlocked) {
      emit(const AuthUnauthenticated());
    }
  }

  Future<void> _onUpdateProfile(
      UpdateProfileEvent event, Emitter<AuthState> emit) async {
    if (state is AuthAuthenticated) {
      final current = state as AuthAuthenticated;
      final user = current.user;

      if (event.companyName != null && user.companyId != null) {
        try {
          await _api.put('/companies/${user.companyId}',
              body: {'name': event.companyName});
        } catch (_) {}
      }

      if (event.firstName != null || event.lastName != null) {
        try {
          await _api.patch('/users/me', body: {
            if (event.firstName != null) 'firstName': event.firstName,
            if (event.lastName != null) 'lastName': event.lastName,
          });
        } catch (_) {}
      }

      final updated = user.copyWith(
        companyName: event.companyName,
        firstName: event.firstName,
        lastName: event.lastName,
        pushNotificationsEnabled: event.pushNotificationsEnabled,
        emailNotificationsEnabled: event.emailNotificationsEnabled,
      );

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', json.encode(updated.toJson()));

      if (event.pushNotificationsEnabled != null) {
        await prefs.setBool(
            'push_notifications_enabled', event.pushNotificationsEnabled!);
        if (event.pushNotificationsEnabled!) {
          unawaited(FcmService.instance.syncToken());
        } else {
          unawaited(FcmService.instance.unregister());
        }
      }

      emit(AuthAuthenticated(user: updated, token: current.token));
    }
  }

  Future<void> _onChangePassword(
      ChangePasswordEvent event, Emitter<AuthState> emit) async {
    try {
      await _api.patch('/users/me', body: {'password': event.newPassword});
      emit(const PasswordChangeSuccess());
    } catch (e) {
      emit(PasswordChangeError('Failed to change password: $e'));
    }
  }
}
