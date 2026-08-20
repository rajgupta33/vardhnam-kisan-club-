import 'package:shared_preferences/shared_preferences.dart';

abstract interface class LocalePreferenceStore {
  Future<String?> readLanguageCode();

  Future<void> writeLanguageCode(String languageCode);
}

class SharedPreferencesLocalePreferenceStore implements LocalePreferenceStore {
  SharedPreferencesLocalePreferenceStore(this._preferences);

  static const preferenceKey = 'preferred_language_code';

  final SharedPreferencesAsync _preferences;

  @override
  Future<String?> readLanguageCode() {
    return _preferences.getString(preferenceKey);
  }

  @override
  Future<void> writeLanguageCode(String languageCode) {
    return _preferences.setString(preferenceKey, languageCode);
  }
}

class NoOpLocalePreferenceStore implements LocalePreferenceStore {
  const NoOpLocalePreferenceStore();

  @override
  Future<String?> readLanguageCode() async => null;

  @override
  Future<void> writeLanguageCode(String languageCode) async {}
}
