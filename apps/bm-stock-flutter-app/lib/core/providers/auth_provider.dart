import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';
import '../api/api_exceptions.dart';
import '../models/user_model.dart';
import '../services/fcm_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  UserModel? _user;
  bool _isLoading = false;
  String? _error;
  final Completer<void> _readyCompleter = Completer<void>();

  UserModel? get user => _user;
  bool get isAuthenticated => _api.accessToken != null;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get accessToken => _api.accessToken;
  Future<void> get isReady => _readyCompleter.future;

  AuthProvider() {
    ApiClient.onUnauthorized = _onUnauthorized;
    _loadSession();
  }

  void _onUnauthorized() {
    _user = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> _loadSession() async {
    try {
      await _api.loadToken();
      final prefs = await SharedPreferences.getInstance();
      final userJson = prefs.getString('user');
      if (userJson != null) {
        _user = UserModel.fromJson(json.decode(userJson));
      }
    } catch (_) {
      // ignore session load errors
    }
    notifyListeners();
    if (!_readyCompleter.isCompleted) _readyCompleter.complete();
  }

  Future<void> _saveSession(String accessToken, Map<String, dynamic> userData) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', accessToken);
    await prefs.setString('user', json.encode(userData));
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _api.post('/auth/login', body: {
        'email': email,
        'password': password,
      }, auth: false);

      final token = data['accessToken'] as String;
      _api.setToken(token);
      _user = UserModel.fromJson(data['user']);
      await _saveSession(token, data['user']);
      FcmService.instance.syncToken();

      _isLoading = false;
      notifyListeners();
      return true;
    } on UnauthorizedException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Connection failed: Please check if the backend is running';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? companyName,
    String? phone,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final payload = <String, dynamic>{
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
      };
      if (companyName != null && companyName.isNotEmpty) {
        payload['companyName'] = companyName;
      }
      if (phone != null && phone.isNotEmpty) {
        payload['phone'] = phone;
      }

      final data = await _api.post('/auth/register', body: payload, auth: false);

      if (data is Map<String, dynamic>) {
        final token = data['accessToken'];
        if (token != null) {
          _api.setToken(token.toString());
        }
        final userData = data['user'];
        if (userData is Map<String, dynamic>) {
          _user = UserModel.fromJson(userData);
          if (token != null) {
            await _saveSession(token.toString(), userData);
          }
        }
      }

      FcmService.instance.syncToken();

      _isLoading = false;
      notifyListeners();
      return true;
    } on ConflictException {
      _error = 'An account with this phone number already exists. Please log in instead.';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString().contains('already exists')
          ? e.toString()
          : 'Registration failed: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<Map<String, dynamic>> sendOtp(String phone) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _api.post('/auth/send-otp', body: {'phone': phone}, auth: false);
      _isLoading = false;
      notifyListeners();
      return {
        'success': true,
        'verificationId': data['verificationId'],
      };
    } catch (e) {
      _error = 'Failed to send OTP';
      _isLoading = false;
      notifyListeners();
      return {'success': false};
    }
  }

  Future<bool> verifyOtp(String phone, String code) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _api.post('/auth/verify-otp', body: {'phone': phone, 'code': code}, auth: false);
      _isLoading = false;
      notifyListeners();
      if (data['verified'] == true) {
        return true;
      }
      _error = data['message'] ?? 'Invalid or expired OTP code';
      return false;
    } catch (e) {
      _error = 'Invalid or expired OTP code';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await FcmService.instance.unregister();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user');

    _api.setToken(null);
    _user = null;
    notifyListeners();
  }

  Future<bool> updateCompanyName(String newName) async {
    if (_user == null) return false;
    _isLoading = true;
    notifyListeners();

    try {
      if (_user?.companyId != null) {
        await _api.put('/company/${_user!.companyId}', body: {'name': newName});
      }
      _user = _user!.copyWith(companyName: newName);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', json.encode(_user!.toJson()));

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      // Offline / fallback save
      _user = _user!.copyWith(companyName: newName);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', json.encode(_user!.toJson()));

      _isLoading = false;
      notifyListeners();
      return true;
    }
  }

  Future<void> updateNotifications({bool? push, bool? email}) async {
    if (_user == null) return;
    _user = _user!.copyWith(
      pushNotificationsEnabled: push ?? _user!.pushNotificationsEnabled,
      emailNotificationsEnabled: email ?? _user!.emailNotificationsEnabled,
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user', json.encode(_user!.toJson()));
    notifyListeners();
  }

  Future<bool> changePassword(String currentPassword, String newPassword) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _api.patch('/users/me', body: {
        'currentPassword': currentPassword,
        'password': newPassword,
      });
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _error = 'Failed to change password: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateProfile({String? firstName, String? lastName}) async {
    if (_user == null) return false;
    _isLoading = true;
    notifyListeners();

    try {
      final body = <String, dynamic>{};
      if (firstName != null) body['firstName'] = firstName;
      if (lastName != null) body['lastName'] = lastName;

      if (body.isNotEmpty) {
        await _api.patch('/users/me', body: body);
        _user = _user!.copyWith(
          firstName: firstName ?? _user!.firstName,
          lastName: lastName ?? _user!.lastName,
        );
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user', json.encode(_user!.toJson()));
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _error = 'Failed to update profile: $e';
      notifyListeners();
      return false;
    }
  }
}
