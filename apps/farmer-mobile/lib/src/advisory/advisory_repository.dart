import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';

final advisoryRepositoryProvider = Provider<AdvisoryRepository>(
  (ref) => ApiAdvisoryRepository(ref.watch(authenticatedApiClientProvider)),
);

enum AdvisoryStatus { pending, delivered, read, dismissed }

class FarmerAdvisory {
  const FarmerAdvisory({
    required this.id,
    required this.status,
    required this.dueOn,
    required this.category,
    required this.title,
    required this.body,
    required this.ruleVersion,
    required this.cropCycleId,
    required this.cropName,
    this.varietyName,
    this.sourceReference,
    this.readAt,
  });

  factory FarmerAdvisory.fromJson(Map<String, Object?> json) {
    final crop = _map(json, 'cropCycle');
    return FarmerAdvisory(
      id: _string(json, 'id'),
      status: AdvisoryStatus.values.byName(
        _string(json, 'status').toLowerCase(),
      ),
      dueOn: DateTime.parse(_string(json, 'dueOn')),
      category: _string(json, 'category'),
      title: _string(json, 'title'),
      body: _string(json, 'body'),
      sourceReference: json['sourceReference'] as String?,
      ruleVersion: json['ruleVersion'] as int,
      cropCycleId: _string(crop, 'id'),
      cropName: _string(crop, 'cropName'),
      varietyName: crop['varietyName'] as String?,
      readAt: json['readAt'] is String
          ? DateTime.parse(json['readAt']! as String).toUtc()
          : null,
    );
  }

  final String id;
  final AdvisoryStatus status;
  final DateTime dueOn;
  final String category;
  final String title;
  final String body;
  final String? sourceReference;
  final int ruleVersion;
  final String cropCycleId;
  final String cropName;
  final String? varietyName;
  final DateTime? readAt;
}

class FarmerAdvisoryPage {
  const FarmerAdvisoryPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });
  factory FarmerAdvisoryPage.fromJson(Map<String, Object?> json) =>
      FarmerAdvisoryPage(
        items: (json['items'] as List<Object?>)
            .map(
              (item) => FarmerAdvisory.fromJson(
                (item! as Map).cast<String, Object?>(),
              ),
            )
            .toList(growable: false),
        page: json['page'] as int,
        limit: json['limit'] as int,
        total: json['total'] as int,
      );
  final List<FarmerAdvisory> items;
  final int page;
  final int limit;
  final int total;
}

abstract interface class AdvisoryRepository {
  Future<FarmerAdvisoryPage> list({int page = 1, int limit = 20});
  Future<FarmerAdvisory> get(String id);
  Future<void> markRead(String id);
  Future<void> dismiss(String id);
}

class ApiAdvisoryRepository implements AdvisoryRepository {
  const ApiAdvisoryRepository(this._client);
  final AuthenticatedApiClient _client;
  @override
  Future<FarmerAdvisoryPage> list({int page = 1, int limit = 20}) async =>
      FarmerAdvisoryPage.fromJson(
        await _client.get('/advisory/me?page=$page&limit=$limit'),
      );
  @override
  Future<FarmerAdvisory> get(String id) async => FarmerAdvisory.fromJson(
    await _client.get('/advisory/me/${Uri.encodeComponent(id)}'),
  );
  @override
  Future<void> markRead(String id) async {
    await _client.post(
      '/advisory/me/${Uri.encodeComponent(id)}/read',
      const {},
    );
  }

  @override
  Future<void> dismiss(String id) async {
    await _client.post(
      '/advisory/me/${Uri.encodeComponent(id)}/dismiss',
      const {},
    );
  }
}

Map<String, Object?> _map(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! Map) {
    throw FormatException('Advisory response is missing $key.');
  }
  return value.cast<String, Object?>();
}

String _string(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Advisory response is missing $key.');
  }
  return value;
}
