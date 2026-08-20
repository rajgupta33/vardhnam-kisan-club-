import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/advisory/advisory_repository.dart';
import 'package:vardhnam_farmer_mobile/src/app/theme/vardhnam_theme.dart';
import 'package:vardhnam_farmer_mobile/src/screens/advisory_detail_screen.dart';

void main() {
  group('Advisory detail goldens', () {
    testWidgets('English content at a standard phone viewport', (tester) async {
      await _setViewport(tester, const Size(390, 844));
      await _pumpAdvisoryDetail(tester, const Locale('en'));

      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/advisory_detail_en.png'),
      );
    });

    testWidgets('Hindi content at 320dp and 200 percent text', (tester) async {
      await _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
      await _pumpAdvisoryDetail(tester, const Locale('hi'));

      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/advisory_detail_hi_320dp_200.png'),
      );
    });
  });
}

Future<void> _setViewport(
  WidgetTester tester,
  Size size, {
  double textScaleFactor = 1,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScaleFactor;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

Future<void> _pumpAdvisoryDetail(WidgetTester tester, Locale locale) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        advisoryRepositoryProvider.overrideWithValue(
          const _GoldenAdvisoryRepository(),
        ),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: VardhnamTheme.light,
        home: const AdvisoryDetailScreen(advisoryId: 'advisory-golden'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _GoldenAdvisoryRepository implements AdvisoryRepository {
  const _GoldenAdvisoryRepository();

  static final item = FarmerAdvisory(
    id: 'advisory-golden',
    status: AdvisoryStatus.read,
    dueOn: DateTime.utc(2026, 1, 15),
    category: 'IRRIGATION',
    title: 'Check soil moisture before irrigation',
    body:
        'Inspect the root zone in several parts of the field before following the approved irrigation plan.',
    sourceReference: 'Approved agronomy bulletin 12',
    ruleVersion: 1,
    cropCycleId: 'cycle-golden',
    cropName: 'Wheat',
    varietyName: 'HD-2967',
  );

  @override
  Future<void> dismiss(String id) async {}

  @override
  Future<FarmerAdvisory> get(String id) async => item;

  @override
  Future<FarmerAdvisoryPage> list({int page = 1, int limit = 20}) async =>
      FarmerAdvisoryPage(items: const [], page: page, limit: limit, total: 0);

  @override
  Future<void> markRead(String id) async {}
}
