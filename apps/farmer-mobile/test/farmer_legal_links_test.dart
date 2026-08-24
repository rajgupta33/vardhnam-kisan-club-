import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/legal/farmer_legal_links.dart';

void main() {
  test('accepts public HTTPS legal links', () {
    final links = FarmerLegalLinks.fromValues(
      privacyPolicyUrl: 'https://www.vardhnamagrotech.com/privacy',
      termsUrl: 'https://legal.vardhnamagrotech.com/terms',
      accountDeletionUrl: 'https://support.vardhnamagrotech.com/delete-account',
    );

    expect(links.privacyPolicyUrl?.path, '/privacy');
    expect(links.termsUrl?.path, '/terms');
    expect(links.accountDeletionUrl?.path, '/delete-account');
  });

  test('rejects unsafe and placeholder legal links', () {
    final links = FarmerLegalLinks.fromValues(
      privacyPolicyUrl: 'http://vardhnamagrotech.com/privacy',
      termsUrl: 'https://localhost/terms',
      accountDeletionUrl: 'https://user:secret@vardhnamagrotech.com/delete',
    );

    expect(links.privacyPolicyUrl, isNull);
    expect(links.termsUrl, isNull);
    expect(links.accountDeletionUrl, isNull);
  });

  test('rejects reserved placeholder domains', () {
    final links = FarmerLegalLinks.fromValues(
      privacyPolicyUrl: 'https://vardhnam.invalid/privacy',
      termsUrl: 'https://vardhnam.example/terms',
    );

    expect(links.privacyPolicyUrl, isNull);
    expect(links.termsUrl, isNull);
  });
}
