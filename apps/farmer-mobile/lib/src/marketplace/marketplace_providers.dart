import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profile/farmer_profile_repository.dart';
import 'marketplace_api.dart';

/// The public marketplace catalogue.
///
/// `marketplace_api.dart` stays free of Flutter and Riverpod so it can be tested
/// as plain Dart, so the provider lives here instead. Routed screens keep taking
/// a repository as a constructor parameter for testability; this exists for
/// widgets like the home screen that are composed rather than routed.
///
/// `FarmerApp` overrides it in tests, the same way it overrides the Kisan Club
/// catalogue repository.
final marketplaceProductRepositoryProvider =
    Provider<MarketplaceProductRepository>(
      (ref) => MarketplaceHttpProductRepository(),
    );

/// A short product strip for the home screen, scoped to the farmer's pincode.
///
/// Returns an empty list rather than throwing when the farmer has no pincode on
/// their profile: discovery is pincode-scoped, and a home module has nothing
/// useful to say without one. The Shop tab asks for a pincode properly.
final homeRecommendedProductsProvider =
    FutureProvider.autoDispose<HomeProductStrip>((ref) async {
      final profile = await ref
          .watch(farmerProfileRepositoryProvider)
          .getProfile();
      final pincode = profile.primaryPincode?.trim() ?? '';
      if (pincode.isEmpty) {
        return const HomeProductStrip(pincode: '', products: []);
      }

      final page = await ref
          .watch(marketplaceProductRepositoryProvider)
          .listProducts(MarketplaceProductQuery(pincode: pincode, limit: 4));

      return HomeProductStrip(pincode: pincode, products: page.items);
    });

class HomeProductStrip {
  const HomeProductStrip({required this.pincode, required this.products});

  final String pincode;
  final List<MarketplaceProductSummary> products;
}
