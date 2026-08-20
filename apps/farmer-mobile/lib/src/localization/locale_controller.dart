import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'locale_preferences.dart';

const supportedLanguageCodes = {'en', 'hi'};

final initialLocaleProvider = Provider<Locale>((ref) => const Locale('en'));

final localePreferenceStoreProvider = Provider<LocalePreferenceStore>(
  (ref) => const NoOpLocalePreferenceStore(),
);

final localeControllerProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);

class LocaleController extends Notifier<Locale> {
  @override
  Locale build() => ref.watch(initialLocaleProvider);

  Future<void> selectLanguage(String languageCode) async {
    if (!supportedLanguageCodes.contains(languageCode)) {
      throw ArgumentError.value(
        languageCode,
        'languageCode',
        'Unsupported farmer-app language',
      );
    }

    if (state.languageCode == languageCode) {
      await ref
          .read(localePreferenceStoreProvider)
          .writeLanguageCode(languageCode);
      return;
    }

    final previousLocale = state;
    state = Locale(languageCode);
    try {
      await ref
          .read(localePreferenceStoreProvider)
          .writeLanguageCode(languageCode);
    } on Exception {
      state = previousLocale;
      rethrow;
    }
  }
}

Locale resolveInitialLocale({
  required String? savedLanguageCode,
  required Locale deviceLocale,
}) {
  if (savedLanguageCode != null &&
      supportedLanguageCodes.contains(savedLanguageCode)) {
    return Locale(savedLanguageCode);
  }

  if (supportedLanguageCodes.contains(deviceLocale.languageCode)) {
    return Locale(deviceLocale.languageCode);
  }

  return const Locale('en');
}
