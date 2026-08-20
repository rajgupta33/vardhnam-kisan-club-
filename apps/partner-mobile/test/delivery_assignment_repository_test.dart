import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_assignment_models.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_assignment_repository.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_location_proof.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';

void main() {
  test(
    'uses own fulfilment reads and backend delivery transition paths',
    () async {
      final adapter = _DeliveryAdapter();
      final repository = ApiDeliveryAssignmentRepository(
        PartnerApiClient(
          () => _session,
          () async => _session,
          () async {},
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      final page = await repository.list(page: 2, limit: 5);
      final accepted = await repository.accept('order-1');
      final rejected = await repository.reject(
        orderId: 'order-1',
        reason: ' Route overloaded ',
      );
      final pickupVerified = await repository.verifyPickup(
        orderId: 'order-1',
        packageQrCode: ' VARDHNAM-PICKUP:dispatch-1:token ',
      );
      final started = await repository.start('order-1');
      final failed = await repository.reportFailure(
        orderId: 'order-1',
        reason: DeliveryFailureReason.farmerUnavailable,
        retryAt: DateTime.utc(2026, 8, 15, 3, 30),
        note: ' Farmer requested tomorrow ',
      );
      final retried = await repository.retry('order-1');
      final completed = await repository.complete(
        orderId: 'order-1',
        otpCode: '123456',
        locationProof: DeliveryLocationProof.granted(
          latitude: 20.593684,
          longitude: 78.96288,
          accuracyMetres: 12.5,
          capturedAt: DateTime.utc(2026, 8, 14, 8, 30),
        ),
        proofNote: ' Handed to farmer ',
      );

      expect(
        page.items.single.assignment.status,
        DeliveryAssignmentStatus.assigned,
      );
      expect(accepted.assignment.status, DeliveryAssignmentStatus.accepted);
      expect(rejected.assignment.status, DeliveryAssignmentStatus.rejected);
      expect(pickupVerified.assignment.pickupVerifiedAt, isNotNull);
      expect(
        started.assignment.status,
        DeliveryAssignmentStatus.outForDelivery,
      );
      expect(failed.assignment.status, DeliveryAssignmentStatus.deliveryFailed);
      expect(
        retried.assignment.status,
        DeliveryAssignmentStatus.outForDelivery,
      );
      expect(completed.assignment.status, DeliveryAssignmentStatus.delivered);
      expect(adapter.paths, [
        '/fulfilment/orders?page=2&limit=5',
        '/fulfilment/orders/order-1/delivery-assignment/accept',
        '/fulfilment/orders/order-1/delivery-assignment/reject',
        '/fulfilment/orders/order-1/delivery-assignment/verify-pickup',
        '/fulfilment/orders/order-1/out-for-delivery',
        '/fulfilment/orders/order-1/delivery-failure',
        '/fulfilment/orders/order-1/delivery-retry',
        '/fulfilment/orders/order-1/deliver',
      ]);
      expect(adapter.deliveryBody, {
        'otpCode': '123456',
        'proofNote': 'Handed to farmer',
        'proofLocationStatus': 'GRANTED',
        'proofLatitude': 20.593684,
        'proofLongitude': 78.96288,
        'proofAccuracyMetres': 12.5,
        'proofLocationCapturedAt': '2026-08-14T08:30:00.000Z',
      });
      expect(adapter.rejectionBody, {'reason': 'Route overloaded'});
      expect(adapter.pickupBody, {
        'packageQrCode': 'VARDHNAM-PICKUP:dispatch-1:token',
      });
      expect(adapter.failureBody, {
        'reasonCode': 'FARMER_UNAVAILABLE',
        'retryAt': '2026-08-15T03:30:00.000Z',
        'note': 'Farmer requested tomorrow',
      });
    },
  );

  test('omits coordinates when location permission is denied', () async {
    final adapter = _DeliveryAdapter();
    final repository = ApiDeliveryAssignmentRepository(
      PartnerApiClient(
        () => _session,
        () async => _session,
        () async {},
        dio: Dio()..httpClientAdapter = adapter,
      ),
    );

    await repository.complete(
      orderId: 'order-1',
      otpCode: '123456',
      locationProof: const DeliveryLocationProof.denied(),
    );

    expect(adapter.deliveryBody, {
      'otpCode': '123456',
      'proofLocationStatus': 'DENIED',
    });
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

class _DeliveryAdapter implements HttpClientAdapter {
  final paths = <String>[];
  Map<String, Object?>? deliveryBody;
  Map<String, Object?>? rejectionBody;
  Map<String, Object?>? pickupBody;
  Map<String, Object?>? failureBody;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.uri.toString());
    var status = 'ASSIGNED';
    if (options.path.endsWith('/delivery-assignment/accept')) {
      status = 'ACCEPTED';
    }
    if (options.path.endsWith('/delivery-assignment/reject')) {
      status = 'REJECTED';
      rejectionBody = (options.data as Map).cast<String, Object?>();
    }
    final pickupVerified = options.path.endsWith(
      '/delivery-assignment/verify-pickup',
    );
    if (pickupVerified) {
      status = 'ACCEPTED';
      pickupBody = (options.data as Map).cast<String, Object?>();
    }
    if (options.path.endsWith('/out-for-delivery')) status = 'OUT_FOR_DELIVERY';
    if (options.path.endsWith('/delivery-failure')) {
      status = 'DELIVERY_FAILED';
      failureBody = (options.data as Map).cast<String, Object?>();
    }
    if (options.path.endsWith('/delivery-retry')) status = 'OUT_FOR_DELIVERY';
    if (options.path.endsWith('/deliver')) {
      status = 'DELIVERED';
      deliveryBody = (options.data as Map).cast<String, Object?>();
    }
    final order = deliveryOrderJson(status, pickupVerified: pickupVerified);
    final data = options.method == 'GET'
        ? {
            'items': [order],
            'page': 2,
            'limit': 5,
            'total': 6,
          }
        : order;
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

Map<String, Object?> deliveryOrderJson(
  String assignmentStatus, {
  bool pickupVerified = false,
}) => {
  'id': 'order-1',
  'orderNumber': 'PO-1001',
  'status': assignmentStatus == 'DELIVERED' ? 'DELIVERED' : 'READY_FOR_PICKUP',
  'sellerNameSnapshot': 'Etah Distributor',
  'serviceablePincode': '207247',
  'itemCount': 1,
  'deliveryAddressSnapshot': {
    'recipientName': 'Asha Devi',
    'phone': '9876543210',
    'addressLine1': 'Farm road',
    'addressLine2': null,
    'village': 'Aliganj',
    'city': null,
    'district': 'Etah',
    'state': 'Uttar Pradesh',
    'pincode': '207247',
    'landmark': null,
  },
  'deliveryAssignment': {
    'id': 'assignment-1',
    'assignmentNumber': 'DA-1001',
    'status': assignmentStatus,
    'dispatchNumberSnapshot': 'DSP-1001',
    'invoiceNumberSnapshot': 'INV-1001',
    'otpExpiresAt': '2026-08-15T00:00:00.000Z',
    'otpAttemptCount': 0,
    'pickupVerificationAttemptCount': 0,
    'pickupVerifiedAt': pickupVerified ? '2026-08-14T00:30:00.000Z' : null,
    'assignedAt': '2026-08-14T00:00:00.000Z',
    'startedAt': assignmentStatus == 'ASSIGNED'
        ? null
        : '2026-08-14T01:00:00.000Z',
    'completedAt': assignmentStatus == 'DELIVERED'
        ? '2026-08-14T02:00:00.000Z'
        : null,
    'deliveryProofNote': assignmentStatus == 'DELIVERED'
        ? 'Handed to farmer'
        : null,
    'failureAttemptCount': assignmentStatus == 'DELIVERY_FAILED' ? 1 : 0,
    'lastFailureReasonCode': assignmentStatus == 'DELIVERY_FAILED'
        ? 'FARMER_UNAVAILABLE'
        : null,
    'lastFailureNote': assignmentStatus == 'DELIVERY_FAILED'
        ? 'Farmer requested tomorrow'
        : null,
    'lastFailedAt': assignmentStatus == 'DELIVERY_FAILED'
        ? '2026-08-14T02:00:00.000Z'
        : null,
    'retryScheduledAt': assignmentStatus == 'DELIVERY_FAILED'
        ? '2026-08-15T03:30:00.000Z'
        : null,
  },
  'items': [
    {
      'productNameSnapshot': 'Wheat seed',
      'variantNameSnapshot': '10 kg',
      'quantity': 2,
    },
  ],
};
