import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';

void main() {
  test('parses authoritative filters and serializes selected query values', () {
    final options = MarketplaceFilterOptions.fromJson({
      'categories': ['Seeds'],
      'brands': [
        {'id': 'brand-1', 'name': 'Demo Seeds', 'slug': 'demo-seeds'},
      ],
      'cropTargets': ['Bajra'],
    });
    const query = MarketplaceProductQuery(
      pincode: '302001',
      category: 'Seeds',
      brandId: 'brand-1',
      cropTarget: 'Bajra',
    );

    expect(options.brands.single.name, 'Demo Seeds');
    expect(query.toQueryParameters(), containsPair('brandId', 'brand-1'));
    expect(query.toQueryParameters(), containsPair('cropTarget', 'Bajra'));
    expect(query.cacheKey, contains('brandId=brand-1'));
    expect(query.cacheKey, contains('cropTarget=bajra'));
  });

  test('parses product detail offer, batch and public document metadata', () {
    final detail = MarketplaceProductDetail.fromJson({
      'id': 'product-1',
      'name': 'Hybrid Bajra Seed',
      'category': 'Seeds',
      'cropTargets': ['Bajra'],
      'brand': {'id': 'brand-1', 'name': 'Demo Seeds', 'slug': 'demo-seeds'},
      'company': {'id': 'company-1', 'displayName': 'Demo Company'},
      'serviceablePincode': '302001',
      'lowestPricePaise': 120000,
      'availableQuantity': 42,
      'offerCount': 1,
      'sellerCount': 1,
      'fulfilmentModes': ['DISTRIBUTOR_FULFILLED'],
      'description': 'A public product description.',
      'variants': [
        {
          'id': 'variant-1',
          'variantName': '1 kg pack',
          'packSize': '1',
          'packUnit': 'kg',
          'mrpPaise': 125000,
        },
      ],
      'documents': [
        {
          'id': 'document-1',
          'documentType': 'SEED_LICENCE',
          'title': 'Seed licence',
          'documentNumber': 'SL-10',
          'issuedAt': '2026-01-01T00:00:00.000Z',
          'expiresAt': '2027-01-01T00:00:00.000Z',
        },
      ],
      'offers': [
        {
          'id': 'offer-1',
          'variant': {
            'id': 'variant-1',
            'variantName': '1 kg pack',
            'packSize': '1',
            'packUnit': 'kg',
            'mrpPaise': 125000,
          },
          'seller': {
            'organisationId': 'seller-1',
            'displayName': 'Jaipur Distributor',
            'legalName': 'Jaipur Distributor Private Limited',
            'gstin': '08ABCDE1234F1Z5',
          },
          'warehouse': {
            'id': 'warehouse-1',
            'name': 'Jaipur Warehouse',
            'city': 'Jaipur',
            'state': 'Rajasthan',
            'pincode': '302001',
          },
          'batch': {
            'id': 'batch-1',
            'batchNumber': 'B-2026',
            'expiryDate': '2027-06-01T00:00:00.000Z',
            'germinationPercentage': '92.5',
          },
          'sellingPricePaise': 120000,
          'minimumOrderQuantity': 1,
          'maximumOrderQuantity': 10,
          'availableQuantity': 42,
          'fulfilmentMode': 'DISTRIBUTOR_FULFILLED',
          'deliverySlaDays': 2,
        },
      ],
      'clubProgrammes': [
        {'id': 'programme-1', 'variantId': 'variant-1', 'displayPriority': 20},
      ],
    });

    expect(detail.description, 'A public product description.');
    expect(
      detail.product.offers.single.seller.legalName,
      'Jaipur Distributor Private Limited',
    );
    expect(detail.product.offers.single.batch?.batchNumber, 'B-2026');
    expect(detail.product.offers.single.batch?.germinationPercentage, '92.5');
    expect(detail.documents.single.documentNumber, 'SL-10');
    expect(detail.documents.single.expiresAt, DateTime.utc(2027));
    expect(detail.product.clubProgrammes.single.id, 'programme-1');
    expect(detail.product.clubProgrammes.single.variantId, 'variant-1');
  });
}
