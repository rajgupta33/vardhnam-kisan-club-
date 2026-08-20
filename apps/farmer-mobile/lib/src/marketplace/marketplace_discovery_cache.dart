import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'marketplace_api.dart';

const marketplaceDiscoveryCacheLifetime = Duration(hours: 24);
const marketplaceDiscoveryCacheEntryLimit = 5;

class CachedMarketplaceProductPage {
  const CachedMarketplaceProductPage({
    required this.page,
    required this.cachedAt,
  });

  final MarketplaceProductPage page;
  final DateTime cachedAt;
}

abstract class MarketplaceDiscoveryCache {
  Future<CachedMarketplaceProductPage?> read(MarketplaceProductQuery query);

  Future<void> write(
    MarketplaceProductQuery query,
    MarketplaceProductPage page,
  );
}

class NoOpMarketplaceDiscoveryCache implements MarketplaceDiscoveryCache {
  const NoOpMarketplaceDiscoveryCache();

  @override
  Future<CachedMarketplaceProductPage?> read(
    MarketplaceProductQuery query,
  ) async => null;

  @override
  Future<void> write(
    MarketplaceProductQuery query,
    MarketplaceProductPage page,
  ) async {}
}

class SharedPreferencesMarketplaceDiscoveryCache
    implements MarketplaceDiscoveryCache {
  SharedPreferencesMarketplaceDiscoveryCache(
    this._storage, {
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final MarketplaceDiscoveryCacheStorage _storage;
  final DateTime Function() _now;

  @override
  Future<CachedMarketplaceProductPage?> read(
    MarketplaceProductQuery query,
  ) async {
    try {
      final entries = await _readEntries();
      final matching = entries.where((entry) => entry['key'] == query.cacheKey);
      if (matching.isEmpty) return null;

      final entry = matching.first;
      final cachedAt = DateTime.parse(entry['cachedAt']! as String).toUtc();
      if (_now().toUtc().difference(cachedAt) >
          marketplaceDiscoveryCacheLifetime) {
        return null;
      }
      return CachedMarketplaceProductPage(
        page: MarketplaceProductPage.fromJson(
          (entry['page']! as Map).cast<String, Object?>(),
        ),
        cachedAt: cachedAt,
      );
    } on Exception {
      return null;
    }
  }

  @override
  Future<void> write(
    MarketplaceProductQuery query,
    MarketplaceProductPage page,
  ) async {
    try {
      final entries = await _readEntries();
      entries.removeWhere((entry) => entry['key'] == query.cacheKey);
      entries.insert(0, {
        'key': query.cacheKey,
        'cachedAt': _now().toUtc().toIso8601String(),
        'page': page.toJson(),
      });
      await _storage.write(
        jsonEncode(entries.take(marketplaceDiscoveryCacheEntryLimit).toList()),
      );
    } on Exception {
      // Discovery remains usable when local persistence is unavailable.
    }
  }

  Future<List<Map<String, Object?>>> _readEntries() async {
    final encoded = await _storage.read();
    if (encoded == null) return [];
    final decoded = jsonDecode(encoded);
    if (decoded is! List) return [];
    return decoded
        .whereType<Map>()
        .map((entry) => entry.cast<String, Object?>())
        .toList();
  }
}

abstract class MarketplaceDiscoveryCacheStorage {
  Future<String?> read();

  Future<void> write(String value);
}

class SharedPreferencesMarketplaceDiscoveryCacheStorage
    implements MarketplaceDiscoveryCacheStorage {
  SharedPreferencesMarketplaceDiscoveryCacheStorage(this._preferences);

  static const _storageKey = 'marketplace.discovery.cache.v1';

  final SharedPreferencesAsync _preferences;

  @override
  Future<String?> read() => _preferences.getString(_storageKey);

  @override
  Future<void> write(String value) =>
      _preferences.setString(_storageKey, value);
}
