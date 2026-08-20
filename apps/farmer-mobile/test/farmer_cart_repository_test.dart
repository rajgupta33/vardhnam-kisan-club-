import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/cart/farmer_cart.dart';
import 'package:vardhnam_farmer_mobile/src/cart/farmer_cart_repository.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test(
    'uses farmer cart endpoints and parses server-calculated values',
    () async {
      final client = _RecordingApiClient();
      final repository = ApiFarmerCartRepository(client);

      final loaded = await repository.getCart();
      await repository.addItem(
        offerId: 'offer-1',
        quantity: 2,
        serviceablePincode: '302001',
      );
      await repository.updateItem('item-1', 3);
      await repository.removeItem('item-1');
      await repository.clearCart();

      expect(loaded.subtotalPaise, 240000);
      expect(loaded.items.single.lineTotalPaise, 240000);
      expect(loaded.items.single.distributorOrganisationId, 'distributor-1');
      expect(loaded.items.single.sellerNameSnapshot, 'Jaipur Distributor');
      expect(loaded.items.single.minimumOrderQuantity, 1);
      expect(loaded.items.single.maximumOrderQuantity, 10);
      expect(loaded.items.single.maximumSelectableQuantity, 10);
      expect(loaded.clubBenefitPaise, 10000);
      expect(loaded.farmerPayablePaise, 230000);
      expect(loaded.items.single.clubBenefitSnapshotPaise, 10000);
      expect(client.getPaths, ['/cart']);
      expect(client.postPaths, ['/cart/items']);
      expect(client.postBodies.single, containsPair('offerId', 'offer-1'));
      expect(
        client.postBodies.single,
        containsPair('serviceablePincode', '302001'),
      );
      expect(client.patchPaths, ['/cart/items/item-1']);
      expect(client.patchBodies.single, containsPair('quantity', 3));
      expect(client.deletePaths, ['/cart/items/item-1', '/cart/items']);
    },
  );

  test('groups cart items by stable distributor organisation ID', () {
    final firstItem =
        (_cartJson['items']! as List<Object?>).single! as Map<String, Object?>;
    final cart = FarmerCart.fromJson({
      ..._cartJson,
      'itemCount': 2,
      'subtotalPaise': 360000,
      'items': [
        firstItem,
        {
          ...firstItem,
          'id': 'item-2',
          'offerId': 'offer-2',
          'distributorOrganisationId': 'distributor-2',
          'sellerNameSnapshot': 'Ajmer Distributor',
          'lineTotalPaise': 120000,
        },
      ],
    });

    expect(cart.sellerGroups, hasLength(2));
    expect(cart.sellerGroups.first.distributorOrganisationId, 'distributor-1');
    expect(cart.sellerGroups.last.sellerNameSnapshot, 'Ajmer Distributor');
  });

  test('derives safe quantity steps from offer bounds and availability', () {
    final itemJson =
        (_cartJson['items']! as List<Object?>).single! as Map<String, Object?>;
    final belowMinimum = FarmerCartItem.fromJson({
      ...itemJson,
      'quantity': 1,
      'minimumOrderQuantity': 3,
      'maximumOrderQuantity': 8,
      'availableQuantitySnapshot': 6,
    });
    final aboveMaximum = FarmerCartItem.fromJson({
      ...itemJson,
      'quantity': 9,
      'minimumOrderQuantity': 3,
      'maximumOrderQuantity': 8,
      'availableQuantitySnapshot': 6,
    });

    expect(belowMinimum.nextLowerQuantity, isNull);
    expect(belowMinimum.nextHigherQuantity, 3);
    expect(belowMinimum.maximumSelectableQuantity, 6);
    expect(aboveMaximum.nextLowerQuantity, 6);
    expect(aboveMaximum.nextHigherQuantity, isNull);
  });
}

class _RecordingApiClient implements AuthenticatedApiClient {
  final getPaths = <String>[];
  final postPaths = <String>[];
  final postBodies = <Map<String, Object?>>[];
  final patchPaths = <String>[];
  final patchBodies = <Map<String, Object?>>[];
  final deletePaths = <String>[];

  @override
  Future<Map<String, Object?>> get(String path) async {
    getPaths.add(path);
    return _cartJson;
  }

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPaths.add(path);
    postBodies.add(body);
    return _cartJson;
  }

  @override
  Future<Map<String, Object?>> patch(
    String path,
    Map<String, Object?> body,
  ) async {
    patchPaths.add(path);
    patchBodies.add(body);
    return _cartJson;
  }

  @override
  Future<Map<String, Object?>> delete(String path) async {
    deletePaths.add(path);
    return _cartJson;
  }

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) =>
      throw UnimplementedError();

  @override
  Future<List<Object?>> getList(String path) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _cartJson = <String, Object?>{
  'id': 'cart-1',
  'deliveryAddress': null,
  'serviceablePincode': '302001',
  'status': 'ACTIVE',
  'itemCount': 1,
  'subtotalPaise': 240000,
  'clubBenefitPaise': 10000,
  'farmerPayablePaise': 230000,
  'items': [
    {
      'id': 'item-1',
      'offerId': 'offer-1',
      'distributorOrganisationId': 'distributor-1',
      'quantity': 2,
      'priceSnapshotPaise': 120000,
      'availableQuantitySnapshot': 42,
      'minimumOrderQuantity': 1,
      'maximumOrderQuantity': 10,
      'serviceablePincodeSnapshot': '302001',
      'productNameSnapshot': 'Hybrid Bajra Seed',
      'variantNameSnapshot': '1 kg pack',
      'sellerNameSnapshot': 'Jaipur Distributor',
      'warehouseNameSnapshot': 'Jaipur Warehouse',
      'fulfilmentModeSnapshot': 'DISTRIBUTOR_FULFILLED',
      'deliverySlaDaysSnapshot': 2,
      'lineTotalPaise': 240000,
      'clubBenefitSnapshotPaise': 10000,
      'farmerPayablePaise': 230000,
    },
  ],
};
