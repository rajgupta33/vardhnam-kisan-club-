import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/advisory/advisory_repository.dart';
import 'package:vardhnam_farmer_mobile/src/farms/farm_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_membership_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_models.dart';
import 'package:vardhnam_farmer_mobile/src/localization/locale_controller.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile_repository.dart';
import 'package:vardhnam_farmer_mobile/src/screens/kisan_club_home_screen.dart';

void main() {
  testWidgets('orders real Club member modules around farm support', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(600, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('Sita Devi'), findsOneWidget);
    expect(find.text('WHEAT'), findsOneWidget);
    expect(find.text('Irrigation check'), findsOneWidget);
    expect(find.textContaining('Check soil moisture'), findsOneWidget);
    expect(find.text('Crop problem?'), findsOneWidget);
    expect(find.textContaining('will not generate'), findsOneWidget);

    final headings = [
      'Your crop',
      "Today's advisory",
      'Crop problem?',
      'Your Vardhnam promoter',
      'Kisan Club benefits',
      'My farms',
    ];
    final positions = headings
        .map((heading) => tester.getTopLeft(find.text(heading)).dy)
        .toList(growable: false);
    expect(positions, orderedEquals([...positions]..sort()));
  });

  testWidgets('keeps the Hindi Club dashboard usable at 200 percent text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(600, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      _app(locale: const Locale('hi'), textScaler: const TextScaler.linear(2)),
    );
    await tester.pumpAndSettle();

    expect(find.text('सीता देवी'), findsOneWidget);
    expect(find.text('गेहूँ'), findsOneWidget);
    expect(find.text('फसल में समस्या?'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Widget _app({
  Locale locale = const Locale('en'),
  TextScaler textScaler = TextScaler.noScaling,
}) => ProviderScope(
  overrides: [
    kisanClubMembershipRepositoryProvider.overrideWithValue(
      const _MembershipRepository(),
    ),
    farmRepositoryProvider.overrideWithValue(const _FarmRepository()),
    advisoryRepositoryProvider.overrideWithValue(const _AdvisoryRepository()),
    farmerProfileRepositoryProvider.overrideWithValue(
      _ProfileRepository(locale.languageCode),
    ),
    initialLocaleProvider.overrideWithValue(locale),
  ],
  child: MaterialApp(
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: textScaler),
      child: child!,
    ),
    home: const KisanClubHomeScreen(),
  ),
);

class _MembershipRepository implements KisanClubMembershipRepository {
  const _MembershipRepository();

  @override
  Future<KisanClubMembershipAvailability> getMembership() async =>
      KisanClubMembershipAvailability.enabled(
        KisanClubMembership(
          id: 'membership-1',
          memberNumber: 'VKC-001',
          status: KisanClubMembershipStatus.active,
          homePincode: '302001',
          joinedAt: DateTime.utc(2026, 8, 1),
          termsVersion: kisanClubTermsVersion,
          advisoryConsent: true,
          marketingConsent: false,
          preciseLocationConsent: false,
        ),
      );

  @override
  Future<KisanClubMembership> join(KisanClubMembershipInput input) =>
      throw UnimplementedError();

  @override
  Future<KisanClubMembership> updateConsents(KisanClubConsentInput input) =>
      throw UnimplementedError();
}

class _FarmRepository implements FarmRepository {
  const _FarmRepository();

  @override
  Future<List<FarmerFarm>> listMine() async => [
    FarmerFarm(
      id: 'farm-1',
      name: 'Farm home',
      pincode: '302001',
      areaAcres: 3,
      ownershipType: FarmOwnershipType.owned,
      isActive: true,
      cropCycles: [
        FarmCropCycleSummary(
          id: 'cycle-1',
          cropId: 'crop-1',
          cropNameEn: 'Wheat',
          cropNameHi: 'गेहूँ',
          areaAcres: 2,
          season: 'RABI_2026',
          status: CropCycleStatus.active,
          sowingDate: DateTime.now().subtract(const Duration(days: 24)),
        ),
      ],
    ),
  ];

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
  Future<FarmCropCycleSummary> harvestCropCycle(
    String farmId,
    String cycleId,
    HarvestCropCycleInput input,
  ) => throw UnimplementedError();
  @override
  Future<List<FarmActivity>> listActivities(String cycleId) =>
      throw UnimplementedError();
  @override
  Future<List<CropReference>> listReferenceCrops() =>
      throw UnimplementedError();
  @override
  Future<FarmerFarm> update(String farmId, UpdateFarmInput input) =>
      throw UnimplementedError();
  @override
  Future<FarmCropCycleSummary> updateCropCycle(
    String farmId,
    String cycleId,
    UpdateCropCycleInput input,
  ) => throw UnimplementedError();
}

class _AdvisoryRepository implements AdvisoryRepository {
  const _AdvisoryRepository();

  @override
  Future<FarmerAdvisoryPage> list({int page = 1, int limit = 20}) async =>
      FarmerAdvisoryPage(
        items: [
          FarmerAdvisory(
            id: 'advisory-1',
            status: AdvisoryStatus.delivered,
            dueOn: DateTime.utc(2026, 8, 18),
            category: 'IRRIGATION',
            title: 'Irrigation check',
            body: 'Check soil moisture before the next approved irrigation.',
            ruleVersion: 1,
            cropCycleId: 'cycle-1',
            cropName: 'Wheat',
          ),
        ],
        page: page,
        limit: limit,
        total: 1,
      );

  @override
  Future<void> dismiss(String id) => throw UnimplementedError();
  @override
  Future<FarmerAdvisory> get(String id) => throw UnimplementedError();
  @override
  Future<void> markRead(String id) => throw UnimplementedError();
}

class _ProfileRepository implements FarmerProfileRepository {
  const _ProfileRepository(this.languageCode);

  final String languageCode;

  @override
  Future<FarmerProfile> getProfile() async => FarmerProfile(
    id: 'farmer-1',
    fullName: languageCode == 'hi' ? 'सीता देवी' : 'Sita Devi',
    preferredLocale: languageCode,
    cropInterests: const [],
    addresses: const [],
    primaryPincode: '302001',
  );

  @override
  Future<FarmerProfile> saveProfile(FarmerProfileInput input) =>
      throw UnimplementedError();
}
