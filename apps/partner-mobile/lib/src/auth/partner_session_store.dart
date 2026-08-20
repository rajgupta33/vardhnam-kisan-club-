import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'partner_auth_models.dart';

abstract interface class PartnerSessionStore {
  Future<PartnerSession?> read();

  Future<void> write(PartnerSession session);

  Future<void> clear();
}

class SecurePartnerSessionStore implements PartnerSessionStore {
  SecurePartnerSessionStore(this._storage);

  static const _sessionKey = 'partner_auth_session_v1';
  final FlutterSecureStorage _storage;

  @override
  Future<PartnerSession?> read() async {
    final encoded = await _storage.read(key: _sessionKey);
    if (encoded == null) return null;
    try {
      final value = jsonDecode(encoded);
      if (value is! Map) throw const FormatException();
      return PartnerSession.fromJson(value.cast<String, Object?>());
    } on FormatException {
      await clear();
      return null;
    } on PartnerAuthException {
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(PartnerSession session) =>
      _storage.write(key: _sessionKey, value: jsonEncode(session.toJson()));

  @override
  Future<void> clear() => _storage.delete(key: _sessionKey);
}

class NoOpPartnerSessionStore implements PartnerSessionStore {
  const NoOpPartnerSessionStore();

  @override
  Future<PartnerSession?> read() async => null;

  @override
  Future<void> write(PartnerSession session) async {}

  @override
  Future<void> clear() async {}
}
