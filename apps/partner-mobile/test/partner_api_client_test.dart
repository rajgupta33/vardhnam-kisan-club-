import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';

void main() {
  test('refreshes one expired access token and retries once', () async {
    final adapter = _TokenAdapter();
    final dio = Dio()..httpClientAdapter = adapter;
    var session = _session('old-access');
    var refreshes = 0;
    final client = PartnerApiClient(
      () => session,
      () async {
        refreshes += 1;
        session = _session('new-access');
        return session;
      },
      () async {},
      dio: dio,
    );

    final result = await client.get('/auth/session');

    expect(result['role'], 'PROMOTER');
    expect(refreshes, 1);
    expect(adapter.authorizationHeaders, [
      'Bearer old-access',
      'Bearer new-access',
    ]);
  });
}

PartnerSession _session(String accessToken) => PartnerSession(
  accessToken: accessToken,
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  role: PartnerRole.promoter,
  expiresIn: '15m',
);

class _TokenAdapter implements HttpClientAdapter {
  final authorizationHeaders = <String?>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final authorization = options.headers['Authorization'] as String?;
    authorizationHeaders.add(authorization);
    final success = authorization == 'Bearer new-access';
    return ResponseBody.fromString(
      jsonEncode(
        success
            ? {
                'data': {'role': 'PROMOTER'},
              }
            : {
                'error': {
                  'code': 'UNAUTHENTICATED',
                  'message': 'Access token expired.',
                },
              },
      ),
      success ? 200 : 401,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
