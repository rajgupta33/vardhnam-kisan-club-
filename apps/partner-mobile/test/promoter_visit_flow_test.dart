import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/leads/farmer_lead_models.dart';
import 'package:vardhnam_partner_mobile/src/leads/farmer_lead_repository.dart';
import 'package:vardhnam_partner_mobile/src/visits/promoter_visit_models.dart';
import 'package:vardhnam_partner_mobile/src/visits/promoter_visit_repository.dart';

void main() {
  testWidgets('promoter explicitly records a converted-farmer visit', (
    tester,
  ) async {
    final visits = _FakeVisitRepository();
    await tester.pumpWidget(
      PartnerApp(
        initialSession: _session,
        farmerLeadRepository: _LeadRepository(),
        promoterVisitRepository: visits,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Farmer leads'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Record visit'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('visit-notes')),
      'Discussed the next seed order',
    );
    await tester.tap(find.byKey(const Key('save-visit')));
    await tester.pumpAndSettle();

    expect(visits.input?.farmerProfileId, 'farmer-profile');
    expect(visits.input?.farmerLeadId, isNull);
    expect(visits.input?.locationProof, isNull);
    expect(visits.input?.notes, 'Discussed the next seed order');
    expect(find.text('Visit recorded.'), findsOneWidget);
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

class _LeadRepository implements FarmerLeadRepository {
  static final lead = FarmerLead(
    id: 'lead',
    fullName: 'Ram Singh',
    phone: '+919876543210',
    source: FarmerLeadSource.fieldVisit,
    status: FarmerLeadStatus.converted,
    cropInterests: const [],
    createdAt: DateTime.utc(2026, 8, 16),
    updatedAt: DateTime.utc(2026, 8, 16),
    convertedFarmerProfileId: 'farmer-profile',
  );

  @override
  Future<FarmerLeadPage> listMyLeads({
    FarmerLeadStatus? status,
    int page = 1,
  }) async => FarmerLeadPage(items: [lead], page: 1, limit: 20, total: 1);
  @override
  Future<FarmerLead> createLead(CreateFarmerLeadInput input) =>
      throw UnimplementedError();
  @override
  Future<FarmerLead> updateStatus(
    String leadId,
    FarmerLeadStatus status, {
    String? reason,
  }) => throw UnimplementedError();
  @override
  Future<FarmerLead> convertRegisteredFarmer(String leadId) =>
      throw UnimplementedError();
  @override
  Future<AssistedFarmerOtpChallenge> requestAssistedRegistrationOtp(
    String leadId,
  ) => throw UnimplementedError();
  @override
  Future<FarmerLead> verifyAssistedRegistrationOtp(
    String leadId, {
    required String code,
    required String preferredLocale,
  }) => throw UnimplementedError();
}

class _FakeVisitRepository implements PromoterVisitRepository {
  CreatePromoterVisitInput? input;

  @override
  Future<PromoterVisit> create(CreatePromoterVisitInput input) async {
    this.input = input;
    return PromoterVisit(
      id: 'visit',
      purpose: input.purpose,
      occurredAt: input.occurredAt,
      locationStatus: 'NOT_REQUESTED',
      targetName: 'Ram Singh',
      notes: input.notes,
    );
  }

  @override
  Future<PromoterVisitPage> listMine({int page = 1}) async =>
      const PromoterVisitPage(items: [], total: 0);
}
