import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';
import 'package:vardhnam_farmer_mobile/src/payments/farmer_payment_repository.dart';

void main() {
  test('creates a mock payment intent with a stable key', () async {
    final client = _RecordingApiClient();
    final keyStore = _FakePaymentIdempotencyStore();
    final repository = ApiFarmerPaymentRepository(client, keyStore);

    final intent = await repository.createIntent('checkout-1');

    expect(client.postPaths, ['/payments/mock-intents']);
    expect(client.postBodies.single['checkoutId'], 'checkout-1');
    expect(client.postHeaders.single, {
      'Idempotency-Key': 'stable-payment-key',
    });
    expect(keyStore.operations, ['create:checkout-1']);
    expect(keyStore.clearedOperations, ['create:checkout-1']);
    expect(intent.status, 'PENDING');
    expect(intent.amountPaise, 120000);
  });

  test('confirms then re-reads server payment status', () async {
    final client = _RecordingApiClient();
    final keyStore = _FakePaymentIdempotencyStore();
    final repository = ApiFarmerPaymentRepository(client, keyStore);

    final intent = await repository.confirmIntent(
      'intent-1',
      MockPaymentOutcome.success,
    );

    expect(client.postPaths, ['/payments/mock-intents/intent-1/confirm']);
    expect(client.postBodies.single['outcome'], 'SUCCESS');
    expect(client.getPaths, ['/payments/mock-intents/intent-1']);
    expect(keyStore.operations, ['confirm:intent-1:SUCCESS']);
    expect(intent.status, 'SUCCEEDED');
    expect(intent.checkoutStatus, 'PAID');
  });

  test('retains confirmation key when authoritative re-read fails', () async {
    final client = _RecordingApiClient(failGet: true);
    final keyStore = _FakePaymentIdempotencyStore();
    final repository = ApiFarmerPaymentRepository(client, keyStore);

    await expectLater(
      repository.confirmIntent('intent-1', MockPaymentOutcome.success),
      throwsA(isA<StateError>()),
    );

    expect(keyStore.operations, ['confirm:intent-1:SUCCESS']);
    expect(keyStore.clearedOperations, isEmpty);
  });
}

class _FakePaymentIdempotencyStore implements PaymentIdempotencyStore {
  final operations = <String>[];
  final clearedOperations = <String>[];

  @override
  Future<String> getOrCreate(String operation) async {
    operations.add(operation);
    return 'stable-payment-key';
  }

  @override
  Future<void> clear(String operation, String key) async {
    clearedOperations.add(operation);
  }
}

class _RecordingApiClient implements AuthenticatedApiClient {
  _RecordingApiClient({this.failGet = false});

  final bool failGet;
  final postPaths = <String>[];
  final postBodies = <Map<String, Object?>>[];
  final postHeaders = <Map<String, String>?>[];
  final getPaths = <String>[];

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPaths.add(path);
    postBodies.add(body);
    postHeaders.add(headers);
    return _paymentJson;
  }

  @override
  Future<Map<String, Object?>> get(String path) async {
    getPaths.add(path);
    if (failGet) throw StateError('Server status could not be read.');
    return {..._paymentJson, 'status': 'SUCCEEDED'};
  }

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

const _paymentJson = <String, Object?>{
  'id': 'intent-1',
  'checkoutId': 'checkout-1',
  'farmerProfileId': 'farmer-1',
  'providerMode': 'MOCK',
  'providerReference': 'mock-reference-1',
  'status': 'PENDING',
  'amountPaise': 120000,
  'currency': 'INR',
  'failureCode': null,
  'failureMessage': null,
  'checkout': {
    'id': 'checkout-1',
    'status': 'PAID',
    'subtotalPaise': 120000,
    'itemCount': 1,
    'childOrderCount': 1,
    'orders': <Object?>[],
  },
  'events': <Object?>[],
};
