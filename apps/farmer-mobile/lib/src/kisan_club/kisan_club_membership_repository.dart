import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';
import 'kisan_club_models.dart';

const kisanClubTermsVersion = '2026-08-11';

final kisanClubMembershipRepositoryProvider =
    Provider<KisanClubMembershipRepository>(
      (ref) => ApiKisanClubMembershipRepository(
        ref.watch(authenticatedApiClientProvider),
      ),
    );

final kisanClubMembershipProvider =
    FutureProvider.autoDispose<KisanClubMembershipAvailability>((ref) {
      return ref.watch(kisanClubMembershipRepositoryProvider).getMembership();
    });

abstract interface class KisanClubMembershipRepository {
  Future<KisanClubMembershipAvailability> getMembership();

  Future<KisanClubMembership> join(KisanClubMembershipInput input);

  Future<KisanClubMembership> updateConsents(KisanClubConsentInput input);
}

class ApiKisanClubMembershipRepository
    implements KisanClubMembershipRepository {
  const ApiKisanClubMembershipRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<KisanClubMembershipAvailability> getMembership() async {
    try {
      final json = await _client.getOptionalMap('/kisan-club/membership/me');
      return KisanClubMembershipAvailability.enabled(
        json == null ? null : KisanClubMembership.fromJson(json),
      );
    } on AuthenticatedApiException catch (error) {
      if (error.statusCode == 404 && error.code == 'NOT_FOUND') {
        return const KisanClubMembershipAvailability.disabled();
      }
      rethrow;
    }
  }

  @override
  Future<KisanClubMembership> join(KisanClubMembershipInput input) async =>
      KisanClubMembership.fromJson(
        await _client.post('/kisan-club/membership', input.toJson()),
      );

  @override
  Future<KisanClubMembership> updateConsents(
    KisanClubConsentInput input,
  ) async {
    if (!input.hasSelection) {
      throw ArgumentError('At least one Kisan Club consent is required.');
    }
    return KisanClubMembership.fromJson(
      await _client.patch('/kisan-club/membership/me/consents', input.toJson()),
    );
  }
}
