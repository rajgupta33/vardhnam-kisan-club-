import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const supportedPartnerLanguageCodes = {'en', 'hi'};

abstract interface class PartnerLocaleStore {
  Future<String?> read();

  Future<void> write(String languageCode);
}

class SharedPreferencesPartnerLocaleStore implements PartnerLocaleStore {
  SharedPreferencesPartnerLocaleStore(this._preferences);

  static const preferenceKey = 'partner_preferred_language_code';
  final SharedPreferencesAsync _preferences;

  @override
  Future<String?> read() => _preferences.getString(preferenceKey);

  @override
  Future<void> write(String languageCode) =>
      _preferences.setString(preferenceKey, languageCode);
}

class NoOpPartnerLocaleStore implements PartnerLocaleStore {
  const NoOpPartnerLocaleStore();

  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String languageCode) async {}
}

final initialPartnerLocaleProvider = Provider<Locale>(
  (ref) => const Locale('en'),
);
final partnerLocaleStoreProvider = Provider<PartnerLocaleStore>(
  (ref) => const NoOpPartnerLocaleStore(),
);
final partnerLocaleControllerProvider =
    NotifierProvider<PartnerLocaleController, Locale>(
      PartnerLocaleController.new,
    );

class PartnerLocaleController extends Notifier<Locale> {
  @override
  Locale build() => ref.watch(initialPartnerLocaleProvider);

  Future<void> select(String languageCode) async {
    if (!supportedPartnerLanguageCodes.contains(languageCode)) {
      throw ArgumentError.value(languageCode, 'languageCode');
    }
    final previous = state;
    state = Locale(languageCode);
    try {
      await ref.read(partnerLocaleStoreProvider).write(languageCode);
    } on Exception {
      state = previous;
      rethrow;
    }
  }
}

Locale resolvePartnerLocale({
  required String? savedLanguageCode,
  required Locale deviceLocale,
}) {
  if (supportedPartnerLanguageCodes.contains(savedLanguageCode)) {
    return Locale(savedLanguageCode!);
  }
  if (supportedPartnerLanguageCodes.contains(deviceLocale.languageCode)) {
    return Locale(deviceLocale.languageCode);
  }
  return const Locale('en');
}
