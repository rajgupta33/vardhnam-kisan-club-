import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/app/assets/app_assets.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/core/widgets/vardhnam_bottom_navigation.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_membership_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_models.dart';

void main() {
  testWidgets('uses the official logo on farmer entry', (tester) async {
    await tester.pumpWidget(const FarmerApp());

    final logo = tester.widget<Image>(
      find.byWidgetPredicate(
        (widget) =>
            widget is Image &&
            widget.image is AssetImage &&
            (widget.image as AssetImage).assetName ==
                AppAssets.vardhnamLogoFull,
      ),
    );

    expect((logo.image as AssetImage).assetName, AppAssets.vardhnamLogoFull);
  });

  testWidgets('home exposes the five farmer destinations', (tester) async {
    await tester.pumpWidget(
      const FarmerApp(
        initialSession: _session,
        kisanClubMembershipRepository: _ClubRepository(
          KisanClubMembershipAvailability.disabled(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(VardhnamBottomNavigation), findsOneWidget);
    // Short tab labels: five destinations share one row, and Devanagari at
    // 200% text decides how long a label can be.
    for (final label in ['Home', 'Shop', 'Kisan Club', 'Orders', 'Account']) {
      expect(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text(label),
        ),
        findsOneWidget,
      );
    }
  });

  testWidgets('Kisan Club landing explains the free programme', (tester) async {
    await tester.pumpWidget(
      const FarmerApp(
        initialSession: _session,
        initialLocation: '/kisan-club',
        kisanClubMembershipRepository: _ClubRepository(
          KisanClubMembershipAvailability.enabled(null),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('A free farmer-support programme from Vardhnam.'),
      findsOneWidget,
    );
    await tester.dragUntilVisible(
      find.text('No membership fee.'),
      find.byType(ListView),
      const Offset(0, -250),
    );
    expect(find.text('No membership fee.'), findsOneWidget);
    expect(find.text('Join Kisan Club'), findsOneWidget);
  });

  testWidgets('Hindi Club landing survives narrow 200% text', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      const FarmerApp(
        initialSession: _session,
        initialLocale: Locale('hi'),
        initialLocation: '/kisan-club',
        kisanClubMembershipRepository: _ClubRepository(
          KisanClubMembershipAvailability.enabled(null),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('keeps the navigation bar on every tab', (tester) async {
    await tester.pumpWidget(
      const FarmerApp(
        initialSession: _session,
        kisanClubMembershipRepository: _ClubRepository(
          KisanClubMembershipAvailability.disabled(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Before the shell existed the bar was built by the dashboard alone, so it
    // vanished the moment a farmer left home.
    for (final tab in ['Shop', 'Orders', 'Account', 'Home']) {
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text(tab),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.byType(VardhnamBottomNavigation),
        findsOneWidget,
        reason: 'the navigation bar should survive switching to $tab',
      );
    }
  });
}

class _ClubRepository implements KisanClubMembershipRepository {
  const _ClubRepository(this.availability);

  final KisanClubMembershipAvailability availability;

  @override
  Future<KisanClubMembershipAvailability> getMembership() async => availability;

  @override
  Future<KisanClubMembership> join(KisanClubMembershipInput input) =>
      throw UnimplementedError();

  @override
  Future<KisanClubMembership> updateConsents(KisanClubConsentInput input) =>
      throw UnimplementedError();
}

const _session = AuthSession(
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  membershipId: 'membership-1',
  organisationId: 'farmer-context',
  role: 'FARMER',
  expiresIn: '15m',
);
