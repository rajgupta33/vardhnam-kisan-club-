import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';
import 'package:vardhnam_partner_mobile/src/territory/promoter_territory_repository.dart';

void main() {
  test('reads only the authenticated promoter territory endpoint', () async {
    final adapter = _TerritoryAdapter();
    final repository = ApiPromoterTerritoryRepository(
      PartnerApiClient(
        () => _session,
        () async => _session,
        () async {},
        dio: Dio()..httpClientAdapter = adapter,
      ),
    );

    final assignment = await repository.getMyTerritory();

    expect(adapter.request?.method, 'GET');
    expect(adapter.request?.uri.path, '/promoters/territories/me');
    expect(assignment.assigned, isTrue);
    expect(assignment.territory?.pincodes, ['207001']);
  });
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  role: PartnerRole.promoter,
  expiresIn: '15m',
);

class _TerritoryAdapter implements HttpClientAdapter {
  RequestOptions? request;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    request = options;
    return ResponseBody.fromString(
      jsonEncode({'data': _assignmentJson}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const _assignmentJson = <String, Object?>{
  'assigned': true,
  'promoterUserId': 'promoter',
  'promoterOrganisationId': 'organisation',
  'territory': {
    'id': 'territory',
    'name': 'Etah North',
    'state': 'Uttar Pradesh',
    'district': 'Etah',
    'blocks': ['Sakit'],
    'pincodes': ['207001'],
    'villages': ['Nagla'],
    'status': 'ACTIVE',
  },
};
