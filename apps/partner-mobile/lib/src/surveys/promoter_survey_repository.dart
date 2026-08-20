import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../kisan_club/promoter_club_models.dart';
import '../network/partner_api_client.dart';

final promoterSurveyRepositoryProvider = Provider<PromoterSurveyRepository>(
  (ref) => ApiPromoterSurveyRepository(ref.read(partnerApiClientProvider)),
);

abstract interface class PromoterSurveyRepository {
  Future<List<CropReference>> listCropReferences();

  Future<void> createSurvey({
    required String farmerProfileId,
    required FarmSurveyInput survey,
  });
}

class ApiPromoterSurveyRepository implements PromoterSurveyRepository {
  ApiPromoterSurveyRepository(this._client);

  final PartnerApiClient _client;

  @override
  Future<List<CropReference>> listCropReferences() async {
    final items = await _client.getList('/promoters/surveys/reference/crops');
    return items
        .map(
          (item) =>
              CropReference.fromJson((item as Map).cast<String, Object?>()),
        )
        .toList(growable: false);
  }

  @override
  Future<void> createSurvey({
    required String farmerProfileId,
    required FarmSurveyInput survey,
  }) async {
    final payload = survey.toJson()..remove('membershipId');
    await _client.post('/promoters/surveys', {
      ...payload,
      'farmerProfileId': farmerProfileId,
    });
  }
}
