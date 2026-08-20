import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'auth_models.dart';

abstract interface class AuthSessionStore {
  Future<AuthSession?> read();

  Future<void> write(AuthSession session);

  Future<void> clear();
}

class SecureAuthSessionStore implements AuthSessionStore {
  SecureAuthSessionStore(this._storage);

  static const _sessionKey = 'farmer_auth_session_v1';

  final FlutterSecureStorage _storage;

  @override
  Future<AuthSession?> read() async {
    final encoded = await _storage.read(key: _sessionKey);
    if (encoded == null) {
      return null;
    }
    try {
      final value = jsonDecode(encoded);
      if (value is! Map) {
        throw const FormatException('Session is not an object');
      }
      return AuthSession.fromJson(value.cast<String, Object?>());
    } on FormatException {
      await clear();
      return null;
    } on FarmerAuthException {
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(AuthSession session) {
    return _storage.write(
      key: _sessionKey,
      value: jsonEncode(session.toJson()),
    );
  }

  @override
  Future<void> clear() => _storage.delete(key: _sessionKey);
}

class NoOpAuthSessionStore implements AuthSessionStore {
  const NoOpAuthSessionStore();

  @override
  Future<AuthSession?> read() async => null;

  @override
  Future<void> write(AuthSession session) async {}

  @override
  Future<void> clear() async {}
}
