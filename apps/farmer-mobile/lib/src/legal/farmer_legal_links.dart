import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

const _privacyPolicyEnvironment = String.fromEnvironment(
  'FARMER_PRIVACY_POLICY_URL',
);
const _termsEnvironment = String.fromEnvironment('FARMER_TERMS_URL');
const _accountDeletionEnvironment = String.fromEnvironment(
  'FARMER_ACCOUNT_DELETION_URL',
);

final farmerLegalLinksProvider = Provider<FarmerLegalLinks>(
  (ref) => FarmerLegalLinks.fromEnvironment(),
);

final externalLegalLinkLauncherProvider = Provider<ExternalLegalLinkLauncher>(
  (ref) => const UrlExternalLegalLinkLauncher(),
);

class FarmerLegalLinks {
  const FarmerLegalLinks({
    this.privacyPolicyUrl,
    this.termsUrl,
    this.accountDeletionUrl,
  });

  factory FarmerLegalLinks.fromEnvironment() => FarmerLegalLinks.fromValues(
    privacyPolicyUrl: _privacyPolicyEnvironment,
    termsUrl: _termsEnvironment,
    accountDeletionUrl: _accountDeletionEnvironment,
  );

  factory FarmerLegalLinks.fromValues({
    String privacyPolicyUrl = '',
    String termsUrl = '',
    String accountDeletionUrl = '',
  }) => FarmerLegalLinks(
    privacyPolicyUrl: _validPublicHttpsUriOrNull(privacyPolicyUrl),
    termsUrl: _validPublicHttpsUriOrNull(termsUrl),
    accountDeletionUrl: _validPublicHttpsUriOrNull(accountDeletionUrl),
  );

  final Uri? privacyPolicyUrl;
  final Uri? termsUrl;
  final Uri? accountDeletionUrl;
}

abstract interface class ExternalLegalLinkLauncher {
  Future<bool> launch(Uri uri);
}

class UrlExternalLegalLinkLauncher implements ExternalLegalLinkLauncher {
  const UrlExternalLegalLinkLauncher();

  @override
  Future<bool> launch(Uri uri) =>
      launchUrl(uri, mode: LaunchMode.externalApplication);
}

Uri? _validPublicHttpsUriOrNull(String value) {
  final uri = Uri.tryParse(value.trim());
  if (uri == null ||
      uri.scheme != 'https' ||
      !uri.hasAuthority ||
      uri.userInfo.isNotEmpty) {
    return null;
  }

  final host = uri.host.toLowerCase();
  if (!host.contains('.') ||
      host == 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.example') ||
      host.endsWith('.invalid')) {
    return null;
  }
  return uri;
}
