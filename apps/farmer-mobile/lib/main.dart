import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'src/app.dart';
import 'src/auth/auth_models.dart';
import 'src/auth/auth_repository.dart';
import 'src/auth/session_store.dart';
import 'src/localization/locale_controller.dart';
import 'src/localization/locale_preferences.dart';
import 'src/marketplace/marketplace_discovery_cache.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final localePreferences = SharedPreferencesLocalePreferenceStore(
    SharedPreferencesAsync(),
  );
  String? savedLanguageCode;
  var localePreferenceReadSucceeded = false;
  try {
    savedLanguageCode = await localePreferences.readLanguageCode();
    localePreferenceReadSucceeded = true;
  } on Exception {
    // A preference read must not prevent the farmer from opening the app.
  }

  final initialLocale = resolveInitialLocale(
    savedLanguageCode: savedLanguageCode,
    deviceLocale: WidgetsBinding.instance.platformDispatcher.locale,
  );
  final authRepository = DioFarmerAuthRepository();
  final authSessionStore = SecureAuthSessionStore(const FlutterSecureStorage());
  AuthSession? initialSession;
  try {
    initialSession = await authSessionStore.read();
  } on Exception {
    // Secure-storage availability is handled by the signed-out experience.
  }

  runApp(
    FarmerApp(
      initialLocale: initialLocale,
      requiresLanguageChoice:
          localePreferenceReadSucceeded &&
          !supportedLanguageCodes.contains(savedLanguageCode),
      localePreferenceStore: localePreferences,
      authRepository: authRepository,
      authSessionStore: authSessionStore,
      initialSession: initialSession,
      marketplaceDiscoveryCache: SharedPreferencesMarketplaceDiscoveryCache(
        SharedPreferencesMarketplaceDiscoveryCacheStorage(
          SharedPreferencesAsync(),
        ),
      ),
    ),
  );
}
