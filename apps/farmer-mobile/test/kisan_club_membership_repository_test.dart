import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_membership_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_models.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test(
    'distinguishes enabled not-joined membership from disabled Club',
    () async {
      final notJoined = ApiKisanClubMembershipRepository(
        _ClubApiClient(optionalResponse: null),
      );
      final disabled = ApiKisanClubMembershipRepository(
        _ClubApiClient(
          optionalError: const AuthenticatedApiException(
            code: 'NOT_FOUND',
            message: 'Not found',
            statusCode: 404,
          ),
        ),
      );

      final enabledResult = await notJoined.getMembership();
      final disabledResult = await disabled.getMembership();

      expect(enabledResult.isEnabled, isTrue);
      expect(enabledResult.membership, isNull);
      expect(disabledResult.isEnabled, isFalse);
    },
  );

  test('parses membership and sends only backend-owned join inputs', () async {
    final client = _ClubApiClient(optionalResponse: _membershipJson);
    final repository = ApiKisanClubMembershipRepository(client);

    final lookup = await repository.getMembership();
    final joined = await repository.join(
      const KisanClubMembershipInput(
        homePincode: '302001',
        homeVillage: 'Rampura',
        homeDistrict: 'Jaipur',
        homeState: 'Rajasthan',
        termsVersion: kisanClubTermsVersion,
      ),
    );
    await repository.updateConsents(
      const KisanClubConsentInput(
        advisoryConsent: true,
        marketingConsent: false,
        preciseLocationConsent: false,
      ),
    );

    expect(lookup.membership?.status, KisanClubMembershipStatus.pendingProfile);
    expect(joined.memberNumber, 'VKC-TEST-001');
    expect(client.postBodies.single, {
      'homePincode': '302001',
      'homeVillage': 'Rampura',
      'homeDistrict': 'Jaipur',
      'homeState': 'Rajasthan',
      'termsVersion': kisanClubTermsVersion,
      'termsAccepted': true,
    });
    expect(client.patchBodies.single, {
      'advisoryConsent': true,
      'marketingConsent': false,
      'preciseLocationConsent': false,
    });
  });
}

class _ClubApiClient implements AuthenticatedApiClient {
  _ClubApiClient({this.optionalResponse, this.optionalError});

  final Map<String, Object?>? optionalResponse;
  final AuthenticatedApiException? optionalError;
  final postBodies = <Map<String, Object?>>[];
  final patchBodies = <Map<String, Object?>>[];

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) async {
    if (optionalError case final error?) throw error;
    return optionalResponse;
  }

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postBodies.add(body);
    return _membershipJson;
  }

  @override
  Future<Map<String, Object?>> patch(
    String path,
    Map<String, Object?> body,
  ) async {
    patchBodies.add(body);
    return {..._membershipJson, ...body};
  }

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> get(String path) => throw UnimplementedError();

  @override
  Future<List<Object?>> getList(String path) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

final _membershipJson = <String, Object?>{
  'id': 'club-membership-1',
  'memberNumber': 'VKC-TEST-001',
  'status': 'PENDING_PROFILE',
  'homePincode': '302001',
  'homeVillage': 'Rampura',
  'homeDistrict': 'Jaipur',
  'homeState': 'Rajasthan',
  'joinedAt': '2026-08-11T10:00:00.000Z',
  'termsVersion': kisanClubTermsVersion,
  'advisoryConsent': false,
  'marketingConsent': false,
  'preciseLocationConsent': false,
  'suspendedReason': null,
};
