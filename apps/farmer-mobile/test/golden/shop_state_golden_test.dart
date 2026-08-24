@Tags(['golden'])
library;

import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/app/theme/vardhnam_theme.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/screens/product_browse_screen.dart';

void main() {
  group('Shop state goldens', () {
    for (final scenario in _ShopScenario.values) {
      testWidgets('${scenario.name} in English', (tester) async {
        _setViewport(tester, const Size(390, 844));
        final repository = _StateRepository(scenario);
        await _pumpState(tester, const Locale('en'), repository);
        await _alignState(tester, scenario, const Locale('en'));

        await expectLater(
          find.byType(Scaffold),
          matchesGoldenFile('goldens/shop_${scenario.name}_en.png'),
        );
        await repository.release(tester);
      });

      testWidgets('${scenario.name} in Hindi at 320dp and 200 percent text', (
        tester,
      ) async {
        _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
        final repository = _StateRepository(scenario);
        await _pumpState(tester, const Locale('hi'), repository);
        await _alignState(tester, scenario, const Locale('hi'));

        expect(tester.takeException(), isNull);
        await expectLater(
          find.byType(Scaffold),
          matchesGoldenFile('goldens/shop_${scenario.name}_hi_320dp_200.png'),
        );
        await repository.release(tester);
      });
    }
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

Future<void> _pumpState(
  WidgetTester tester,
  Locale locale,
  _StateRepository repository,
) async {
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: VardhnamTheme.light,
      home: ProductBrowseScreen(repository: repository),
    ),
  );
  if (repository.scenario == _ShopScenario.loading) {
    await tester.pump();
  } else {
    await tester.pumpAndSettle();
  }
}

Future<void> _alignState(
  WidgetTester tester,
  _ShopScenario scenario,
  Locale locale,
) async {
  final target = switch (scenario) {
    _ShopScenario.loading => find.byType(LinearProgressIndicator),
    _ShopScenario.empty => find.text(
      locale.languageCode == 'hi'
          ? 'इस पिनकोड के लिए कोई स्वीकृत ऑफर नहीं मिला।'
          : 'No approved offers found for this pincode.',
    ),
    _ShopScenario.error => find.byIcon(Icons.cloud_off_outlined),
  };
  await tester.scrollUntilVisible(
    target,
    250,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.ensureVisible(target);
  await tester.pump();
}

enum _ShopScenario { loading, empty, error }

class _StateRepository implements MarketplaceProductRepository {
  _StateRepository(this.scenario);

  final _ShopScenario scenario;
  final _loading = Completer<MarketplaceProductPage>();

  @override
  Future<MarketplaceFilterOptions> getFilterOptions(String pincode) async =>
      const MarketplaceFilterOptions(
        categories: [],
        brands: [],
        cropTargets: [],
      );

  @override
  Future<MarketplaceProductPage> listProducts(MarketplaceProductQuery query) =>
      switch (scenario) {
        _ShopScenario.loading => _loading.future,
        _ShopScenario.empty => Future.value(_emptyPage(query)),
        _ShopScenario.error => Future.error(const SocketException('offline')),
      };

  Future<void> release(WidgetTester tester) async {
    if (!_loading.isCompleted) {
      _loading.complete(
        _emptyPage(const MarketplaceProductQuery(pincode: '302001')),
      );
    }
    await tester.pumpAndSettle();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

MarketplaceProductPage _emptyPage(MarketplaceProductQuery query) =>
    MarketplaceProductPage(
      items: const [],
      page: query.page,
      limit: query.limit,
      total: 0,
    );
