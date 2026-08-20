import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/advisory/advisory_repository.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test('parses localized farmer advisory page and marks it read', () async {
    final client = _Client();
    final repository = ApiAdvisoryRepository(client);
    final page = await repository.list();
    await repository.markRead(page.items.single.id);
    expect(page.items.single.title, 'Irrigate at flowering');
    expect(page.items.single.cropName, 'Mustard');
    expect(page.items.single.cropCycleId, 'cycle-1');
    expect(page.items.single.status, AdvisoryStatus.delivered);
    expect(client.posts, ['/advisory/me/advisory-1/read']);
  });
}

class _Client implements AuthenticatedApiClient {
  final posts = <String>[];
  @override
  Future<Map<String, Object?>> get(String path) async =>
      path.startsWith('/advisory/me?') ? _page : throw UnimplementedError();
  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    posts.add(path);
    return const {'id': 'advisory-1'};
  }

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();
  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) =>
      throw UnimplementedError();
  @override
  Future<List<Object?>> getList(String path) => throw UnimplementedError();
  @override
  Future<Map<String, Object?>> patch(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _page = <String, Object?>{
  'items': [
    {
      'id': 'advisory-1',
      'status': 'DELIVERED',
      'dueOn': '2026-08-13',
      'category': 'IRRIGATION',
      'title': 'Irrigate at flowering',
      'body': 'Check soil moisture before irrigation.',
      'sourceReference': 'KVK Etah bulletin',
      'ruleVersion': 1,
      'readAt': null,
      'cropCycle': {
        'id': 'cycle-1',
        'cropName': 'Mustard',
        'varietyName': null,
      },
    },
  ],
  'page': 1,
  'limit': 20,
  'total': 1,
};
