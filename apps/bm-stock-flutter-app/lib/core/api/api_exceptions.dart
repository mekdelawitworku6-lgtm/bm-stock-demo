class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? errorCode;
  ApiException(this.message, {this.statusCode, this.errorCode});
  @override
  String toString() => message;
}

class UnauthorizedException extends ApiException {
  UnauthorizedException([String message = 'Unauthorized', String? errorCode])
      : super(message, statusCode: 401, errorCode: errorCode);
}

class ForbiddenException extends ApiException {
  ForbiddenException([String message = 'You do not have permission to perform this action', String? errorCode])
      : super(message, statusCode: 403, errorCode: errorCode);
}

class NotFoundException extends ApiException {
  NotFoundException([String message = 'Not found'])
      : super(message, statusCode: 404);
}

class ValidationException extends ApiException {
  final Map<String, dynamic>? errors;
  ValidationException([String message = 'Validation failed', this.errors])
      : super(message, statusCode: 422);
}

class ServerException extends ApiException {
  ServerException([String message = 'Server error'])
      : super(message, statusCode: 500);
}

class ConflictException extends ApiException {
  ConflictException([String message = 'Resource already exists'])
      : super(message, statusCode: 409);
}
