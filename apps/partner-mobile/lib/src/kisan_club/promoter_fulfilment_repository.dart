import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'promoter_fulfilment_models.dart';

final promoterFulfilmentRepositoryProvider =
    Provider<PromoterFulfilmentRepository>((ref) {
      return ApiPromoterFulfilmentRepository(
        ref.read(partnerApiClientProvider),
      );
    });

abstract interface class PromoterFulfilmentRepository {
  Future<ClubFulfilmentPage> list({
    ClubFulfilmentStatus? status,
    int page = 1,
    int limit = 20,
  });

  Future<ClubFulfilmentAssignment> get(String assignmentId);

  Future<ClubFulfilmentAssignment> transition({
    required String assignmentId,
    required ClubFulfilmentAction action,
    String? reason,
  });
}

class ApiPromoterFulfilmentRepository implements PromoterFulfilmentRepository {
  ApiPromoterFulfilmentRepository(this._client);
  final PartnerApiClient _client;

  @override
  Future<ClubFulfilmentPage> list({
    ClubFulfilmentStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    final uri = Uri(
      path: '/kisan-club/fulfilment/assignments',
      queryParameters: {
        'page': '$page',
        'limit': '$limit',
        if (status != null) 'status': status.apiValue,
      },
    );
    return ClubFulfilmentPage.fromJson(await _client.get(uri.toString()));
  }

  @override
  Future<ClubFulfilmentAssignment> get(String assignmentId) async =>
      ClubFulfilmentAssignment.fromJson(
        await _client.get(
          '/kisan-club/fulfilment/assignments/'
          '${Uri.encodeComponent(assignmentId)}',
        ),
      );

  @override
  Future<ClubFulfilmentAssignment> transition({
    required String assignmentId,
    required ClubFulfilmentAction action,
    String? reason,
  }) async => ClubFulfilmentAssignment.fromJson(
    await _client.post(
      '/kisan-club/fulfilment/assignments/'
      '${Uri.encodeComponent(assignmentId)}/${action.path}',
      {if (reason?.trim().isNotEmpty ?? false) 'reason': reason!.trim()},
    ),
  );
}
