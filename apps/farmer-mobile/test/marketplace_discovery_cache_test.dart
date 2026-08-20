import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_discovery_cache.dart';

void main() {
  test(
    'round-trips an exact discovery query and its server snapshots',
    () async {
      final now = DateTime.utc(2026, 8, 10, 12);
      final cache = SharedPreferencesMarketplaceDiscoveryCache(
        _MemoryCacheStorage(),
        now: () => now,
      );
      const query = MarketplaceProductQuery(
        pincode: '302001',
        category: 'SEEDS',
        search: 'Bajra',
      );

      await cache.write(query, _page);
      final cached = await cache.read(query);

      expect(cached?.cachedAt, now);
      expect(cached?.page.items.single.name, 'Hybrid Bajra Seed');
      expect(cached?.page.items.single.primaryOffer?.sellingPricePaise, 120000);
    },
  );

  test('does not reuse a cache entry for a different filter', () async {
    final cache = SharedPreferencesMarketplaceDiscoveryCache(
      _MemoryCacheStorage(),
      now: () => DateTime.utc(2026, 8, 10, 12),
    );
    const savedQuery = MarketplaceProductQuery(pincode: '302001');
    const otherQuery = MarketplaceProductQuery(
      pincode: '302001',
      search: 'cotton',
    );

    await cache.write(savedQuery, _page);

    expect(await cache.read(otherQuery), isNull);
  });

  test('rejects entries older than the bounded lifetime', () async {
    var now = DateTime.utc(2026, 8, 10, 12);
    final cache = SharedPreferencesMarketplaceDiscoveryCache(
      _MemoryCacheStorage(),
      now: () => now,
    );
    const query = MarketplaceProductQuery(pincode: '302001');
    await cache.write(query, _page);

    now = now
        .add(marketplaceDiscoveryCacheLifetime)
        .add(const Duration(seconds: 1));

    expect(await cache.read(query), isNull);
  });

  test('retains only the newest bounded number of query entries', () async {
    final cache = SharedPreferencesMarketplaceDiscoveryCache(
      _MemoryCacheStorage(),
      now: () => DateTime.utc(2026, 8, 10, 12),
    );
    for (var index = 0; index <= marketplaceDiscoveryCacheEntryLimit; index++) {
      await cache.write(
        MarketplaceProductQuery(pincode: '302001', search: 'query-$index'),
        _page,
      );
    }

    expect(
      await cache.read(
        const MarketplaceProductQuery(pincode: '302001', search: 'query-0'),
      ),
      isNull,
    );
    expect(
      await cache.read(
        const MarketplaceProductQuery(pincode: '302001', search: 'query-5'),
      ),
      isNotNull,
    );
  });
}

class _MemoryCacheStorage implements MarketplaceDiscoveryCacheStorage {
  String? value;

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String value) async => this.value = value;
}

final _page = MarketplaceProductPage.fromJson({
  'items': [
    {
      'id': 'product-1',
      'name': 'Hybrid Bajra Seed',
      'category': 'SEEDS',
      'cropTargets': ['Bajra'],
      'brand': {'id': 'brand-1', 'name': 'Demo Seeds', 'slug': 'demo-seeds'},
      'company': {'id': 'company-1', 'displayName': 'Demo Company'},
      'serviceablePincode': '302001',
      'lowestPricePaise': 120000,
      'availableQuantity': 42,
      'offerCount': 1,
      'sellerCount': 1,
      'fulfilmentModes': ['DISTRIBUTOR_FULFILLED'],
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
          'batch': null,
          'sellingPricePaise': 120000,
          'minimumOrderQuantity': 1,
          'maximumOrderQuantity': 10,
          'availableQuantity': 42,
          'fulfilmentMode': 'DISTRIBUTOR_FULFILLED',
          'deliverySlaDays': 2,
        },
      ],
    },
  ],
  'page': 1,
  'limit': 20,
  'total': 1,
});
