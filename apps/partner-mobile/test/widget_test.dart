import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_repository.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_partner_profile.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_partner_profile_repository.dart';

void main() {
  for (final testCase in <(PartnerRole, String)>[
    (PartnerRole.promoter, 'Promoter workspace'),
    (PartnerRole.salesPartner, 'Sales partner workspace'),
    (PartnerRole.serviceProvider, 'Service provider workspace'),
    (PartnerRole.deliveryPartner, 'Delivery partner workspace'),
  ]) {
    testWidgets('routes ${testCase.$1.apiValue} to only its workspace', (
      tester,
    ) async {
      await tester.pumpWidget(
        PartnerApp(
          initialSession: _session(testCase.$1),
          deliveryPartnerProfileRepository:
              testCase.$1 == PartnerRole.deliveryPartner
              ? _FakeDeliveryProfileRepository()
              : null,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(testCase.$2), findsNWidgets(2));
      for (final other in <String>[
        'Promoter workspace',
        'Sales partner workspace',
        'Service provider workspace',
        'Delivery partner workspace',
      ].where((label) => label != testCase.$2)) {
        expect(find.text(other), findsNothing);
      }
    });
  }

  testWidgets('OTP login selects one supported partner context', (
    tester,
  ) async {
    final repository = _FakePartnerAuthRepository();
    await tester.pumpWidget(PartnerApp(authRepository: repository));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('partner-phone')),
      '9876543210',
    );
    await tester.tap(find.text('Request OTP'));
    await tester.pumpAndSettle();
    expect(repository.requestedPhone, '+919876543210');

    await tester.enterText(find.byKey(const Key('partner-otp')), '123456');
    await tester.tap(find.text('Verify and continue'));
    await tester.pumpAndSettle();

    expect(find.text('Select workspace'), findsOneWidget);
    expect(find.text('Etah field team'), findsOneWidget);
    expect(find.text('Farmer context'), findsNothing);

    await tester.tap(find.text('Etah field team'));
    await tester.pumpAndSettle();

    expect(find.text('Promoter workspace'), findsNWidgets(2));
    expect(repository.selectedOrganisationId, 'org-promoter');
  });
}

class _FakeDeliveryProfileRepository
    implements DeliveryPartnerProfileRepository {
  @override
  Future<DeliveryPartnerProfile> getMyProfile() async =>
      const DeliveryPartnerProfile(
        userId: 'delivery-user',
        organisationId: 'delivery-organisation',
        availability: DeliveryPartnerAvailability.offline,
      );

  @override
  Future<DeliveryPartnerProfile> updateAvailability(
    DeliveryPartnerAvailability availability,
  ) async => DeliveryPartnerProfile(
    userId: 'delivery-user',
    organisationId: 'delivery-organisation',
    availability: availability,
  );
}

PartnerSession _session(PartnerRole role) => PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  organisationName: 'Test organisation',
  role: role,
  expiresIn: '15m',
);

class _FakePartnerAuthRepository implements PartnerAuthRepository {
  String? requestedPhone;
  String? selectedOrganisationId;

  @override
  Future<OtpChallenge> requestOtp(String phone) async {
    requestedPhone = phone;
    return OtpChallenge(expiresAt: DateTime.utc(2030), mockOtpCode: '123456');
  }

  @override
  Future<PartnerVerificationResult> verifyOtp({
    required String phone,
    required String code,
  }) async => const PartnerSelectionRequired(
    selectionToken: 'selection',
    candidates: [
      PartnerMembershipCandidate(
        organisationId: 'org-promoter',
        organisationName: 'Etah field team',
        role: PartnerRole.promoter,
      ),
    ],
  );

  @override
  Future<PartnerSession> selectMembership({
    required String selectionToken,
    required PartnerMembershipCandidate candidate,
  }) async {
    selectedOrganisationId = candidate.organisationId;
    return _session(
      candidate.role,
    ).withOrganisationName(candidate.organisationName);
  }

  @override
  Future<PartnerSession> refresh(String refreshToken) async =>
      _session(PartnerRole.promoter);

  @override
  Future<void> logout(String refreshToken) async {}
}
