import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_repository.dart';

void main() {
  testWidgets('promoter opens assigned farmer and redeems a benefit token', (
    tester,
  ) async {
    final repository = _FakePromoterClubRepository();
    await tester.pumpWidget(
      PartnerApp(
        initialSession: _session(PartnerRole.promoter),
        promoterClubRepository: repository,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Kisan Club'));
    await tester.pumpAndSettle();
    expect(find.text('Assigned farmers'), findsOneWidget);
    expect(find.text('Asha Devi'), findsOneWidget);
    expect(find.textContaining('VKC-A1B2C3D4'), findsNothing);

    await tester.tap(find.text('Asha Devi'));
    await tester.pumpAndSettle();
    expect(find.text('North farm'), findsOneWidget);
    expect(find.textContaining('Wheat'), findsOneWidget);

    await tester.tap(find.text('Redeem benefit token'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('benefit-token-code')),
      'vkc-a1b2c3d4-123456',
    );
    await tester.tap(find.text('Create assisted checkout'));
    await tester.pumpAndSettle();

    expect(find.text('Assisted checkout created'), findsOneWidget);
    expect(
      find.text('Payment is still required in the farmer app.'),
      findsOneWidget,
    );
    expect(repository.redeemedMembershipId, 'membership-1');
    expect(repository.redeemedCode, 'vkc-a1b2c3d4-123456');
    expect(repository.idempotencyKey, isNotEmpty);
  });

  testWidgets('delivery partner is not shown promoter Club navigation', (
    tester,
  ) async {
    await tester.pumpWidget(
      PartnerApp(initialSession: _session(PartnerRole.deliveryPartner)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Kisan Club'), findsNothing);
  });

  testWidgets('promoter records a farm-only survey for an assigned farmer', (
    tester,
  ) async {
    final repository = _FakePromoterClubRepository();
    await tester.pumpWidget(
      PartnerApp(
        initialSession: _session(PartnerRole.promoter),
        promoterClubRepository: repository,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Kisan Club'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Asha Devi'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Record farm survey'));
    await tester.tap(find.text('Record farm survey'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('survey-farm-name')), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('survey-farm-name')),
      'South farm',
    );
    await tester.enterText(find.byKey(const Key('survey-farm-area')), '1.75');
    await tester.scrollUntilVisible(
      find.byKey(const Key('survey-include-crop')),
      300,
      scrollable: find
          .descendant(
            of: find.byKey(const Key('survey-form-list')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.tap(find.byKey(const Key('survey-include-crop')));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byKey(const Key('submit-farm-survey')),
      300,
      scrollable: find
          .descendant(
            of: find.byKey(const Key('survey-form-list')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.tap(find.byKey(const Key('submit-farm-survey')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Farm survey saved'), findsOneWidget);
    expect(repository.survey?.membershipId, 'membership-1');
    expect(repository.survey?.farmName, 'South farm');
    expect(repository.survey?.pincode, '207247');
    expect(repository.survey?.cropCycle, isNull);
  });
}

PartnerSession _session(PartnerRole role) => PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'partner-membership',
  organisationId: 'partner-organisation',
  role: role,
  expiresIn: '15m',
);

class _FakePromoterClubRepository implements PromoterClubRepository {
  String? redeemedMembershipId;
  String? redeemedCode;
  String? idempotencyKey;
  FarmSurveyInput? survey;

  @override
  Future<void> createFarmSurvey(FarmSurveyInput survey) async {
    this.survey = survey;
  }

  @override
  Future<List<PromoterFarmerSummary>> listAssignedFarmers() async => [_farmer];

  @override
  Future<PromoterFarmerSummary> getAssignedFarmer(String membershipId) async =>
      _farmer;

  @override
  Future<List<CropReference>> listCropReferences() async => const [
    CropReference(
      id: 'crop-1',
      code: 'WHEAT',
      nameEn: 'Wheat',
      nameHi: 'गेहूँ',
    ),
  ];

  @override
  Future<AssistedCheckoutResult> redeemBenefitToken({
    required String membershipId,
    required String code,
    required String idempotencyKey,
  }) async {
    redeemedMembershipId = membershipId;
    redeemedCode = code;
    this.idempotencyKey = idempotencyKey;
    return const AssistedCheckoutResult(
      checkoutId: 'checkout-1',
      status: 'PENDING_PAYMENT',
      clubBenefitPaise: 2500,
      farmerPayablePaise: 7500,
      productOrderId: 'order-1',
      paymentRequiredInApp: true,
    );
  }
}

final _farmer = PromoterFarmerSummary(
  assignmentId: 'assignment-1',
  membershipId: 'membership-1',
  memberNumber: 'VKC-000001',
  fullName: 'Asha Devi',
  village: 'Aliganj',
  district: 'Etah',
  pincode: '207247',
  assignedAt: DateTime.utc(2026, 8, 14),
  farms: const [
    PromoterFarm(
      id: 'farm-1',
      name: 'North farm',
      areaAcres: '2.5',
      isActive: true,
      cropCycles: [
        PromoterCropCycle(
          id: 'crop-cycle-1',
          crop: 'Wheat',
          areaAcres: '2.0',
          season: 'RABI',
          status: 'ACTIVE',
        ),
      ],
    ),
  ],
);
