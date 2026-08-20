import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/earnings/partner_earnings_models.dart';
import 'package:vardhnam_partner_mobile/src/earnings/partner_earnings_repository.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_repository.dart';

void main() {
  testWidgets(
    'promoter sees backend statement totals and masked payout account',
    (tester) async {
      await tester.pumpWidget(
        PartnerApp(
          initialSession: _session,
          promoterClubRepository: _EmptyClubRepository(),
          partnerEarningsRepository: _FakeEarningsRepository(),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Kisan Club'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Earnings statement'));
      await tester.pumpAndSettle();

      expect(find.textContaining('********6789'), findsOneWidget);
      expect(find.text('₹125.50'), findsAtLeastNWidgets(2));
      expect(
        find.textContaining('Provisional earnings are not yet payable'),
        findsOneWidget,
      );
      expect(find.textContaining('Promoter commission'), findsOneWidget);
    },
  );

  testWidgets(
    'delivery partner can submit a shared payout account for verification',
    (tester) async {
      final repository = _FakeEarningsRepository(account: null);
      await tester.pumpWidget(
        PartnerApp(
          initialSession: _deliverySession,
          partnerEarningsRepository: repository,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Earnings statement'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Add payout account'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Account holder name'),
        'Deepak Driver',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Bank name'),
        'State Bank of India',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Account number'),
        '000123456789',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'IFSC code'),
        'sbin0001234',
      );
      await tester.ensureVisible(find.text('Submit for verification'));
      await tester.tap(find.text('Submit for verification'));
      await tester.pumpAndSettle();

      expect(repository.savedInput?.accountHolderName, 'Deepak Driver');
      expect(repository.savedInput?.ifscCode, 'SBIN0001234');
      expect(find.textContaining('********6789'), findsOneWidget);
      expect(find.textContaining('Pending verification'), findsOneWidget);
    },
  );
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  role: PartnerRole.promoter,
  expiresIn: '15m',
);

const _deliverySession = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  role: PartnerRole.deliveryPartner,
  expiresIn: '15m',
);

class _EmptyClubRepository implements PromoterClubRepository {
  @override
  Future<void> createFarmSurvey(FarmSurveyInput survey) =>
      throw UnimplementedError();

  @override
  Future<PromoterFarmerSummary> getAssignedFarmer(String membershipId) =>
      throw UnimplementedError();

  @override
  Future<List<PromoterFarmerSummary>> listAssignedFarmers() async => const [];

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

class _FakeEarningsRepository implements PartnerEarningsRepository {
  _FakeEarningsRepository({this.account = _verifiedAccount});

  PayoutAccountView? account;
  PayoutAccountInput? savedInput;

  @override
  Future<PayoutAccountView?> getMyPayoutAccount() async => account;

  @override
  Future<PayoutAccountView> saveMyPayoutAccount(
    PayoutAccountInput input,
  ) async {
    savedInput = input;
    return account = PayoutAccountView(
      id: 'account-1',
      accountHolderName: input.accountHolderName,
      bankName: input.bankName,
      maskedAccountNumber: '********6789',
      ifscCode: input.ifscCode,
      upiId: input.upiId,
      status: 'PENDING_VERIFICATION',
    );
  }

  @override
  Future<EarningsStatementPage> getMyStatement({
    EarningsStatus? status,
    int page = 1,
    int limit = 20,
  }) async => EarningsStatementPage(
    items: [
      EarningsEntry(
        id: 'earning-1',
        productOrderId: 'order-1',
        type: EarningsType.promoterCommission,
        amountPaise: 12550,
        status: EarningsStatus.finalised,
        eligibleAt: DateTime.utc(2026, 8, 14),
        finalizedAt: DateTime.utc(2026, 8, 14),
        createdAt: DateTime.utc(2026, 8, 1),
      ),
    ],
    page: page,
    limit: limit,
    total: 1,
    totalsByStatus: const {
      EarningsStatus.provisional: 5000,
      EarningsStatus.finalised: 12550,
      EarningsStatus.reversed: 0,
    },
  );
}

const _verifiedAccount = PayoutAccountView(
  id: 'account-1',
  accountHolderName: 'Asha Promoter',
  bankName: 'State Bank of India',
  maskedAccountNumber: '********6789',
  ifscCode: 'SBIN0001234',
  status: 'VERIFIED',
);
