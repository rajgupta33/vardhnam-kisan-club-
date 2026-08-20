import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../marketplace/marketplace_api.dart';

final authenticatedApiClientProvider = Provider<AuthenticatedApiClient>((ref) {
  return AuthenticatedApiClient(
    () => ref.read(authSessionControllerProvider),
    () => ref.read(authSessionControllerProvider.notifier).refreshSession(),
    () => ref.read(authSessionControllerProvider.notifier).invalidate(),
  );
});

class AuthenticatedApiClient {
  AuthenticatedApiClient(
    this._currentSession,
    this._refreshSession,
    this._invalidateSession, {
    String baseUrl = marketplaceApiBaseUrl,
    Dio? dio,
  }) : _dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: '${baseUrl.replaceFirst(RegExp(r'/+$'), '')}/api/v1',
               connectTimeout: const Duration(seconds: 10),
               sendTimeout: const Duration(seconds: 10),
               receiveTimeout: const Duration(seconds: 20),
               headers: {Headers.acceptHeader: Headers.jsonContentType},
             ),
           );

  final AuthSession? Function() _currentSession;
  final Future<AuthSession?> Function() _refreshSession;
  final Future<void> Function() _invalidateSession;
  final Dio _dio;

  Future<Map<String, Object?>> get(String path) async =>
      _asMap(await _request('GET', path), 'response data');

  Future<Map<String, Object?>?> getOptionalMap(String path) async {
    final value = await _request('GET', path);
    return value == null ? null : _asMap(value, 'response data');
  }

  Future<List<Object?>> getList(String path) async =>
      _asList(await _request('GET', path), 'response data');

  Future<Map<String, Object?>> put(
    String path,
    Map<String, Object?> body,
  ) async => _asMap(await _request('PUT', path, body: body), 'response data');

  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async => _asMap(
    await _request('POST', path, body: body, headers: headers),
    'response data',
  );

  Future<Map<String, Object?>> patch(
    String path,
    Map<String, Object?> body,
  ) async => _asMap(await _request('PATCH', path, body: body), 'response data');

  Future<Map<String, Object?>> delete(String path) async =>
      _asMap(await _request('DELETE', path), 'response data');

  Future<Object?> _request(
    String method,
    String path, {
    Map<String, Object?>? body,
    Map<String, String>? headers,
  }) async {
    final session = _currentSession();
    if (session == null) {
      throw const AuthenticatedApiException(
        code: 'UNAUTHENTICATED',
        message: 'A farmer session is required.',
      );
    }

    try {
      return await _send(
        method,
        path,
        body: body,
        headers: headers,
        accessToken: session.accessToken,
      );
    } on DioException catch (error) {
      if (error.response?.statusCode != 401) {
        throw _mapError(error);
      }

      final latest = _currentSession();
      AuthSession? retrySession;
      if (latest != null && latest.accessToken != session.accessToken) {
        retrySession = latest;
      } else {
        try {
          retrySession = await _refreshSession();
        } on FarmerAuthException catch (refreshError) {
          throw AuthenticatedApiException(
            code: refreshError.code,
            message: refreshError.message,
          );
        }
      }

      if (retrySession == null) {
        await _invalidateSession();
        throw const AuthenticatedApiException(
          code: 'UNAUTHENTICATED',
          message: 'The farmer session has expired.',
        );
      }

      try {
        return await _send(
          method,
          path,
          body: body,
          headers: headers,
          accessToken: retrySession.accessToken,
        );
      } on DioException catch (retryError) {
        if (retryError.response?.statusCode == 401) {
          await _invalidateSession();
        }
        throw _mapError(retryError);
      }
    }
  }

  Future<Object?> _send(
    String method,
    String path, {
    required String accessToken,
    Map<String, Object?>? body,
    Map<String, String>? headers,
  }) async {
    final response = await _dio.request<Object?>(
      path,
      data: body,
      options: Options(
        method: method,
        headers: {...?headers, 'Authorization': 'Bearer $accessToken'},
      ),
    );
    final envelope = _asMap(response.data, 'response envelope');
    return envelope['data'];
  }

  AuthenticatedApiException _mapError(DioException error) {
    final response = error.response?.data;
    final envelope = response is Map
        ? response.cast<String, Object?>()
        : const <String, Object?>{};
    final payload = envelope['error'] is Map
        ? (envelope['error'] as Map).cast<String, Object?>()
        : envelope;
    return AuthenticatedApiException(
      code: payload['code'] as String? ?? _transportErrorCode(error.type),
      message:
          payload['message'] as String? ??
          'Could not reach the marketplace service.',
      statusCode: error.response?.statusCode,
    );
  }
}

String _transportErrorCode(DioExceptionType type) => switch (type) {
  DioExceptionType.connectionTimeout ||
  DioExceptionType.sendTimeout ||
  DioExceptionType.receiveTimeout => 'NETWORK_TIMEOUT',
  DioExceptionType.connectionError => 'NETWORK_OFFLINE',
  _ => 'NETWORK_ERROR',
};

class AuthenticatedApiException implements Exception {
  const AuthenticatedApiException({
    required this.code,
    required this.message,
    this.statusCode,
  });

  final String code;
  final String message;
  final int? statusCode;

  @override
  String toString() => 'AuthenticatedApiException($code)';
}

Map<String, Object?> _asMap(Object? value, String label) {
  if (value is! Map) {
    throw AuthenticatedApiException(
      code: 'INVALID_API_RESPONSE',
      message: 'Expected $label to be an object.',
    );
  }
  return value.cast<String, Object?>();
}

List<Object?> _asList(Object? value, String label) {
  if (value is! List) {
    throw AuthenticatedApiException(
      code: 'INVALID_API_RESPONSE',
      message: 'Expected $label to be a list.',
    );
  }
  return value.cast<Object?>();
}
