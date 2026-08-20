import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/partner_auth_models.dart';
import '../auth/partner_auth_repository.dart';
import '../auth/partner_session_controller.dart';

final partnerApiClientProvider = Provider<PartnerApiClient>((ref) {
  return PartnerApiClient(
    () => ref.read(partnerSessionControllerProvider),
    () => ref.read(partnerSessionControllerProvider.notifier).refreshSession(),
    () => ref.read(partnerSessionControllerProvider.notifier).invalidate(),
  );
});

class PartnerApiClient {
  PartnerApiClient(
    this._currentSession,
    this._refreshSession,
    this._invalidateSession, {
    String baseUrl = partnerApiBaseUrl,
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

  final PartnerSession? Function() _currentSession;
  final Future<PartnerSession?> Function() _refreshSession;
  final Future<void> Function() _invalidateSession;
  final Dio _dio;

  Future<Map<String, Object?>> get(String path) async =>
      _asMap(await _request('GET', path));

  Future<List<Object?>> getList(String path) async =>
      _asList(await _request('GET', path));

  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async =>
      _asMap(await _request('POST', path, body: body, headers: headers));

  Future<Map<String, Object?>> put(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async => _asMap(await _request('PUT', path, body: body, headers: headers));

  Future<Map<String, Object?>> patch(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async =>
      _asMap(await _request('PATCH', path, body: body, headers: headers));

  Future<Object?> _request(
    String method,
    String path, {
    Map<String, Object?>? body,
    Map<String, String>? headers,
  }) async {
    final session = _currentSession();
    if (session == null) {
      throw const PartnerApiException(
        code: 'UNAUTHENTICATED',
        message: 'A partner session is required.',
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
      if (error.response?.statusCode != 401) throw _mapError(error);
      final latest = _currentSession();
      PartnerSession? retrySession;
      if (latest != null && latest.accessToken != session.accessToken) {
        retrySession = latest;
      } else {
        try {
          retrySession = await _refreshSession();
        } on PartnerAuthException catch (refreshError) {
          throw PartnerApiException(
            code: refreshError.code,
            message: refreshError.message,
          );
        }
      }
      if (retrySession == null) {
        await _invalidateSession();
        throw const PartnerApiException(
          code: 'UNAUTHENTICATED',
          message: 'The partner session has expired.',
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
    return _asMap(response.data)['data'];
  }

  PartnerApiException _mapError(DioException error) {
    final envelope = error.response?.data is Map
        ? (error.response!.data as Map).cast<String, Object?>()
        : const <String, Object?>{};
    final payload = envelope['error'] is Map
        ? (envelope['error'] as Map).cast<String, Object?>()
        : envelope;
    return PartnerApiException(
      code: payload['code'] as String? ?? _transportCode(error.type),
      message:
          payload['message'] as String? ??
          'Could not reach the marketplace service.',
      statusCode: error.response?.statusCode,
    );
  }
}

String _transportCode(DioExceptionType type) => switch (type) {
  DioExceptionType.connectionTimeout ||
  DioExceptionType.sendTimeout ||
  DioExceptionType.receiveTimeout => 'NETWORK_TIMEOUT',
  DioExceptionType.connectionError => 'NETWORK_OFFLINE',
  _ => 'NETWORK_ERROR',
};

class PartnerApiException implements Exception {
  const PartnerApiException({
    required this.code,
    required this.message,
    this.statusCode,
  });

  final String code;
  final String message;
  final int? statusCode;
}

Map<String, Object?> _asMap(Object? value) {
  if (value is! Map) {
    throw const PartnerApiException(
      code: 'INVALID_API_RESPONSE',
      message: 'The API response is invalid.',
    );
  }
  return value.cast<String, Object?>();
}

List<Object?> _asList(Object? value) {
  if (value is! List) {
    throw const PartnerApiException(
      code: 'INVALID_API_RESPONSE',
      message: 'The API response is invalid.',
    );
  }
  return value.cast<Object?>();
}
