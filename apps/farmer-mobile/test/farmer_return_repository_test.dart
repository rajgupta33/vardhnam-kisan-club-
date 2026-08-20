import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';
import 'package:vardhnam_farmer_mobile/src/returns/farmer_return_repository.dart';

void main() {
  test('reads authoritative eligibility for one seller child order', () async {
    final client = _RecordingApiClient();
    final repository = ApiFarmerReturnRepository(client, _FakeKeyStore());

    final eligibility = await repository.getEligibility('order-1');

    expect(client.getPath, '/returns/eligibility/order-1');
    expect(eligibility.eligible, true);
    expect(eligibility.items.single.orderedQuantity, 2);
  });

  test('lists and reads farmer-owned return requests', () async {
    final client = _RecordingApiClient();
    final repository = ApiFarmerReturnRepository(client, _FakeKeyStore());

    final page = await repository.listMyReturnRequests(
      page: 2,
      status: 'APPROVED',
    );

    expect(client.getPath, '/returns/me?page=2&limit=20&status=APPROVED');
    expect(page.total, 1);
    expect(page.items.single.orderNumber, 'VA-1001');

    final request = await repository.getReturnRequest('return-1');
    expect(client.getPath, '/returns/return-1');
    expect(request.statusHistory.single.toStatus, 'REQUESTED');
    expect(request.items.single.lineRefundPaise, 12500);
    expect(request.refunds.single.status, 'SUCCEEDED');
    expect(
      request.refunds.single.providerRefundReference,
      'mock-refund:return-1',
    );
  });

  test(
    'submits selected quantities with a persisted idempotency key',
    () async {
      final client = _RecordingApiClient();
      final keys = _FakeKeyStore();
      final repository = ApiFarmerReturnRepository(client, keys);

      final request = await repository.createReturnRequest(
        orderId: 'order-1',
        reasonCode: 'QUALITY_ISSUE',
        reasonNote: 'Packaging was open.',
        itemQuantities: {'item-1': 1, 'item-2': 0},
      );

      expect(client.postPath, '/returns');
      expect(client.headers, {'Idempotency-Key': 'stable-return-key'});
      expect(client.body?['items'], [
        {'productOrderItemId': 'item-1', 'quantity': 1},
      ]);
      expect(request.status, 'REQUESTED');
      expect(keys.cleared, true);
    },
  );

  test('cancels before pickup with a stable idempotency key', () async {
    final client = _RecordingApiClient();
    final keys = _FakeKeyStore();
    final repository = ApiFarmerReturnRepository(client, keys);

    final request = await repository.cancelReturnRequest('return-1');

    expect(client.postPath, '/returns/return-1/cancel');
    expect(client.headers, {'Idempotency-Key': 'stable-return-key'});
    expect(client.body, isEmpty);
    expect(request.id, 'return-1');
    expect(keys.cleared, true);
  });

  test('reads and downloads a successful refund credit note', () async {
    final client = _RecordingApiClient();
    final repository = ApiFarmerReturnRepository(client, _FakeKeyStore());

    final note = await repository.getCreditNote('refund 1');
    final download = await repository.getCreditNoteDownload('refund 1');

    expect(note.creditNoteNumber, 'CNABCD/26/000001');
    expect(note.farmerRefundPaise, 12500);
    expect(note.document?.status, 'AVAILABLE');
    expect(
      download.downloadUri,
      Uri.parse('https://files.example/credit-note.pdf'),
    );
    expect(client.getPaths, [
      '/refunds/refund%201/credit-note',
      '/refunds/refund%201/credit-note/download',
    ]);
  });
}

class _FakeKeyStore implements ReturnRequestKeyStore {
  var cleared = false;

  @override
  Future<String> getOrCreate(String orderId) async => 'stable-return-key';

  @override
  Future<void> clear(String orderId, String key) async => cleared = true;
}

class _RecordingApiClient implements AuthenticatedApiClient {
  String? getPath;
  final getPaths = <String>[];
  String? postPath;
  Map<String, Object?>? body;
  Map<String, String>? headers;

  @override
  Future<Map<String, Object?>> get(String path) async {
    getPath = path;
    getPaths.add(path);
    if (path.endsWith('/credit-note/download')) return _creditNoteDownloadJson;
    if (path.endsWith('/credit-note')) return _creditNoteJson;
    if (path.startsWith('/returns/me')) return _returnPageJson;
    if (path.startsWith('/returns/eligibility/')) return _eligibilityJson;
    return _returnRequestJson;
  }

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPath = path;
    this.body = body;
    this.headers = headers;
    return _returnRequestJson;
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

const _eligibilityJson = <String, Object?>{
  'productOrderId': 'order-1',
  'orderNumber': 'VA-1001',
  'eligible': true,
  'reason': null,
  'windowExpiresAt': '2026-08-18T08:00:00.000Z',
  'existingReturnRequestId': null,
  'items': [
    {
      'productOrderItemId': 'item-1',
      'productName': 'Bajra seed',
      'variantName': '1 kg',
      'orderedQuantity': 2,
      'unitPricePaise': 12500,
    },
  ],
};

const _returnRequestJson = <String, Object?>{
  'id': 'return-1',
  'productOrderId': 'order-1',
  'orderNumber': 'VA-1001',
  'sellerName': 'Kisan Distributor',
  'status': 'REQUESTED',
  'reasonCode': 'QUALITY_ISSUE',
  'reasonNote': 'Packaging was open.',
  'requestedAt': '2026-08-11T08:00:00.000Z',
  'windowExpiresAt': '2026-08-18T08:00:00.000Z',
  'refundableAmountPaise': 12500,
  'items': [
    {
      'id': 'return-item-1',
      'productOrderItemId': 'item-1',
      'productName': 'Bajra seed',
      'variantName': '1 kg',
      'quantity': 1,
      'unitPricePaise': 12500,
      'lineRefundPaise': 12500,
    },
  ],
  'statusHistory': [
    {
      'id': 'history-1',
      'fromStatus': null,
      'toStatus': 'REQUESTED',
      'reason': 'Packaging was open.',
      'createdAt': '2026-08-11T08:00:00.000Z',
    },
  ],
  'refunds': [
    {
      'id': 'refund-1',
      'amountPaise': 12500,
      'method': 'ORIGINAL_PAYMENT_METHOD',
      'status': 'SUCCEEDED',
      'providerMode': 'MOCK',
      'providerRefundReference': 'mock-refund:return-1',
      'failureReason': null,
      'initiatedAt': '2026-08-11T10:00:00.000Z',
      'completedAt': '2026-08-11T10:01:00.000Z',
    },
  ],
  'createdAt': '2026-08-11T08:00:00.000Z',
  'updatedAt': '2026-08-11T08:00:00.000Z',
};

const _returnPageJson = <String, Object?>{
  'items': [_returnRequestJson],
  'page': 2,
  'limit': 20,
  'total': 1,
};

const _creditNoteJson = <String, Object?>{
  'id': 'credit-note-1',
  'refundId': 'refund-1',
  'productInvoiceId': 'invoice-1',
  'productOrderId': 'order-1',
  'creditNoteNumber': 'CNABCD/26/000001',
  'financialYear': '2026-27',
  'grossCreditPaise': 14000,
  'farmerRefundPaise': 12500,
  'subsidyReversalPaise': 1500,
  'taxableAmountPaise': 11864,
  'taxPaise': 2136,
  'cgstPaise': 1068,
  'sgstPaise': 1068,
  'igstPaise': 0,
  'originalInvoiceNumber': 'INV-1001',
  'originalInvoiceDate': '2026-08-10T08:00:00.000Z',
  'reasonSnapshot': 'Accepted returned goods',
  'issuedAt': '2026-08-11T10:01:00.000Z',
  'document': {
    'id': 'credit-note-document-1',
    'status': 'AVAILABLE',
    'fileId': 'file-1',
    'checksumSha256': 'abc123',
    'attemptCount': 1,
    'lastError': null,
    'generatedAt': '2026-08-11T10:02:00.000Z',
  },
};

const _creditNoteDownloadJson = <String, Object?>{
  'downloadUrl': 'https://files.example/credit-note.pdf',
  'expiresAt': '2026-08-11T10:07:00.000Z',
};
