import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_benefit_token_repository.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test('issues a token once and lists only safe token metadata', () async {
    final client = _TokenApiClient();
    final repository = ApiKisanClubBenefitTokenRepository(client);

    final issued = await repository.issue(offerId: 'offer-1', quantity: 2);
    final page = await repository.list();
    await repository.list(
      status: KisanClubBenefitTokenStatus.redeemed,
      page: 2,
      limit: 5,
    );

    expect(issued.code, 'VKC-A1B2C3D4-782165');
    expect(issued.status, KisanClubBenefitTokenStatus.issued);
    expect(page.items.single.code, isNull);
    expect(page.items.single.quotedFarmerPayablePaise, 18000);
    expect(client.postPath, '/kisan-club/benefit-tokens');
    expect(client.postBody, {'offerId': 'offer-1', 'quantity': 2});
    expect(client.getPaths, [
      '/kisan-club/benefit-tokens/me?page=1&limit=20',
      '/kisan-club/benefit-tokens/me?page=2&limit=5&status=REDEEMED',
    ]);
  });
}

class _TokenApiClient implements AuthenticatedApiClient {
  String? postPath;
  Map<String, Object?>? postBody;
  final getPaths = <String>[];

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPath = path;
    postBody = body;
    return {..._tokenJson, 'code': 'VKC-A1B2C3D4-782165'};
  }

  @override
  Future<Map<String, Object?>> get(String path) async {
    getPaths.add(path);
    return {
      'items': [_tokenJson],
      'page': 1,
      'limit': 20,
      'total': 1,
    };
  }

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();

  @override
  Future<List<Object?>> getList(String path) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> patch(String path, Map<String, Object?> body) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _tokenJson = <String, Object?>{
  'id': 'token-1',
  'tokenReference': 'A1B2C3D4',
  'membershipId': 'membership-1',
  'benefitRuleId': 'rule-1',
  'offerId': 'offer-1',
  'promoterUserId': 'promoter-1',
  'quantity': 2,
  'quotedUnitPricePaise': 10000,
  'quotedBenefitPaise': 2000,
  'quotedFarmerPayablePaise': 18000,
  'status': 'ISSUED',
  'expiresAt': '2026-08-15T10:00:00.000Z',
  'consumedAt': null,
  'productOrderId': null,
  'product': {'id': 'product-1', 'name': 'Wheat Seed'},
  'variant': {'id': 'variant-1', 'name': '1 kg pack'},
  'seller': {'id': 'seller-1', 'name': 'Etah Distributor'},
  'createdAt': '2026-08-12T10:00:00.000Z',
  'updatedAt': '2026-08-12T10:00:00.000Z',
};
