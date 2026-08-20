import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/app/theme/vardhnam_theme.dart';
import 'package:vardhnam_farmer_mobile/src/core/widgets/vardhnam_components.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/screens/product_browse_screen.dart';
import 'package:vardhnam_farmer_mobile/src/screens/product_detail_screen.dart';

void main() {
  testWidgets('shop uses the reusable product card and backend offer data', (
    tester,
  ) async {
    await tester.pumpWidget(
      _testApp(ProductBrowseScreen(repository: _MarketplaceRepository())),
    );
    await tester.pumpAndSettle();

    expect(find.text('Delivering to'), findsOneWidget);
    expect(find.text('Shop by crop'), findsOneWidget);
    expect(find.text('Shop by category'), findsOneWidget);
    expect(find.text('Shop by brand'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byType(VardhnamProductCard),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.byType(VardhnamProductCard), findsOneWidget);
    expect(find.text('Demo Seeds'), findsWidgets);
    expect(find.textContaining('₹1200'), findsOneWidget);
  });

  testWidgets('Hindi shop survives narrow 200 percent text', (tester) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      _testApp(
        ProductBrowseScreen(repository: _MarketplaceRepository()),
        locale: const Locale('hi'),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    await tester.scrollUntilVisible(
      find.byType(VardhnamProductCard),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.byType(VardhnamProductCard), findsOneWidget);
  });

  testWidgets('product detail makes distributor invoice responsibility clear', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: _testApp(
          ProductDetailScreen(
            productId: 'product-1',
            pincode: '302001',
            repository: _MarketplaceRepository(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.bySemanticsLabel('Product image placeholder for Hybrid Bajra Seed'),
      findsOneWidget,
    );
    await tester.scrollUntilVisible(
      find.text('Seller and invoice'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Seller and invoice'), findsOneWidget);
    expect(find.textContaining('legal seller'), findsOneWidget);
    expect(find.text('Suitable for crops'), findsOneWidget);
  });

  testWidgets('Club catalogue uses the benefit badge returned by backend', (
    tester,
  ) async {
    await tester.pumpWidget(
      _testApp(
        ProductBrowseScreen(
          repository: _MarketplaceRepository(club: true),
          kisanClubMode: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Kisan Club Benefit'), findsOneWidget);
    expect(find.text('Eligible Club products'), findsOneWidget);
  });
}

Widget _testApp(Widget home, {Locale locale = const Locale('en')}) =>
    MaterialApp(
      theme: VardhnamTheme.light,
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: home,
    );

class _MarketplaceRepository implements MarketplaceProductRepository {
  _MarketplaceRepository({bool club = false})
    : detail = MarketplaceProductDetail.fromJson({
        ..._productJson,
        if (club)
          'clubProgrammes': [
            {'id': 'programme-1', 'variantId': null, 'displayPriority': 1},
          ],
      });

  final MarketplaceProductDetail detail;

  @override
  Future<MarketplaceFilterOptions> getFilterOptions(String pincode) async =>
      MarketplaceFilterOptions.fromJson({
        'categories': ['Seeds'],
        'brands': [
          {'id': 'brand-1', 'name': 'Demo Seeds', 'slug': 'demo-seeds'},
        ],
        'cropTargets': ['Bajra'],
      });

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) async => detail;

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async => MarketplaceProductPage(
    items: [detail.product],
    page: 1,
    limit: 20,
    total: 1,
  );
}

final Map<String, Object?> _productJson = {
  'id': 'product-1',
  'name': 'Hybrid Bajra Seed',
  'category': 'Seeds',
  'cropTargets': ['Bajra'],
  'brand': {'id': 'brand-1', 'name': 'Demo Seeds', 'slug': 'demo-seeds'},
  'company': {'id': 'company-1', 'displayName': 'Demo Company'},
  'serviceablePincode': '302001',
  'lowestPricePaise': 120000,
  'availableQuantity': 42,
  'offerCount': 1,
  'sellerCount': 1,
  'fulfilmentModes': ['DISTRIBUTOR_FULFILLED'],
  'description': 'Approved product description.',
  'variants': <Object?>[],
  'documents': <Object?>[],
  'offers': [
    {
      'id': 'offer-1',
      'variant': {
        'id': 'variant-1',
        'variantName': '1 kg pack',
        'packSize': '1',
        'packUnit': 'kg',
        'mrpPaise': 125000,
      },
      'seller': {
        'organisationId': 'seller-1',
        'displayName': 'Jaipur Distributor',
        'legalName': 'Jaipur Distributor Private Limited',
        'gstin': '08ABCDE1234F1Z5',
      },
      'warehouse': {
        'id': 'warehouse-1',
        'name': 'Jaipur Warehouse',
        'city': 'Jaipur',
        'state': 'Rajasthan',
        'pincode': '302001',
      },
      'batch': null,
      'sellingPricePaise': 120000,
      'minimumOrderQuantity': 1,
      'maximumOrderQuantity': 10,
      'availableQuantity': 42,
      'fulfilmentMode': 'DISTRIBUTOR_FULFILLED',
      'deliverySlaDays': 2,
    },
  ],
};
