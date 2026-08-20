import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/notifications/farmer_notification.dart';
import 'package:vardhnam_farmer_mobile/src/notifications/farmer_notification_repository.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order_repository.dart';
import 'package:vardhnam_farmer_mobile/src/returns/farmer_return.dart';
import 'package:vardhnam_farmer_mobile/src/returns/farmer_return_repository.dart';
import 'package:vardhnam_farmer_mobile/src/support/farmer_support_repository.dart';
import 'package:vardhnam_farmer_mobile/src/support/farmer_support_ticket.dart';

void main() {
  testWidgets('dashboard actions meet Android minimum tap targets', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(const FarmerApp(initialSession: _session));
    await tester.pumpAndSettle();

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    semantics.dispose();
  });

  testWidgets('dashboard text meets the automated contrast guideline', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(const FarmerApp(initialSession: _session));
    await tester.pumpAndSettle();

    await expectLater(tester, meetsGuideline(textContrastGuideline));
    semantics.dispose();
  });

  testWidgets('dashboard remains usable on a narrow large-text display', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(const FarmerApp(initialSession: _session));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Farmer workspace'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    final scrollable = tester.state<ScrollableState>(find.byType(Scrollable));
    expect(scrollable.position.pixels, greaterThan(0));
  });

  testWidgets('Hindi dashboard scrolls on a narrow 200% text display', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      const FarmerApp(initialSession: _session, initialLocale: Locale('hi')),
    );
    await tester.pumpAndSettle();

    expect(find.text('किसान कार्यक्षेत्र'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    final scrollable = tester.state<ScrollableState>(find.byType(Scrollable));
    expect(scrollable.position.pixels, greaterThan(0));
  });

  testWidgets('login fields follow visual keyboard focus order', (
    tester,
  ) async {
    await tester.pumpWidget(const FarmerApp());
    await tester.pumpAndSettle();
    final fields = find.byType(EditableText);

    await tester.tap(find.widgetWithText(TextField, 'Full name'));
    await tester.pump();
    expect(
      tester.widget<EditableText>(fields.at(0)).focusNode.hasFocus,
      isTrue,
    );

    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    expect(
      tester.widget<EditableText>(fields.at(1)).focusNode.hasFocus,
      isTrue,
    );
  });

  testWidgets('login actions meet tap-target and contrast guidelines', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(const FarmerApp());
    await tester.pumpAndSettle();

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    semantics.dispose();
  });

  testWidgets('login validation errors are announced as live updates', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(const FarmerApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Send OTP'));
    await tester.pump();

    final error = tester.getSemantics(find.text('Enter your full name.'));
    expect(error.flagsCollection.isLiveRegion, isTrue);
    semantics.dispose();
  });

  testWidgets('Hindi login scrolls on a narrow 200% text display', (
    tester,
  ) async {
    _useNarrowLargeTextDisplay(tester);

    await tester.pumpWidget(const FarmerApp(initialLocale: Locale('hi')));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(ListView), const Offset(0, -350));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('product discovery meets tap-target and contrast guidelines', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
      FarmerApp(
        initialLocation: '/browse',
        marketplaceProductRepository: _EmptyMarketplaceRepository(),
      ),
    );
    await tester.pumpAndSettle();

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    semantics.dispose();
  });

  testWidgets('Hindi product discovery survives narrow 200% text', (
    tester,
  ) async {
    _useNarrowLargeTextDisplay(tester);

    await tester.pumpWidget(
      FarmerApp(
        initialLocale: const Locale('hi'),
        initialLocation: '/browse',
        marketplaceProductRepository: _EmptyMarketplaceRepository(),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(ListView), const Offset(0, -350));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('Hindi farmer lists survive narrow 200% text', (tester) async {
    _useNarrowLargeTextDisplay(tester);
    final apps = <Widget>[
      const FarmerApp(
        initialLocale: Locale('hi'),
        initialSession: _session,
        initialLocation: '/orders',
        farmerOrderRepository: _EmptyOrderRepository(),
      ),
      const FarmerApp(
        initialLocale: Locale('hi'),
        initialSession: _session,
        initialLocation: '/returns',
        farmerReturnRepository: _EmptyReturnRepository(),
      ),
      const FarmerApp(
        initialLocale: Locale('hi'),
        initialSession: _session,
        initialLocation: '/support',
        farmerSupportRepository: _EmptySupportRepository(),
      ),
      const FarmerApp(
        initialLocale: Locale('hi'),
        initialSession: _session,
        initialLocation: '/notifications',
        farmerNotificationRepository: _EmptyNotificationRepository(),
      ),
    ];

    for (final app in apps) {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(app);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });
}

void _useNarrowLargeTextDisplay(WidgetTester tester) {
  tester.view.physicalSize = const Size(320, 640);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = 2;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

class _EmptyMarketplaceRepository implements MarketplaceProductRepository {
  @override
  Future<MarketplaceFilterOptions> getFilterOptions(String pincode) async =>
      const MarketplaceFilterOptions(
        categories: [],
        brands: [],
        cropTargets: [],
      );

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async =>
      const MarketplaceProductPage(items: [], page: 1, limit: 20, total: 0);

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) => throw UnimplementedError();
}

class _EmptyOrderRepository implements FarmerOrderRepository {
  const _EmptyOrderRepository();

  @override
  Future<FarmerOrderPage> listOrders({
    int page = 1,
    int limit = 20,
    String? status,
  }) async =>
      FarmerOrderPage(items: const [], page: page, limit: limit, total: 0);

  @override
  Future<FarmerOrder> cancelOrder(String orderId) => throw UnimplementedError();

  @override
  Future<FarmerOrder> getOrder(String orderId) => throw UnimplementedError();

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _EmptyReturnRepository implements FarmerReturnRepository {
  const _EmptyReturnRepository();

  @override
  Future<FarmerReturnPage> listMyReturnRequests({
    int page = 1,
    int limit = 20,
    String? status,
  }) async =>
      FarmerReturnPage(items: const [], page: page, limit: limit, total: 0);

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
  Future<FarmerReturnRequest> getReturnRequest(String returnRequestId) =>
      throw UnimplementedError();

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _EmptySupportRepository implements FarmerSupportRepository {
  const _EmptySupportRepository();

  @override
  Future<FarmerSupportTicketPage> listMyTickets({
    int page = 1,
    int limit = 20,
    String? status,
  }) async => FarmerSupportTicketPage(
    items: const [],
    page: page,
    limit: limit,
    total: 0,
  );

  @override
  Future<FarmerSupportTicket> createTicket(FarmerSupportTicketInput input) =>
      throw UnimplementedError();

  @override
  Future<FarmerSupportTicket> getTicket(String ticketId) =>
      throw UnimplementedError();

  @override
  Future<FarmerSupportTicket> reopenTicket(String ticketId, String reason) =>
      throw UnimplementedError();
}

class _EmptyNotificationRepository implements FarmerNotificationRepository {
  const _EmptyNotificationRepository();

  @override
  Future<FarmerNotificationPage> listMyNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async => FarmerNotificationPage(
    items: const [],
    page: page,
    limit: limit,
    total: 0,
  );

  @override
  Future<FarmerNotification> getNotification(String notificationId) =>
      throw UnimplementedError();

  @override
  Future<FarmerNotification> markRead(String notificationId) =>
      throw UnimplementedError();
}

const _session = AuthSession(
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  membershipId: 'membership-1',
  organisationId: 'farmer-context',
  role: 'FARMER',
  expiresIn: '15m',
);
