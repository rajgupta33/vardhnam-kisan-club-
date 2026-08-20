import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/leads/farmer_lead_models.dart';
import 'package:vardhnam_partner_mobile/src/leads/farmer_lead_repository.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';

void main() {
  test(
    'uses only own-scoped list and controlled create/status payloads',
    () async {
      final adapter = _LeadAdapter();
      final repository = ApiFarmerLeadRepository(
        PartnerApiClient(
          () => _session,
          () async => _session,
          () async {},
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      await repository.listMyLeads(status: FarmerLeadStatus.newLead, page: 2);
      await repository.createLead(
        const CreateFarmerLeadInput(
          fullName: 'Ram Singh',
          phone: '9876543210',
          source: FarmerLeadSource.fieldVisit,
        ),
      );
      final updated = await repository.updateStatus(
        'lead-1',
        FarmerLeadStatus.lost,
        reason: 'Not interested',
      );
      final converted = await repository.convertRegisteredFarmer('lead-1');
      final challenge = await repository.requestAssistedRegistrationOtp(
        'lead-1',
      );
      final assisted = await repository.verifyAssistedRegistrationOtp(
        'lead-1',
        code: '123456',
        preferredLocale: 'hi-IN',
      );

      expect(updated.status, FarmerLeadStatus.lost);
      expect(converted.status, FarmerLeadStatus.converted);
      expect(
        adapter.requests[0].uri.toString(),
        '/promoters/leads/me?page=2&limit=20&status=NEW',
      );
      expect(adapter.requests[1].method, 'POST');
      expect(adapter.requests[1].data, containsPair('source', 'FIELD_VISIT'));
      expect(adapter.requests[2].method, 'PATCH');
      expect(adapter.requests[2].data, {
        'status': 'LOST',
        'statusReason': 'Not interested',
      });
      expect(adapter.requests[3].method, 'POST');
      expect(adapter.requests[3].uri.path, '/promoters/leads/lead-1/convert');
      expect(challenge.mockOtpCode, '123456');
      expect(assisted.status, FarmerLeadStatus.converted);
      expect(
        adapter.requests[4].uri.path,
        '/promoters/leads/lead-1/farmer-otp/request',
      );
      expect(adapter.requests[5].data, {
        'code': '123456',
        'preferredLocale': 'hi-IN',
      });
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

class _LeadAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final status = options.data is Map
        ? (options.data as Map)['status'] as String?
        : null;
    final lead = {..._leadJson, if (status != null) 'status': status};
    final isConversion = options.uri.path.endsWith('/convert');
    final isOtpRequest = options.uri.path.endsWith('/farmer-otp/request');
    final isOtpVerify = options.uri.path.endsWith('/farmer-otp/verify');
    final data = options.method == 'GET'
        ? {
            'items': [lead],
            'page': 2,
            'limit': 20,
            'total': 21,
          }
        : isOtpRequest
        ? {'expiresAt': '2026-08-16T12:00:00.000Z', 'mockOtpCode': '123456'}
        : isConversion || isOtpVerify
        ? {
            'lead': {...lead, 'status': 'CONVERTED'},
            'farmerProfileId': 'farmer-profile-1',
          }
        : lead;
    return ResponseBody.fromString(
      jsonEncode({'data': data}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const _leadJson = <String, Object?>{
  'id': 'lead-1',
  'fullName': 'Ram Singh',
  'phone': '+919876543210',
  'source': 'FIELD_VISIT',
  'status': 'NEW',
  'village': 'Nagla',
  'district': 'Etah',
  'state': 'Uttar Pradesh',
  'pincode': '207001',
  'cropInterests': ['Wheat'],
  'notes': null,
  'statusReason': null,
  'createdAt': '2026-08-15T08:00:00.000Z',
  'updatedAt': '2026-08-15T08:00:00.000Z',
};
