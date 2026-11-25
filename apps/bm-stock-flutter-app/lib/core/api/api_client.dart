import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_exceptions.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  static void Function()? onUnauthorized;
  static void Function(String errorCode, String message)? onAccountBlocked;

  String? _accessToken;

  String? get accessToken => _accessToken;

  static const String prodBase = 'https://bmstock.possibletechplc.com';
  static const String localBase = 'http://localhost:3000';

  static const String _envBaseUrl = String.fromEnvironment('BASE_URL');
  static const String _envTunnelUrl = String.fromEnvironment('TUNNEL_URL');

  bool get isLocalBackend {
    // Auto-detect: local for web testing on localhost/127.0.0.1 or debug mode
    if (kIsWeb) {
      final host = Uri.base.host;
      if (host == 'localhost' || host == '127.0.0.1' || host.isEmpty) {
        return true;
      }
    }
    return kDebugMode;
  }

  String get baseUrl {
    if (_envBaseUrl.isNotEmpty) {
      return _envBaseUrl;
    }
    if (_envTunnelUrl.isNotEmpty) {
      return '$_envTunnelUrl/api/v1';
    }

    if (isLocalBackend) {
      return '$localBase/api/v1';
    }

    if (kIsWeb) {
      final host = Uri.base.host;
      if (host.isNotEmpty && host != 'localhost' && host != '127.0.0.1') {
        return '${Uri.base.scheme}://${Uri.base.authority}/api/v1';
      }
    }

    return '$prodBase/api/v1';
  }

  String resolveMediaUrl(String path) {
    if (path.startsWith('http')) return path;
    final host = baseUrl.replaceFirst(RegExp(r'/api/v1$'), '');
    return '$host$path';
  }

  String? _selectedCompanyId;

  String? get selectedCompanyId => _selectedCompanyId;

  void setSelectedCompanyId(String? companyId) {
    _selectedCompanyId = companyId;
  }

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('access_token');
    _selectedCompanyId = prefs.getString('selected_company_id');
  }

  void setToken(String? token) {
    _accessToken = token;
  }

  Map<String, String> _headers({bool auth = true}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (auth && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }
    if (_selectedCompanyId != null && _selectedCompanyId!.isNotEmpty) {
      headers['x-company-id'] = _selectedCompanyId!;
    }
    return headers;
  }

  Future<dynamic> _request(Future<http.Response> Function() request) async {
    return request().timeout(const Duration(seconds: 30));
  }

  Future<dynamic> get(String path, {Map<String, String>? queryParams, bool auth = true}) async {
    await loadToken();
    var uri = Uri.parse('$baseUrl$path');
    if (queryParams != null) {
      uri = uri.replace(queryParameters: queryParams);
    }
    final response = await _request(() => http.get(uri, headers: _headers(auth: auth)));
    return _handleResponse(response, auth: auth);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body, Map<String, String>? queryParams, bool auth = true}) async {
    await loadToken();
    var uri = Uri.parse('$baseUrl$path');
    if (queryParams != null) {
      uri = uri.replace(queryParameters: queryParams);
    }
    final response = await _request(() => http.post(
      uri,
      headers: _headers(auth: auth),
      body: body != null ? json.encode(body) : null,
    ));
    return _handleResponse(response, auth: auth);
  }

  Future<dynamic> put(String path, {Map<String, dynamic>? body, bool auth = true}) async {
    await loadToken();
    final uri = Uri.parse('$baseUrl$path');
    final response = await _request(() => http.put(
      uri,
      headers: _headers(auth: auth),
      body: body != null ? json.encode(body) : null,
    ));
    return _handleResponse(response, auth: auth);
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body, bool auth = true}) async {
    await loadToken();
    final uri = Uri.parse('$baseUrl$path');
    final response = await _request(() => http.patch(
      uri,
      headers: _headers(auth: auth),
      body: body != null ? json.encode(body) : null,
    ));
    return _handleResponse(response, auth: auth);
  }

  Future<dynamic> delete(String path, {Map<String, dynamic>? body, bool auth = true}) async {
    await loadToken();
    final uri = Uri.parse('$baseUrl$path');
    final response = await _request(() => http.delete(
      uri,
      headers: _headers(auth: auth),
      body: body != null ? json.encode(body) : null,
    ));
    return _handleResponse(response, auth: auth);
  }

  MediaType _contentTypeFor(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    switch (ext) {
      case 'png':
        return MediaType('image', 'png');
      case 'jpg':
      case 'jpeg':
        return MediaType('image', 'jpeg');
      case 'webp':
        return MediaType('image', 'webp');
      case 'gif':
        return MediaType('image', 'gif');
      case 'heic':
        return MediaType('image', 'heic');
      case 'heif':
        return MediaType('image', 'heif');
      default:
        return MediaType('application', 'octet-stream');
    }
  }

  Future<dynamic> uploadFile(String path, List<int> bytes, String filename, {String field = 'file', bool auth = true}) async {
    await loadToken();
    final uri = Uri.parse('$baseUrl$path');
    final request = http.MultipartRequest('POST', uri);
    if (auth && _accessToken != null) {
      request.headers['Authorization'] = 'Bearer $_accessToken';
    }
    request.files.add(http.MultipartFile.fromBytes(
      field,
      bytes,
      filename: filename,
      contentType: _contentTypeFor(filename),
    ));
    final streamed = await request.send().timeout(const Duration(seconds: 60));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response, auth: auth);
  }

  dynamic _handleResponse(http.Response response, {bool auth = true}) {
    final body = response.body.isNotEmpty ? json.decode(response.body) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (body is Map && body.containsKey('data')) {
        return body['data'];
      }
      return body;
    }

    String message = 'Request failed';
    String? errorCode;
    if (body is Map) {
      if (body['errorCode'] is String) {
        errorCode = body['errorCode'] as String;
      }
      final msgObj = body['message'];
      if (msgObj is List) {
        message = msgObj.join(', ');
      } else if (msgObj is String) {
        message = msgObj;
      } else if (msgObj is Map) {
        if (msgObj['errorCode'] is String) errorCode = msgObj['errorCode'] as String;
        if (msgObj['message'] is String) message = msgObj['message'] as String;
      } else if (body['error'] is String) {
        message = body['error'];
      }
    }

    final isAccountBlock = errorCode == 'SUBSCRIPTION_EXPIRED' || errorCode == 'COMPANY_DEACTIVATED';
    if (isAccountBlock && _accessToken != null) {
      _accessToken = null;
      SharedPreferences.getInstance().then((prefs) {
        prefs.remove('access_token');
        prefs.remove('refresh_token');
        prefs.remove('user');
        prefs.remove('companies');
        prefs.remove('selected_company_id');
      });
      onAccountBlocked?.call(errorCode!, message);
    } else if (auth && response.statusCode == 401 && _accessToken != null) {
      _accessToken = null;
      SharedPreferences.getInstance().then((prefs) {
        prefs.remove('access_token');
        prefs.remove('refresh_token');
        prefs.remove('user');
        prefs.remove('companies');
        prefs.remove('selected_company_id');
      });
      onUnauthorized?.call();
    }

    switch (response.statusCode) {
      case 400:
      case 422:
        final errorsMap = (body is Map && body['errors'] is Map<String, dynamic>)
            ? body['errors'] as Map<String, dynamic>
            : null;
        throw ValidationException(message, errorsMap);
      case 401:
        throw UnauthorizedException(message, errorCode);
      case 403:
        throw ForbiddenException(message, errorCode);
      case 404:
        throw NotFoundException(message);
      case 409:
        throw ConflictException(message);
      case 500:
        throw ServerException(message);
      default:
        throw ApiException(message, statusCode: response.statusCode);
    }
  }
}
