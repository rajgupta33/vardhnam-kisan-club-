import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';

void main() {
  test('membership selection exposes only farmer candidates', () {
    final selection = FarmerMembershipSelectionRequired.fromJson({
      'membershipSelectionRequired': true,
      'selectionToken': 'selection-token',
      'candidates': [
        {
          'organisationId': 'farmer-1',
          'organisationName': 'Jaipur Farmers',
          'role': 'FARMER',
        },
        {
          'organisationId': 'company-1',
          'organisationName': 'Private Company Context',
          'role': 'COMPANY_OWNER',
        },
        {
          'organisationId': 'farmer-2',
          'organisationName': 'Ajmer Farmers',
          'role': 'FARMER',
        },
      ],
    });

    expect(selection.candidates.map((candidate) => candidate.organisationId), [
      'farmer-1',
      'farmer-2',
    ]);
  });

  test('membership selection rejects fewer than two farmer candidates', () {
    expect(
      () => FarmerMembershipSelectionRequired.fromJson({
        'membershipSelectionRequired': true,
        'selectionToken': 'selection-token',
        'candidates': [
          {
            'organisationId': 'farmer-1',
            'organisationName': 'Jaipur Farmers',
            'role': 'FARMER',
          },
          {
            'organisationId': 'company-1',
            'organisationName': 'Private Company Context',
            'role': 'COMPANY_OWNER',
          },
        ],
      }),
      throwsA(
        isA<FarmerAuthException>().having(
          (error) => error.code,
          'code',
          'INVALID_AUTH_RESPONSE',
        ),
      ),
    );
  });
}
