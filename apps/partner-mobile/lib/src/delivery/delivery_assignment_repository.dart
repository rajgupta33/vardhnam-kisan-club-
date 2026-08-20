import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'delivery_assignment_models.dart';
import 'delivery_location_proof.dart';

final deliveryAssignmentRepositoryProvider =
    Provider<DeliveryAssignmentRepository>((ref) {
      return ApiDeliveryAssignmentRepository(
        ref.read(partnerApiClientProvider),
      );
    });

abstract interface class DeliveryAssignmentRepository {
  Future<DeliveryAssignmentPage> list({int page = 1, int limit = 20});
  Future<DeliveryOrder> get(String orderId);
  Future<DeliveryOrder> accept(String orderId);
  Future<DeliveryOrder> reject({
    required String orderId,
    required String reason,
  });
  Future<DeliveryOrder> verifyPickup({
    required String orderId,
    required String packageQrCode,
  });
  Future<DeliveryOrder> start(String orderId);
  Future<DeliveryOrder> reportFailure({
    required String orderId,
    required DeliveryFailureReason reason,
    required DateTime retryAt,
    String? note,
  });
  Future<DeliveryOrder> retry(String orderId);
  Future<DeliveryOrder> complete({
    required String orderId,
    required String otpCode,
    required DeliveryLocationProof locationProof,
    String? proofNote,
  });
}

class ApiDeliveryAssignmentRepository implements DeliveryAssignmentRepository {
  ApiDeliveryAssignmentRepository(this._client);
  final PartnerApiClient _client;

  @override
  Future<DeliveryAssignmentPage> list({int page = 1, int limit = 20}) async {
    final uri = Uri(
      path: '/fulfilment/orders',
      queryParameters: {'page': '$page', 'limit': '$limit'},
    );
    return DeliveryAssignmentPage.fromJson(await _client.get(uri.toString()));
  }

  @override
  Future<DeliveryOrder> get(String orderId) async => DeliveryOrder.fromJson(
    await _client.get('/fulfilment/orders/${Uri.encodeComponent(orderId)}'),
  );

  @override
  Future<DeliveryOrder> accept(String orderId) async => DeliveryOrder.fromJson(
    await _client.post(
      '/fulfilment/orders/${Uri.encodeComponent(orderId)}/delivery-assignment/accept',
      {'reason': 'Delivery assignment accepted in partner app'},
    ),
  );

  @override
  Future<DeliveryOrder> reject({
    required String orderId,
    required String reason,
  }) async => DeliveryOrder.fromJson(
    await _client.post(
      '/fulfilment/orders/${Uri.encodeComponent(orderId)}/delivery-assignment/reject',
      {'reason': reason.trim()},
    ),
  );

  @override
  Future<DeliveryOrder> verifyPickup({
    required String orderId,
    required String packageQrCode,
  }) async => DeliveryOrder.fromJson(
    await _client.post(
      '/fulfilment/orders/${Uri.encodeComponent(orderId)}/delivery-assignment/verify-pickup',
      {'packageQrCode': packageQrCode.trim()},
    ),
  );

  @override
  Future<DeliveryOrder> start(String orderId) async => DeliveryOrder.fromJson(
    await _client.post(
      '/fulfilment/orders/${Uri.encodeComponent(orderId)}/out-for-delivery',
      {'reason': 'Assigned delivery partner collected the package'},
    ),
  );

  @override
  Future<DeliveryOrder> reportFailure({
    required String orderId,
    required DeliveryFailureReason reason,
    required DateTime retryAt,
    String? note,
  }) async => DeliveryOrder.fromJson(
    await _client.post(
      '/fulfilment/orders/${Uri.encodeComponent(orderId)}/delivery-failure',
      {
        'reasonCode': reason.apiValue,
        'retryAt': retryAt.toUtc().toIso8601String(),
        if (note?.trim().isNotEmpty ?? false) 'note': note!.trim(),
      },
    ),
  );

  @override
  Future<DeliveryOrder> retry(String orderId) async => DeliveryOrder.fromJson(
    await _client.post(
      '/fulfilment/orders/${Uri.encodeComponent(orderId)}/delivery-retry',
      {'reason': 'Scheduled retry started in partner app'},
    ),
  );

  @override
  Future<DeliveryOrder> complete({
    required String orderId,
    required String otpCode,
    required DeliveryLocationProof locationProof,
    String? proofNote,
  }) async => DeliveryOrder.fromJson(
    await _client.post(
      '/fulfilment/orders/${Uri.encodeComponent(orderId)}/deliver',
      {
        'otpCode': otpCode,
        'proofLocationStatus': locationProof.apiStatus,
        if (locationProof.status == DeliveryProofLocationStatus.granted) ...{
          'proofLatitude': locationProof.latitude,
          'proofLongitude': locationProof.longitude,
          'proofAccuracyMetres': locationProof.accuracyMetres,
          'proofLocationCapturedAt': locationProof.capturedAt!
              .toUtc()
              .toIso8601String(),
        },
        if (proofNote?.trim().isNotEmpty ?? false)
          'proofNote': proofNote!.trim(),
      },
    ),
  );
}
