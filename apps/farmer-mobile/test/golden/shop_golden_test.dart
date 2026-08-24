@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/app/theme/vardhnam_theme.dart';
import 'package:vardhnam_farmer_mobile/src/core/widgets/vardhnam_components.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/screens/product_browse_screen.dart';

void main() {
  group('Shop goldens', () {
    testWidgets('English discovery controls and product results', (
      tester,
    ) async {
      _setViewport(tester, const Size(390, 844));
      await _pumpShop(tester, const Locale('en'));

      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/shop_filters_en.png'),
      );

      await tester.scrollUntilVisible(
        find.byType(VardhnamProductCard),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(find.byType(VardhnamProductCard));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/shop_products_en.png'),
      );
    });

    testWidgets('Hindi discovery and products at 320dp and 200 percent text', (
      tester,
    ) async {
      _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
      await _pumpShop(tester, const Locale('hi'));

      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/shop_filters_hi_320dp_200.png'),
      );

      await tester.scrollUntilVisible(
        find.byType(VardhnamProductCard),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(find.byType(VardhnamProductCard));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/shop_products_hi_320dp_200.png'),
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

Future<void> _pumpShop(WidgetTester tester, Locale locale) async {
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: VardhnamTheme.light,
      home: ProductBrowseScreen(repository: _ShopRepository()),
    ),
  );
  await tester.pumpAndSettle();
}

class _ShopRepository implements MarketplaceProductRepository {
  _ShopRepository() : detail = MarketplaceProductDetail.fromJson(_productJson);

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
    page: query.page,
    limit: query.limit,
    total: 1,
  );
}

final Map<String, Object?> _productJson = {
  'id': 'product-golden',
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
      'id': 'offer-golden',
      'variant': {
        'id': 'variant-golden',
        'variantName': '1 kg pack',
        'packSize': '1',
        'packUnit': 'kg',
        'mrpPaise': 125000,
      },
      'seller': {
        'organisationId': 'seller-golden',
        'displayName': 'Jaipur Distributor',
        'legalName': 'Jaipur Distributor Private Limited',
        'gstin': '08ABCDE1234F1Z5',
      },
      'warehouse': {
        'id': 'warehouse-golden',
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
