import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'farmer_lead_models.dart';

final farmerLeadRepositoryProvider = Provider<FarmerLeadRepository>((ref) {
  return ApiFarmerLeadRepository(ref.read(partnerApiClientProvider));
});

abstract interface class FarmerLeadRepository {
  Future<FarmerLeadPage> listMyLeads({FarmerLeadStatus? status, int page = 1});
  Future<FarmerLead> createLead(CreateFarmerLeadInput input);
  Future<FarmerLead> updateStatus(
    String leadId,
    FarmerLeadStatus status, {
    String? reason,
  });
  Future<FarmerLead> convertRegisteredFarmer(String leadId);
  Future<AssistedFarmerOtpChallenge> requestAssistedRegistrationOtp(
    String leadId,
  );
  Future<FarmerLead> verifyAssistedRegistrationOtp(
    String leadId, {
    required String code,
    required String preferredLocale,
  });
}

class ApiFarmerLeadRepository implements FarmerLeadRepository {
  ApiFarmerLeadRepository(this._client);
  final PartnerApiClient _client;

  @override
  Future<FarmerLeadPage> listMyLeads({
    FarmerLeadStatus? status,
    int page = 1,
  }) async {
    final uri = Uri(
      path: '/promoters/leads/me',
      queryParameters: {
        'page': '$page',
        'limit': '20',
        if (status != null) 'status': status.apiValue,
      },
    );
    return FarmerLeadPage.fromJson(await _client.get(uri.toString()));
  }

  @override
  Future<FarmerLead> createLead(CreateFarmerLeadInput input) async =>
      FarmerLead.fromJson(
        await _client.post('/promoters/leads', input.toJson()),
      );

  @override
  Future<FarmerLead> updateStatus(
    String leadId,
    FarmerLeadStatus status, {
    String? reason,
  }) async => FarmerLead.fromJson(
    await _client.patch('/promoters/leads/$leadId', {
      'status': status.apiValue,
      if (reason != null) 'statusReason': reason,
    }),
  );

  @override
  Future<FarmerLead> convertRegisteredFarmer(String leadId) async {
    final response = await _client.post(
      '/promoters/leads/$leadId/convert',
      const {},
    );
    return FarmerLead.fromJson(
      (response['lead'] as Map).cast<String, Object?>(),
    );
  }

  @override
  Future<AssistedFarmerOtpChallenge> requestAssistedRegistrationOtp(
    String leadId,
  ) async => AssistedFarmerOtpChallenge.fromJson(
    await _client.post('/promoters/leads/$leadId/farmer-otp/request', const {}),
  );

  @override
  Future<FarmerLead> verifyAssistedRegistrationOtp(
    String leadId, {
    required String code,
    required String preferredLocale,
  }) async {
    final response = await _client.post(
      '/promoters/leads/$leadId/farmer-otp/verify',
      {'code': code, 'preferredLocale': preferredLocale},
    );
    return FarmerLead.fromJson(
      (response['lead'] as Map).cast<String, Object?>(),
    );
  }
}
