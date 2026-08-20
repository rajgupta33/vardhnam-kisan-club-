import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_models.dart';
import 'package:vardhnam_partner_mobile/src/leads/farmer_lead_models.dart';
import 'package:vardhnam_partner_mobile/src/leads/farmer_lead_repository.dart';
import 'package:vardhnam_partner_mobile/src/surveys/promoter_survey_repository.dart';

void main() {
  testWidgets('promoter records a farm survey for a converted non-Club lead', (
    tester,
  ) async {
    final surveys = _FakeSurveyRepository();
    await tester.pumpWidget(
      PartnerApp(
        initialSession: _session,
        farmerLeadRepository: _ConvertedLeadRepository(),
        promoterSurveyRepository: surveys,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Farmer leads'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Record farm survey'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('survey-farm-name')),
      'North field',
    );
    await tester.enterText(find.byKey(const Key('survey-farm-area')), '2');
    await tester.drag(
      find.byKey(const Key('survey-form-list')),
      const Offset(0, -500),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('survey-include-crop')));
    await tester.pumpAndSettle();
    await tester.drag(
      find.byKey(const Key('survey-form-list')),
      const Offset(0, -500),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('submit-farm-survey')));
    await tester.tap(find.byKey(const Key('submit-farm-survey')));
    await tester.pumpAndSettle();

    expect(surveys.farmerProfileId, 'farmer-profile');
    expect(surveys.survey?.pincode, '207001');
    expect(
      find.text('Farm survey saved and added to the farmer\'s record.'),
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

class _ConvertedLeadRepository implements FarmerLeadRepository {
  static final lead = FarmerLead(
    id: 'lead',
    fullName: 'Ram Singh',
    phone: '+919876543210',
    source: FarmerLeadSource.fieldVisit,
    status: FarmerLeadStatus.converted,
    cropInterests: const ['Wheat'],
    createdAt: DateTime.utc(2026, 8, 16),
    updatedAt: DateTime.utc(2026, 8, 16),
    village: 'Nagla',
    district: 'Etah',
    state: 'Uttar Pradesh',
    pincode: '207001',
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

class _FakeSurveyRepository implements PromoterSurveyRepository {
  String? farmerProfileId;
  FarmSurveyInput? survey;

  @override
  Future<List<CropReference>> listCropReferences() async => const [];

  @override
  Future<void> createSurvey({
    required String farmerProfileId,
    required FarmSurveyInput survey,
  }) async {
    this.farmerProfileId = farmerProfileId;
    this.survey = survey;
  }
}
