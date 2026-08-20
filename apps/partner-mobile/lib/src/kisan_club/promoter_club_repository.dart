import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'promoter_club_models.dart';

final promoterClubRepositoryProvider = Provider<PromoterClubRepository>((ref) {
  return ApiPromoterClubRepository(ref.read(partnerApiClientProvider));
});

abstract interface class PromoterClubRepository {
  Future<List<PromoterFarmerSummary>> listAssignedFarmers();

  Future<PromoterFarmerSummary> getAssignedFarmer(String membershipId);

  Future<List<CropReference>> listCropReferences();

  Future<void> createFarmSurvey(FarmSurveyInput survey);

  Future<AssistedCheckoutResult> redeemBenefitToken({
    required String membershipId,
    required String code,
    required String idempotencyKey,
  });
}

class ApiPromoterClubRepository implements PromoterClubRepository {
  ApiPromoterClubRepository(this._client);

  final PartnerApiClient _client;

  @override
  Future<List<PromoterFarmerSummary>> listAssignedFarmers() async {
    final items = await _client.getList('/kisan-club/promoter/farmers');
    return items
        .map((item) => PromoterFarmerSummary.fromJson(_map(item)))
        .toList(growable: false);
  }

  @override
  Future<PromoterFarmerSummary> getAssignedFarmer(String membershipId) async {
    final item = await _client.get(
      '/kisan-club/promoter/farmers/${Uri.encodeComponent(membershipId)}',
    );
    return PromoterFarmerSummary.fromJson(item);
  }

  @override
  Future<List<CropReference>> listCropReferences() async {
    final items = await _client.getList('/farms/reference/crops');
    return items
        .map((item) => CropReference.fromJson(_map(item)))
        .toList(growable: false);
  }

  @override
  Future<void> createFarmSurvey(FarmSurveyInput survey) async {
    await _client.post('/farms/surveys', survey.toJson());
  }

  @override
  Future<AssistedCheckoutResult> redeemBenefitToken({
    required String membershipId,
    required String code,
    required String idempotencyKey,
  }) async {
    final result = await _client.post(
      '/kisan-club/benefit-tokens/redeem',
      {'membershipId': membershipId, 'code': code.trim().toUpperCase()},
      headers: {'Idempotency-Key': idempotencyKey},
    );
    return AssistedCheckoutResult.fromJson(result);
  }
}

Map<String, Object?> _map(Object? value) {
  if (value is! Map) throw const FormatException('Expected an object');
  return value.cast<String, Object?>();
}
