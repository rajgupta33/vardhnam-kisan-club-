import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/notifications/farmer_notification.dart';
import 'package:vardhnam_farmer_mobile/src/notifications/farmer_notification_repository.dart';
import 'package:vardhnam_farmer_mobile/src/returns/farmer_return.dart';
import 'package:vardhnam_farmer_mobile/src/returns/farmer_return_repository.dart';

void main() {
  test('parses paginated notification metadata and nullable read state', () {
    final page = FarmerNotificationPage.fromJson({
      'items': [_notificationJson()],
      'page': 1,
      'limit': 20,
      'total': 1,
    });

    expect(page.total, 1);
    expect(page.items.single.isUnread, isTrue);
    expect(page.items.single.relatedResourceType, 'SupportTicket');
  });

  testWidgets('lists an owned notification and marks it read on open', (
    tester,
  ) async {
    final repository = _FakeNotificationRepository();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _session,
        initialLocation: '/notifications',
        farmerNotificationRepository: repository,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Delivery update'), findsOneWidget);
    expect(find.byIcon(Icons.mark_email_unread_outlined), findsOneWidget);
    // 'Orders' is also the persistent tab label, so more than one match is
    // expected here; the point is that the notification's link target shows.
    expect(find.text('Orders'), findsWidgets);
    expect(repository.listCalls, 1);

    await tester.tap(find.text('Delivery update'));
    await tester.pumpAndSettle();

    expect(find.text('Your seller order is packed.'), findsOneWidget);
    expect(find.byIcon(Icons.receipt_long_outlined), findsWidgets);
    expect(repository.getIds, ['notification-1']);
    expect(repository.markReadIds, ['notification-1']);
  });

  testWidgets('unread switch sends the backend unread-only filter', (
    tester,
  ) async {
    final repository = _FakeNotificationRepository();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _session,
        initialLocation: '/notifications',
        farmerNotificationRepository: repository,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Show unread only'));
    await tester.pumpAndSettle();

    expect(repository.unreadFilters, [false, true]);
  });

  testWidgets(
    'opens an allowlisted return notification in owned return detail',
    (tester) async {
      final repository = _FakeNotificationRepository(
        relatedResourceType: 'ReturnRequest',
        relatedResourceId: 'return-1',
      );
      final returns = _NotificationReturnRepository();
      await tester.pumpWidget(
        FarmerApp(
          initialSession: _session,
          initialLocation: '/notifications/notification-1',
          farmerNotificationRepository: repository,
          farmerReturnRepository: returns,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open related item'));
      await tester.pumpAndSettle();

      expect(find.text('Return details'), findsOneWidget);
      expect(returns.getIds, ['return-1']);
    },
  );
}

class _FakeNotificationRepository implements FarmerNotificationRepository {
  _FakeNotificationRepository({
    this.relatedResourceType = 'SupportTicket',
    this.relatedResourceId = 'ticket-1',
  });

  final String relatedResourceType;
  final String relatedResourceId;
  var listCalls = 0;
  final unreadFilters = <bool>[];
  final getIds = <String>[];
  final markReadIds = <String>[];

  FarmerNotification get notification => FarmerNotification.fromJson(
    _notificationJson(
      relatedResourceType: relatedResourceType,
      relatedResourceId: relatedResourceId,
    ),
  );

  @override
  Future<FarmerNotificationPage> listMyNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    listCalls += 1;
    unreadFilters.add(unreadOnly);
    return FarmerNotificationPage(
      items: [notification],
      page: page,
      limit: limit,
      total: 1,
    );
  }

  @override
  Future<FarmerNotification> getNotification(String notificationId) async {
    getIds.add(notificationId);
    return notification;
  }

  @override
  Future<FarmerNotification> markRead(String notificationId) async {
    markReadIds.add(notificationId);
    return notification.markRead(DateTime.utc(2026, 8, 8, 10, 5));
  }
}

class _NotificationReturnRepository implements FarmerReturnRepository {
  final getIds = <String>[];

  @override
  Future<FarmerReturnRequest> getReturnRequest(String returnRequestId) async {
    getIds.add(returnRequestId);
    return _returnRequest;
  }

  @override
  Future<FarmerReturnRequest> cancelReturnRequest(
    String returnRequestId, {
    String? reason,
  }) => throw UnimplementedError();

  @override
  Future<FarmerReturnRequest> createReturnRequest({
    required String orderId,
    required String reasonCode,
    required Map<String, int> itemQuantities,
    String? reasonNote,
  }) => throw UnimplementedError();

  @override
  Future<FarmerReturnEligibility> getEligibility(String orderId) =>
      throw UnimplementedError();

  @override
  Future<FarmerReturnPage> listMyReturnRequests({
    int page = 1,
    int limit = 20,
    String? status,
  }) => throw UnimplementedError();

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

Map<String, Object?> _notificationJson({
  String relatedResourceType = 'SupportTicket',
  String relatedResourceId = 'ticket-1',
}) => {
  'id': 'notification-1',
  'category': 'ORDER_UPDATE',
  'title': 'Delivery update',
  'body': 'Your seller order is packed.',
  'status': 'SENT',
  'readAt': null,
  'relatedResourceType': relatedResourceType,
  'relatedResourceId': relatedResourceId,
  'createdAt': '2026-08-08T10:00:00.000Z',
};

final _returnRequest = FarmerReturnRequest(
  id: 'return-1',
  productOrderId: 'order-1',
  orderNumber: 'VA-100',
  sellerName: 'Kisan Distributor',
  status: 'APPROVED',
  reasonCode: 'QUALITY_ISSUE',
  requestedAt: _returnDate,
  windowExpiresAt: DateTime.utc(2026, 8, 20),
  refundableAmountPaise: 25000,
  items: const [],
  statusHistory: const [],
  createdAt: _returnDate,
  updatedAt: _returnDate,
);

final _returnDate = DateTime.utc(2026, 8, 11);

const _session = AuthSession(
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  membershipId: 'membership-1',
  organisationId: 'organisation-1',
  role: 'FARMER',
  expiresIn: '15m',
);
