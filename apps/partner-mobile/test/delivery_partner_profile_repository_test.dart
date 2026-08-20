import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_partner_profile.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_partner_profile_repository.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';

void main() {
  test('reads and updates backend-owned availability', () async {
    final adapter = _ProfileAdapter();
    final repository = ApiDeliveryPartnerProfileRepository(
      PartnerApiClient(
        () => _session,
        () async => _session,
        () async {},
        dio: Dio()..httpClientAdapter = adapter,
      ),
    );

    final initial = await repository.getMyProfile();
    final updated = await repository.updateAvailability(
      DeliveryPartnerAvailability.online,
    );

    expect(initial.availability, DeliveryPartnerAvailability.offline);
    expect(updated.availability, DeliveryPartnerAvailability.online);
    expect(adapter.methods, ['GET', 'PUT']);
    expect(adapter.paths, [
      '/delivery-partners/me',
      '/delivery-partners/me/availability',
    ]);
    expect(adapter.updateBody, {'availabilityStatus': 'ONLINE'});
  });
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'delivery-organisation',
  role: PartnerRole.deliveryPartner,
  expiresIn: '15m',
);

class _ProfileAdapter implements HttpClientAdapter {
  final paths = <String>[];
  final methods = <String>[];
  Map<String, Object?>? updateBody;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.uri.toString());
    methods.add(options.method);
    if (options.method == 'PUT') {
      updateBody = (options.data as Map).cast<String, Object?>();
    }
    return ResponseBody.fromString(
      jsonEncode({
        'data': {
          'id': options.method == 'PUT' ? 'profile-1' : null,
          'userId': 'delivery-user',
          'organisationId': 'delivery-organisation',
          'availabilityStatus': options.method == 'PUT' ? 'ONLINE' : 'OFFLINE',
          'availabilityChangedAt': options.method == 'PUT'
              ? '2026-08-14T10:00:00.000Z'
              : null,
        },
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
