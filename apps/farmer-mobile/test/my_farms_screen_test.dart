import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/advisory/advisory_repository.dart';
import 'package:vardhnam_farmer_mobile/src/crop_doctor/crop_doctor_feature.dart';
import 'package:vardhnam_farmer_mobile/src/farms/farm_repository.dart';
import 'package:vardhnam_farmer_mobile/src/screens/my_farms_screen.dart';

void main() {
  testWidgets('edits an owned farm and refreshes the displayed details', (
    tester,
  ) async {
    final repository = _FakeFarmRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          farmRepositoryProvider.overrideWithValue(repository),
          advisoryRepositoryProvider.overrideWithValue(
            const _EmptyAdvisoryRepository(),
          ),
        ],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: MyFarmsScreen(defaultPincode: '302001'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Edit farm'));
    await tester.pumpAndSettle();
    expect(find.text('Edit farm details'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).first, 'Updated field');
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    expect(repository.updates, hasLength(1));
    expect(repository.updates.single.input.name, 'Updated field');
    expect(repository.updates.single.input.pincode, '302001');
    expect(find.text('Updated field'), findsOneWidget);
  });

  testWidgets('edits an active crop cycle and refreshes its details', (
    tester,
  ) async {
    final repository = _FakeFarmRepository(withCropCycle: true);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          farmRepositoryProvider.overrideWithValue(repository),
          advisoryRepositoryProvider.overrideWithValue(
            const _EmptyAdvisoryRepository(),
          ),
        ],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: MyFarmsScreen(defaultPincode: '302001'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Edit crop cycle'));
    await tester.pumpAndSettle();
    expect(find.text('Edit crop cycle'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'HD 2967'),
      'DBW 187',
    );
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    expect(repository.cycleUpdates, hasLength(1));
    expect(repository.cycleUpdates.single.input.varietyName, 'DBW 187');
    expect(repository.cycleUpdates.single.input.areaAcres, 2);
  });

  testWidgets('resumes profile completion at the crop step for a saved farm', (
    tester,
  ) async {
    final repository = _FakeFarmRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          farmRepositoryProvider.overrideWithValue(repository),
          advisoryRepositoryProvider.overrideWithValue(
            const _EmptyAdvisoryRepository(),
          ),
        ],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: MyFarmsScreen(defaultPincode: '302001', completionMode: true),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Complete Club profile'), findsOneWidget);
    expect(
      find.text('Step 2 of 2: Add the crop you are growing'),
      findsOneWidget,
    );
    expect(find.text('North field'), findsOneWidget);
    expect(find.text('Add crop cycle'), findsOneWidget);
  });

  testWidgets('opens farm and crop details without invented guidance', (
    tester,
  ) async {
    final repository = _FakeFarmRepository(withCropCycle: true);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          farmRepositoryProvider.overrideWithValue(repository),
          advisoryRepositoryProvider.overrideWithValue(
            _EmptyAdvisoryRepository(items: _approvedAdvisories()),
          ),
          cropDoctorShellEnabledProvider.overrideWithValue(true),
        ],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: MyFarmsScreen(defaultPincode: '302001'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('View farm'));
    await tester.pumpAndSettle();
    expect(find.text('Current crops'), findsOneWidget);
    expect(find.text('North field'), findsWidgets);

    await tester.tap(find.text('Wheat'));
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.text('Check soil moisture'),
      find.byType(ListView),
      const Offset(0, -250),
    );
    expect(find.text('Check soil moisture'), findsOneWidget);
    expect(find.textContaining('authoritative irrigation'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('Next 7 days'),
      find.byType(ListView),
      const Offset(0, -250),
    );
    expect(find.text('Next 7 days'), findsOneWidget);
    expect(find.text('Nutrition check'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('Open photo guide'),
      find.byType(ListView),
      const Offset(0, -250),
    );
    expect(find.text('Open photo guide'), findsOneWidget);
  });

  testWidgets('farm and crop details support narrow Hindi at 200% text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    final repository = _FakeFarmRepository(withCropCycle: true);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          farmRepositoryProvider.overrideWithValue(repository),
          advisoryRepositoryProvider.overrideWithValue(
            const _EmptyAdvisoryRepository(),
          ),
        ],
        child: const MaterialApp(
          locale: Locale('hi'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: MyFarmsScreen(defaultPincode: '302001'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.byIcon(Icons.visibility_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.visibility_outlined));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.dragUntilVisible(
      find.text(_cycle.cropNameHi),
      find.byType(ListView),
      const Offset(0, -180),
    );
    await tester.tap(find.text(_cycle.cropNameHi));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}

class _EmptyAdvisoryRepository implements AdvisoryRepository {
  const _EmptyAdvisoryRepository({this.items = const []});

  final List<FarmerAdvisory> items;

  @override
  Future<FarmerAdvisoryPage> list({int page = 1, int limit = 20}) async =>
      FarmerAdvisoryPage(
        items: items,
        page: page,
        limit: limit,
        total: items.length,
      );

  @override
  Future<void> dismiss(String id) => throw UnimplementedError();

  @override
  Future<FarmerAdvisory> get(String id) => throw UnimplementedError();

  @override
  Future<void> markRead(String id) => throw UnimplementedError();
}

List<FarmerAdvisory> _approvedAdvisories() {
  final today = DateTime.now();
  return [
    FarmerAdvisory(
      id: 'advisory-today',
      status: AdvisoryStatus.delivered,
      dueOn: today,
      category: 'IRRIGATION',
      title: 'Check soil moisture',
      body: 'Follow the authoritative irrigation guidance for this crop.',
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
  ];
}

class _FakeFarmRepository implements FarmRepository {
  _FakeFarmRepository({bool withCropCycle = false})
    : _farm = FarmerFarm(
        id: 'farm-1',
        name: 'North field',
        village: 'Rampura',
        pincode: '302001',
        areaAcres: 2.5,
        ownershipType: FarmOwnershipType.owned,
        isActive: true,
        cropCycles: withCropCycle ? [_cycle] : const [],
      );

  FarmerFarm _farm;

  final updates = <({String farmId, UpdateFarmInput input})>[];
  final cycleUpdates =
      <({String farmId, String cycleId, UpdateCropCycleInput input})>[];

  @override
  Future<List<FarmerFarm>> listMine() async => [_farm];

  @override
  Future<FarmerFarm> update(String farmId, UpdateFarmInput input) async {
    updates.add((farmId: farmId, input: input));
    _farm = FarmerFarm(
      id: _farm.id,
      name: input.name.trim(),
      village: input.village?.trim(),
      pincode: input.pincode,
      areaAcres: input.areaAcres,
      ownershipType: input.ownershipType,
      isActive: input.isActive,
      cropCycles: _farm.cropCycles,
    );
    return _farm;
  }

  @override
  Future<FarmerFarm> create(CreateFarmInput input) =>
      throw UnimplementedError();

  @override
  Future<FarmActivity> createActivity(
    String cycleId,
    CreateFarmActivityInput input,
  ) => throw UnimplementedError();

  @override
  Future<FarmCropCycleSummary> createCropCycle(
    String farmId,
    CreateCropCycleInput input,
  ) => throw UnimplementedError();

  @override
  Future<FarmCropCycleSummary> updateCropCycle(
    String farmId,
    String cycleId,
    UpdateCropCycleInput input,
  ) async {
    cycleUpdates.add((farmId: farmId, cycleId: cycleId, input: input));
    final updated = FarmCropCycleSummary(
      id: cycleId,
      cropId: input.cropId,
      cropNameEn: 'Wheat',
      cropNameHi: 'गेहूँ',
      areaAcres: input.areaAcres,
      season: input.season,
      status: CropCycleStatus.active,
      varietyName: input.varietyName?.trim(),
    );
    _farm = FarmerFarm(
      id: _farm.id,
      name: _farm.name,
      village: _farm.village,
      pincode: _farm.pincode,
      areaAcres: _farm.areaAcres,
      ownershipType: _farm.ownershipType,
      isActive: _farm.isActive,
      cropCycles: [updated],
    );
    return updated;
  }

  @override
  Future<FarmCropCycleSummary> harvestCropCycle(
    String farmId,
    String cycleId,
    HarvestCropCycleInput input,
  ) => throw UnimplementedError();

  @override
  Future<List<FarmActivity>> listActivities(String cycleId) =>
      throw UnimplementedError();

  @override
  Future<List<CropReference>> listReferenceCrops() => Future.value([_crop]);
}

const _crop = CropReference(
  id: 'crop-1',
  code: 'WHEAT',
  nameEn: 'Wheat',
  nameHi: 'गेहूँ',
);

const _cycle = FarmCropCycleSummary(
  id: 'cycle-1',
  cropId: 'crop-1',
  cropNameEn: 'Wheat',
  cropNameHi: 'गेहूँ',
  areaAcres: 2,
  season: 'RABI_2026_27',
  status: CropCycleStatus.active,
  varietyName: 'HD 2967',
);
