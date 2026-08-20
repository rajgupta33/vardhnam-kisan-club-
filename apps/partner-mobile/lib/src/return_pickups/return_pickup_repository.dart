import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'return_pickup_models.dart';

final returnPickupRepositoryProvider = Provider<ReturnPickupRepository>((ref) {
  return ApiReturnPickupRepository(ref.read(partnerApiClientProvider));
});

abstract interface class ReturnPickupRepository {
  Future<ReturnPickupPage> list({int page = 1, int limit = 20});
  Future<ReturnPickup> get(String assignmentId);
  Future<ReturnPickup> accept(String assignmentId);
  Future<ReturnPickup> reject({
    required String assignmentId,
    required String reason,
  });
  Future<ReturnPickup> collect({required String assignmentId, String? note});
}

class ApiReturnPickupRepository implements ReturnPickupRepository {
  ApiReturnPickupRepository(this._client);
  final PartnerApiClient _client;

  @override
  Future<ReturnPickupPage> list({int page = 1, int limit = 20}) async =>
      ReturnPickupPage.fromJson(
        await _client.get('/return-pickups?page=$page&limit=$limit'),
      );

  @override
  Future<ReturnPickup> get(String assignmentId) async => ReturnPickup.fromJson(
    await _client.get('/return-pickups/${Uri.encodeComponent(assignmentId)}'),
  );

  @override
  Future<ReturnPickup> accept(String assignmentId) async =>
      ReturnPickup.fromJson(
        await _client.post(
          '/return-pickups/${Uri.encodeComponent(assignmentId)}/accept',
          {},
        ),
      );

  @override
  Future<ReturnPickup> reject({
    required String assignmentId,
    required String reason,
  }) async => ReturnPickup.fromJson(
    await _client.post(
      '/return-pickups/${Uri.encodeComponent(assignmentId)}/reject',
      {'reason': reason.trim()},
    ),
  );

  @override
  Future<ReturnPickup> collect({
    required String assignmentId,
    String? note,
  }) async => ReturnPickup.fromJson(
    await _client.post(
      '/return-pickups/${Uri.encodeComponent(assignmentId)}/collect',
      {if (note?.trim().isNotEmpty ?? false) 'reason': note!.trim()},
    ),
  );
}
