import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/addresses/farmer_address_repository.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/farms/farm_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_membership_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_models.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order_repository.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile_repository.dart';

/// Home summarises data owned by other screens (blueprint §10.5–10.7). The
/// behaviour worth protecting is *when each module appears*: home should stay
/// short and calm for a farmer who has nothing in flight, rather than showing a
/// column of empty states.
void main() {
  testWidgets('personalises home with the farmer and default locality', (
    tester,
  ) async {
    _useTallViewport(tester);

    await tester.pumpWidget(
      _app(
        profileRepository: const _ProfileRepositoryStub(
          fullName: 'Sita Devi',
          addresses: [
            FarmerAddress(
              id: 'address-1',
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
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Namaste, Sita Devi'), findsOneWidget);
    expect(find.text('Rampura, 302001'), findsOneWidget);
  });

  testWidgets(
    'uses localised generic home identity when profile loading fails',
    (tester) async {
      _useTallViewport(tester);

      await tester.pumpWidget(
        _app(
          profileRepository: const _FailingProfileRepositoryStub(),
          initialLocale: const Locale('hi'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('किसान कार्यक्षेत्र'), findsOneWidget);
      expect(find.text('आपका खेत और डिलीवरी क्षेत्र'), findsOneWidget);
    },
  );

  testWidgets('opens delivery addresses from the selected home location', (
    tester,
  ) async {
    _useTallViewport(tester);
    const address = FarmerAddress(
      id: 'address-1',
      label: 'Farm home',
      recipientName: 'Sita Devi',
      phone: '+919000000001',
      addressLine1: 'Farm road',
      village: 'Rampura',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      isDefault: true,
    );

    await tester.pumpWidget(
      _app(
        profileRepository: const _ProfileRepositoryStub(
          fullName: 'Sita Devi',
          addresses: [address],
        ),
        addressRepository: const _AddressRepositoryStub([address]),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Rampura, 302001'));
    await tester.pumpAndSettle();

    expect(find.text('Delivery addresses'), findsOneWidget);
    expect(find.text('Farm home'), findsOneWidget);
  });

  testWidgets('personalised home header survives narrow 200 percent text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      _app(
        profileRepository: const _ProfileRepositoryStub(
          fullName: 'Sita Devi With A Long Name',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Namaste, Sita Devi With A Long Name'), findsOneWidget);
  });

  testWidgets('shows the active crop with days since sowing', (tester) async {
    _useTallViewport(tester);

    await tester.pumpWidget(
      _app(
        farmRepository: _FarmRepositoryStub([
          _farm(
            cycles: [
              _cycle(
                status: CropCycleStatus.active,
                sowingDate: DateTime.now().subtract(const Duration(days: 40)),
              ),
            ],
          ),
        ]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Your crop'), findsOneWidget);
    expect(find.text('WHEAT'), findsOneWidget);
    expect(find.text('Day 40'), findsOneWidget);
  });

  testWidgets('hides the crop module when no cycle is active', (tester) async {
    _useTallViewport(tester);

    await tester.pumpWidget(
      _app(
        farmRepository: _FarmRepositoryStub([
          // Harvested, so there is nothing for the farmer to act on.
          _farm(cycles: [_cycle(status: CropCycleStatus.harvested)]),
        ]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Your crop'), findsNothing);
  });

  testWidgets('shows an order that is still in flight', (tester) async {
    _useTallViewport(tester);

    await tester.pumpWidget(
      _app(orderRepository: _OrderRepositoryStub(_order('OUT_FOR_DELIVERY'))),
    );
    await tester.pumpAndSettle();

    expect(find.text('Your order'), findsOneWidget);
    expect(find.text('ORD-1001'), findsOneWidget);
  });

  testWidgets('hides the order module once delivery is complete', (
    tester,
  ) async {
    _useTallViewport(tester);

    await tester.pumpWidget(
      _app(orderRepository: _OrderRepositoryStub(_order('DELIVERED'))),
    );
    await tester.pumpAndSettle();

    // A delivered order needs no tracking, so home says nothing about it.
    expect(find.text('Your order'), findsNothing);
  });

  testWidgets('caps the product strip at four', (tester) async {
    _useTallViewport(tester);

    await tester.pumpWidget(
      _app(
        productRepository: _ProductRepositoryStub([
          _product('Adiyogi'),
          _product('Aman Plus'),
          _product('Gauri'),
          _product('Basant Gold 9180'),
          _product('Chanakya-4590'),
        ]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('For your farm'), findsOneWidget);
    // Home is not a catalogue; a farmer scrolling a long product list never
    // reaches their crop or their orders.
    expect(find.text('Chanakya-4590'), findsNothing);
  });

  testWidgets('hides the product strip when the farmer has no pincode', (
    tester,
  ) async {
    _useTallViewport(tester);

    await tester.pumpWidget(
      _app(
        profileRepository: const _ProfileRepositoryStub(pincode: null),
        productRepository: _ProductRepositoryStub([_product('Adiyogi')]),
      ),
    );
    await tester.pumpAndSettle();

    // Discovery is pincode-scoped, so without one there is nothing honest to
    // show; the Shop tab asks for a pincode properly.
    expect(find.text('For your farm'), findsNothing);
  });
}

void _useTallViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Widget _app({
  FarmRepository? farmRepository,
  FarmerOrderRepository? orderRepository,
  MarketplaceProductRepository? productRepository,
  FarmerProfileRepository? profileRepository,
  FarmerAddressRepository? addressRepository,
  Locale initialLocale = const Locale('en'),
}) => FarmerApp(
  initialSession: _session,
  initialLocale: initialLocale,
  kisanClubMembershipRepository: const _ClubRepositoryStub(),
  farmRepository: farmRepository ?? const _FarmRepositoryStub([]),
  farmerOrderRepository: orderRepository ?? const _OrderRepositoryStub(null),
  farmerProfileRepository: profileRepository ?? const _ProfileRepositoryStub(),
  farmerAddressRepository: addressRepository,
  marketplaceProductRepository:
      productRepository ?? const _ProductRepositoryStub([]),
);

FarmerFarm _farm({required List<FarmCropCycleSummary> cycles}) => FarmerFarm(
  id: 'farm-1',
  name: 'Rampura North Field',
  pincode: '302001',
  areaAcres: 4.5,
  ownershipType: FarmOwnershipType.owned,
  isActive: true,
  cropCycles: cycles,
);

FarmCropCycleSummary _cycle({
  required CropCycleStatus status,
  DateTime? sowingDate,
}) => FarmCropCycleSummary(
  id: 'cycle-1',
  cropId: 'crop-1',
  cropNameEn: 'Wheat',
  cropNameHi: 'गेहूँ',
  areaAcres: 3,
  season: 'RABI',
  status: status,
  sowingDate: sowingDate,
);

FarmerOrder _order(String status) => FarmerOrder(
  id: 'order-1',
  checkoutId: 'checkout-1',
  orderNumber: 'ORD-1001',
  status: status,
  serviceablePincode: '302001',
  sellerNameSnapshot: 'Demo Jaipur Distributor',
  sellerGstinSnapshot: '08ABCDE1234F1Z5',
  deliveryAddress: const FarmerOrderAddress(
    recipientName: 'Demo Farmer',
    phone: '+919000000042',
    addressLine1: 'Khasra 42',
    addressLine2: null,
    village: null,
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

MarketplaceProductSummary _product(String name) => MarketplaceProductSummary(
  id: 'product-$name',
  name: name,
  category: 'Seeds',
  cropTargets: const ['Rice'],
  brand: const MarketplaceBrandSummary(
    id: 'brand-1',
    name: 'Vardhnam Agro',
    slug: 'vardhnam-agro',
  ),
  company: const MarketplaceCompanySummary(
    id: 'company-1',
    displayName: 'Vardhnam',
  ),
  serviceablePincode: '302001',
  lowestPricePaise: 56000,
  availableQuantity: 400,
  offerCount: 1,
  sellerCount: 1,
  fulfilmentModes: const ['DISTRIBUTOR_FULFILLED'],
  offers: const [],
);

class _FarmRepositoryStub implements FarmRepository {
  const _FarmRepositoryStub(this._farms);

  final List<FarmerFarm> _farms;

  @override
  Future<List<FarmerFarm>> listMine() async => _farms;

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _OrderRepositoryStub implements FarmerOrderRepository {
  const _OrderRepositoryStub(this._order);

  final FarmerOrder? _order;

  @override
  Future<FarmerOrderPage> listOrders({
    int page = 1,
    int limit = 20,
    String? status,
  }) async => FarmerOrderPage(
    items: _order == null ? const [] : [_order],
    page: page,
    limit: limit,
    total: _order == null ? 0 : 1,
  );

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _ProductRepositoryStub implements MarketplaceProductRepository {
  const _ProductRepositoryStub(this._products);

  final List<MarketplaceProductSummary> _products;

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async => MarketplaceProductPage(
    items: _products,
    page: 1,
    limit: query.limit,
    total: _products.length,
  );

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _ProfileRepositoryStub implements FarmerProfileRepository {
  const _ProfileRepositoryStub({
    this.pincode = '302001',
    this.fullName = 'Demo Farmer',
    this.addresses = const [],
  });

  final String? pincode;
  final String fullName;
  final List<FarmerAddress> addresses;

  @override
  Future<FarmerProfile> getProfile() async => FarmerProfile(
    id: 'profile-1',
    fullName: fullName,
    preferredLocale: 'en-IN',
    cropInterests: const [],
    addresses: addresses,
    primaryPincode: pincode,
  );

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _FailingProfileRepositoryStub implements FarmerProfileRepository {
  const _FailingProfileRepositoryStub();

  @override
  Future<FarmerProfile> getProfile() async => throw Exception('offline');

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _AddressRepositoryStub implements FarmerAddressRepository {
  const _AddressRepositoryStub(this.addresses);

  final List<FarmerAddress> addresses;

  @override
  Future<List<FarmerAddress>> listAddresses() async => addresses;

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _ClubRepositoryStub implements KisanClubMembershipRepository {
  const _ClubRepositoryStub();

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
  membershipId: 'membership-1',
  organisationId: 'farmer-context',
  role: 'FARMER',
  expiresIn: '15m',
);
