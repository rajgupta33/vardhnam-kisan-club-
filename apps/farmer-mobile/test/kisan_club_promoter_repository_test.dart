import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_promoter_repository.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test('parses the farmer-safe active promoter assignment', () async {
    final client = _PromoterApiClient(_assignmentJson);
    final assignment = await ApiKisanClubPromoterRepository(client).getMine();

    expect(client.path, '/kisan-club/promoter/me');
    expect(assignment?.displayName, 'Ramesh Kumar');
    expect(assignment?.phone, '+919876543210');
    expect(assignment?.territoryDistrict, 'Etah');
  });

  test('represents an awaiting farmer with no assignment', () async {
    final assignment = await ApiKisanClubPromoterRepository(
      _PromoterApiClient(null),
    ).getMine();

    expect(assignment, isNull);
  });
}

class _PromoterApiClient implements AuthenticatedApiClient {
  _PromoterApiClient(this.response);
  final Map<String, Object?>? response;
  String? path;

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) async {
    this.path = path;
    return response;
  }

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();
  @override
  Future<Map<String, Object?>> get(String path) => throw UnimplementedError();
  @override
  Future<List<Object?>> getList(String path) => throw UnimplementedError();
  @override
  Future<Map<String, Object?>> patch(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) => throw UnimplementedError();
  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _assignmentJson = <String, Object?>{
  'id': 'assignment-1',
  'promoterUserId': 'promoter-1',
  'territoryId': 'territory-1',
  'status': 'ACTIVE',
  'assignedAt': '2026-08-12T10:00:00.000Z',
  'territory': {
    'id': 'territory-1',
    'name': 'Etah Pilot',
    'state': 'Uttar Pradesh',
    'district': 'Etah',
  },
  'promoterUser': {
    'id': 'promoter-1',
    'phone': '+919876543210',
    'profile': {'displayName': 'Ramesh Kumar'},
  },
};
