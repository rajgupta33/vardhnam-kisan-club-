import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_controller.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_repository.dart';
import 'package:vardhnam_farmer_mobile/src/auth/session_store.dart';

void main() {
  test(
    'serializes concurrent refreshes and persists the rotated session',
    () async {
      final repository = _RefreshAuthRepository();
      final store = _RecordingSessionStore();
      final container = ProviderContainer(
        overrides: [
          initialAuthSessionProvider.overrideWithValue(_initialSession),
          farmerAuthRepositoryProvider.overrideWithValue(repository),
          authSessionStoreProvider.overrideWithValue(store),
        ],
      );
      addTearDown(container.dispose);
      final controller = container.read(authSessionControllerProvider.notifier);

      final refreshes = [
        controller.refreshSession(),
        controller.refreshSession(),
      ];
      expect(repository.refreshCount, 1);
      repository.refreshCompleter.complete(_refreshedSession);
      final sessions = await Future.wait(refreshes);

      expect(sessions, [_refreshedSession, _refreshedSession]);
      expect(container.read(authSessionControllerProvider), _refreshedSession);
      expect(store.writes, [_refreshedSession]);
    },
  );

  test('clears local credentials when refresh is unauthenticated', () async {
    final repository = _RefreshAuthRepository(
      refreshError: const FarmerAuthException(
        code: 'UNAUTHENTICATED',
        message: 'Refresh token expired.',
      ),
    );
    final store = _RecordingSessionStore();
    final container = ProviderContainer(
      overrides: [
        initialAuthSessionProvider.overrideWithValue(_initialSession),
        farmerAuthRepositoryProvider.overrideWithValue(repository),
        authSessionStoreProvider.overrideWithValue(store),
      ],
    );
    addTearDown(container.dispose);

    await expectLater(
      container.read(authSessionControllerProvider.notifier).refreshSession(),
      throwsA(isA<FarmerAuthException>()),
    );

    expect(container.read(authSessionControllerProvider), isNull);
    expect(store.clearCount, 1);
  });
}

class _RefreshAuthRepository implements FarmerAuthRepository {
  _RefreshAuthRepository({this.refreshError});

  final FarmerAuthException? refreshError;
  final refreshCompleter = Completer<AuthSession>();
  var refreshCount = 0;

  @override
  Future<AuthSession> refresh(String refreshToken) {
    refreshCount += 1;
    final error = refreshError;
    if (error != null) return Future.error(error);
    return refreshCompleter.future;
  }

  @override
  Future<void> logout(String refreshToken) async {}

  @override
  Future<OtpChallengeResult> requestOtp(String phone) =>
      throw UnimplementedError();

  @override
  Future<FarmerOtpVerificationResult> verifyOtp({
    required String phone,
    required String code,
    required String fullName,
    required String preferredLocale,
  }) => throw UnimplementedError();

  @override
  Future<AuthSession> selectFarmerMembership({
    required String selectionToken,
    required String organisationId,
  }) => throw UnimplementedError();
}

class _RecordingSessionStore implements AuthSessionStore {
  final writes = <AuthSession>[];
  var clearCount = 0;

  @override
  Future<void> clear() async => clearCount += 1;

  @override
  Future<AuthSession?> read() async => null;

  @override
  Future<void> write(AuthSession session) async => writes.add(session);
}

const _initialSession = AuthSession(
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  membershipId: 'membership-1',
  organisationId: 'organisation-1',
  role: 'FARMER',
  expiresIn: '15m',
);

const _refreshedSession = AuthSession(
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  membershipId: 'membership-1',
  organisationId: 'organisation-1',
  role: 'FARMER',
  expiresIn: '15m',
);
