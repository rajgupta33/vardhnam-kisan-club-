import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_catalogue_repository.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test(
    'uses authenticated Club routes and parses programme eligibility',
    () async {
      final client = _CatalogueApiClient();
      final repository = KisanClubCatalogueRepository(client);

      final page = await repository.listProducts(
        const MarketplaceProductQuery(pincode: '302001', search: 'bajra seed'),
      );
      final detail = await repository.getProduct(
        productId: 'product-1',
        pincode: '302001',
      );

      expect(page.items.single.clubProgrammes.single.id, 'programme-1');
      expect(detail.product.clubProgrammes.single.displayPriority, 20);
      expect(
        client.paths.first,
        '/kisan-club/products?pincode=302001&page=1&limit=20&q=bajra+seed',
      );
      expect(
        client.paths.last,
        '/kisan-club/products/product-1?pincode=302001',
      );
    },
  );
}

class _CatalogueApiClient implements AuthenticatedApiClient {
  final paths = <String>[];

  @override
  Future<Map<String, Object?>> get(String path) async {
    paths.add(path);
    if (path.contains('/product-1')) return _productDetail;
    return {
      'items': [_productSummary],
      'page': 1,
      'limit': 20,
      'total': 1,
    };
  }

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();

  @override
  Future<List<Object?>> getList(String path) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> patch(String path, Map<String, Object?> body) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _productSummary = <String, Object?>{
  'id': 'product-1',
  'name': 'Hybrid Bajra Seed',
  'category': 'Seeds',
  'cropTargets': ['Bajra'],
  'brand': {'id': 'brand-1', 'name': 'Vardhnam', 'slug': 'vardhnam'},
  'company': {'id': 'company-1', 'displayName': 'Vardhnam'},
  'serviceablePincode': '302001',
  'lowestPricePaise': 120000,
  'availableQuantity': 10,
  'offerCount': 0,
  'sellerCount': 0,
  'fulfilmentModes': <Object?>[],
  'offers': <Object?>[],
  'clubProgrammes': [
    {'id': 'programme-1', 'variantId': null, 'displayPriority': 20},
  ],
};

const _productDetail = <String, Object?>{
  ..._productSummary,
  'description': 'Club product',
  'variants': <Object?>[],
  'documents': <Object?>[],
};
