import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'src/app.dart';
import 'src/auth/partner_auth_models.dart';
import 'src/auth/partner_auth_repository.dart';
import 'src/auth/partner_session_store.dart';
import 'src/localization/partner_locale_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final localeStore = SharedPreferencesPartnerLocaleStore(
    SharedPreferencesAsync(),
  );
  String? savedLanguageCode;
  try {
    savedLanguageCode = await localeStore.read();
  } on Exception {
    // Preference failure must not prevent sign-in.
  }
  final initialLocale = resolvePartnerLocale(
    savedLanguageCode: savedLanguageCode,
    deviceLocale: WidgetsBinding.instance.platformDispatcher.locale,
  );

  final sessionStore = SecurePartnerSessionStore(const FlutterSecureStorage());
  PartnerSession? initialSession;
  try {
    initialSession = await sessionStore.read();
  } on Exception {
    // Secure-storage availability is handled by the signed-out experience.
  }

  runApp(
    PartnerApp(
      initialLocale: initialLocale,
      localeStore: localeStore,
      authRepository: DioPartnerAuthRepository(),
      sessionStore: sessionStore,
      initialSession: initialSession,
    ),
  );
}
