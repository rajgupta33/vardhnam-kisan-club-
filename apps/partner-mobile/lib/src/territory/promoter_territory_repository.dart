import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'promoter_territory.dart';

final promoterTerritoryRepositoryProvider =
    Provider<PromoterTerritoryRepository>(
      (ref) =>
          ApiPromoterTerritoryRepository(ref.read(partnerApiClientProvider)),
    );

abstract interface class PromoterTerritoryRepository {
  Future<PromoterTerritoryAssignment> getMyTerritory();
}

class ApiPromoterTerritoryRepository implements PromoterTerritoryRepository {
  ApiPromoterTerritoryRepository(this._client);

  final PartnerApiClient _client;

  @override
  Future<PromoterTerritoryAssignment> getMyTerritory() async =>
      PromoterTerritoryAssignment.fromJson(
        await _client.get('/promoters/territories/me'),
      );
}
