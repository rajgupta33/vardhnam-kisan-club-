import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';
import 'package:vardhnam_partner_mobile/src/return_pickups/return_pickup_models.dart';
import 'package:vardhnam_partner_mobile/src/return_pickups/return_pickup_repository.dart';

void main() {
  test('lists, accepts, rejects and collects own return pickups', () async {
    final adapter = _Adapter();
    final repository = ApiReturnPickupRepository(
      PartnerApiClient(
        () => _session,
        () async => _session,
        () async {},
        dio: Dio()..httpClientAdapter = adapter,
      ),
    );

    final page = await repository.list();
    final accepted = await repository.accept('pickup-1');
    final rejected = await repository.reject(
      assignmentId: 'pickup-1',
      reason: ' Route full ',
    );
    final collected = await repository.collect(
      assignmentId: 'pickup-1',
      note: ' Sealed package ',
    );

    expect(page.items.single.status, ReturnPickupStatus.assigned);
    expect(accepted.status, ReturnPickupStatus.accepted);
    expect(rejected.status, ReturnPickupStatus.rejected);
    expect(collected.status, ReturnPickupStatus.collected);
    expect(adapter.rejectionBody, {'reason': 'Route full'});
    expect(adapter.collectionBody, {'reason': 'Sealed package'});
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

class _Adapter implements HttpClientAdapter {
  Map<String, Object?>? rejectionBody;
  Map<String, Object?>? collectionBody;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    var status = 'ASSIGNED';
    if (options.path.endsWith('/accept')) status = 'ACCEPTED';
    if (options.path.endsWith('/reject')) {
      status = 'REJECTED';
      rejectionBody = (options.data as Map).cast<String, Object?>();
    }
    if (options.path.endsWith('/collect')) {
      status = 'COLLECTED';
      collectionBody = (options.data as Map).cast<String, Object?>();
    }
    final pickup = _json(status);
    final data = options.method == 'GET' && !options.path.endsWith('pickup-1')
        ? {
            'items': [pickup],
            'page': 1,
            'limit': 20,
            'total': 1,
          }
        : pickup;
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

Map<String, Object?> _json(String status) => {
  'id': 'pickup-1',
  'returnRequestId': 'return-1',
  'productOrderId': 'order-1',
  'assignmentNumber': 'RPU-1001',
  'status': status,
  'orderNumber': 'PO-1001',
  'sellerName': 'Etah Distributor',
  'pickupAddress': {
    'recipientName': 'Asha Devi',
    'phone': '9876543210',
    'addressLine1': 'Farm road',
    'district': 'Etah',
    'state': 'Uttar Pradesh',
    'pincode': '207247',
  },
  'items': [
    {'productName': 'Wheat seed', 'variantName': '10 kg', 'quantity': 1},
  ],
  'returnReasonCode': 'QUALITY_ISSUE',
  'returnReasonNote': 'Seal damaged',
  'returnStatus': status == 'COLLECTED' ? 'IN_TRANSIT' : 'APPROVED',
  'assignedAt': '2026-08-14T10:00:00.000Z',
  'respondedAt': status == 'ASSIGNED' ? null : '2026-08-14T10:05:00.000Z',
  'rejectionReason': status == 'REJECTED' ? 'Route full' : null,
  'collectedAt': status == 'COLLECTED' ? '2026-08-14T11:00:00.000Z' : null,
  'collectionNote': status == 'COLLECTED' ? 'Sealed package' : null,
};
