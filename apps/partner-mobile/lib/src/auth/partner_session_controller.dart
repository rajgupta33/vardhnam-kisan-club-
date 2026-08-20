import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'partner_auth_models.dart';
import 'partner_auth_repository.dart';
import 'partner_session_store.dart';

final initialPartnerSessionProvider = Provider<PartnerSession?>((ref) => null);
final partnerAuthRepositoryProvider = Provider<PartnerAuthRepository>(
  (ref) => DioPartnerAuthRepository(),
);
final partnerSessionStoreProvider = Provider<PartnerSessionStore>(
  (ref) => const NoOpPartnerSessionStore(),
);
final partnerSessionControllerProvider =
    NotifierProvider<PartnerSessionController, PartnerSession?>(
      PartnerSessionController.new,
    );

class PartnerSessionController extends Notifier<PartnerSession?> {
  Future<PartnerSession?>? _refreshInFlight;
  var _generation = 0;

  @override
  PartnerSession? build() => ref.watch(initialPartnerSessionProvider);

  Future<void> accept(PartnerSession session) async {
    await ref.read(partnerSessionStoreProvider).write(session);
    _generation += 1;
    state = session;
  }

  Future<PartnerSession?> refreshSession() {
    final existing = _refreshInFlight;
    if (existing != null) return existing;
    final refresh = _performRefresh();
    _refreshInFlight = refresh;
    return refresh.whenComplete(() {
      if (identical(_refreshInFlight, refresh)) _refreshInFlight = null;
    });
  }

  Future<PartnerSession?> _performRefresh() async {
    final current = state;
    if (current == null) return null;
    final generation = _generation;
    try {
      final refreshed = await ref
          .read(partnerAuthRepositoryProvider)
          .refresh(current.refreshToken);
      if (state == null || generation != _generation) return state;
      await accept(
        refreshed.organisationName == null && current.organisationName != null
            ? refreshed.withOrganisationName(current.organisationName!)
            : refreshed,
      );
      return state;
    } on PartnerAuthException catch (error) {
      if (error.code == 'UNAUTHENTICATED' ||
          error.code == 'INVALID_REFRESH_TOKEN') {
        await invalidate();
      }
      rethrow;
    }
  }

  Future<void> invalidate() async {
    _generation += 1;
    await ref.read(partnerSessionStoreProvider).clear();
    state = null;
  }

  Future<void> logout() async {
    final current = state;
    try {
      if (current != null) {
        await ref
            .read(partnerAuthRepositoryProvider)
            .logout(current.refreshToken);
      }
    } on Exception {
      // Local credentials are removed even if server revocation is unreachable.
    } finally {
      await invalidate();
    }
  }
}
