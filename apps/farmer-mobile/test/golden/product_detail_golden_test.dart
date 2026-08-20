import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/app/theme/vardhnam_theme.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/screens/product_detail_screen.dart';

void main() {
  group('Product detail goldens', () {
    testWidgets('English product and seller disclosure', (tester) async {
      _setViewport(tester, const Size(390, 844));
      await _pumpProductDetail(tester, const Locale('en'));

      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/product_detail_summary_en.png'),
      );

      await _showSellerOffer(tester);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/product_detail_seller_en.png'),
      );
    });

    testWidgets('Hindi product and seller at 320dp and 200 percent text', (
      tester,
    ) async {
      _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
      await _pumpProductDetail(tester, const Locale('hi'));

      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/product_detail_summary_hi_320dp_200.png'),
      );

      await _showSellerOffer(tester);
      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/product_detail_seller_hi_320dp_200.png'),
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

Future<void> _pumpProductDetail(WidgetTester tester, Locale locale) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: VardhnamTheme.light,
        home: ProductDetailScreen(
          productId: 'product-golden',
          pincode: '302001',
          repository: _ProductDetailRepository(),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _showSellerOffer(WidgetTester tester) async {
  final gstin = find.textContaining('GSTIN');
  await tester.scrollUntilVisible(
    gstin,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.ensureVisible(gstin);
  await tester.pumpAndSettle();
}

class _ProductDetailRepository implements MarketplaceProductRepository {
  _ProductDetailRepository()
    : detail = MarketplaceProductDetail.fromJson(_productJson);

  final MarketplaceProductDetail detail;

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) async => detail;

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
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
  'description': 'Approved product description for rainfed Bajra farms.',
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
      'batch': {
        'id': 'batch-golden',
        'batchNumber': 'BJ-2026-08',
        'expiryDate': '2027-06-30T00:00:00.000Z',
        'germinationPercentage': '88',
      },
      'sellingPricePaise': 120000,
      'minimumOrderQuantity': 1,
      'maximumOrderQuantity': 10,
      'availableQuantity': 42,
      'fulfilmentMode': 'DISTRIBUTOR_FULFILLED',
      'deliverySlaDays': 2,
    },
  ],
};
