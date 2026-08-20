import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_invoice_document.dart';
import 'package:vardhnam_farmer_mobile/src/orders/invoice_download_launcher.dart';
import 'package:vardhnam_farmer_mobile/src/returns/farmer_credit_note.dart';
import 'package:vardhnam_farmer_mobile/src/returns/farmer_return.dart';
import 'package:vardhnam_farmer_mobile/src/returns/farmer_return_repository.dart';
import 'package:vardhnam_farmer_mobile/src/routing/app_routes.dart';

void main() {
  testWidgets('farmer opens a return and sees its status timeline', (
    tester,
  ) async {
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _session,
        initialLocation: AppRoutes.returns,
        farmerReturnRepository: _ReturnRepository(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('My returns'), findsOneWidget);
    expect(find.text('Kisan Distributor'), findsOneWidget);
    expect(find.text('Requested'), findsOneWidget);

    await tester.tap(find.text('Kisan Distributor'));
    await tester.pumpAndSettle();

    expect(find.text('Return details'), findsOneWidget);
    expect(find.text('Return timeline'), findsOneWidget);
    expect(find.text('Packaging was open.'), findsWidgets);
    expect(find.textContaining('₹125'), findsWidgets);

    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel return'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel return').last);
    await tester.pumpAndSettle();

    expect(find.text('Cancelled'), findsWidgets);
    expect(find.text('Your return request was cancelled.'), findsOneWidget);
  });

  testWidgets('successful refund exposes and downloads its credit note', (
    tester,
  ) async {
    final repository = _SuccessfulReturnRepository();
    final launcher = _CreditNoteLauncher();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _session,
        initialLocation: AppRoutes.returnRequest('return-1'),
        farmerReturnRepository: repository,
        invoiceDownloadLauncher: launcher,
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('View credit note'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('View credit note'));
    await tester.pumpAndSettle();

    expect(repository.creditNoteRefundIds, ['refund-1']);
    expect(repository.downloadRefundIds, ['refund-1']);
    expect(find.text('Credit note: CNABCD/26/000001'), findsOneWidget);
    expect(find.text('Original invoice: INV-1001'), findsOneWidget);
    expect(
      find.text('Credit note PDF opened in your browser.'),
      findsOneWidget,
    );
    expect(launcher.uris, [Uri.parse('https://files.example/credit-note.pdf')]);
  });
}

class _ReturnRepository implements FarmerReturnRepository {
  @override
  Future<FarmerReturnPage> listMyReturnRequests({
    int page = 1,
    int limit = 20,
    String? status,
  }) async =>
      FarmerReturnPage(items: [_request], page: page, limit: limit, total: 1);

  @override
  Future<FarmerReturnRequest> getReturnRequest(String returnRequestId) async =>
      _request;

  @override
  Future<FarmerReturnRequest> cancelReturnRequest(
    String returnRequestId, {
    String? reason,
  }) async => FarmerReturnRequest(
    id: _request.id,
    productOrderId: _request.productOrderId,
    orderNumber: _request.orderNumber,
    sellerName: _request.sellerName,
    status: 'CANCELLED',
    reasonCode: _request.reasonCode,
    reasonNote: _request.reasonNote,
    requestedAt: _request.requestedAt,
    windowExpiresAt: _request.windowExpiresAt,
    refundableAmountPaise: _request.refundableAmountPaise,
    items: _request.items,
    statusHistory: [
      ..._request.statusHistory,
      FarmerReturnStatusHistory(
        id: 'history-2',
        fromStatus: 'REQUESTED',
        toStatus: 'CANCELLED',
        createdAt: _windowDate,
      ),
    ],
    createdAt: _request.createdAt,
    updatedAt: _windowDate,
  );

  @override
  Future<FarmerReturnEligibility> getEligibility(String orderId) =>
      throw UnimplementedError();

  @override
  Future<FarmerReturnRequest> createReturnRequest({
    required String orderId,
    required String reasonCode,
    required Map<String, int> itemQuantities,
    String? reasonNote,
  }) => throw UnimplementedError();

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _SuccessfulReturnRepository implements FarmerReturnRepository {
  final creditNoteRefundIds = <String>[];
  final downloadRefundIds = <String>[];

  @override
  Future<FarmerReturnRequest> getReturnRequest(String returnRequestId) async =>
      _successfulRequest;

  @override
  Future<FarmerCreditNote> getCreditNote(String refundId) async {
    creditNoteRefundIds.add(refundId);
    return _creditNote;
  }

  @override
  Future<FarmerCreditNoteDownload> getCreditNoteDownload(
    String refundId,
  ) async {
    downloadRefundIds.add(refundId);
    return FarmerInvoiceDownload(
      downloadUri: Uri.parse('https://files.example/credit-note.pdf'),
      expiresAt: DateTime.utc(2026, 8, 11, 10, 7),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _CreditNoteLauncher implements InvoiceDownloadLauncher {
  final uris = <Uri>[];

  @override
  Future<bool> launch(Uri uri) async {
    uris.add(uri);
    return true;
  }
}

final _request = FarmerReturnRequest(
  id: 'return-1',
  productOrderId: 'order-1',
  orderNumber: 'VA-1001',
  sellerName: 'Kisan Distributor',
  status: 'REQUESTED',
  reasonCode: 'QUALITY_ISSUE',
  reasonNote: 'Packaging was open.',
  requestedAt: _date,
  windowExpiresAt: _windowDate,
  refundableAmountPaise: 12500,
  items: const [
    FarmerReturnItem(
      id: 'item-1',
      productOrderItemId: 'order-item-1',
      productName: 'Bajra seed',
      variantName: '1 kg',
      quantity: 1,
      unitPricePaise: 12500,
      lineRefundPaise: 12500,
    ),
  ],
  statusHistory: [
    FarmerReturnStatusHistory(
      id: 'history-1',
      toStatus: 'REQUESTED',
      reason: 'Packaging was open.',
      createdAt: _date,
    ),
  ],
  createdAt: _date,
  updatedAt: _date,
);

final _successfulRequest = FarmerReturnRequest(
  id: 'return-1',
  productOrderId: 'order-1',
  orderNumber: 'VA-1001',
  sellerName: 'Kisan Distributor',
  status: 'COMPLETED',
  reasonCode: 'QUALITY_ISSUE',
  requestedAt: _date,
  windowExpiresAt: _windowDate,
  refundableAmountPaise: 12500,
  approvedRefundAmountPaise: 12500,
  items: _request.items,
  statusHistory: _request.statusHistory,
  refunds: [
    FarmerRefundSummary(
      id: 'refund-1',
      amountPaise: 12500,
      method: 'ORIGINAL_PAYMENT_METHOD',
      status: 'SUCCEEDED',
      providerMode: 'MOCK',
      providerRefundReference: 'mock-refund:return-1',
      initiatedAt: _date,
      completedAt: _date,
    ),
  ],
  createdAt: _date,
  updatedAt: _date,
);

final _creditNote = FarmerCreditNote(
  id: 'credit-note-1',
  refundId: 'refund-1',
  creditNoteNumber: 'CNABCD/26/000001',
  grossCreditPaise: 14000,
  farmerRefundPaise: 12500,
  subsidyReversalPaise: 1500,
  taxableAmountPaise: 11864,
  taxPaise: 2136,
  originalInvoiceNumber: 'INV-1001',
  originalInvoiceDate: _date,
  reason: 'Accepted returned goods',
  issuedAt: _date,
  document: FarmerCreditNoteDocument(
    id: 'document-1',
    status: 'AVAILABLE',
    fileId: 'file-1',
    attemptCount: 1,
    generatedAt: _date,
  ),
);

const _session = AuthSession(
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  membershipId: 'membership-1',
  organisationId: 'organisation-1',
  role: 'FARMER',
  expiresIn: '15m',
);

final _date = DateTime.utc(2026, 8, 11, 8);
final _windowDate = DateTime.utc(2030, 8, 18, 8);
