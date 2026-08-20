import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/farms/farm_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_membership_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_models.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order_repository.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile_repository.dart';

void main() {
  group('Home goldens', () {
    testWidgets('English content at a standard phone viewport', (tester) async {
      _setViewport(tester, const Size(390, 844));
      await _pumpHome(tester, const Locale('en'));

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/home_en.png'),
      );
    });

    testWidgets('Hindi content at 320dp and 200 percent text', (tester) async {
      _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
      await _pumpHome(tester, const Locale('hi'));

      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/home_hi_320dp_200.png'),
      );
    });
  });
}

void _setViewport(
  WidgetTester tester,
  Size size, {
  double textScaleFactor = 1,
}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScaleFactor;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

Future<void> _pumpHome(WidgetTester tester, Locale locale) async {
  await tester.pumpWidget(
    FarmerApp(
      initialLocale: locale,
      initialSession: _session,
      farmerProfileRepository: const _HomeProfileRepository(),
      farmRepository: _HomeFarmRepository(),
      farmerOrderRepository: const _HomeOrderRepository(),
      marketplaceProductRepository: const _EmptyProductRepository(),
      kisanClubMembershipRepository: const _DisabledClubRepository(),
    ),
  );
  await tester.pumpAndSettle();
}

class _HomeProfileRepository implements FarmerProfileRepository {
  const _HomeProfileRepository();

  @override
  Future<FarmerProfile> getProfile() async => const FarmerProfile(
    id: 'profile-golden',
    fullName: 'Sita Devi',
    preferredLocale: 'en-IN',
    cropInterests: ['Wheat'],
    addresses: [
      FarmerAddress(
        id: 'address-golden',
        label: 'Farm home',
        recipientName: 'Sita Devi',
        phone: '+919000000001',
        addressLine1: 'Farm road',
        village: 'Rampura',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
        isDefault: true,
      ),
    ],
    primaryPincode: '302001',
  );

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _HomeFarmRepository implements FarmRepository {
  _HomeFarmRepository();

  @override
  Future<List<FarmerFarm>> listMine() async => [
    FarmerFarm(
      id: 'farm-golden',
      name: 'Rampura North Field',
      pincode: '302001',
      areaAcres: 4.5,
      ownershipType: FarmOwnershipType.owned,
      isActive: true,
      cropCycles: [
        FarmCropCycleSummary(
          id: 'cycle-golden',
          cropId: 'crop-wheat',
          cropNameEn: 'Wheat',
          cropNameHi: 'गेहूँ',
          areaAcres: 3,
          season: 'RABI',
          status: CropCycleStatus.active,
          sowingDate: DateTime.now().subtract(const Duration(days: 40)),
        ),
      ],
    ),
  ];

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _HomeOrderRepository implements FarmerOrderRepository {
  const _HomeOrderRepository();

  @override
  Future<FarmerOrderPage> listOrders({
    int page = 1,
    int limit = 20,
    String? status,
  }) async =>
      FarmerOrderPage(items: [_order], page: page, limit: limit, total: 1);

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _EmptyProductRepository implements MarketplaceProductRepository {
  const _EmptyProductRepository();

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async => MarketplaceProductPage(
    items: const [],
    page: query.page,
    limit: query.limit,
    total: 0,
  );

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _DisabledClubRepository implements KisanClubMembershipRepository {
  const _DisabledClubRepository();

  @override
  Future<KisanClubMembershipAvailability> getMembership() async =>
      const KisanClubMembershipAvailability.disabled();

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

const _session = AuthSession(
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  membershipId: 'membership-golden',
  organisationId: 'farmer-context',
  role: 'FARMER',
  expiresIn: '15m',
);

final _order = FarmerOrder(
  id: 'order-golden',
  checkoutId: 'checkout-golden',
  orderNumber: 'ORD-1001',
  status: 'OUT_FOR_DELIVERY',
  serviceablePincode: '302001',
  sellerNameSnapshot: 'Demo Jaipur Distributor',
  sellerGstinSnapshot: '08ABCDE1234F1Z5',
  deliveryAddress: const FarmerOrderAddress(
    recipientName: 'Sita Devi',
    phone: '+919000000001',
    addressLine1: 'Farm road',
    addressLine2: null,
    village: 'Rampura',
    city: 'Jaipur',
    district: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    landmark: null,
  ),
  subtotalPaise: 56000,
  itemCount: 1,
  items: const [],
  statusHistory: const [],
  invoice: null,
  dispatchNumber: null,
  deliveryAssignmentNumber: null,
  deliveryAssignmentStatus: null,
  createdAt: DateTime.utc(2026, 8, 18),
  updatedAt: DateTime.utc(2026, 8, 18),
);
