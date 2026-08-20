import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

const _supportPhoneEnvironment = String.fromEnvironment('FARMER_SUPPORT_PHONE');
const _supportWhatsAppEnvironment = String.fromEnvironment(
  'FARMER_SUPPORT_WHATSAPP',
);

final supportContactConfigurationProvider =
    Provider<SupportContactConfiguration>(
      (ref) => SupportContactConfiguration.fromEnvironment(),
    );

final externalSupportLauncherProvider = Provider<ExternalSupportLauncher>(
  (ref) => const UrlExternalSupportLauncher(),
);

class SupportContactConfiguration {
  const SupportContactConfiguration({this.phone, this.whatsApp});

  factory SupportContactConfiguration.fromEnvironment() =>
      SupportContactConfiguration(
        phone: _validE164OrNull(_supportPhoneEnvironment),
        whatsApp: _validE164OrNull(_supportWhatsAppEnvironment),
      );

  final String? phone;
  final String? whatsApp;

  bool get isConfigured => phone != null || whatsApp != null;

  Uri? get phoneUri => phone == null ? null : Uri(scheme: 'tel', path: phone);

  Uri? whatsAppUri(String message) {
    final number = whatsApp;
    if (number == null) return null;
    return Uri.https('wa.me', number.substring(1), {'text': message});
  }
}

abstract interface class ExternalSupportLauncher {
  Future<bool> launch(Uri uri);
}

class UrlExternalSupportLauncher implements ExternalSupportLauncher {
  const UrlExternalSupportLauncher();

  @override
  Future<bool> launch(Uri uri) =>
      launchUrl(uri, mode: LaunchMode.externalApplication);
}

String? _validE164OrNull(String value) {
  final trimmed = value.trim();
  return RegExp(r'^\+[1-9][0-9]{7,14}$').hasMatch(trimmed) ? trimmed : null;
}
