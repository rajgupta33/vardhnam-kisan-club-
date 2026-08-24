@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/advisory/advisory_repository.dart';
import 'package:vardhnam_farmer_mobile/src/app/theme/vardhnam_theme.dart';
import 'package:vardhnam_farmer_mobile/src/crop_doctor/crop_doctor_feature.dart';
import 'package:vardhnam_farmer_mobile/src/farms/farm_repository.dart';
import 'package:vardhnam_farmer_mobile/src/screens/crop_detail_screen.dart';

void main() {
  group('Crop detail goldens', () {
    testWidgets('English content at a standard phone viewport', (tester) async {
      _setViewport(tester, const Size(390, 844));
      await _pumpCropDetail(tester, const Locale('en'));

      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/crop_detail_en.png'),
      );
    });

    testWidgets('Hindi content at 320dp and 200 percent text', (tester) async {
      _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
      await _pumpCropDetail(tester, const Locale('hi'));

      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/crop_detail_hi_320dp_200.png'),
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

Future<void> _pumpCropDetail(WidgetTester tester, Locale locale) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        advisoryRepositoryProvider.overrideWithValue(_CropAdvisoryRepository()),
        cropDoctorShellEnabledProvider.overrideWithValue(false),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: VardhnamTheme.light,
        home: CropDetailScreen(
          farm: _farm,
          cycle: _cycle,
          onEdit: _noAction,
          onOpenDiary: _noAction,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _noAction() async {}

class _CropAdvisoryRepository implements AdvisoryRepository {
  _CropAdvisoryRepository();

  @override
  Future<FarmerAdvisoryPage> list({int page = 1, int limit = 20}) async {
    final today = DateUtils.dateOnly(DateTime.now());
    return FarmerAdvisoryPage(
      items: [
        FarmerAdvisory(
          id: 'advisory-today',
          status: AdvisoryStatus.delivered,
          dueOn: today,
          category: 'IRRIGATION',
          title: 'Check soil moisture',
          body: 'Follow the approved irrigation guidance for this crop.',
          ruleVersion: 1,
          cropCycleId: _cycle.id,
          cropName: _cycle.cropNameEn,
        ),
        FarmerAdvisory(
          id: 'advisory-upcoming',
          status: AdvisoryStatus.pending,
          dueOn: today.add(const Duration(days: 3)),
          category: 'NUTRITION',
          title: 'Nutrition check',
          body: 'Review the approved nutrition plan.',
          ruleVersion: 1,
          cropCycleId: _cycle.id,
          cropName: _cycle.cropNameEn,
        ),
      ],
      page: page,
      limit: limit,
      total: 2,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

final _farm = FarmerFarm(
  id: 'farm-golden',
  name: 'Rampura North Field',
  village: 'Rampura',
  pincode: '302001',
  areaAcres: 4.5,
  ownershipType: FarmOwnershipType.owned,
  isActive: true,
  cropCycles: [_cycle],
);

final _cycle = FarmCropCycleSummary(
  id: 'cycle-golden',
  cropId: 'crop-wheat',
  cropNameEn: 'Wheat',
  cropNameHi: 'गेहूँ',
  areaAcres: 3,
  season: 'RABI 2026',
  status: CropCycleStatus.active,
  varietyName: 'HD 2967',
  sowingDate: DateTime.now().subtract(const Duration(days: 40)),
);
