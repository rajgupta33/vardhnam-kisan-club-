import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'promoter_visit_models.dart';

final promoterVisitRepositoryProvider = Provider<PromoterVisitRepository>(
  (ref) => ApiPromoterVisitRepository(ref.read(partnerApiClientProvider)),
);

abstract interface class PromoterVisitRepository {
  Future<PromoterVisitPage> listMine({int page = 1});
  Future<PromoterVisit> create(CreatePromoterVisitInput input);
}

class ApiPromoterVisitRepository implements PromoterVisitRepository {
  ApiPromoterVisitRepository(this._client);
  final PartnerApiClient _client;

  @override
  Future<PromoterVisitPage> listMine({int page = 1}) async =>
      PromoterVisitPage.fromJson(
        await _client.get('/promoters/visits/me?page=$page&limit=20'),
      );

  @override
  Future<PromoterVisit> create(CreatePromoterVisitInput input) async =>
      PromoterVisit.fromJson(
        await _client.post('/promoters/visits', input.toJson()),
      );
}
