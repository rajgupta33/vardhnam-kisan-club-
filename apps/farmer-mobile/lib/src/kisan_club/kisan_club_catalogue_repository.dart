import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../marketplace/marketplace_api.dart';
import '../network/authenticated_api_client.dart';

final kisanClubCatalogueRepositoryProvider =
    Provider<MarketplaceProductRepository>(
      (ref) => KisanClubCatalogueRepository(
        ref.watch(authenticatedApiClientProvider),
      ),
    );

class KisanClubCatalogueRepository implements MarketplaceProductRepository {
  const KisanClubCatalogueRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async => MarketplaceProductPage.fromJson(
    await _client.get(_path('/kisan-club/products', query.toQueryParameters())),
  );

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) async => MarketplaceProductDetail.fromJson(
    await _client.get(
      _path('/kisan-club/products/$productId', {'pincode': pincode}),
    ),
  );

  @override
  Future<MarketplaceFilterOptions> getFilterOptions(String pincode) async =>
      const MarketplaceFilterOptions(
        categories: [],
        brands: [],
        cropTargets: [],
      );
}

String _path(String path, Map<String, String> queryParameters) =>
    Uri(path: path, queryParameters: queryParameters).toString();
