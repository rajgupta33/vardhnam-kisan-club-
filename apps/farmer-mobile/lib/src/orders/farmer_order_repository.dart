import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/authenticated_api_client.dart';
import 'farmer_invoice_document.dart';
import 'farmer_order.dart';

final orderCancellationKeyStoreProvider = Provider<OrderCancellationKeyStore>(
  (ref) => const SharedPreferencesOrderCancellationKeyStore(),
);

final farmerOrderRepositoryProvider = Provider<FarmerOrderRepository>(
  (ref) => ApiFarmerOrderRepository(
    ref.watch(authenticatedApiClientProvider),
    ref.watch(orderCancellationKeyStoreProvider),
  ),
);

abstract interface class FarmerOrderRepository {
  Future<FarmerOrderPage> listOrders({
    int page = 1,
    int limit = 20,
    String? status,
  });

  Future<FarmerOrder> getOrder(String orderId);

  Future<FarmerOrder> cancelOrder(String orderId);

  Future<FarmerInvoiceDocument> requestInvoicePdf(String orderId);

  Future<FarmerInvoiceDocument> getInvoicePdf(String orderId);

  Future<FarmerInvoiceDownload> getInvoicePdfDownload(String orderId);
}

class ApiFarmerOrderRepository implements FarmerOrderRepository {
  const ApiFarmerOrderRepository(this._client, this._keyStore);

  final AuthenticatedApiClient _client;
  final OrderCancellationKeyStore _keyStore;

  @override
  Future<FarmerOrderPage> listOrders({
    int page = 1,
    int limit = 20,
    String? status,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'limit': '$limit',
      if (status != null) 'status': status,
    };
    return FarmerOrderPage.fromJson(
      await _client.get(
        Uri(path: '/orders', queryParameters: query).toString(),
      ),
    );
  }

  @override
  Future<FarmerOrder> getOrder(String orderId) async => FarmerOrder.fromJson(
    await _client.get('/orders/${Uri.encodeComponent(orderId)}'),
  );

  @override
  Future<FarmerOrder> cancelOrder(String orderId) async {
    final key = await _keyStore.getOrCreate(orderId);
    final order = FarmerOrder.fromJson(
      await _client.post(
        '/orders/${Uri.encodeComponent(orderId)}/cancel',
        {'reason': 'Farmer cancelled child order in the mobile app.'},
        headers: {'Idempotency-Key': key},
      ),
    );
    await _keyStore.clear(orderId, key);
    return order;
  }

  @override
  Future<FarmerInvoiceDocument> requestInvoicePdf(String orderId) async =>
      FarmerInvoiceDocument.fromJson(
        await _client.post(
          '/orders/${Uri.encodeComponent(orderId)}/invoice/pdf',
          const {},
        ),
      );

  @override
  Future<FarmerInvoiceDocument> getInvoicePdf(String orderId) async =>
      FarmerInvoiceDocument.fromJson(
        await _client.get(
          '/orders/${Uri.encodeComponent(orderId)}/invoice/pdf',
        ),
      );

  @override
  Future<FarmerInvoiceDownload> getInvoicePdfDownload(String orderId) async =>
      FarmerInvoiceDownload.fromJson(
        await _client.get(
          '/orders/${Uri.encodeComponent(orderId)}/invoice/pdf/download',
        ),
      );
}

abstract interface class OrderCancellationKeyStore {
  Future<String> getOrCreate(String orderId);

  Future<void> clear(String orderId, String key);
}

class SharedPreferencesOrderCancellationKeyStore
    implements OrderCancellationKeyStore {
  const SharedPreferencesOrderCancellationKeyStore();

  static const _prefix = 'farmer_order_cancel_';

  @override
  Future<String> getOrCreate(String orderId) async {
    final preferences = await SharedPreferences.getInstance();
    final preference = '$_prefix$orderId';
    final saved = preferences.getString(preference);
    if (saved != null) return saved;
    final random = Random.secure();
    final key =
        'farmer-order-cancel-${DateTime.now().microsecondsSinceEpoch}-'
        '${random.nextInt(1 << 32).toRadixString(16)}';
    await preferences.setString(preference, key);
    return key;
  }

  @override
  Future<void> clear(String orderId, String key) async {
    final preferences = await SharedPreferences.getInstance();
    final preference = '$_prefix$orderId';
    if (preferences.getString(preference) == key) {
      await preferences.remove(preference);
    }
  }
}
