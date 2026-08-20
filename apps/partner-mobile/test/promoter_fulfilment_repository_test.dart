import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_fulfilment_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_fulfilment_repository.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';

void main() {
  test('uses exact status pagination and promoter transition paths', () async {
    final adapter = _FulfilmentAdapter();
    final dio = Dio()..httpClientAdapter = adapter;
    final repository = ApiPromoterFulfilmentRepository(
      PartnerApiClient(
        () => _session,
        () async => _session,
        () async {},
        dio: dio,
      ),
    );

    final page = await repository.list(
      status: ClubFulfilmentStatus.assigned,
      page: 2,
      limit: 5,
    );
    final updated = await repository.transition(
      assignmentId: 'assignment-1',
      action: ClubFulfilmentAction.fail,
      reason: ' Farmer unavailable ',
    );

    expect(page.items.single.orderNumber, 'ORD-1');
    expect(updated.status, ClubFulfilmentStatus.failed);
    expect(adapter.paths, [
      '/kisan-club/fulfilment/assignments?page=2&limit=5&status=ASSIGNED',
      '/kisan-club/fulfilment/assignments/assignment-1/fail',
    ]);
    expect(adapter.actionBody, {'reason': 'Farmer unavailable'});
  });

  test(
    'does not expose operations-only actions in promoter transition map',
    () {
      expect(promoterActionsFor(ClubFulfilmentStatus.assigned), [
        ClubFulfilmentAction.accept,
        ClubFulfilmentAction.decline,
      ]);
      expect(promoterActionsFor(ClubFulfilmentStatus.failed), isEmpty);
      expect(promoterActionsFor(ClubFulfilmentStatus.cancelled), isEmpty);
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

class _FulfilmentAdapter implements HttpClientAdapter {
  final paths = <String>[];
  Map<String, Object?>? actionBody;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.uri.toString());
    final isAction = options.path.endsWith('/fail');
    if (isAction) actionBody = (options.data as Map).cast<String, Object?>();
    final assignment = _assignmentJson(isAction ? 'FAILED' : 'ASSIGNED');
    final data = options.method == 'GET'
        ? {
            'items': [assignment],
            'page': 2,
            'limit': 5,
            'total': 6,
          }
        : assignment;
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

Map<String, Object?> assignmentJson(String status) => _assignmentJson(status);

Map<String, Object?> _assignmentJson(String status) => {
  'id': 'assignment-1',
  'productOrderId': 'order-id-1',
  'membershipId': 'member-id-1',
  'promoterUserId': 'promoter-1',
  'mode': 'CLUB_HOME_DELIVERY',
  'status': status,
  'assignedAt': '2026-08-14T00:00:00.000Z',
  'failureReason': status == 'FAILED' ? 'Farmer unavailable' : null,
  'member': {
    'memberNumber': 'VKC-000001',
    'fullName': 'Asha Devi',
    'village': 'Aliganj',
    'pincode': '207247',
  },
  'order': {
    'orderNumber': 'ORD-1',
    'status': 'CONFIRMED',
    'sellerNameSnapshot': 'Etah Distributor',
    'farmerPayablePaise': 7500,
  },
  'statusHistory': [
    {
      'toStatus': status,
      'reason': status == 'FAILED' ? 'Farmer unavailable' : 'Assigned',
      'createdAt': '2026-08-14T00:00:00.000Z',
    },
  ],
};
