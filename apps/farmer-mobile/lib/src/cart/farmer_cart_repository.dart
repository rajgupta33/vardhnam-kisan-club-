import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';
import 'farmer_cart.dart';

final farmerCartRepositoryProvider = Provider<FarmerCartRepository>(
  (ref) => ApiFarmerCartRepository(ref.watch(authenticatedApiClientProvider)),
);

abstract interface class FarmerCartRepository {
  Future<FarmerCart> getCart();

  Future<FarmerCart> addItem({
    required String offerId,
    required int quantity,
    required String serviceablePincode,
  });

  Future<FarmerCart> updateItem(String cartItemId, int quantity);

  Future<FarmerCart> removeItem(String cartItemId);

  Future<FarmerCart> clearCart();
}

class ApiFarmerCartRepository implements FarmerCartRepository {
  const ApiFarmerCartRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<FarmerCart> getCart() async =>
      FarmerCart.fromJson(await _client.get('/cart'));

  @override
  Future<FarmerCart> addItem({
    required String offerId,
    required int quantity,
    required String serviceablePincode,
  }) async => FarmerCart.fromJson(
    await _client.post('/cart/items', {
      'offerId': offerId,
      'quantity': quantity,
      'serviceablePincode': serviceablePincode,
      'reason': 'Farmer selected an offer in the mobile product detail.',
    }),
  );

  @override
  Future<FarmerCart> updateItem(String cartItemId, int quantity) async =>
      FarmerCart.fromJson(
        await _client.patch('/cart/items/${Uri.encodeComponent(cartItemId)}', {
          'quantity': quantity,
          'reason': 'Farmer changed quantity in the mobile cart.',
        }),
      );

  @override
  Future<FarmerCart> removeItem(String cartItemId) async => FarmerCart.fromJson(
    await _client.delete('/cart/items/${Uri.encodeComponent(cartItemId)}'),
  );

  @override
  Future<FarmerCart> clearCart() async =>
      FarmerCart.fromJson(await _client.delete('/cart/items'));
}
