import 'dart:async';
import 'dart:convert';
import 'dart:io';

const marketplaceApiBaseUrl = String.fromEnvironment(
  'MARKETPLACE_API_BASE_URL',
  defaultValue: 'http://127.0.0.1:3001',
);

abstract class MarketplaceProductRepository {
  Future<MarketplaceProductPage> listProducts(MarketplaceProductQuery query);

  Future<MarketplaceFilterOptions> getFilterOptions(String pincode);

  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  });
}

class MarketplaceHttpProductRepository implements MarketplaceProductRepository {
  MarketplaceHttpProductRepository({
    String baseUrl = marketplaceApiBaseUrl,
    HttpClient? httpClient,
  }) : _baseUri = Uri.parse(baseUrl.endsWith('/') ? baseUrl : '$baseUrl/'),
       _httpClient = httpClient ?? HttpClient();

  final Uri _baseUri;
  final HttpClient _httpClient;

  @override
  Future<MarketplaceFilterOptions> getFilterOptions(String pincode) async {
    final uri = _baseUri
        .resolve('api/v1/marketplace/products/filter-options')
        .replace(queryParameters: {'pincode': pincode});
    final request = await _httpClient
        .getUrl(uri)
        .timeout(const Duration(seconds: 10));
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    final response = await request.close().timeout(const Duration(seconds: 20));
    final payload = _decodeJson(await utf8.decodeStream(response));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MarketplaceApiException(
        _errorMessage(payload) ??
            'Marketplace filter request failed with status ${response.statusCode}',
        code: _errorCode(payload),
        statusCode: response.statusCode,
      );
    }
    final envelope = _asMap(payload, 'response envelope');
    return MarketplaceFilterOptions.fromJson(_asMap(envelope['data'], 'data'));
  }

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async {
    final uri = _baseUri
        .resolve('api/v1/marketplace/products')
        .replace(queryParameters: query.toQueryParameters());
    final request = await _httpClient
        .getUrl(uri)
        .timeout(const Duration(seconds: 10));
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');

    final response = await request.close().timeout(const Duration(seconds: 20));
    final body = await utf8.decodeStream(response);
    final payload = _decodeJson(body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MarketplaceApiException(
        _errorMessage(payload) ??
            'Marketplace request failed with status ${response.statusCode}',
        code: _errorCode(payload),
        statusCode: response.statusCode,
      );
    }

    final envelope = _asMap(payload, 'response envelope');
    return MarketplaceProductPage.fromJson(_asMap(envelope['data'], 'data'));
  }

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) async {
    final uri = _baseUri
        .resolve('api/v1/marketplace/products/$productId')
        .replace(queryParameters: {'pincode': pincode});
    final request = await _httpClient
        .getUrl(uri)
        .timeout(const Duration(seconds: 10));
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');

    final response = await request.close().timeout(const Duration(seconds: 20));
    final body = await utf8.decodeStream(response);
    final payload = _decodeJson(body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MarketplaceApiException(
        _errorMessage(payload) ??
            'Marketplace request failed with status ${response.statusCode}',
        code: _errorCode(payload),
        statusCode: response.statusCode,
      );
    }

    final envelope = _asMap(payload, 'response envelope');
    return MarketplaceProductDetail.fromJson(_asMap(envelope['data'], 'data'));
  }
}

class MarketplaceProductQuery {
  const MarketplaceProductQuery({
    required this.pincode,
    this.category,
    this.search,
    this.brandId,
    this.cropTarget,
    this.page = 1,
    this.limit = 20,
  });

  final String pincode;
  final String? category;
  final String? search;
  final String? brandId;
  final String? cropTarget;
  final int page;
  final int limit;

  String get cacheKey {
    final normalized = toQueryParameters();
    return [
          'pincode',
          'category',
          'brandId',
          'cropTarget',
          'q',
          'page',
          'limit',
        ]
        .map((key) => '$key=${normalized[key]?.trim().toLowerCase() ?? ''}')
        .join('&');
  }

  Map<String, String> toQueryParameters() {
    return {
      'pincode': pincode,
      'page': page.toString(),
      'limit': limit.toString(),
      if (category != null && category!.trim().isNotEmpty)
        'category': category!.trim(),
      if (search != null && search!.trim().isNotEmpty) 'q': search!.trim(),
      if (brandId != null && brandId!.trim().isNotEmpty)
        'brandId': brandId!.trim(),
      if (cropTarget != null && cropTarget!.trim().isNotEmpty)
        'cropTarget': cropTarget!.trim(),
    };
  }
}

class MarketplaceFilterOptions {
  const MarketplaceFilterOptions({
    required this.categories,
    required this.brands,
    required this.cropTargets,
  });

  factory MarketplaceFilterOptions.fromJson(Map<String, Object?> json) =>
      MarketplaceFilterOptions(
        categories: _asList(
          json['categories'],
          'categories',
        ).map((item) => _asString(item, 'category')).toList(growable: false),
        brands: _asList(json['brands'], 'brands')
            .map(
              (item) => MarketplaceBrandSummary.fromJson(_asMap(item, 'brand')),
            )
            .toList(growable: false),
        cropTargets: _asList(
          json['cropTargets'],
          'cropTargets',
        ).map((item) => _asString(item, 'crop target')).toList(growable: false),
      );

  final List<String> categories;
  final List<MarketplaceBrandSummary> brands;
  final List<String> cropTargets;
}

class MarketplaceProductPage {
  const MarketplaceProductPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory MarketplaceProductPage.fromJson(Map<String, Object?> json) {
    return MarketplaceProductPage(
      items: _asList(json['items'], 'items')
          .map(
            (item) => MarketplaceProductSummary.fromJson(
              _asMap(item, 'marketplace product'),
            ),
          )
          .toList(growable: false),
      page: _asInt(json['page'], 'page'),
      limit: _asInt(json['limit'], 'limit'),
      total: _asInt(json['total'], 'total'),
    );
  }

  final List<MarketplaceProductSummary> items;
  final int page;
  final int limit;
  final int total;

  Map<String, Object?> toJson() => {
    'items': items.map((item) => item.toJson()).toList(growable: false),
    'page': page,
    'limit': limit,
    'total': total,
  };
}

class MarketplaceProductSummary {
  const MarketplaceProductSummary({
    required this.id,
    required this.name,
    required this.category,
    required this.cropTargets,
    required this.brand,
    required this.company,
    required this.serviceablePincode,
    required this.lowestPricePaise,
    required this.availableQuantity,
    required this.offerCount,
    required this.sellerCount,
    required this.fulfilmentModes,
    required this.offers,
    this.primaryImageUrl,
    this.clubProgrammes = const [],
  });

  factory MarketplaceProductSummary.fromJson(Map<String, Object?> json) {
    return MarketplaceProductSummary(
      id: _asString(json['id'], 'id'),
      name: _asString(json['name'], 'name'),
      category: _asString(json['category'], 'category'),
      cropTargets: _asList(
        json['cropTargets'],
        'cropTargets',
      ).map((crop) => _asString(crop, 'crop target')).toList(growable: false),
      brand: MarketplaceBrandSummary.fromJson(_asMap(json['brand'], 'brand')),
      company: MarketplaceCompanySummary.fromJson(
        _asMap(json['company'], 'company'),
      ),
      serviceablePincode: _asString(
        json['serviceablePincode'],
        'serviceablePincode',
      ),
      lowestPricePaise: _asInt(json['lowestPricePaise'], 'lowestPricePaise'),
      availableQuantity: _asInt(json['availableQuantity'], 'availableQuantity'),
      offerCount: _asInt(json['offerCount'], 'offerCount'),
      sellerCount: _asInt(json['sellerCount'], 'sellerCount'),
      fulfilmentModes: _asList(json['fulfilmentModes'], 'fulfilmentModes')
          .map((mode) => _asString(mode, 'fulfilment mode'))
          .toList(growable: false),
      offers: _asList(json['offers'], 'offers')
          .map(
            (offer) => MarketplaceOfferSummary.fromJson(_asMap(offer, 'offer')),
          )
          .toList(growable: false),
      // Null whenever the catalogue has no pack shot yet; the image frame shows
      // a labelled placeholder rather than a broken image.
      primaryImageUrl: json['primaryImageUrl'] as String?,
      clubProgrammes: json['clubProgrammes'] == null
          ? const []
          : _asList(json['clubProgrammes'], 'clubProgrammes')
                .map(
                  (programme) => MarketplaceClubProgramme.fromJson(
                    _asMap(programme, 'club programme'),
                  ),
                )
                .toList(growable: false),
    );
  }

  final String id;
  final String name;
  final String category;
  final List<String> cropTargets;

  /// Stable URL for the product pack shot, or null when there is none.
  ///
  /// The backend deliberately returns a non-expiring URL that redirects to
  /// short-lived storage, so a cached discovery page keeps working.
  final String? primaryImageUrl;
  final MarketplaceBrandSummary brand;
  final MarketplaceCompanySummary company;
  final String serviceablePincode;
  final int lowestPricePaise;
  final int availableQuantity;
  final int offerCount;
  final int sellerCount;
  final List<String> fulfilmentModes;
  final List<MarketplaceOfferSummary> offers;
  final List<MarketplaceClubProgramme> clubProgrammes;

  MarketplaceOfferSummary? get primaryOffer =>
      offers.isEmpty ? null : offers.first;

  Map<String, Object?> toJson() => {
    'id': id,
    'name': name,
    'category': category,
    'cropTargets': cropTargets,
    // Persisted into the offline discovery cache; safe because the URL is
    // stable rather than a signature that would expire inside the cache window.
    if (primaryImageUrl != null) 'primaryImageUrl': primaryImageUrl,
    'brand': brand.toJson(),
    'company': company.toJson(),
    'serviceablePincode': serviceablePincode,
    'lowestPricePaise': lowestPricePaise,
    'availableQuantity': availableQuantity,
    'offerCount': offerCount,
    'sellerCount': sellerCount,
    'fulfilmentModes': fulfilmentModes,
    'offers': offers.map((offer) => offer.toJson()).toList(growable: false),
    if (clubProgrammes.isNotEmpty)
      'clubProgrammes': clubProgrammes
          .map((programme) => programme.toJson())
          .toList(growable: false),
  };
}

class MarketplaceClubProgramme {
  const MarketplaceClubProgramme({
    required this.id,
    required this.variantId,
    required this.displayPriority,
  });

  factory MarketplaceClubProgramme.fromJson(Map<String, Object?> json) =>
      MarketplaceClubProgramme(
        id: _asString(json['id'], 'clubProgramme.id'),
        variantId: _asNullableString(
          json['variantId'],
          'clubProgramme.variantId',
        ),
        displayPriority: _asInt(
          json['displayPriority'],
          'clubProgramme.displayPriority',
        ),
      );

  final String id;
  final String? variantId;
  final int displayPriority;

  Map<String, Object?> toJson() => {
    'id': id,
    'variantId': variantId,
    'displayPriority': displayPriority,
  };
}

class MarketplaceProductDetail {
  const MarketplaceProductDetail({
    required this.product,
    required this.description,
    required this.variants,
    required this.documents,
  });

  factory MarketplaceProductDetail.fromJson(Map<String, Object?> json) {
    return MarketplaceProductDetail(
      product: MarketplaceProductSummary.fromJson(json),
      description: _asNullableString(json['description'], 'description'),
      variants: _asList(json['variants'], 'variants')
          .map(
            (variant) =>
                MarketplaceVariantSummary.fromJson(_asMap(variant, 'variant')),
          )
          .toList(growable: false),
      documents: _asList(json['documents'], 'documents')
          .map(
            (document) => MarketplaceProductDocument.fromJson(
              _asMap(document, 'document'),
            ),
          )
          .toList(growable: false),
    );
  }

  final MarketplaceProductSummary product;
  final String? description;
  final List<MarketplaceVariantSummary> variants;
  final List<MarketplaceProductDocument> documents;
}

class MarketplaceProductDocument {
  const MarketplaceProductDocument({
    required this.id,
    required this.documentType,
    required this.title,
    required this.documentNumber,
    required this.issuedAt,
    required this.expiresAt,
  });

  factory MarketplaceProductDocument.fromJson(Map<String, Object?> json) {
    return MarketplaceProductDocument(
      id: _asString(json['id'], 'document.id'),
      documentType: _asString(json['documentType'], 'document.documentType'),
      title: _asNullableString(json['title'], 'document.title'),
      documentNumber: _asNullableString(
        json['documentNumber'],
        'document.documentNumber',
      ),
      issuedAt: _asNullableDateTime(json['issuedAt'], 'document.issuedAt'),
      expiresAt: _asNullableDateTime(json['expiresAt'], 'document.expiresAt'),
    );
  }

  final String id;
  final String documentType;
  final String? title;
  final String? documentNumber;
  final DateTime? issuedAt;
  final DateTime? expiresAt;
}

class MarketplaceBrandSummary {
  const MarketplaceBrandSummary({
    required this.id,
    required this.name,
    required this.slug,
  });

  factory MarketplaceBrandSummary.fromJson(Map<String, Object?> json) {
    return MarketplaceBrandSummary(
      id: _asString(json['id'], 'brand.id'),
      name: _asString(json['name'], 'brand.name'),
      slug: _asString(json['slug'], 'brand.slug'),
    );
  }

  final String id;
  final String name;
  final String slug;

  Map<String, Object?> toJson() => {'id': id, 'name': name, 'slug': slug};
}

class MarketplaceCompanySummary {
  const MarketplaceCompanySummary({
    required this.id,
    required this.displayName,
  });

  factory MarketplaceCompanySummary.fromJson(Map<String, Object?> json) {
    return MarketplaceCompanySummary(
      id: _asString(json['id'], 'company.id'),
      displayName: _asString(json['displayName'], 'company.displayName'),
    );
  }

  final String id;
  final String displayName;

  Map<String, Object?> toJson() => {'id': id, 'displayName': displayName};
}

class MarketplaceOfferSummary {
  const MarketplaceOfferSummary({
    required this.id,
    required this.variant,
    required this.seller,
    required this.warehouse,
    required this.batch,
    required this.sellingPricePaise,
    required this.minimumOrderQuantity,
    required this.maximumOrderQuantity,
    required this.availableQuantity,
    required this.fulfilmentMode,
    required this.deliverySlaDays,
  });

  factory MarketplaceOfferSummary.fromJson(Map<String, Object?> json) {
    return MarketplaceOfferSummary(
      id: _asString(json['id'], 'offer.id'),
      variant: MarketplaceVariantSummary.fromJson(
        _asMap(json['variant'], 'variant'),
      ),
      seller: MarketplaceSellerSummary.fromJson(
        _asMap(json['seller'], 'seller'),
      ),
      warehouse: MarketplaceWarehouseSummary.fromJson(
        _asMap(json['warehouse'], 'warehouse'),
      ),
      batch: json['batch'] == null
          ? null
          : MarketplaceBatchSummary.fromJson(_asMap(json['batch'], 'batch')),
      sellingPricePaise: _asInt(json['sellingPricePaise'], 'sellingPricePaise'),
      minimumOrderQuantity: _asInt(
        json['minimumOrderQuantity'],
        'minimumOrderQuantity',
      ),
      maximumOrderQuantity: _asNullableInt(
        json['maximumOrderQuantity'],
        'maximumOrderQuantity',
      ),
      availableQuantity: _asInt(json['availableQuantity'], 'availableQuantity'),
      fulfilmentMode: _asString(json['fulfilmentMode'], 'fulfilmentMode'),
      deliverySlaDays: _asNullableInt(
        json['deliverySlaDays'],
        'deliverySlaDays',
      ),
    );
  }

  final String id;
  final MarketplaceVariantSummary variant;
  final MarketplaceSellerSummary seller;
  final MarketplaceWarehouseSummary warehouse;
  final MarketplaceBatchSummary? batch;
  final int sellingPricePaise;
  final int minimumOrderQuantity;
  final int? maximumOrderQuantity;
  final int availableQuantity;
  final String fulfilmentMode;
  final int? deliverySlaDays;

  Map<String, Object?> toJson() => {
    'id': id,
    'variant': variant.toJson(),
    'seller': seller.toJson(),
    'warehouse': warehouse.toJson(),
    'batch': batch?.toJson(),
    'sellingPricePaise': sellingPricePaise,
    'minimumOrderQuantity': minimumOrderQuantity,
    'maximumOrderQuantity': maximumOrderQuantity,
    'availableQuantity': availableQuantity,
    'fulfilmentMode': fulfilmentMode,
    'deliverySlaDays': deliverySlaDays,
  };
}

class MarketplaceBatchSummary {
  const MarketplaceBatchSummary({
    required this.id,
    required this.batchNumber,
    required this.expiryDate,
    required this.germinationPercentage,
  });

  factory MarketplaceBatchSummary.fromJson(Map<String, Object?> json) {
    return MarketplaceBatchSummary(
      id: _asString(json['id'], 'batch.id'),
      batchNumber: _asString(json['batchNumber'], 'batch.batchNumber'),
      expiryDate: _asNullableDateTime(json['expiryDate'], 'batch.expiryDate'),
      germinationPercentage: _asNullableString(
        json['germinationPercentage'],
        'batch.germinationPercentage',
      ),
    );
  }

  final String id;
  final String batchNumber;
  final DateTime? expiryDate;
  final String? germinationPercentage;

  Map<String, Object?> toJson() => {
    'id': id,
    'batchNumber': batchNumber,
    'expiryDate': expiryDate?.toIso8601String(),
    'germinationPercentage': germinationPercentage,
  };
}

class MarketplaceVariantSummary {
  const MarketplaceVariantSummary({
    required this.id,
    required this.variantName,
    required this.packSize,
    required this.packUnit,
    required this.mrpPaise,
  });

  factory MarketplaceVariantSummary.fromJson(Map<String, Object?> json) {
    return MarketplaceVariantSummary(
      id: _asString(json['id'], 'variant.id'),
      variantName: _asString(json['variantName'], 'variant.variantName'),
      packSize: _asString(json['packSize'], 'variant.packSize'),
      packUnit: _asString(json['packUnit'], 'variant.packUnit'),
      mrpPaise: _asNullableInt(json['mrpPaise'], 'variant.mrpPaise'),
    );
  }

  final String id;
  final String variantName;
  final String packSize;
  final String packUnit;
  final int? mrpPaise;

  String get displayLabel => '$variantName - $packSize $packUnit';

  Map<String, Object?> toJson() => {
    'id': id,
    'variantName': variantName,
    'packSize': packSize,
    'packUnit': packUnit,
    'mrpPaise': mrpPaise,
  };
}

class MarketplaceSellerSummary {
  const MarketplaceSellerSummary({
    required this.organisationId,
    required this.displayName,
    required this.legalName,
    required this.gstin,
  });

  factory MarketplaceSellerSummary.fromJson(Map<String, Object?> json) {
    return MarketplaceSellerSummary(
      organisationId: _asString(
        json['organisationId'],
        'seller.organisationId',
      ),
      displayName: _asString(json['displayName'], 'seller.displayName'),
      legalName: _asString(json['legalName'], 'seller.legalName'),
      gstin: _asNullableString(json['gstin'], 'seller.gstin'),
    );
  }

  final String organisationId;
  final String displayName;
  final String legalName;
  final String? gstin;

  Map<String, Object?> toJson() => {
    'organisationId': organisationId,
    'displayName': displayName,
    'legalName': legalName,
    'gstin': gstin,
  };
}

class MarketplaceWarehouseSummary {
  const MarketplaceWarehouseSummary({
    required this.id,
    required this.name,
    required this.city,
    required this.state,
    required this.pincode,
  });

  factory MarketplaceWarehouseSummary.fromJson(Map<String, Object?> json) {
    return MarketplaceWarehouseSummary(
      id: _asString(json['id'], 'warehouse.id'),
      name: _asString(json['name'], 'warehouse.name'),
      city: _asString(json['city'], 'warehouse.city'),
      state: _asString(json['state'], 'warehouse.state'),
      pincode: _asString(json['pincode'], 'warehouse.pincode'),
    );
  }

  final String id;
  final String name;
  final String city;
  final String state;
  final String pincode;

  Map<String, Object?> toJson() => {
    'id': id,
    'name': name,
    'city': city,
    'state': state,
    'pincode': pincode,
  };
}

class MarketplaceApiException implements Exception {
  const MarketplaceApiException(this.message, {this.code, this.statusCode});

  final String message;
  final String? code;
  final int? statusCode;

  @override
  String toString() => message;
}

Object? _decodeJson(String body) {
  final trimmedBody = body.trim();
  if (trimmedBody.isEmpty) {
    return null;
  }

  return jsonDecode(trimmedBody);
}

String? _errorMessage(Object? payload) {
  if (payload is! Map<String, Object?>) {
    return null;
  }
  final error = payload['error'];
  if (error is! Map<String, Object?>) {
    return null;
  }
  final message = error['message'];
  return message is String ? message : null;
}

String? _errorCode(Object? payload) {
  if (payload is! Map<String, Object?>) return null;
  final error = payload['error'];
  if (error is! Map<String, Object?>) return null;
  final code = error['code'];
  return code is String ? code : null;
}

Map<String, Object?> _asMap(Object? value, String fieldName) {
  if (value is Map<String, Object?>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, value) => MapEntry(key.toString(), value));
  }
  throw FormatException('Expected $fieldName to be an object');
}

List<Object?> _asList(Object? value, String fieldName) {
  if (value is List<Object?>) {
    return value;
  }
  if (value is List) {
    return List<Object?>.from(value);
  }
  throw FormatException('Expected $fieldName to be a list');
}

String _asString(Object? value, String fieldName) {
  if (value is String) {
    return value;
  }
  throw FormatException('Expected $fieldName to be a string');
}

String? _asNullableString(Object? value, String fieldName) {
  if (value == null || value is String) {
    return value as String?;
  }
  throw FormatException('Expected $fieldName to be a string or null');
}

int _asInt(Object? value, String fieldName) {
  if (value is int) {
    return value;
  }
  throw FormatException('Expected $fieldName to be an integer');
}

int? _asNullableInt(Object? value, String fieldName) {
  if (value == null || value is int) {
    return value as int?;
  }
  throw FormatException('Expected $fieldName to be an integer or null');
}

DateTime? _asNullableDateTime(Object? value, String fieldName) {
  if (value == null) {
    return null;
  }
  if (value is String) {
    return DateTime.tryParse(value) ??
        (throw FormatException('Expected $fieldName to be an ISO date'));
  }
  throw FormatException('Expected $fieldName to be a string or null');
}
