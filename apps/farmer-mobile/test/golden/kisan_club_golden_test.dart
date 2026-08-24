@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/advisory/advisory_repository.dart';
import 'package:vardhnam_farmer_mobile/src/app/theme/vardhnam_theme.dart';
import 'package:vardhnam_farmer_mobile/src/farms/farm_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_membership_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_models.dart';
import 'package:vardhnam_farmer_mobile/src/localization/locale_controller.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile_repository.dart';
import 'package:vardhnam_farmer_mobile/src/screens/kisan_club_home_screen.dart';
import 'package:vardhnam_farmer_mobile/src/screens/kisan_club_join_screen.dart';

void main() {
  group('Kisan Club goldens', () {
    testWidgets('Join in English at a standard phone viewport', (tester) async {
      _setViewport(tester, const Size(390, 844));
      await _pumpJoin(tester, const Locale('en'));

      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/kisan_club_join_en.png'),
      );
    });

    testWidgets('Join in Hindi at 320dp and 200 percent text', (tester) async {
      _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
      await _pumpJoin(tester, const Locale('hi'));

      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/kisan_club_join_hi_320dp_200.png'),
      );
    });

    testWidgets('Member dashboard in English at a standard phone viewport', (
      tester,
    ) async {
      _setViewport(tester, const Size(390, 844));
      await _pumpDashboard(tester, const Locale('en'));

      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/kisan_club_dashboard_en.png'),
      );
    });

    testWidgets('Member dashboard in Hindi at 320dp and 200 percent text', (
      tester,
    ) async {
      _setViewport(tester, const Size(320, 700), textScaleFactor: 2);
      await _pumpDashboard(tester, const Locale('hi'));

      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('goldens/kisan_club_dashboard_hi_320dp_200.png'),
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

Future<void> _pumpJoin(WidgetTester tester, Locale locale) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        farmerProfileRepositoryProvider.overrideWithValue(
          _ClubProfileRepository(locale.languageCode),
        ),
        farmRepositoryProvider.overrideWithValue(const _ClubFarmRepository()),
        initialLocaleProvider.overrideWithValue(locale),
      ],
      child: _GoldenApp(locale: locale, home: const KisanClubJoinScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _pumpDashboard(WidgetTester tester, Locale locale) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        kisanClubMembershipRepositoryProvider.overrideWithValue(
          const _ActiveMembershipRepository(),
        ),
        farmRepositoryProvider.overrideWithValue(const _ClubFarmRepository()),
        advisoryRepositoryProvider.overrideWithValue(
          const _ClubAdvisoryRepository(),
        ),
        farmerProfileRepositoryProvider.overrideWithValue(
          _ClubProfileRepository(locale.languageCode),
        ),
        initialLocaleProvider.overrideWithValue(locale),
      ],
      child: _GoldenApp(locale: locale, home: const KisanClubHomeScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

class _GoldenApp extends StatelessWidget {
  const _GoldenApp({required this.locale, required this.home});

  final Locale locale;
  final Widget home;

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    theme: VardhnamTheme.light,
    home: home,
  );
}

class _ActiveMembershipRepository implements KisanClubMembershipRepository {
  const _ActiveMembershipRepository();

  @override
  Future<KisanClubMembershipAvailability> getMembership() async =>
      KisanClubMembershipAvailability.enabled(
        KisanClubMembership(
          id: 'membership-golden',
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
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _ClubFarmRepository implements FarmRepository {
  const _ClubFarmRepository();

  @override
  Future<List<FarmerFarm>> listMine() async => [
    FarmerFarm(
      id: 'farm-golden',
      name: 'Farm home',
      pincode: '302001',
      areaAcres: 3,
      ownershipType: FarmOwnershipType.owned,
      isActive: true,
      cropCycles: [
        FarmCropCycleSummary(
          id: 'cycle-golden',
          cropId: 'crop-wheat',
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
  Future<List<CropReference>> listReferenceCrops() async => const [
    CropReference(
      id: 'crop-wheat',
      code: 'WHEAT',
      nameEn: 'Wheat',
      nameHi: 'गेहूँ',
    ),
  ];

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _ClubAdvisoryRepository implements AdvisoryRepository {
  const _ClubAdvisoryRepository();

  @override
  Future<FarmerAdvisoryPage> list({int page = 1, int limit = 20}) async =>
      FarmerAdvisoryPage(
        items: [
          FarmerAdvisory(
            id: 'advisory-golden',
            status: AdvisoryStatus.delivered,
            dueOn: DateTime.utc(2026, 8, 18),
            category: 'IRRIGATION',
            title: 'Irrigation check',
            body: 'Check soil moisture before the approved irrigation.',
            ruleVersion: 1,
            cropCycleId: 'cycle-golden',
            cropName: 'Wheat',
          ),
        ],
        page: page,
        limit: limit,
        total: 1,
      );

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

class _ClubProfileRepository implements FarmerProfileRepository {
  const _ClubProfileRepository(this.languageCode);

  final String languageCode;

  @override
  Future<FarmerProfile> getProfile() async => FarmerProfile(
    id: 'profile-golden',
    fullName: languageCode == 'hi' ? 'सीता देवी' : 'Sita Devi',
    preferredLocale: languageCode,
    cropInterests: const ['Wheat'],
    addresses: const [],
    primaryPincode: '302001',
    village: languageCode == 'hi' ? 'रामपुरा' : 'Rampura',
    district: languageCode == 'hi' ? 'जयपुर' : 'Jaipur',
    state: languageCode == 'hi' ? 'राजस्थान' : 'Rajasthan',
  );

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}
