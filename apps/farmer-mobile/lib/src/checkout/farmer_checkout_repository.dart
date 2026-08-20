import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/authenticated_api_client.dart';
import 'farmer_checkout.dart';

final checkoutIdempotencyStoreProvider = Provider<CheckoutIdempotencyStore>(
  (ref) => const SharedPreferencesCheckoutIdempotencyStore(),
);

final farmerCheckoutRepositoryProvider = Provider<FarmerCheckoutRepository>(
  (ref) => ApiFarmerCheckoutRepository(
    ref.watch(authenticatedApiClientProvider),
    ref.watch(checkoutIdempotencyStoreProvider),
  ),
);

abstract interface class FarmerCheckoutRepository {
  Future<FarmerCheckout> createCheckout(String farmerAddressId);

  Future<FarmerCheckout> getCheckout(String checkoutId);

  Future<FarmerCheckout> cancelCheckout(String checkoutId);
}

class ApiFarmerCheckoutRepository implements FarmerCheckoutRepository {
  const ApiFarmerCheckoutRepository(this._client, this._idempotencyStore);

  final AuthenticatedApiClient _client;
  final CheckoutIdempotencyStore _idempotencyStore;

  @override
  Future<FarmerCheckout> createCheckout(String farmerAddressId) async {
    final key = await _idempotencyStore.getOrCreate(farmerAddressId);
    final checkout = FarmerCheckout.fromJson(
      await _client.post(
        '/checkout/from-cart',
        {
          'farmerAddressId': farmerAddressId,
          'reason': 'Farmer confirmed checkout in the mobile app.',
        },
        headers: {'Idempotency-Key': key},
      ),
    );
    await _idempotencyStore.clear(key);
    return checkout;
  }

  @override
  Future<FarmerCheckout> getCheckout(String checkoutId) async =>
      FarmerCheckout.fromJson(
        await _client.get('/checkout/${Uri.encodeComponent(checkoutId)}'),
      );

  @override
  Future<FarmerCheckout> cancelCheckout(String checkoutId) async {
    final operation = 'cancel:$checkoutId';
    final key = await _idempotencyStore.getOrCreate(operation);
    final checkout = FarmerCheckout.fromJson(
      await _client.post(
        '/checkout/${Uri.encodeComponent(checkoutId)}/cancel',
        {'reason': 'Farmer cancelled checkout in the mobile app.'},
        headers: {'Idempotency-Key': key},
      ),
    );
    await _idempotencyStore.clear(key);
    return checkout;
  }
}

abstract interface class CheckoutIdempotencyStore {
  Future<String> getOrCreate(String operation);

  Future<void> clear(String key);
}

class SharedPreferencesCheckoutIdempotencyStore
    implements CheckoutIdempotencyStore {
  const SharedPreferencesCheckoutIdempotencyStore();

  static const _keyPreference = 'farmer_checkout_idempotency_key';
  static const _addressPreference = 'farmer_checkout_address_id';

  @override
  Future<String> getOrCreate(String operation) async {
    final preferences = await SharedPreferences.getInstance();
    final savedKey = preferences.getString(_keyPreference);
    final savedAddress = preferences.getString(_addressPreference);
    if (savedKey != null && savedAddress == operation) return savedKey;

    final random = Random.secure();
    final key =
        'farmer-checkout-${DateTime.now().microsecondsSinceEpoch}-'
        '${random.nextInt(1 << 32).toRadixString(16)}';
    await preferences.setString(_keyPreference, key);
    await preferences.setString(_addressPreference, operation);
    return key;
  }

  @override
  Future<void> clear(String key) async {
    final preferences = await SharedPreferences.getInstance();
    if (preferences.getString(_keyPreference) != key) return;
    await preferences.remove(_keyPreference);
    await preferences.remove(_addressPreference);
  }
}
