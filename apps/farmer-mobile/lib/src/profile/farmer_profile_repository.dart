import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';
import 'farmer_profile.dart';

final farmerProfileRepositoryProvider = Provider<FarmerProfileRepository>(
  (ref) =>
      ApiFarmerProfileRepository(ref.watch(authenticatedApiClientProvider)),
);

/// The authenticated farmer snapshot shared by home and account surfaces.
///
/// Keeping this read in one provider prevents the personalised home header and
/// other summary modules from issuing duplicate profile requests. Mutations
/// invalidate it so the farmer's name and selected delivery location refresh
/// from the backend rather than being patched locally.
final farmerProfileProvider = FutureProvider.autoDispose<FarmerProfile>(
  (ref) => ref.watch(farmerProfileRepositoryProvider).getProfile(),
);

abstract interface class FarmerProfileRepository {
  Future<FarmerProfile> getProfile();

  Future<FarmerProfile> saveProfile(FarmerProfileInput input);
}

class ApiFarmerProfileRepository implements FarmerProfileRepository {
  const ApiFarmerProfileRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<FarmerProfile> getProfile() async =>
      FarmerProfile.fromJson(await _client.get('/farmers/me'));

  @override
  Future<FarmerProfile> saveProfile(FarmerProfileInput input) async =>
      FarmerProfile.fromJson(
        await _client.put('/farmers/me/profile', input.toJson()),
      );
}
