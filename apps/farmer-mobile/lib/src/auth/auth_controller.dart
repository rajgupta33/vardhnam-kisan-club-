import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_models.dart';
import 'auth_repository.dart';
import 'session_store.dart';

final initialAuthSessionProvider = Provider<AuthSession?>((ref) => null);

final farmerAuthRepositoryProvider = Provider<FarmerAuthRepository>(
  (ref) => DioFarmerAuthRepository(),
);

final authSessionStoreProvider = Provider<AuthSessionStore>(
  (ref) => const NoOpAuthSessionStore(),
);

final authSessionControllerProvider =
    NotifierProvider<AuthSessionController, AuthSession?>(
      AuthSessionController.new,
    );

class AuthSessionController extends Notifier<AuthSession?> {
  Future<AuthSession?>? _refreshInFlight;
  var _sessionGeneration = 0;

  @override
  AuthSession? build() => ref.watch(initialAuthSessionProvider);

  Future<void> accept(AuthSession session) async {
    await ref.read(authSessionStoreProvider).write(session);
    _sessionGeneration += 1;
    state = session;
  }

  Future<AuthSession?> refreshSession() {
    final existingRefresh = _refreshInFlight;
    if (existingRefresh != null) {
      return existingRefresh;
    }

    final refresh = _performRefresh();
    _refreshInFlight = refresh;
    return refresh.whenComplete(() {
      if (identical(_refreshInFlight, refresh)) {
        _refreshInFlight = null;
      }
    });
  }

  Future<AuthSession?> _performRefresh() async {
    final currentSession = state;
    if (currentSession == null) {
      return null;
    }
    final generation = _sessionGeneration;

    try {
      final refreshed = await ref
          .read(farmerAuthRepositoryProvider)
          .refresh(currentSession.refreshToken);
      if (state == null || generation != _sessionGeneration) {
        return state;
      }
      await accept(refreshed);
      return refreshed;
    } on FarmerAuthException catch (error) {
      if (error.code == 'UNAUTHENTICATED' ||
          error.code == 'INVALID_REFRESH_TOKEN') {
        await invalidate();
      }
      rethrow;
    }
  }

  Future<void> invalidate() async {
    _sessionGeneration += 1;
    await ref.read(authSessionStoreProvider).clear();
    state = null;
  }

  Future<void> logout() async {
    final currentSession = state;
    try {
      if (currentSession != null) {
        await ref
            .read(farmerAuthRepositoryProvider)
            .logout(currentSession.refreshToken);
      }
    } on Exception {
      // Logout still removes local credentials when the API is unreachable.
      // The server-side refresh token remains bounded by its expiry.
    } finally {
      await invalidate();
    }
  }
}
