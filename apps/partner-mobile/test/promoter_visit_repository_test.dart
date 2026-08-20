import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';
import 'package:vardhnam_partner_mobile/src/visits/promoter_visit_models.dart';
import 'package:vardhnam_partner_mobile/src/visits/promoter_visit_repository.dart';

void main() {
  test(
    'uses own-scoped visit list and submits no coordinates by default',
    () async {
      final adapter = _VisitAdapter();
      final repository = ApiPromoterVisitRepository(
        PartnerApiClient(
          () => _session,
          () async => _session,
          () async {},
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );
      await repository.listMine(page: 2);
      await repository.create(
        CreatePromoterVisitInput(
          farmerLeadId: 'lead',
          purpose: PromoterVisitPurpose.leadFollowUp,
          occurredAt: DateTime.utc(2026, 8, 16, 10),
          locationProof: null,
        ),
      );

      expect(adapter.paths.first, '/promoters/visits/me');
      expect(adapter.queries.first, {'page': '2', 'limit': '20'});
      expect(adapter.body, containsPair('locationStatus', 'NOT_REQUESTED'));
      expect(adapter.body, isNot(contains('latitude')));
    },
  );
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  role: PartnerRole.promoter,
  expiresIn: '15m',
);

class _VisitAdapter implements HttpClientAdapter {
  final paths = <String>[];
  final queries = <Map<String, String>>[];
  Map<String, Object?>? body;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.uri.path);
    queries.add(options.uri.queryParameters);
    if (options.method == 'POST') {
      body = (options.data as Map).cast<String, Object?>();
    }
    final data = options.method == 'GET'
        ? {'items': <Object?>[], 'page': 2, 'limit': 20, 'total': 0}
        : _visitJson;
    return ResponseBody.fromString(
      jsonEncode({'data': data}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const _visitJson = <String, Object?>{
  'id': 'visit',
  'purpose': 'LEAD_FOLLOW_UP',
  'occurredAt': '2026-08-16T10:00:00.000Z',
  'locationStatus': 'NOT_REQUESTED',
  'notes': null,
  'farmerLead': {
    'id': 'lead',
    'fullName': 'Ram Singh',
    'phone': '+919876543210',
    'status': 'NEW',
  },
  'farmerProfile': null,
};
