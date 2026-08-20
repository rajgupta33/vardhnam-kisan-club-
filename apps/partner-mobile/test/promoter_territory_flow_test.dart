import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/territory/promoter_territory.dart';
import 'package:vardhnam_partner_mobile/src/territory/promoter_territory_repository.dart';

void main() {
  testWidgets('promoter sees the assigned organisation territory', (
    tester,
  ) async {
    await tester.pumpWidget(
      PartnerApp(
        initialSession: _session,
        promoterTerritoryRepository: _FakeTerritoryRepository(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('My territory'));
    await tester.pumpAndSettle();

    expect(find.text('Etah North'), findsOneWidget);
    expect(find.text('District: Etah'), findsOneWidget);
    expect(find.text('207001'), findsOneWidget);
    expect(
      find.text(
        'Territory assignments are managed by authorised Vardhnam operations staff.',
      ),
      findsOneWidget,
    );
  });
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  role: PartnerRole.promoter,
  expiresIn: '15m',
);

class _FakeTerritoryRepository implements PromoterTerritoryRepository {
  @override
  Future<PromoterTerritoryAssignment> getMyTerritory() async =>
      const PromoterTerritoryAssignment(
        assigned: true,
        promoterUserId: 'promoter',
        promoterOrganisationId: 'organisation',
        territory: PromoterTerritory(
          id: 'territory',
          name: 'Etah North',
          state: 'Uttar Pradesh',
          district: 'Etah',
          blocks: ['Sakit'],
          pincodes: ['207001'],
          villages: ['Nagla'],
          status: 'ACTIVE',
        ),
      );
}
