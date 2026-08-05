import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';

void main() {
  testWidgets('shows farmer dashboard title', (tester) async {
    await tester.pumpWidget(const FarmerApp());
    expect(find.text('Farmer workspace'), findsOneWidget);
  });

  testWidgets('opens API-backed product browsing from the dashboard', (tester) async {
    final repository = _FakeMarketplaceProductRepository();

    await tester.pumpWidget(
      FarmerApp(marketplaceProductRepository: repository),
    );
    await tester.tap(find.text('Product browsing'));
    await tester.pumpAndSettle();

    expect(find.text('Browse products'), findsOneWidget);
    expect(find.text('Available products'), findsOneWidget);
    expect(find.text('Hybrid Bajra Seed'), findsOneWidget);
    expect(repository.queries.single.pincode, '302001');
  });

  testWidgets('opens cart skeleton from the dashboard', (tester) async {
    await tester.pumpWidget(const FarmerApp());
    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle();

    expect(find.text('My cart'), findsOneWidget);
    expect(find.text('Delivery pincode'), findsOneWidget);
    expect(find.text('Subtotal'), findsOneWidget);
  });

  testWidgets('opens checkout review skeleton from the cart', (tester) async {
    await tester.pumpWidget(const FarmerApp());
    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Review checkout'));
    await tester.pumpAndSettle();

    expect(find.text('Checkout review'), findsOneWidget);
    expect(find.text('Mock payment'), findsOneWidget);
    expect(find.text('Confirm mock payment'), findsOneWidget);
    expect(find.text('Cancellation'), findsOneWidget);
    expect(find.text('Cancel checkout'), findsOneWidget);
    expect(find.text('Reservation release: READY'), findsOneWidget);
    expect(find.text('Child orders'), findsOneWidget);
    expect(find.text('Jaipur Krishi Distributor'), findsOneWidget);
  });
}

class _FakeMarketplaceProductRepository implements MarketplaceProductRepository {
  final queries = <MarketplaceProductQuery>[];

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async {
    queries.add(query);
    return _marketplaceProductPage;
  }
}

const _marketplaceProductPage = MarketplaceProductPage(
  items: [
    MarketplaceProductSummary(
      id: 'product-1',
      name: 'Hybrid Bajra Seed',
      category: 'Seeds',
      cropTargets: ['Bajra'],
      brand: MarketplaceBrandSummary(
        id: 'brand-1',
        name: 'Demo Seeds',
        slug: 'demo-seeds',
      ),
      company: MarketplaceCompanySummary(
        id: 'company-1',
        displayName: 'Demo Seeds Company',
      ),
      serviceablePincode: '302001',
      lowestPricePaise: 120000,
      availableQuantity: 42,
      offerCount: 1,
      sellerCount: 1,
      fulfilmentModes: ['DISTRIBUTOR_FULFILLED'],
      offers: [
        MarketplaceOfferSummary(
          id: 'offer-1',
          variant: MarketplaceVariantSummary(
            id: 'variant-1',
            variantName: '1 kg pack',
            packSize: '1',
            packUnit: 'kg',
            mrpPaise: 125000,
          ),
          seller: MarketplaceSellerSummary(
            organisationId: 'seller-1',
            displayName: 'Jaipur Krishi Distributor',
            legalName: 'Jaipur Krishi Distributor Private Limited',
            gstin: '08ABCDE1234F1Z5',
          ),
          warehouse: MarketplaceWarehouseSummary(
            id: 'warehouse-1',
            name: 'Jaipur Warehouse',
            city: 'Jaipur',
            state: 'Rajasthan',
            pincode: '302001',
          ),
          sellingPricePaise: 120000,
          minimumOrderQuantity: 1,
          maximumOrderQuantity: 10,
          availableQuantity: 42,
          fulfilmentMode: 'DISTRIBUTOR_FULFILLED',
          deliverySlaDays: 2,
        ),
      ],
    ),
  ],
  page: 1,
  limit: 20,
  total: 1,
);
