import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test(
    'refreshes after one 401 and retries once with the new access token',
    () async {
      final adapter = _TokenAwareAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      var session = _oldSession;
      var refreshCount = 0;
      var invalidationCount = 0;
      final client = AuthenticatedApiClient(
        () => session,
        () async {
          refreshCount += 1;
          session = _newSession;
          return session;
        },
        () async => invalidationCount += 1,
        dio: dio,
      );

      final data = await client.get('/farmers/me');

      expect(data['id'], 'profile-1');
      expect(refreshCount, 1);
      expect(invalidationCount, 0);
      expect(adapter.authorizationHeaders, [
        'Bearer old-access',
        'Bearer new-access',
      ]);
    },
  );

  test(
    'invalidates the session when the retried request is also unauthorized',
    () async {
      final adapter = _TokenAwareAdapter(alwaysUnauthorized: true);
      final dio = Dio()..httpClientAdapter = adapter;
      var invalidationCount = 0;
      final client = AuthenticatedApiClient(
        () => _oldSession,
        () async => _newSession,
        () async => invalidationCount += 1,
        dio: dio,
      );

      await expectLater(
        client.get('/farmers/me'),
        throwsA(
          isA<AuthenticatedApiException>().having(
            (error) => error.code,
            'code',
            'UNAUTHENTICATED',
          ),
        ),
      );
      expect(invalidationCount, 1);
    },
  );

  test('forwards an idempotency header with authenticated posts', () async {
    final adapter = _TokenAwareAdapter();
    final dio = Dio()..httpClientAdapter = adapter;
    final client = AuthenticatedApiClient(
      () => _newSession,
      () async => _newSession,
      () async {},
      dio: dio,
    );

    await client.post(
      '/checkout/from-cart',
      const {'farmerAddressId': 'address-1'},
      headers: const {'Idempotency-Key': 'stable-key'},
    );

    expect(adapter.idempotencyHeaders, ['stable-key']);
  });

  test('classifies connection failures as offline errors', () async {
    final dio = Dio()
      ..httpClientAdapter = _FailingAdapter(DioExceptionType.connectionError);
    final client = AuthenticatedApiClient(
      () => _newSession,
      () async => _newSession,
      () async {},
      dio: dio,
    );

    await expectLater(
      client.get('/farmers/me'),
      throwsA(
        isA<AuthenticatedApiException>().having(
          (error) => error.code,
          'code',
          'NETWORK_OFFLINE',
        ),
      ),
    );
  });

  test('classifies transport timeouts separately', () async {
    final dio = Dio()
      ..httpClientAdapter = _FailingAdapter(DioExceptionType.receiveTimeout);
    final client = AuthenticatedApiClient(
      () => _newSession,
      () async => _newSession,
      () async {},
      dio: dio,
    );

    await expectLater(
      client.get('/farmers/me'),
      throwsA(
        isA<AuthenticatedApiException>().having(
          (error) => error.code,
          'code',
          'NETWORK_TIMEOUT',
        ),
      ),
    );
  });
}

class _FailingAdapter implements HttpClientAdapter {
  _FailingAdapter(this.type);

  final DioExceptionType type;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => throw DioException(requestOptions: options, type: type);

  @override
  void close({bool force = false}) {}
}

class _TokenAwareAdapter implements HttpClientAdapter {
  _TokenAwareAdapter({this.alwaysUnauthorized = false});

  final bool alwaysUnauthorized;
  final authorizationHeaders = <String?>[];
  final idempotencyHeaders = <String?>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final authorization = options.headers['Authorization'] as String?;
    authorizationHeaders.add(authorization);
    idempotencyHeaders.add(options.headers['Idempotency-Key'] as String?);
    if (alwaysUnauthorized || authorization != 'Bearer new-access') {
      return ResponseBody.fromString(
        jsonEncode({
          'error': {
            'code': 'UNAUTHENTICATED',
            'message': 'Access token expired.',
          },
        }),
        401,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }
    return ResponseBody.fromString(
      jsonEncode({
        'data': {'id': 'profile-1'},
      }),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const _oldSession = AuthSession(
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  membershipId: 'membership-1',
  organisationId: 'organisation-1',
  role: 'FARMER',
  expiresIn: '15m',
);

const _newSession = AuthSession(
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  membershipId: 'membership-1',
  organisationId: 'organisation-1',
  role: 'FARMER',
  expiresIn: '15m',
);
