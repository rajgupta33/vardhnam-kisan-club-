import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/authenticated_api_client.dart';
import 'farmer_payment.dart';

final paymentIdempotencyStoreProvider = Provider<PaymentIdempotencyStore>(
  (ref) => const SharedPreferencesPaymentIdempotencyStore(),
);

final farmerPaymentRepositoryProvider = Provider<FarmerPaymentRepository>(
  (ref) => ApiFarmerPaymentRepository(
    ref.watch(authenticatedApiClientProvider),
    ref.watch(paymentIdempotencyStoreProvider),
  ),
);

enum MockPaymentOutcome { success, failure }

abstract interface class FarmerPaymentRepository {
  Future<FarmerPaymentIntent> createIntent(String checkoutId);

  Future<FarmerPaymentIntent> getIntent(String paymentIntentId);

  Future<FarmerPaymentIntent> confirmIntent(
    String paymentIntentId,
    MockPaymentOutcome outcome,
  );
}

class ApiFarmerPaymentRepository implements FarmerPaymentRepository {
  const ApiFarmerPaymentRepository(this._client, this._idempotencyStore);

  final AuthenticatedApiClient _client;
  final PaymentIdempotencyStore _idempotencyStore;

  @override
  Future<FarmerPaymentIntent> createIntent(String checkoutId) async {
    final operation = 'create:$checkoutId';
    final key = await _idempotencyStore.getOrCreate(operation);
    final intent = FarmerPaymentIntent.fromJson(
      await _client.post(
        '/payments/mock-intents',
        {
          'checkoutId': checkoutId,
          'reason': 'Farmer started mock payment in the mobile app.',
        },
        headers: {'Idempotency-Key': key},
      ),
    );
    await _idempotencyStore.clear(operation, key);
    return intent;
  }

  @override
  Future<FarmerPaymentIntent> getIntent(String paymentIntentId) async =>
      FarmerPaymentIntent.fromJson(
        await _client.get(
          '/payments/mock-intents/${Uri.encodeComponent(paymentIntentId)}',
        ),
      );

  @override
  Future<FarmerPaymentIntent> confirmIntent(
    String paymentIntentId,
    MockPaymentOutcome outcome,
  ) async {
    final outcomeCode = outcome == MockPaymentOutcome.success
        ? 'SUCCESS'
        : 'FAILURE';
    final operation = 'confirm:$paymentIntentId:$outcomeCode';
    final key = await _idempotencyStore.getOrCreate(operation);
    await _client.post(
      '/payments/mock-intents/${Uri.encodeComponent(paymentIntentId)}/confirm',
      {
        'outcome': outcomeCode,
        if (outcome == MockPaymentOutcome.failure) ...{
          'failureCode': 'MOCK_DECLINED',
          'failureMessage': 'Mock payment was declined for local testing.',
        },
        'reason':
            'Farmer completed mock payment confirmation in the mobile app.',
      },
      headers: {'Idempotency-Key': key},
    );
    final intent = await getIntent(paymentIntentId);
    await _idempotencyStore.clear(operation, key);
    return intent;
  }
}

abstract interface class PaymentIdempotencyStore {
  Future<String> getOrCreate(String operation);

  Future<void> clear(String operation, String key);
}

class SharedPreferencesPaymentIdempotencyStore
    implements PaymentIdempotencyStore {
  const SharedPreferencesPaymentIdempotencyStore();

  static const _prefix = 'farmer_payment_idempotency_';

  @override
  Future<String> getOrCreate(String operation) async {
    final preferences = await SharedPreferences.getInstance();
    final preference = '$_prefix$operation';
    final savedKey = preferences.getString(preference);
    if (savedKey != null) return savedKey;

    final random = Random.secure();
    final key =
        'farmer-payment-${DateTime.now().microsecondsSinceEpoch}-'
        '${random.nextInt(1 << 32).toRadixString(16)}';
    await preferences.setString(preference, key);
    return key;
  }

  @override
  Future<void> clear(String operation, String key) async {
    final preferences = await SharedPreferences.getInstance();
    final preference = '$_prefix$operation';
    if (preferences.getString(preference) == key) {
      await preferences.remove(preference);
    }
  }
}
