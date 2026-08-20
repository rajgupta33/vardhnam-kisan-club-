import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';

final kisanClubBenefitTokenRepositoryProvider =
    Provider<KisanClubBenefitTokenRepository>(
      (ref) => ApiKisanClubBenefitTokenRepository(
        ref.watch(authenticatedApiClientProvider),
      ),
    );

enum KisanClubBenefitTokenStatus {
  issued,
  redeemed,
  expired,
  cancelled;

  String get apiValue => switch (this) {
    issued => 'ISSUED',
    redeemed => 'REDEEMED',
    expired => 'EXPIRED',
    cancelled => 'CANCELLED',
  };

  factory KisanClubBenefitTokenStatus.fromApi(String value) => switch (value) {
    'ISSUED' => issued,
    'REDEEMED' => redeemed,
    'EXPIRED' => expired,
    'CANCELLED' => cancelled,
    _ => throw FormatException(
      'Unknown Kisan Club benefit token status: $value',
    ),
  };
}

class KisanClubBenefitToken {
  const KisanClubBenefitToken({
    required this.id,
    required this.tokenReference,
    required this.quantity,
    required this.quotedUnitPricePaise,
    required this.quotedBenefitPaise,
    required this.quotedFarmerPayablePaise,
    required this.status,
    required this.expiresAt,
    required this.productName,
    required this.variantName,
    required this.sellerName,
    required this.createdAt,
    this.code,
    this.productOrderId,
  });

  factory KisanClubBenefitToken.fromJson(Map<String, Object?> json) {
    final product = _requiredMap(json, 'product');
    final variant = _requiredMap(json, 'variant');
    final seller = _requiredMap(json, 'seller');
    return KisanClubBenefitToken(
      id: _requiredString(json, 'id'),
      tokenReference: _requiredString(json, 'tokenReference'),
      quantity: _requiredInt(json, 'quantity'),
      quotedUnitPricePaise: _requiredInt(json, 'quotedUnitPricePaise'),
      quotedBenefitPaise: _requiredInt(json, 'quotedBenefitPaise'),
      quotedFarmerPayablePaise: _requiredInt(json, 'quotedFarmerPayablePaise'),
      status: KisanClubBenefitTokenStatus.fromApi(
        _requiredString(json, 'status'),
      ),
      expiresAt: DateTime.parse(_requiredString(json, 'expiresAt')).toUtc(),
      productName: _requiredString(product, 'name'),
      variantName: _requiredString(variant, 'name'),
      sellerName: _requiredString(seller, 'name'),
      createdAt: DateTime.parse(_requiredString(json, 'createdAt')).toUtc(),
      code: json['code'] as String?,
      productOrderId: json['productOrderId'] as String?,
    );
  }

  final String id;
  final String tokenReference;
  final int quantity;
  final int quotedUnitPricePaise;
  final int quotedBenefitPaise;
  final int quotedFarmerPayablePaise;
  final KisanClubBenefitTokenStatus status;
  final DateTime expiresAt;
  final String productName;
  final String variantName;
  final String sellerName;
  final DateTime createdAt;
  final String? code;
  final String? productOrderId;
}

class KisanClubBenefitTokenPage {
  const KisanClubBenefitTokenPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory KisanClubBenefitTokenPage.fromJson(Map<String, Object?> json) {
    final rawItems = json['items'];
    if (rawItems is! List<Object?>) {
      throw const FormatException('Benefit token response is missing items.');
    }
    return KisanClubBenefitTokenPage(
      items: rawItems
          .map(
            (item) =>
                KisanClubBenefitToken.fromJson(item! as Map<String, Object?>),
          )
          .toList(growable: false),
      page: _requiredInt(json, 'page'),
      limit: _requiredInt(json, 'limit'),
      total: _requiredInt(json, 'total'),
    );
  }

  final List<KisanClubBenefitToken> items;
  final int page;
  final int limit;
  final int total;
}

abstract interface class KisanClubBenefitTokenRepository {
  Future<KisanClubBenefitToken> issue({
    required String offerId,
    required int quantity,
  });

  Future<KisanClubBenefitTokenPage> list({
    KisanClubBenefitTokenStatus? status,
    int page = 1,
    int limit = 20,
  });
}

class ApiKisanClubBenefitTokenRepository
    implements KisanClubBenefitTokenRepository {
  const ApiKisanClubBenefitTokenRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<KisanClubBenefitToken> issue({
    required String offerId,
    required int quantity,
  }) async => KisanClubBenefitToken.fromJson(
    await _client.post('/kisan-club/benefit-tokens', {
      'offerId': offerId,
      'quantity': quantity,
    }),
  );

  @override
  Future<KisanClubBenefitTokenPage> list({
    KisanClubBenefitTokenStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'limit': '$limit',
      if (status != null) 'status': status.apiValue,
    };
    return KisanClubBenefitTokenPage.fromJson(
      await _client.get(
        Uri(
          path: '/kisan-club/benefit-tokens/me',
          queryParameters: query,
        ).toString(),
      ),
    );
  }
}

Map<String, Object?> _requiredMap(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! Map<String, Object?>) {
    throw FormatException('Kisan Club benefit token is missing $key.');
  }
  return value;
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Kisan Club benefit token is missing $key.');
  }
  return value;
}

int _requiredInt(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int) {
    throw FormatException('Kisan Club benefit token is missing $key.');
  }
  return value;
}
