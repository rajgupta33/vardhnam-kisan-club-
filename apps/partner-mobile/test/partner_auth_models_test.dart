import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';

void main() {
  test('accepts only partner roles in a session', () {
    expect(
      PartnerSession.fromJson(_sessionJson('DELIVERY_PARTNER')).role,
      PartnerRole.deliveryPartner,
    );
    expect(
      () => PartnerSession.fromJson(_sessionJson('FARMER')),
      throwsA(isA<PartnerAuthException>()),
    );
    expect(
      () => PartnerSession.fromJson(_sessionJson('ADMIN')),
      throwsA(isA<PartnerAuthException>()),
    );
  });

  test('filters non-partner membership selection candidates', () {
    final result = PartnerSelectionRequired.fromJson({
      'selectionToken': 'selection-token',
      'candidates': [
        {
          'organisationId': 'farmer-org',
          'organisationName': 'Farmer context',
          'role': 'FARMER',
        },
        {
          'organisationId': 'partner-org',
          'organisationName': 'Partner context',
          'role': 'PROMOTER',
        },
      ],
    });

    expect(result.candidates, hasLength(1));
    expect(result.candidates.single.organisationId, 'partner-org');
    expect(result.candidates.single.role, PartnerRole.promoter);
  });
}

Map<String, Object?> _sessionJson(String role) => {
  'accessToken': 'access',
  'refreshToken': 'refresh',
  'membershipId': 'membership',
  'organisationId': 'organisation',
  'role': role,
  'expiresIn': '15m',
};
