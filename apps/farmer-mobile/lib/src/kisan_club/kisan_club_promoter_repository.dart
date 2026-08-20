import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';

final kisanClubPromoterRepositoryProvider =
    Provider<KisanClubPromoterRepository>(
      (ref) => ApiKisanClubPromoterRepository(
        ref.watch(authenticatedApiClientProvider),
      ),
    );

class KisanClubPromoterAssignment {
  const KisanClubPromoterAssignment({
    required this.id,
    required this.promoterUserId,
    required this.assignedAt,
    this.displayName,
    this.phone,
    this.territoryName,
    this.territoryDistrict,
    this.territoryState,
  });

  factory KisanClubPromoterAssignment.fromJson(Map<String, Object?> json) {
    final promoter = _requiredMap(json, 'promoterUser');
    final profile = promoter['profile'];
    final territory = json['territory'];
    return KisanClubPromoterAssignment(
      id: _requiredString(json, 'id'),
      promoterUserId: _requiredString(json, 'promoterUserId'),
      assignedAt: DateTime.parse(_requiredString(json, 'assignedAt')).toUtc(),
      displayName: profile is Map<String, Object?>
          ? profile['displayName'] as String?
          : null,
      phone: promoter['phone'] as String?,
      territoryName: territory is Map<String, Object?>
          ? territory['name'] as String?
          : null,
      territoryDistrict: territory is Map<String, Object?>
          ? territory['district'] as String?
          : null,
      territoryState: territory is Map<String, Object?>
          ? territory['state'] as String?
          : null,
    );
  }

  final String id;
  final String promoterUserId;
  final DateTime assignedAt;
  final String? displayName;
  final String? phone;
  final String? territoryName;
  final String? territoryDistrict;
  final String? territoryState;
}

abstract interface class KisanClubPromoterRepository {
  Future<KisanClubPromoterAssignment?> getMine();
}

class ApiKisanClubPromoterRepository implements KisanClubPromoterRepository {
  const ApiKisanClubPromoterRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<KisanClubPromoterAssignment?> getMine() async {
    final json = await _client.getOptionalMap('/kisan-club/promoter/me');
    return json == null ? null : KisanClubPromoterAssignment.fromJson(json);
  }
}

Map<String, Object?> _requiredMap(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! Map<String, Object?>) {
    throw FormatException('Kisan Club promoter response is missing $key.');
  }
  return value;
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Kisan Club promoter response is missing $key.');
  }
  return value;
}
