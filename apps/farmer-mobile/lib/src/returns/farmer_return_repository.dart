import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/authenticated_api_client.dart';
import 'farmer_credit_note.dart';
import 'farmer_return.dart';

final returnRequestKeyStoreProvider = Provider<ReturnRequestKeyStore>(
  (ref) => const SharedPreferencesReturnRequestKeyStore(),
);

final farmerReturnRepositoryProvider = Provider<FarmerReturnRepository>(
  (ref) => ApiFarmerReturnRepository(
    ref.watch(authenticatedApiClientProvider),
    ref.watch(returnRequestKeyStoreProvider),
  ),
);

abstract interface class FarmerReturnRepository {
  Future<FarmerReturnPage> listMyReturnRequests({
    int page = 1,
    int limit = 20,
    String? status,
  });

  Future<FarmerReturnRequest> getReturnRequest(String returnRequestId);

  Future<FarmerReturnRequest> cancelReturnRequest(
    String returnRequestId, {
    String? reason,
  });

  Future<FarmerReturnEligibility> getEligibility(String orderId);

  Future<FarmerCreditNote> getCreditNote(String refundId);

  Future<FarmerCreditNoteDownload> getCreditNoteDownload(String refundId);

  Future<FarmerReturnRequest> createReturnRequest({
    required String orderId,
    required String reasonCode,
    required Map<String, int> itemQuantities,
    String? reasonNote,
  });
}

class ApiFarmerReturnRepository implements FarmerReturnRepository {
  const ApiFarmerReturnRepository(this._client, this._keyStore);

  final AuthenticatedApiClient _client;
  final ReturnRequestKeyStore _keyStore;

  @override
  Future<FarmerReturnPage> listMyReturnRequests({
    int page = 1,
    int limit = 20,
    String? status,
  }) async => FarmerReturnPage.fromJson(
    await _client.get(
      Uri(
        path: '/returns/me',
        queryParameters: {
          'page': '$page',
          'limit': '$limit',
          if (status != null) 'status': status,
        },
      ).toString(),
    ),
  );

  @override
  Future<FarmerReturnRequest> getReturnRequest(String returnRequestId) async =>
      FarmerReturnRequest.fromJson(
        await _client.get('/returns/${Uri.encodeComponent(returnRequestId)}'),
      );

  @override
  Future<FarmerReturnRequest> cancelReturnRequest(
    String returnRequestId, {
    String? reason,
  }) async {
    final operationId = 'cancel-$returnRequestId';
    final key = await _keyStore.getOrCreate(operationId);
    final request = FarmerReturnRequest.fromJson(
      await _client.post(
        '/returns/${Uri.encodeComponent(returnRequestId)}/cancel',
        {
          if (reason != null && reason.trim().isNotEmpty)
            'reason': reason.trim(),
        },
        headers: {'Idempotency-Key': key},
      ),
    );
    await _keyStore.clear(operationId, key);
    return request;
  }

  @override
  Future<FarmerReturnEligibility> getEligibility(String orderId) async =>
      FarmerReturnEligibility.fromJson(
        await _client.get(
          '/returns/eligibility/${Uri.encodeComponent(orderId)}',
        ),
      );

  @override
  Future<FarmerCreditNote> getCreditNote(String refundId) async =>
      FarmerCreditNote.fromJson(
        await _client.get(
          '/refunds/${Uri.encodeComponent(refundId)}/credit-note',
        ),
      );

  @override
  Future<FarmerCreditNoteDownload> getCreditNoteDownload(
    String refundId,
  ) async => FarmerCreditNoteDownload.fromJson(
    await _client.get(
      '/refunds/${Uri.encodeComponent(refundId)}/credit-note/download',
    ),
  );

  @override
  Future<FarmerReturnRequest> createReturnRequest({
    required String orderId,
    required String reasonCode,
    required Map<String, int> itemQuantities,
    String? reasonNote,
  }) async {
    final key = await _keyStore.getOrCreate(orderId);
    final request = FarmerReturnRequest.fromJson(
      await _client.post(
        '/returns',
        {
          'productOrderId': orderId,
          'reasonCode': reasonCode,
          if (reasonNote != null && reasonNote.trim().isNotEmpty)
            'reasonNote': reasonNote.trim(),
          'items': itemQuantities.entries
              .where((entry) => entry.value > 0)
              .map(
                (entry) => {
                  'productOrderItemId': entry.key,
                  'quantity': entry.value,
                },
              )
              .toList(growable: false),
        },
        headers: {'Idempotency-Key': key},
      ),
    );
    await _keyStore.clear(orderId, key);
    return request;
  }
}

abstract interface class ReturnRequestKeyStore {
  Future<String> getOrCreate(String orderId);
  Future<void> clear(String orderId, String key);
}

class SharedPreferencesReturnRequestKeyStore implements ReturnRequestKeyStore {
  const SharedPreferencesReturnRequestKeyStore();

  static const _prefix = 'farmer_return_request_';

  @override
  Future<String> getOrCreate(String orderId) async {
    final preferences = await SharedPreferences.getInstance();
    final preference = '$_prefix$orderId';
    final saved = preferences.getString(preference);
    if (saved != null) return saved;
    final key =
        'farmer-return-${DateTime.now().microsecondsSinceEpoch}-'
        '${Random.secure().nextInt(1 << 32).toRadixString(16)}';
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
