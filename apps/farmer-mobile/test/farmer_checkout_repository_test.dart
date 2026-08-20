import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/checkout/farmer_checkout_repository.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test(
    'creates checkout with a persisted idempotency key and parses orders',
    () async {
      final client = _RecordingApiClient();
      final keyStore = _FakeIdempotencyStore();
      final repository = ApiFarmerCheckoutRepository(client, keyStore);

      final checkout = await repository.createCheckout('address-1');

      expect(client.postPath, '/checkout/from-cart');
      expect(client.postBody?['farmerAddressId'], 'address-1');
      expect(client.postHeaders, {'Idempotency-Key': 'stable-checkout-key'});
      expect(keyStore.addressIds, ['address-1']);
      expect(keyStore.clearedKeys, ['stable-checkout-key']);
      expect(checkout.status, 'PENDING_PAYMENT');
      expect(checkout.subtotalPaise, 120000);
      expect(checkout.clubBenefitPaise, 10000);
      expect(checkout.farmerPayablePaise, 110000);
      expect(checkout.orders.single.isKisanClubOrder, isTrue);
      expect(checkout.orders.single.items.single.clubBenefitPaise, 10000);
      expect(checkout.orders.single.sellerNameSnapshot, 'Jaipur Distributor');
      expect(
        checkout.orders.single.items.single.reservations.single.batchNumber,
        'B-2026',
      );
    },
  );

  test('cancels checkout with a stable idempotency key', () async {
    final client = _RecordingApiClient(cancelResponse: true);
    final keyStore = _FakeIdempotencyStore();
    final repository = ApiFarmerCheckoutRepository(client, keyStore);

    final checkout = await repository.cancelCheckout('checkout-1');

    expect(client.postPath, '/checkout/checkout-1/cancel');
    expect(client.postHeaders, {'Idempotency-Key': 'stable-checkout-key'});
    expect(keyStore.addressIds, ['cancel:checkout-1']);
    expect(keyStore.clearedKeys, ['stable-checkout-key']);
    expect(checkout.status, 'CANCELLED');
  });
}

class _FakeIdempotencyStore implements CheckoutIdempotencyStore {
  final addressIds = <String>[];
  final clearedKeys = <String>[];

  @override
  Future<String> getOrCreate(String farmerAddressId) async {
    addressIds.add(farmerAddressId);
    return 'stable-checkout-key';
  }

  @override
  Future<void> clear(String key) async => clearedKeys.add(key);
}

class _RecordingApiClient implements AuthenticatedApiClient {
  _RecordingApiClient({this.cancelResponse = false});

  final bool cancelResponse;
  String? postPath;
  Map<String, Object?>? postBody;
  Map<String, String>? postHeaders;

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPath = path;
    postBody = body;
    postHeaders = headers;
    return cancelResponse
        ? {..._checkoutJson, 'status': 'CANCELLED'}
        : _checkoutJson;
  }

  @override
  Future<Map<String, Object?>> get(String path) async => _checkoutJson;

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) =>
      throw UnimplementedError();

  @override
  Future<List<Object?>> getList(String path) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>> patch(String path, Map<String, Object?> body) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _checkoutJson = <String, Object?>{
  'id': 'checkout-1',
  'deliveryAddress': {
    'id': 'address-1',
    'label': 'Home',
    'recipientName': 'Test Farmer',
    'phone': '+919876543210',
    'addressLine1': 'Farm road',
    'addressLine2': null,
    'village': null,
    'city': 'Jaipur',
    'district': null,
    'state': 'Rajasthan',
    'pincode': '302001',
    'landmark': null,
    'isDefault': true,
  },
  'serviceablePincode': '302001',
  'status': 'PENDING_PAYMENT',
  'subtotalPaise': 120000,
  'clubBenefitPaise': 10000,
  'farmerPayablePaise': 110000,
  'itemCount': 1,
  'childOrderCount': 1,
  'orders': [
    {
      'id': 'order-1',
      'orderNumber': 'VA-1001',
      'status': 'INVENTORY_RESERVED',
      'sellerNameSnapshot': 'Jaipur Distributor',
      'sellerGstinSnapshot': '08ABCDE1234F1Z5',
      'subtotalPaise': 120000,
      'clubBenefitPaise': 10000,
      'farmerPayablePaise': 110000,
      'isKisanClubOrder': true,
      'itemCount': 1,
      'items': [
        {
          'id': 'item-1',
          'quantity': 1,
          'unitPricePaise': 120000,
          'lineTotalPaise': 120000,
          'clubBenefitPaise': 10000,
          'farmerPayablePaise': 110000,
          'productNameSnapshot': 'Hybrid Bajra Seed',
          'variantNameSnapshot': '1 kg pack',
          'warehouseNameSnapshot': 'Jaipur Warehouse',
          'fulfilmentModeSnapshot': 'DISTRIBUTOR_FULFILLED',
          'deliverySlaDaysSnapshot': 2,
          'reservations': [
            {
              'id': 'reservation-1',
              'batchId': 'batch-1',
              'batchNumber': 'B-2026',
              'quantity': 1,
            },
          ],
        },
      ],
    },
  ],
};
