import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_repository.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_fulfilment_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_fulfilment_repository.dart';

void main() {
  testWidgets('promoter accepts then fails own coordination with a reason', (
    tester,
  ) async {
    final fulfilment = _FakeFulfilmentRepository();
    await tester.pumpWidget(
      PartnerApp(
        initialSession: _session,
        promoterClubRepository: _EmptyClubRepository(),
        promoterFulfilmentRepository: fulfilment,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Kisan Club'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Club fulfilment'));
    await tester.pumpAndSettle();
    expect(find.text('Order ORD-1'), findsOneWidget);

    await tester.tap(find.text('Order ORD-1'));
    await tester.pumpAndSettle();
    expect(find.text('Accept assignment'), findsOneWidget);
    expect(find.text('Cancel'), findsNothing);

    await tester.tap(find.text('Accept assignment'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm action'));
    await tester.pumpAndSettle();
    expect(find.text('Mark product ready'), findsOneWidget);
    expect(fulfilment.getCount, 2);

    await tester.tap(find.text('Mark coordination failed'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm action'));
    await tester.pump();
    expect(find.text('Enter at least 3 characters.'), findsOneWidget);
    await tester.enterText(
      find.byKey(const Key('fulfilment-reason')),
      'Farmer unavailable',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm action'));
    await tester.pumpAndSettle();

    expect(find.text('Coordination: Failed'), findsOneWidget);
    expect(fulfilment.lastReason, 'Farmer unavailable');
    expect(fulfilment.getCount, 3);
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

class _EmptyClubRepository implements PromoterClubRepository {
  @override
  Future<void> createFarmSurvey(FarmSurveyInput survey) =>
      throw UnimplementedError();

  @override
  Future<List<PromoterFarmerSummary>> listAssignedFarmers() async => const [];

  @override
  Future<PromoterFarmerSummary> getAssignedFarmer(String membershipId) =>
      throw UnimplementedError();

  @override
  Future<List<CropReference>> listCropReferences() =>
      throw UnimplementedError();

  @override
  Future<AssistedCheckoutResult> redeemBenefitToken({
    required String membershipId,
    required String code,
    required String idempotencyKey,
  }) => throw UnimplementedError();
}

class _FakeFulfilmentRepository implements PromoterFulfilmentRepository {
  var status = ClubFulfilmentStatus.assigned;
  var getCount = 0;
  String? lastReason;

  ClubFulfilmentAssignment get assignment => ClubFulfilmentAssignment(
    id: 'assignment-1',
    productOrderId: 'order-1',
    mode: 'CLUB_HOME_DELIVERY',
    status: status,
    assignedAt: DateTime.utc(2026, 8, 14),
    memberNumber: 'VKC-000001',
    farmerName: 'Asha Devi',
    village: 'Aliganj',
    pincode: '207247',
    orderNumber: 'ORD-1',
    orderStatus: 'CONFIRMED',
    sellerName: 'Etah Distributor',
    farmerPayablePaise: 7500,
    failureReason: status == ClubFulfilmentStatus.failed
        ? 'Farmer unavailable'
        : null,
    history: [
      ClubFulfilmentHistory(
        status: status,
        createdAt: DateTime.utc(2026, 8, 14),
        reason: lastReason,
      ),
    ],
  );

  @override
  Future<ClubFulfilmentPage> list({
    ClubFulfilmentStatus? status,
    int page = 1,
    int limit = 20,
  }) async => ClubFulfilmentPage(
    items: [assignment],
    page: page,
    limit: limit,
    total: 1,
  );

  @override
  Future<ClubFulfilmentAssignment> get(String assignmentId) async {
    getCount += 1;
    return assignment;
  }

  @override
  Future<ClubFulfilmentAssignment> transition({
    required String assignmentId,
    required ClubFulfilmentAction action,
    String? reason,
  }) async {
    status = action.targetStatus;
    lastReason = reason;
    return assignment;
  }
}
