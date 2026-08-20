import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_invoice_document.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order_repository.dart';

void main() {
  test('lists paginated farmer orders with an exact status filter', () async {
    final client = _RecordingApiClient();
    final repository = ApiFarmerOrderRepository(
      client,
      _FakeOrderCancellationKeyStore(),
    );

    final page = await repository.listOrders(
      page: 2,
      limit: 10,
      status: 'DELIVERED',
    );

    expect(client.getPaths, ['/orders?page=2&limit=10&status=DELIVERED']);
    expect(page.page, 1);
    expect(page.total, 1);
    expect(page.items.single.orderNumber, 'VA-1001');
    expect(page.items.single.statusHistory.last.toStatus, 'DELIVERED');
    expect(page.items.single.invoice?.totalPaise, 120000);
  });

  test('cancels one child order with a persisted idempotency key', () async {
    final client = _RecordingApiClient();
    final keyStore = _FakeOrderCancellationKeyStore();
    final repository = ApiFarmerOrderRepository(client, keyStore);

    final order = await repository.cancelOrder('order-1');

    expect(client.postPath, '/orders/order-1/cancel');
    expect(client.postBody?['reason'], contains('child order'));
    expect(client.postHeaders, {'Idempotency-Key': 'stable-order-key'});
    expect(keyStore.requestedOrderIds, ['order-1']);
    expect(keyStore.clearedOrderIds, ['order-1']);
    expect(order.status, 'CANCELLED');
  });

  test('requests, checks and downloads an authorised invoice PDF', () async {
    final client = _RecordingApiClient();
    final repository = ApiFarmerOrderRepository(
      client,
      _FakeOrderCancellationKeyStore(),
    );

    final requested = await repository.requestInvoicePdf('order 1');
    final checked = await repository.getInvoicePdf('order 1');
    final download = await repository.getInvoicePdfDownload('order 1');

    expect(client.postPath, '/orders/order%201/invoice/pdf');
    expect(client.postBody, isEmpty);
    expect(client.getPaths, [
      '/orders/order%201/invoice/pdf',
      '/orders/order%201/invoice/pdf/download',
    ]);
    expect(requested.status, 'AVAILABLE');
    expect(checked.fileId, 'file-1');
    expect(
      download.downloadUri,
      Uri.parse('https://files.example/invoice.pdf'),
    );
    expect(download.expiresAt, DateTime.utc(2026, 8, 20, 12, 5));
  });

  test('rejects a non-HTTP invoice download URL', () {
    expect(
      () => FarmerInvoiceDownload.fromJson(const {
        'downloadUrl': 'javascript:alert(1)',
        'expiresAt': '2026-08-20T12:05:00.000Z',
      }),
      throwsFormatException,
    );
  });
}

class _FakeOrderCancellationKeyStore implements OrderCancellationKeyStore {
  final requestedOrderIds = <String>[];
  final clearedOrderIds = <String>[];

  @override
  Future<String> getOrCreate(String orderId) async {
    requestedOrderIds.add(orderId);
    return 'stable-order-key';
  }

  @override
  Future<void> clear(String orderId, String key) async {
    clearedOrderIds.add(orderId);
  }
}

class _RecordingApiClient implements AuthenticatedApiClient {
  final getPaths = <String>[];
  String? postPath;
  Map<String, Object?>? postBody;
  Map<String, String>? postHeaders;

  @override
  Future<Map<String, Object?>> get(String path) async {
    getPaths.add(path);
    if (path.endsWith('/invoice/pdf/download')) return _invoiceDownloadJson;
    if (path.endsWith('/invoice/pdf')) return _invoiceDocumentJson;
    return path.startsWith('/orders?') ? _orderPageJson : _orderJson;
  }

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPath = path;
    postBody = body;
    postHeaders = headers;
    if (path.endsWith('/invoice/pdf')) return _invoiceDocumentJson;
    return {..._orderJson, 'status': 'CANCELLED'};
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

const _invoiceDocumentJson = <String, Object?>{
  'id': 'document-1',
  'productInvoiceId': 'invoice-1',
  'status': 'AVAILABLE',
  'fileId': 'file-1',
  'checksumSha256': 'abc123',
  'attemptCount': 1,
  'lastError': null,
  'generatedAt': '2026-08-20T12:00:00.000Z',
  'createdAt': '2026-08-20T11:59:00.000Z',
  'updatedAt': '2026-08-20T12:00:00.000Z',
};

const _invoiceDownloadJson = <String, Object?>{
  'downloadUrl': 'https://files.example/invoice.pdf',
  'expiresAt': '2026-08-20T12:05:00.000Z',
};

const _orderPageJson = <String, Object?>{
  'items': [_orderJson],
  'page': 1,
  'limit': 20,
  'total': 1,
};

const _orderJson = <String, Object?>{
  'id': 'order-1',
  'checkoutId': 'checkout-1',
  'orderType': 'PRODUCT_ORDER',
  'farmerProfileId': 'farmer-1',
  'deliveryAddressId': 'address-1',
  'sellerOrganisationId': 'seller-1',
  'orderNumber': 'VA-1001',
  'status': 'DELIVERED',
  'serviceablePincode': '302001',
  'sellerNameSnapshot': 'Jaipur Distributor',
  'sellerGstinSnapshot': '08ABCDE1234F1Z5',
  'deliveryAddressSnapshot': {
    'id': 'address-1',
    'label': 'Farm',
    'recipientName': 'Test Farmer',
    'phone': '+919876543210',
    'addressLine1': 'Farm road',
    'addressLine2': null,
    'village': 'Demo village',
    'city': 'Jaipur',
    'district': 'Jaipur',
    'state': 'Rajasthan',
    'pincode': '302001',
    'landmark': null,
    'isDefault': true,
  },
  'subtotalPaise': 120000,
  'itemCount': 1,
  'items': [
    {
      'id': 'item-1',
      'quantity': 1,
      'unitPricePaise': 120000,
      'lineTotalPaise': 120000,
      'productNameSnapshot': 'Hybrid Bajra Seed',
      'variantNameSnapshot': '1 kg pack',
      'warehouseNameSnapshot': 'Jaipur Warehouse',
      'fulfilmentModeSnapshot': 'DISTRIBUTOR_FULFILLED',
      'deliverySlaDaysSnapshot': 2,
      'reservations': [
        {'batchNumber': 'B-2026'},
      ],
      'createdAt': '2026-08-08T08:00:00.000Z',
      'updatedAt': '2026-08-08T08:00:00.000Z',
    },
  ],
  'statusHistory': [
    {
      'id': 'history-1',
      'fromStatus': null,
      'toStatus': 'INVENTORY_RESERVED',
      'actorUserId': 'farmer-user-1',
      'actorRole': 'FARMER',
      'reason': 'Inventory reserved',
      'requestId': 'request-1',
      'createdAt': '2026-08-08T08:00:00.000Z',
    },
    {
      'id': 'history-2',
      'fromStatus': 'OUT_FOR_DELIVERY',
      'toStatus': 'DELIVERED',
      'actorUserId': 'delivery-user-1',
      'actorRole': 'DELIVERY_PARTNER',
      'reason': 'Delivery OTP verified',
      'requestId': 'request-2',
      'createdAt': '2026-08-09T08:00:00.000Z',
    },
  ],
  'invoice': {
    'invoiceNumber': 'INV-1001',
    'status': 'GENERATED',
    'currency': 'INR',
    'subtotalPaise': 120000,
    'taxPaise': 0,
    'totalPaise': 120000,
    'sellerLegalNameSnapshot': 'Jaipur Distributor Private Limited',
    'sellerDisplayNameSnapshot': 'Jaipur Distributor',
    'sellerGstinSnapshot': '08ABCDE1234F1Z5',
    'farmerNameSnapshot': 'Test Farmer',
    'generatedAt': '2026-08-08T10:00:00.000Z',
  },
  'dispatch': {'dispatchNumber': 'DSP-1001'},
  'deliveryAssignment': {'assignmentNumber': 'DEL-1001', 'status': 'DELIVERED'},
  'createdAt': '2026-08-08T08:00:00.000Z',
  'updatedAt': '2026-08-09T08:00:00.000Z',
};
