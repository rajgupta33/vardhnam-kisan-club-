import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/app/theme/vardhnam_theme.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/screens/product_detail_screen.dart';

void main() {
  group('Product detail state goldens', () {
    for (final scenario in _ProductDetailScenario.values) {
      testWidgets('${scenario.name} in English', (tester) async {
        _setViewport(tester, const Size(390, 844));
        final repository = _StateRepository(scenario);
        await _pumpState(tester, const Locale('en'), repository);

        await expectLater(
          find.byType(Scaffold),
          matchesGoldenFile('goldens/product_detail_${scenario.name}_en.png'),
        );
        await repository.release(tester);
      });

      testWidgets('${scenario.name} in Hindi at 320dp and 200 percent text', (
        tester,
      ) async {
        _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
        final repository = _StateRepository(scenario);
        await _pumpState(tester, const Locale('hi'), repository);

        expect(tester.takeException(), isNull);
        await expectLater(
          find.byType(Scaffold),
          matchesGoldenFile(
            'goldens/product_detail_${scenario.name}_hi_320dp_200.png',
          ),
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
          repository: repository,
        ),
      ),
    ),
  );
  if (repository.scenario == _ProductDetailScenario.loading) {
    await tester.pump();
  } else {
    await tester.pumpAndSettle();
  }
}

enum _ProductDetailScenario { loading, error }

class _StateRepository implements MarketplaceProductRepository {
  _StateRepository(this.scenario);

  final _ProductDetailScenario scenario;
  final _loadingGate = Completer<void>();

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) async {
    if (scenario == _ProductDetailScenario.loading) {
      await _loadingGate.future;
    }
    throw const SocketException('offline');
  }

  Future<void> release(WidgetTester tester) async {
    if (!_loadingGate.isCompleted) {
      await tester.pumpWidget(const SizedBox.shrink());
      _loadingGate.complete();
      await tester.pump();
    }
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}
