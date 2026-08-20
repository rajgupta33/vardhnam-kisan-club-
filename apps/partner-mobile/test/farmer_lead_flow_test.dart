import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/leads/farmer_lead_models.dart';
import 'package:vardhnam_partner_mobile/src/leads/farmer_lead_repository.dart';

void main() {
  testWidgets('promoter captures and contacts an own farmer lead', (
    tester,
  ) async {
    final repository = _FakeLeadRepository();
    await tester.pumpWidget(
      PartnerApp(initialSession: _session, farmerLeadRepository: repository),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Farmer leads'));
    await tester.pumpAndSettle();
    expect(find.text('No matching farmer leads.'), findsOneWidget);

    await tester.tap(find.text('Capture lead'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Farmer name'),
      'Ram Singh',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Phone number'),
      '9876543210',
    );
    await tester.ensureVisible(find.text('Save lead'));
    await tester.tap(find.text('Save lead'));
    await tester.pumpAndSettle();

    expect(find.text('Ram Singh'), findsOneWidget);
    expect(find.text('+919876543210'), findsOneWidget);
    await tester.tap(find.text('Mark contacted'));
    await tester.pumpAndSettle();

    expect(repository.items.single.status, FarmerLeadStatus.contacted);
    expect(find.text('Contacted'), findsOneWidget);

    await tester.tap(find.text('Register with farmer OTP'));
    await tester.pumpAndSettle();
    expect(find.text('Mock OTP: 123456'), findsOneWidget);
    await tester.tap(find.text('Verify and register'));
    await tester.pumpAndSettle();

    expect(repository.items.single.status, FarmerLeadStatus.converted);
    expect(find.text('Converted'), findsOneWidget);
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

class _FakeLeadRepository implements FarmerLeadRepository {
  final items = <FarmerLead>[];

  @override
  Future<FarmerLead> createLead(CreateFarmerLeadInput input) async {
    final lead = FarmerLead(
      id: 'lead-1',
      fullName: input.fullName,
      phone: '+919876543210',
      source: input.source,
      status: FarmerLeadStatus.newLead,
      cropInterests: input.cropInterests,
      createdAt: DateTime.utc(2026, 8, 15),
      updatedAt: DateTime.utc(2026, 8, 15),
    );
    items.add(lead);
    return lead;
  }

  @override
  Future<FarmerLead> convertRegisteredFarmer(String leadId) =>
      updateStatus(leadId, FarmerLeadStatus.converted);

  @override
  Future<AssistedFarmerOtpChallenge> requestAssistedRegistrationOtp(
    String leadId,
  ) async => AssistedFarmerOtpChallenge(
    expiresAt: DateTime.utc(2026, 8, 16, 12),
    mockOtpCode: '123456',
  );

  @override
  Future<FarmerLead> verifyAssistedRegistrationOtp(
    String leadId, {
    required String code,
    required String preferredLocale,
  }) => updateStatus(leadId, FarmerLeadStatus.converted);

  @override
  Future<FarmerLeadPage> listMyLeads({
    FarmerLeadStatus? status,
    int page = 1,
  }) async {
    final filtered = status == null
        ? items
        : items.where((item) => item.status == status).toList();
    return FarmerLeadPage(
      items: filtered,
      page: page,
      limit: 20,
      total: filtered.length,
    );
  }

  @override
  Future<FarmerLead> updateStatus(
    String leadId,
    FarmerLeadStatus status, {
    String? reason,
  }) async {
    final current = items.singleWhere((item) => item.id == leadId);
    final updated = FarmerLead(
      id: current.id,
      fullName: current.fullName,
      phone: current.phone,
      source: current.source,
      status: status,
      cropInterests: current.cropInterests,
      createdAt: current.createdAt,
      updatedAt: DateTime.utc(2026, 8, 15, 9),
      statusReason: reason,
    );
    items[items.indexOf(current)] = updated;
    return updated;
  }
}
