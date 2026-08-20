import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/addresses/farmer_address_repository.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_repository.dart';
import 'package:vardhnam_farmer_mobile/src/auth/session_store.dart';
import 'package:vardhnam_farmer_mobile/src/cart/farmer_cart.dart';
import 'package:vardhnam_farmer_mobile/src/cart/farmer_cart_repository.dart';
import 'package:vardhnam_farmer_mobile/src/checkout/farmer_checkout.dart';
import 'package:vardhnam_farmer_mobile/src/checkout/farmer_checkout_repository.dart';
import 'package:vardhnam_farmer_mobile/src/core/widgets/vardhnam_components.dart';
import 'package:vardhnam_farmer_mobile/src/farms/farm_repository.dart';
import 'package:vardhnam_farmer_mobile/src/localization/locale_controller.dart';
import 'package:vardhnam_farmer_mobile/src/localization/locale_preferences.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_membership_repository.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_models.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_api.dart';
import 'package:vardhnam_farmer_mobile/src/marketplace/marketplace_discovery_cache.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_invoice_document.dart';
import 'package:vardhnam_farmer_mobile/src/orders/farmer_order_repository.dart';
import 'package:vardhnam_farmer_mobile/src/orders/invoice_download_launcher.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile.dart';
import 'package:vardhnam_farmer_mobile/src/profile/farmer_profile_repository.dart';
import 'package:vardhnam_farmer_mobile/src/support/farmer_support_repository.dart';
import 'package:vardhnam_farmer_mobile/src/support/farmer_support_ticket.dart';

void main() {
  testWidgets('shows farmer dashboard title', (tester) async {
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        kisanClubMembershipRepository: _FakeKisanClubMembershipRepository(
          enabled: false,
        ),
        // Home now summarises crops, orders and products (blueprint 10.5-10.7).
        // Without these the modules fall through to real HTTP repositories and
        // leave their timeout timers pending after the tree is disposed.
        farmRepository: const _EmptyFarmRepository(),
        farmerOrderRepository: _FakeFarmerOrderRepository(_deliveredTestOrder),
        farmerProfileRepository: _FakeFarmerProfileRepository(),
        marketplaceProductRepository: _FakeMarketplaceProductRepository(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Namaste, Test Farmer'), findsOneWidget);
  });

  testWidgets('joins Kisan Club with profile prefill and optional consent', (
    tester,
  ) async {
    final clubRepository = _FakeKisanClubMembershipRepository();
    final farmRepository = _ClubJoinFarmRepository();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        farmerProfileRepository: _FakeFarmerProfileRepository(),
        kisanClubMembershipRepository: clubRepository,
        farmRepository: farmRepository,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Join Kisan Club'), findsOneWidget);
    await tester.tap(find.text('Join Kisan Club'));
    await tester.pumpAndSettle();
    await _completeClubJoinForm(tester);

    expect(clubRepository.joinedInputs.single.homePincode, '302001');
    expect(
      clubRepository.joinedInputs.single.termsVersion,
      kisanClubTermsVersion,
    );
    expect(clubRepository.consentInputs.single.advisoryConsent, isTrue);
    expect(farmRepository.createdFarmInputs.single.name, 'North field');
    expect(farmRepository.createdCropInputs.single.areaAcres, 3);
    expect(farmRepository.createdCropInputs.single.cropId, 'crop-wheat');
  });

  testWidgets(
    'keeps a created Club membership resumable when farm save fails',
    (tester) async {
      final clubRepository = _FakeKisanClubMembershipRepository();
      final farmRepository = _ClubJoinFarmRepository(failCreate: true);
      await tester.pumpWidget(
        FarmerApp(
          initialSession: _testSession,
          farmerProfileRepository: _FakeFarmerProfileRepository(),
          kisanClubMembershipRepository: clubRepository,
          farmRepository: farmRepository,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Join Kisan Club'));
      await tester.pumpAndSettle();
      await _completeClubJoinForm(tester);

      expect(clubRepository.joinedInputs, hasLength(1));
      expect(farmRepository.createdFarmInputs, hasLength(1));
      expect(find.text('Complete Club profile'), findsOneWidget);
      expect(find.text('Step 1 of 2: Add your first farm'), findsOneWidget);
    },
  );

  testWidgets('Hindi four-step Club join scrolls at 200 percent text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        initialLocale: const Locale('hi'),
        initialLocation: '/kisan-club/join',
        farmerProfileRepository: _FakeFarmerProfileRepository(),
        kisanClubMembershipRepository: _FakeKisanClubMembershipRepository(),
        farmRepository: _ClubJoinFarmRepository(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('4 में से चरण 1'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('opens the authenticated Club catalogue at the member pincode', (
    tester,
  ) async {
    final membershipRepository = _FakeKisanClubMembershipRepository()
      ..membership = _testClubMembership;
    final catalogueRepository = _FakeMarketplaceProductRepository();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        kisanClubMembershipRepository: membershipRepository,
        kisanClubCatalogueRepository: catalogueRepository,
      ),
    );
    await tester.pumpAndSettle();

    // 'Kisan Club' is both the tab label and the dashboard card, so tap the tab
    // explicitly rather than whichever the finder happens to reach first.
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Kisan Club'),
      ),
    );
    await tester.pumpAndSettle();
    // The persistent tab bar costs vertical space, so this action can sit below
    // the fold on a test-sized viewport.
    await tester.scrollUntilVisible(find.text('Club products'), 200);
    await tester.tap(find.text('Club products'));
    await tester.pumpAndSettle();

    expect(find.text('Eligible Club products'), findsOneWidget);
    expect(find.text('Hybrid Bajra Seed'), findsOneWidget);
    expect(catalogueRepository.queries.single.pincode, '302001');
  });

  testWidgets('guards private routes and keeps product browsing public', (
    tester,
  ) async {
    await tester.pumpWidget(const FarmerApp());
    expect(find.text('Farmer login'), findsOneWidget);

    await tester.tap(find.text('Browse products without login'));
    await tester.pumpAndSettle();
    expect(find.text('Browse products'), findsOneWidget);
  });

  testWidgets('requests OTP, verifies it and stores the farmer session', (
    tester,
  ) async {
    final repository = _FakeFarmerAuthRepository();
    final sessionStore = _RecordingAuthSessionStore();
    await tester.pumpWidget(
      FarmerApp(authRepository: repository, authSessionStore: sessionStore),
    );

    await tester.enterText(find.byType(TextField).at(0), 'New Farmer');
    await tester.enterText(find.byType(TextField).at(1), '9876543210');
    await tester.tap(find.text('Send OTP'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Development OTP'), findsOneWidget);
    await tester.enterText(find.byType(TextField).at(2), '123456');
    await tester.tap(find.text('Verify and continue'));
    await tester.pumpAndSettle();

    expect(find.text('Farmer workspace'), findsOneWidget);
    expect(repository.requestedPhones, ['+919876543210']);
    expect(repository.verifiedCodes, ['123456']);
    expect(sessionStore.writes, [_testSession]);
  });

  testWidgets('selects only from eligible farmer membership contexts', (
    tester,
  ) async {
    const selection = FarmerMembershipSelectionRequired(
      selectionToken: 'farmer-selection-token',
      candidates: [
        FarmerMembershipCandidate(
          organisationId: 'farmer-context-1',
          organisationName: 'Jaipur Farmer Group',
        ),
        FarmerMembershipCandidate(
          organisationId: 'farmer-context-2',
          organisationName: 'Ajmer Farmer Group',
        ),
      ],
    );
    final repository = _FakeFarmerAuthRepository(verificationResult: selection);
    final sessionStore = _RecordingAuthSessionStore();
    await tester.pumpWidget(
      FarmerApp(authRepository: repository, authSessionStore: sessionStore),
    );

    await tester.enterText(find.byType(TextField).at(0), 'Existing Farmer');
    await tester.enterText(find.byType(TextField).at(1), '9876543210');
    await tester.tap(find.text('Send OTP'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(2), '123456');
    await tester.tap(find.text('Verify and continue'));
    await tester.pumpAndSettle();

    expect(find.text('Choose your farmer context'), findsOneWidget);
    expect(find.text('Jaipur Farmer Group'), findsOneWidget);
    expect(find.text('Ajmer Farmer Group'), findsOneWidget);
    expect(find.textContaining('COMPANY'), findsNothing);
    expect(find.textContaining('PROMOTER'), findsNothing);

    await tester.tap(find.text('Ajmer Farmer Group'));
    await tester.pumpAndSettle();

    expect(repository.selectedOrganisationIds, ['farmer-context-2']);
    expect(sessionStore.writes, [_testSession]);
    expect(find.text('Farmer workspace'), findsOneWidget);
  });

  testWidgets('logs out, clears secure state and returns to login', (
    tester,
  ) async {
    final repository = _FakeFarmerAuthRepository();
    final sessionStore = _RecordingAuthSessionStore();
    await tester.pumpWidget(
      FarmerApp(
        authRepository: repository,
        authSessionStore: sessionStore,
        initialSession: _testSession,
      ),
    );

    await tester.tap(find.byTooltip('Log out'));
    await tester.pumpAndSettle();

    expect(find.text('Farmer login'), findsOneWidget);
    expect(repository.loggedOutRefreshTokens, ['test-refresh-token']);
    expect(sessionStore.clearCount, 1);
  });

  testWidgets('switches to Hindi and persists the choice', (tester) async {
    final localePreferences = _RecordingLocalePreferenceStore();
    await tester.pumpWidget(
      FarmerApp(
        localePreferenceStore: localePreferences,
        initialSession: _testSession,
      ),
    );

    await tester.tap(find.byTooltip('Language'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('हिन्दी'));
    await tester.pumpAndSettle();

    expect(find.text('किसान कार्यक्षेत्र'), findsOneWidget);
    expect(localePreferences.writes, ['hi']);
  });

  testWidgets('persists the device-default language on first launch', (
    tester,
  ) async {
    final localePreferences = _RecordingLocalePreferenceStore();
    await tester.pumpWidget(
      FarmerApp(
        requiresLanguageChoice: true,
        localePreferenceStore: localePreferences,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Choose your language'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'English'));
    await tester.pumpAndSettle();

    expect(localePreferences.writes, ['en']);
    expect(find.text('Farmer login'), findsOneWidget);
  });

  testWidgets('language choice preserves a restored signed-in session', (
    tester,
  ) async {
    final localePreferences = _RecordingLocalePreferenceStore();
    await tester.pumpWidget(
      FarmerApp(
        requiresLanguageChoice: true,
        localePreferenceStore: localePreferences,
        initialSession: _testSession,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('हिन्दी'));
    await tester.pumpAndSettle();

    expect(localePreferences.writes, ['hi']);
    expect(find.byTooltip('लॉग आउट'), findsOneWidget);
  });

  testWidgets('uses a Hindi initial locale across routed screens', (
    tester,
  ) async {
    await tester.pumpWidget(
      FarmerApp(
        initialLocale: const Locale('hi'),
        initialLocation: '/cart',
        initialSession: _testSession,
        farmerCartRepository: _FakeFarmerCartRepository(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('मेरा कार्ट'), findsOneWidget);
    expect(find.text('डिलीवरी पिनकोड'), findsOneWidget);
  });

  testWidgets('opens API-backed product browsing from the dashboard', (
    tester,
  ) async {
    // The persistent tab bar takes a slice of an already-short test viewport,
    // pushing the first result out of the build window.
    _useTallViewport(tester);
    final repository = _FakeMarketplaceProductRepository();

    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: repository,
        initialSession: _testSession,
      ),
    );
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Shop'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Browse products'), findsOneWidget);
    expect(find.text('All products'), findsOneWidget);
    expect(find.text('Hybrid Bajra Seed'), findsOneWidget);
    expect(repository.queries.single.pincode, '302001');
  });

  testWidgets('labels exact-query cached discovery after a network failure', (
    tester,
  ) async {
    final cache = _FakeMarketplaceDiscoveryCache(
      CachedMarketplaceProductPage(
        page: _marketplaceProductPage,
        cachedAt: DateTime.now().toUtc().subtract(const Duration(minutes: 12)),
      ),
    );

    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: _FailingMarketplaceProductRepository(),
        marketplaceDiscoveryCache: cache,
        initialLocation: '/browse',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Hybrid Bajra Seed'), findsOneWidget);
    expect(
      find.textContaining('Saved results from 12 minute(s) ago'),
      findsOneWidget,
    );
    expect(
      find.textContaining('reconnect before adding to cart'),
      findsOneWidget,
    );
    expect(cache.readQueries.single.pincode, '302001');
  });

  testWidgets('applies authoritative brand and crop discovery filters', (
    tester,
  ) async {
    _useTallViewport(tester);
    final repository = _FakeMarketplaceProductRepository();
    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: repository,
        initialLocation: '/browse',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Shop by brand'), findsOneWidget);
    expect(find.text('Shop by crop'), findsOneWidget);
    await tester.tap(find.text('Demo Seeds').first);
    await tester.pumpAndSettle();
    expect(repository.queries.last.brandId, 'brand-1');

    await tester.tap(find.text('Bajra').first);
    await tester.pumpAndSettle();
    expect(repository.queries.last.cropTarget, 'Bajra');
  });

  testWidgets('loads the next discovery page without duplicating products', (
    tester,
  ) async {
    _useTallViewport(tester);
    final repository = _PaginatedMarketplaceProductRepository();
    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: repository,
        initialLocation: '/browse',
      ),
    );
    await tester.pumpAndSettle();

    final loadMoreButton = find.widgetWithText(
      OutlinedButton,
      'Load more products',
    );
    await tester.ensureVisible(loadMoreButton);
    await tester.pumpAndSettle();
    await tester.tap(loadMoreButton);
    await tester.pumpAndSettle();

    expect(find.text('Hybrid Bajra Seed'), findsOneWidget);
    expect(find.text('Cotton Seed'), findsOneWidget);
    expect(repository.queries.map((query) => query.page), [1, 2]);
  });

  testWidgets('each tab keeps its own navigation history', (tester) async {
    _useTallViewport(tester);
    final repository = _FakeMarketplaceProductRepository();

    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: repository,
        initialSession: _testSession,
        initialLocation: '/browse',
      ),
    );
    await tester.pumpAndSettle();

    // Go one level deep inside the Shop tab.
    await tester.tap(find.text('View details'));
    await tester.pumpAndSettle();
    expect(find.text('Hybrid Bajra Seed'), findsWidgets);

    Future<void> selectTab(String label) async {
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text(label),
        ),
      );
      await tester.pumpAndSettle();
    }

    // Leaving and returning must land back on the product, not reset the tab.
    // A stateful shell is the whole reason this holds; with plain routes the
    // detail screen was lost the moment another destination was opened.
    await selectTab('Orders');
    await selectTab('Shop');

    // Back on the product detail, not the browse list it was opened from.
    expect(find.text('Hybrid Bajra Seed'), findsWidgets);
    expect(find.text('View details'), findsNothing);
  });

  testWidgets('opens product details with seller-of-record offer data', (
    tester,
  ) async {
    _useTallViewport(tester);
    final repository = _FakeMarketplaceProductRepository();

    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: repository,
        initialLocation: '/browse',
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('View details'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Choose a seller offer'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Choose a seller offer'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Jaipur Krishi Distributor'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Jaipur Krishi Distributor'), findsOneWidget);
    expect(
      find.text('Seller of record: Jaipur Krishi Distributor Private Limited'),
      findsOneWidget,
    );
    expect(find.text('Selected offer'), findsOneWidget);
    expect(repository.detailRequests.single.productId, 'product-1');
    expect(repository.detailRequests.single.pincode, '302001');
  });

  testWidgets('adds the selected offer and opens the API-backed cart', (
    tester,
  ) async {
    _useTallViewport(tester);
    final marketplaceRepository = _FakeMarketplaceProductRepository();
    final cartRepository = _FakeFarmerCartRepository();
    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: marketplaceRepository,
        farmerCartRepository: cartRepository,
        initialLocation: '/browse',
        initialSession: _testSession,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('View details'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Add selected offer to cart'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Add selected offer to cart'));
    await tester.pumpAndSettle();

    expect(cartRepository.addRequests.single.offerId, 'offer-1');
    expect(cartRepository.addRequests.single.quantity, 1);
    expect(cartRepository.addRequests.single.pincode, '302001');
    expect(find.text('My cart'), findsOneWidget);
    expect(find.text('Hybrid Bajra Seed'), findsOneWidget);
    expect(find.text('₹1,200'), findsNothing);
    expect(find.text('₹1200'), findsNWidgets(2));
  });

  testWidgets('refreshes and reselects after a seller offer is withdrawn', (
    tester,
  ) async {
    _useTallViewport(tester);
    final replacementOffer = MarketplaceOfferSummary.fromJson({
      ..._marketplaceProductPage.items.single.offers.single.toJson(),
      'id': 'offer-2',
      'sellingPricePaise': 125000,
    });
    final refreshedDetail = MarketplaceProductDetail(
      product: MarketplaceProductSummary.fromJson({
        ..._marketplaceProductPage.items.single.toJson(),
        'offers': [replacementOffer.toJson()],
      }),
      description: _marketplaceProductDetail.description,
      variants: _marketplaceProductDetail.variants,
      documents: _marketplaceProductDetail.documents,
    );
    final marketplaceRepository = _FakeMarketplaceProductRepository(
      details: [_marketplaceProductDetail, refreshedDetail],
    );
    final cartRepository = _FakeFarmerCartRepository(
      addError: const AuthenticatedApiException(
        code: 'VALIDATION_FAILED',
        message: 'Offer cannot be added to cart: APPROVED_OFFER',
      ),
    );

    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: marketplaceRepository,
        farmerCartRepository: cartRepository,
        initialLocation: '/browse',
        initialSession: _testSession,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('View details'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Add selected offer to cart'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Add selected offer to cart'));
    await tester.pumpAndSettle();

    expect(marketplaceRepository.detailRequests, hasLength(2));
    expect(
      find.text(
        'This seller offer is no longer available. Choose another live offer.',
      ),
      findsOneWidget,
    );
    expect(find.text('Selected offer'), findsOneWidget);
  });

  testWidgets('requires review when backend accepts a newer offer price', (
    tester,
  ) async {
    _useTallViewport(tester);
    final originalItem = _testCart.items.single;
    final repricedCart = FarmerCart(
      id: _testCart.id,
      deliveryAddress: _testCart.deliveryAddress,
      serviceablePincode: _testCart.serviceablePincode,
      status: _testCart.status,
      itemCount: _testCart.itemCount,
      subtotalPaise: 125000,
      items: [
        FarmerCartItem(
          id: originalItem.id,
          offerId: originalItem.offerId,
          distributorOrganisationId: originalItem.distributorOrganisationId,
          quantity: originalItem.quantity,
          priceSnapshotPaise: 125000,
          availableQuantitySnapshot: originalItem.availableQuantitySnapshot,
          minimumOrderQuantity: originalItem.minimumOrderQuantity,
          maximumOrderQuantity: originalItem.maximumOrderQuantity,
          serviceablePincodeSnapshot: originalItem.serviceablePincodeSnapshot,
          productNameSnapshot: originalItem.productNameSnapshot,
          variantNameSnapshot: originalItem.variantNameSnapshot,
          sellerNameSnapshot: originalItem.sellerNameSnapshot,
          warehouseNameSnapshot: originalItem.warehouseNameSnapshot,
          fulfilmentModeSnapshot: originalItem.fulfilmentModeSnapshot,
          deliverySlaDaysSnapshot: originalItem.deliverySlaDaysSnapshot,
          lineTotalPaise: 125000,
        ),
      ],
    );
    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: _FakeMarketplaceProductRepository(),
        farmerCartRepository: _FakeFarmerCartRepository(cart: repricedCart),
        initialLocation: '/browse',
        initialSession: _testSession,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('View details'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Add selected offer to cart'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Add selected offer to cart'));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Price updated'), findsOneWidget);
    expect(find.textContaining('changed this offer from'), findsOneWidget);
    await tester.tap(find.text('Stay here'));
    await tester.pumpAndSettle();
    expect(find.text('Hybrid Bajra Seed'), findsWidgets);
  });

  testWidgets('clears stale detail when the last live offer disappears', (
    tester,
  ) async {
    _useTallViewport(tester);
    final marketplaceRepository = _FakeMarketplaceProductRepository(
      detailError: const MarketplaceApiException(
        'Marketplace product was not found for this pincode',
        code: 'NOT_FOUND',
        statusCode: 404,
      ),
    );
    final cartRepository = _FakeFarmerCartRepository(
      addError: const AuthenticatedApiException(
        code: 'VALIDATION_FAILED',
        message: 'Requested quantity exceeds sellable availability',
      ),
    );
    await tester.pumpWidget(
      FarmerApp(
        marketplaceProductRepository: marketplaceRepository,
        farmerCartRepository: cartRepository,
        initialLocation: '/browse',
        initialSession: _testSession,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('View details'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Add selected offer to cart'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Add selected offer to cart'));
    await tester.pumpAndSettle();

    expect(find.text('Jaipur Krishi Distributor'), findsNothing);
    expect(
      find.textContaining('This seller offer is no longer available.'),
      findsOneWidget,
    );
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('loads and saves the authenticated farmer profile', (
    tester,
  ) async {
    final repository = _FakeFarmerProfileRepository();
    await tester.pumpWidget(
      FarmerApp(
        farmerProfileRepository: repository,
        initialSession: _testSession,
      ),
    );

    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Account'),
      ),
    );
    await tester.pumpAndSettle();

    // 'Account' is also the tab label now, so assert the screen heading itself.
    expect(find.text('Your account'), findsOneWidget);
    expect(find.text('My farms'), findsOneWidget);
    expect(find.text('Support'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.widgetWithText(TextFormField, 'Full name'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.widgetWithText(TextFormField, 'Full name'), findsOneWidget);
    expect(find.text('Profile details'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.widgetWithText(TextFormField, 'Village'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Village'),
      'Updated Village',
    );
    tester.testTextInput.hide();
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.text('Save profile'),
      find.byType(ListView),
      const Offset(0, -250),
    );
    await tester.tap(find.text('Save profile'));
    await tester.pumpAndSettle();

    expect(find.text('Farmer profile saved.'), findsOneWidget);
    expect(repository.savedInputs.single.village, 'Updated Village');
    expect(repository.savedInputs.single.preferredLocale, 'en-IN');
    await tester.dragUntilVisible(
      find.text('Saved delivery addresses'),
      find.byType(ListView),
      const Offset(0, -250),
    );
    expect(find.widgetWithText(VardhnamInfoCard, 'Home'), findsOneWidget);
    expect(find.text('Default'), findsOneWidget);
  });

  testWidgets('Hindi account remains usable on narrow 200 percent text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      FarmerApp(
        farmerProfileRepository: _FakeFarmerProfileRepository(),
        initialLocale: const Locale('hi'),
        initialLocation: '/profile',
        initialSession: _testSession,
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(ListView), const Offset(0, -350));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('lists farmer addresses and changes the default address', (
    tester,
  ) async {
    final repository = _FakeFarmerAddressRepository();
    await tester.pumpWidget(
      FarmerApp(
        farmerAddressRepository: repository,
        initialLocation: '/profile/addresses',
        initialSession: _testSession,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Delivery addresses'), findsOneWidget);
    expect(find.widgetWithText(Card, 'Home'), findsOneWidget);
    expect(find.text('Farm'), findsOneWidget);
    await tester.tap(find.text('Set as default'));
    await tester.pumpAndSettle();

    expect(repository.defaultAddressIds, ['address-2']);
    expect(find.text('Default delivery address updated.'), findsOneWidget);
  });

  testWidgets('opens create and edit delivery-address forms', (tester) async {
    final repository = _FakeFarmerAddressRepository();
    await tester.pumpWidget(
      FarmerApp(
        farmerAddressRepository: repository,
        initialLocation: '/profile/addresses',
        initialSession: _testSession,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add address'));
    await tester.pumpAndSettle();
    expect(find.text('Add delivery address'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Address label'), findsOneWidget);
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Edit').first);
    await tester.pumpAndSettle();
    expect(find.text('Edit delivery address'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Home'), findsOneWidget);
  });

  testWidgets('opens API-backed cart from the dashboard', (tester) async {
    final cartRepository = _FakeFarmerCartRepository();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        farmerCartRepository: cartRepository,
      ),
    );
    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle();

    expect(find.text('My cart'), findsOneWidget);
    expect(find.text('Delivery pincode'), findsOneWidget);
    expect(find.text('Sold by Jaipur Krishi Distributor'), findsOneWidget);
    expect(
      find.text('1 product(s) · separate seller order and invoice'),
      findsOneWidget,
    );
    expect(find.text('Allowed quantity: 1–10'), findsOneWidget);
    await tester.tap(find.byTooltip('Increase quantity'));
    await tester.pumpAndSettle();
    expect(cartRepository.updatedQuantities, [2]);

    await tester.scrollUntilVisible(
      find.text('Subtotal'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Subtotal'), findsOneWidget);
  });

  testWidgets('refreshes cart snapshots when the app resumes', (tester) async {
    final cartRepository = _FakeFarmerCartRepository();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        initialLocation: '/cart',
        farmerCartRepository: cartRepository,
      ),
    );
    await tester.pumpAndSettle();
    expect(cartRepository.getCount, 1);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(cartRepository.getCount, 2);
  });

  testWidgets('selects an address and creates backend checkout child orders', (
    tester,
  ) async {
    final checkoutRepository = _FakeFarmerCheckoutRepository();
    final cartRepository = _FakeFarmerCartRepository();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        farmerCartRepository: cartRepository,
        farmerAddressRepository: _FakeFarmerAddressRepository(),
        farmerCheckoutRepository: checkoutRepository,
      ),
    );
    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Review checkout'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.drag(find.byType(ListView).last, const Offset(0, -100));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Review checkout'));
    await tester.pumpAndSettle();
    expect(cartRepository.getCount, 2);

    await tester.scrollUntilVisible(
      find.text('Confirm and create checkout'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Select delivery address'), findsOneWidget);
    expect(find.textContaining('Farm road'), findsOneWidget);
    await tester.tap(find.text('Confirm and create checkout'));
    await tester.pumpAndSettle();

    expect(checkoutRepository.addressIds, ['address-1']);
    expect(
      find.text('Checkout created and inventory reserved successfully.'),
      findsOneWidget,
    );
    expect(find.text('Jaipur Krishi Distributor'), findsOneWidget);
    expect(find.text('Order number: VA-1001'), findsOneWidget);
    expect(find.text('Reserved stock: B-2026 × 1'), findsOneWidget);
  });

  testWidgets('opens order history, timeline and distributor invoice', (
    tester,
  ) async {
    final repository = _FakeFarmerOrderRepository(_deliveredTestOrder);
    final launcher = _FakeInvoiceDownloadLauncher();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        farmerOrderRepository: repository,
        invoiceDownloadLauncher: launcher,
      ),
    );

    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Orders'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Order number: VA-1001'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'All orders'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Delivered'), findsOneWidget);
    expect(find.text('Seller: Jaipur Krishi Distributor'), findsOneWidget);
    expect(find.text('Delivered'), findsWidgets);
    expect(find.text('Track order'), findsOneWidget);

    await tester.tap(find.text('Order number: VA-1001'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Order timeline'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Order timeline'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.textContaining('Delivery OTP verified'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.textContaining('Delivery OTP verified'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Distributor invoice'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Invoice number: INV-1001'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Prepare invoice PDF'),
      120,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Prepare invoice PDF'));
    await tester.pumpAndSettle();
    expect(repository.requestedInvoiceOrderIds, ['order-1']);
    expect(repository.downloadedInvoiceOrderIds, ['order-1']);
    expect(launcher.launchedUris, [
      Uri.parse('https://files.example/invoice.pdf'),
    ]);
    expect(find.text('Download invoice PDF'), findsOneWidget);
    expect(find.text('Invoice PDF opened in your browser.'), findsOneWidget);
  });

  testWidgets('cancels only the eligible child order after confirmation', (
    tester,
  ) async {
    final repository = _FakeFarmerOrderRepository(_failedTestOrder);
    await tester.pumpWidget(
      FarmerApp(
        initialLocation: '/orders/order-1',
        initialSession: _testSession,
        farmerOrderRepository: repository,
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Cancel this order'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Cancel this order'));
    await tester.pumpAndSettle();
    expect(find.text('Cancel this seller order?'), findsOneWidget);
    await tester.tap(find.text('Cancel this order').last);
    await tester.pumpAndSettle();

    expect(repository.cancelledOrderIds, ['order-1']);
    expect(find.text('Cancelled'), findsOneWidget);
    expect(find.text('Cancel this order'), findsNothing);
  });

  testWidgets('refreshes active order on interval and foreground resume', (
    tester,
  ) async {
    final repository = _FakeFarmerOrderRepository(_failedTestOrder);
    await tester.pumpWidget(
      FarmerApp(
        initialLocation: '/orders/order-1',
        initialSession: _testSession,
        farmerOrderRepository: repository,
      ),
    );
    await tester.pumpAndSettle();
    expect(repository.getOrderCalls, 1);

    await tester.pump(const Duration(seconds: 30));
    await tester.pump();
    expect(repository.getOrderCalls, 2);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(repository.getOrderCalls, 3);
  });

  testWidgets('creates a support ticket linked to a seller order', (
    tester,
  ) async {
    final repository = _FakeFarmerSupportRepository(_openSupportTicket);
    await tester.pumpWidget(
      FarmerApp(
        initialLocation: '/support/new?orderId=order-1',
        initialSession: _testSession,
        farmerSupportRepository: repository,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('order-1'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Subject'),
      'Delivery delayed',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Describe the issue'),
      'The seller order has not arrived.',
    );
    await tester.scrollUntilVisible(
      find.text('Submit ticket'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.drag(find.byType(Scrollable).last, const Offset(0, -120));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit ticket'));
    await tester.pumpAndSettle();

    expect(repository.createdInputs.single.productOrderId, 'order-1');
    expect(repository.createdInputs.single.subject, 'Delivery delayed');
    expect(find.text('Support ticket'), findsOneWidget);
  });

  testWidgets('lists and reopens the farmer own resolved support ticket', (
    tester,
  ) async {
    final repository = _FakeFarmerSupportRepository(_resolvedSupportTicket);
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _testSession,
        farmerSupportRepository: repository,
      ),
    );

    await tester.scrollUntilVisible(
      find.text('Support access'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Support access'));
    await tester.pumpAndSettle();
    expect(find.text('Delivery delayed'), findsOneWidget);
    await tester.tap(find.text('Delivery delayed'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reopen ticket'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'Issue is still open');
    await tester.tap(find.text('Reopen ticket').last);
    await tester.pumpAndSettle();

    expect(repository.reopenReasons, ['Issue is still open']);
    expect(find.text('Reopened'), findsOneWidget);
  });

  test('saved locale wins, then device locale, then English fallback', () {
    expect(
      resolveInitialLocale(
        savedLanguageCode: 'hi',
        deviceLocale: const Locale('en'),
      ),
      const Locale('hi'),
    );
    expect(
      resolveInitialLocale(
        savedLanguageCode: null,
        deviceLocale: const Locale('hi', 'IN'),
      ),
      const Locale('hi'),
    );
    expect(
      resolveInitialLocale(
        savedLanguageCode: 'unsupported',
        deviceLocale: const Locale('fr'),
      ),
      const Locale('en'),
    );
  });
}

Future<void> _completeClubJoinForm(WidgetTester tester) async {
  expect(find.text('302001'), findsOneWidget);

  await tester.ensureVisible(find.text('Continue'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Continue'));
  await tester.pumpAndSettle();

  expect(find.text('Step 2 of 4'), findsOneWidget);
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Farm name'),
    'North field',
  );
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Area in acres'),
    '3',
  );
  await tester.ensureVisible(find.text('Continue'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Continue'));
  await tester.pumpAndSettle();

  expect(find.text('Step 3 of 4'), findsOneWidget);
  await tester.tap(find.text('Choose crop'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Wheat'));
  await tester.pumpAndSettle();
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Season code'),
    'RABI_2026',
  );
  await tester.ensureVisible(find.text('Choose sowing date'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Choose sowing date'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK'));
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text('Continue'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Continue'));
  await tester.pumpAndSettle();

  expect(find.text('Step 4 of 4'), findsOneWidget);
  await tester.ensureVisible(
    find.text('I accept the Kisan Club programme terms'),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('I accept the Kisan Club programme terms'));
  await tester.ensureVisible(find.text('Crop and farm advisory messages'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Crop and farm advisory messages'));
  await tester.ensureVisible(find.text('Join free'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Join free'));
  await tester.pumpAndSettle();
}

class _RecordingLocalePreferenceStore implements LocalePreferenceStore {
  final writes = <String>[];

  @override
  Future<String?> readLanguageCode() async => null;

  @override
  Future<void> writeLanguageCode(String languageCode) async {
    writes.add(languageCode);
  }
}

void _useTallViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 1000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

class _RecordingAuthSessionStore implements AuthSessionStore {
  final writes = <AuthSession>[];
  var clearCount = 0;

  @override
  Future<void> clear() async {
    clearCount += 1;
  }

  @override
  Future<AuthSession?> read() async => null;

  @override
  Future<void> write(AuthSession session) async {
    writes.add(session);
  }
}

class _FakeFarmerAuthRepository implements FarmerAuthRepository {
  _FakeFarmerAuthRepository({this.verificationResult});

  final FarmerOtpVerificationResult? verificationResult;
  final requestedPhones = <String>[];
  final verifiedCodes = <String>[];
  final loggedOutRefreshTokens = <String>[];
  final selectedOrganisationIds = <String>[];

  @override
  Future<void> logout(String refreshToken) async {
    loggedOutRefreshTokens.add(refreshToken);
  }

  @override
  Future<AuthSession> refresh(String refreshToken) async => _testSession;

  @override
  Future<OtpChallengeResult> requestOtp(String phone) async {
    requestedPhones.add(phone);
    return OtpChallengeResult(
      expiresAt: DateTime.now().add(const Duration(minutes: 10)),
      mockOtpCode: '123456',
    );
  }

  @override
  Future<FarmerOtpVerificationResult> verifyOtp({
    required String phone,
    required String code,
    required String fullName,
    required String preferredLocale,
  }) async {
    verifiedCodes.add(code);
    return verificationResult ?? const FarmerOtpAuthenticated(_testSession);
  }

  @override
  Future<AuthSession> selectFarmerMembership({
    required String selectionToken,
    required String organisationId,
  }) async {
    selectedOrganisationIds.add(organisationId);
    return _testSession;
  }
}

class _FakeMarketplaceProductRepository
    implements MarketplaceProductRepository {
  _FakeMarketplaceProductRepository({
    List<MarketplaceProductDetail>? details,
    this.detailError,
  }) : details = details ?? [_marketplaceProductDetail];

  final List<MarketplaceProductDetail> details;
  final Object? detailError;
  final queries = <MarketplaceProductQuery>[];
  final detailRequests = <({String productId, String pincode})>[];

  @override
  Future<MarketplaceFilterOptions> getFilterOptions(String pincode) async =>
      const MarketplaceFilterOptions(
        categories: ['Seeds'],
        brands: [
          MarketplaceBrandSummary(
            id: 'brand-1',
            name: 'Demo Seeds',
            slug: 'demo-seeds',
          ),
        ],
        cropTargets: ['Bajra'],
      );

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async {
    queries.add(query);
    return _marketplaceProductPage;
  }

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) async {
    detailRequests.add((productId: productId, pincode: pincode));
    final index = detailRequests.length - 1;
    if (index >= details.length && detailError != null) throw detailError!;
    return details[index < details.length ? index : details.length - 1];
  }
}

class _FailingMarketplaceProductRepository
    implements MarketplaceProductRepository {
  @override
  Future<MarketplaceFilterOptions> getFilterOptions(String pincode) =>
      throw const SocketException('offline');

  @override
  Future<MarketplaceProductPage> listProducts(MarketplaceProductQuery query) =>
      throw const SocketException('offline');

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) => throw const SocketException('offline');
}

class _PaginatedMarketplaceProductRepository
    implements MarketplaceProductRepository {
  final queries = <MarketplaceProductQuery>[];

  @override
  Future<MarketplaceFilterOptions> getFilterOptions(String pincode) async =>
      const MarketplaceFilterOptions(
        categories: ['Seeds'],
        brands: [],
        cropTargets: ['Bajra'],
      );

  @override
  Future<MarketplaceProductPage> listProducts(
    MarketplaceProductQuery query,
  ) async {
    queries.add(query);
    if (query.page == 1) {
      return MarketplaceProductPage(
        items: _marketplaceProductPage.items,
        page: 1,
        limit: 1,
        total: 2,
      );
    }
    final secondProduct = MarketplaceProductSummary.fromJson({
      ..._marketplaceProductPage.items.single.toJson(),
      'id': 'product-2',
      'name': 'Cotton Seed',
    });
    return MarketplaceProductPage(
      items: [secondProduct],
      page: 2,
      limit: 1,
      total: 2,
    );
  }

  @override
  Future<MarketplaceProductDetail> getProduct({
    required String productId,
    required String pincode,
  }) => throw UnimplementedError();
}

class _FakeMarketplaceDiscoveryCache implements MarketplaceDiscoveryCache {
  _FakeMarketplaceDiscoveryCache(this.result);

  final CachedMarketplaceProductPage? result;
  final readQueries = <MarketplaceProductQuery>[];

  @override
  Future<CachedMarketplaceProductPage?> read(
    MarketplaceProductQuery query,
  ) async {
    readQueries.add(query);
    return result;
  }

  @override
  Future<void> write(
    MarketplaceProductQuery query,
    MarketplaceProductPage page,
  ) async {}
}

class _FakeFarmerCartRepository implements FarmerCartRepository {
  _FakeFarmerCartRepository({FarmerCart? cart, this.addError})
    : cart = cart ?? _testCart;

  final Object? addError;
  final addRequests = <({String offerId, int quantity, String pincode})>[];
  final updatedQuantities = <int>[];
  FarmerCart cart;
  var getCount = 0;

  @override
  Future<FarmerCart> getCart() async {
    getCount += 1;
    return cart;
  }

  @override
  Future<FarmerCart> addItem({
    required String offerId,
    required int quantity,
    required String serviceablePincode,
  }) async {
    addRequests.add((
      offerId: offerId,
      quantity: quantity,
      pincode: serviceablePincode,
    ));
    if (addError case final error?) throw error;
    return cart;
  }

  @override
  Future<FarmerCart> updateItem(String cartItemId, int quantity) async {
    updatedQuantities.add(quantity);
    return cart;
  }

  @override
  Future<FarmerCart> removeItem(String cartItemId) async {
    cart = _emptyTestCart;
    return cart;
  }

  @override
  Future<FarmerCart> clearCart() async {
    cart = _emptyTestCart;
    return cart;
  }
}

class _FakeFarmerCheckoutRepository implements FarmerCheckoutRepository {
  final addressIds = <String>[];

  @override
  Future<FarmerCheckout> createCheckout(String farmerAddressId) async {
    addressIds.add(farmerAddressId);
    return _testCheckout;
  }

  @override
  Future<FarmerCheckout> getCheckout(String checkoutId) async => _testCheckout;

  @override
  Future<FarmerCheckout> cancelCheckout(String checkoutId) async =>
      _testCheckout;
}

class _FakeFarmerOrderRepository implements FarmerOrderRepository {
  _FakeFarmerOrderRepository(this.order);

  FarmerOrder order;
  final cancelledOrderIds = <String>[];
  final requestedInvoiceOrderIds = <String>[];
  final downloadedInvoiceOrderIds = <String>[];
  var getOrderCalls = 0;

  @override
  Future<FarmerOrderPage> listOrders({
    int page = 1,
    int limit = 20,
    String? status,
  }) async => FarmerOrderPage(
    items: status == null || status == order.status ? [order] : const [],
    page: page,
    limit: limit,
    total: status == null || status == order.status ? 1 : 0,
  );

  @override
  Future<FarmerOrder> getOrder(String orderId) async {
    getOrderCalls += 1;
    return order;
  }

  @override
  Future<FarmerOrder> cancelOrder(String orderId) async {
    cancelledOrderIds.add(orderId);
    order = _orderFixture(status: 'CANCELLED');
    return order;
  }

  @override
  Future<FarmerInvoiceDocument> requestInvoicePdf(String orderId) async {
    requestedInvoiceOrderIds.add(orderId);
    return _availableInvoiceDocument;
  }

  @override
  Future<FarmerInvoiceDocument> getInvoicePdf(String orderId) async =>
      _availableInvoiceDocument;

  @override
  Future<FarmerInvoiceDownload> getInvoicePdfDownload(String orderId) async {
    downloadedInvoiceOrderIds.add(orderId);
    return FarmerInvoiceDownload(
      downloadUri: Uri.parse('https://files.example/invoice.pdf'),
      expiresAt: DateTime.utc(2026, 8, 20, 12, 5),
    );
  }
}

class _FakeInvoiceDownloadLauncher implements InvoiceDownloadLauncher {
  final launchedUris = <Uri>[];

  @override
  Future<bool> launch(Uri uri) async {
    launchedUris.add(uri);
    return true;
  }
}

final _availableInvoiceDocument = FarmerInvoiceDocument(
  id: 'document-1',
  productInvoiceId: 'invoice-1',
  status: 'AVAILABLE',
  fileId: 'file-1',
  checksumSha256: 'abc123',
  attemptCount: 1,
  generatedAt: DateTime.utc(2026, 8, 20, 12),
  createdAt: DateTime.utc(2026, 8, 20, 11, 59),
  updatedAt: DateTime.utc(2026, 8, 20, 12),
);

class _FakeFarmerSupportRepository implements FarmerSupportRepository {
  _FakeFarmerSupportRepository(this.ticket);

  FarmerSupportTicket ticket;
  final createdInputs = <FarmerSupportTicketInput>[];
  final reopenReasons = <String>[];

  @override
  Future<FarmerSupportTicketPage> listMyTickets({
    int page = 1,
    int limit = 20,
    String? status,
  }) async => FarmerSupportTicketPage(
    items: status == null || status == ticket.status ? [ticket] : const [],
    page: page,
    limit: limit,
    total: status == null || status == ticket.status ? 1 : 0,
  );

  @override
  Future<FarmerSupportTicket> getTicket(String ticketId) async => ticket;

  @override
  Future<FarmerSupportTicket> createTicket(
    FarmerSupportTicketInput input,
  ) async {
    createdInputs.add(input);
    ticket = _supportTicketFixture(
      status: 'OPEN',
      subject: input.subject,
      description: input.description,
      productOrderId: input.productOrderId,
    );
    return ticket;
  }

  @override
  Future<FarmerSupportTicket> reopenTicket(
    String ticketId,
    String reason,
  ) async {
    reopenReasons.add(reason);
    ticket = _supportTicketFixture(status: 'REOPENED');
    return ticket;
  }
}

class _FakeFarmerProfileRepository implements FarmerProfileRepository {
  final savedInputs = <FarmerProfileInput>[];

  @override
  Future<FarmerProfile> getProfile() async => _testProfile;

  @override
  Future<FarmerProfile> saveProfile(FarmerProfileInput input) async {
    savedInputs.add(input);
    return FarmerProfile(
      id: _testProfile.id,
      fullName: input.fullName,
      alternatePhone: input.alternatePhone,
      preferredLocale: input.preferredLocale,
      village: input.village,
      district: input.district,
      state: input.state,
      primaryPincode: input.primaryPincode,
      cropInterests: input.cropInterests,
      addresses: _testProfile.addresses,
    );
  }
}

class _FakeKisanClubMembershipRepository
    implements KisanClubMembershipRepository {
  _FakeKisanClubMembershipRepository({this.enabled = true});

  final bool enabled;
  final joinedInputs = <KisanClubMembershipInput>[];
  final consentInputs = <KisanClubConsentInput>[];
  KisanClubMembership? membership;

  @override
  Future<KisanClubMembershipAvailability> getMembership() async => enabled
      ? KisanClubMembershipAvailability.enabled(membership)
      : const KisanClubMembershipAvailability.disabled();

  @override
  Future<KisanClubMembership> join(KisanClubMembershipInput input) async {
    joinedInputs.add(input);
    membership = _testClubMembership;
    return membership!;
  }

  @override
  Future<KisanClubMembership> updateConsents(
    KisanClubConsentInput input,
  ) async {
    consentInputs.add(input);
    return membership!;
  }
}

class _EmptyFarmRepository implements FarmRepository {
  const _EmptyFarmRepository();

  @override
  Future<List<FarmerFarm>> listMine() async => const [];

  @override
  Future<FarmerFarm> create(CreateFarmInput input) =>
      throw UnimplementedError();

  @override
  Future<FarmerFarm> update(String farmId, UpdateFarmInput input) =>
      throw UnimplementedError();

  @override
  Future<List<CropReference>> listReferenceCrops() =>
      throw UnimplementedError();

  @override
  Future<FarmCropCycleSummary> createCropCycle(
    String farmId,
    CreateCropCycleInput input,
  ) => throw UnimplementedError();

  @override
  Future<FarmCropCycleSummary> updateCropCycle(
    String farmId,
    String cycleId,
    UpdateCropCycleInput input,
  ) => throw UnimplementedError();

  @override
  Future<List<FarmActivity>> listActivities(String cycleId) =>
      throw UnimplementedError();

  @override
  Future<FarmActivity> createActivity(
    String cycleId,
    CreateFarmActivityInput input,
  ) => throw UnimplementedError();

  @override
  Future<FarmCropCycleSummary> harvestCropCycle(
    String farmId,
    String cycleId,
    HarvestCropCycleInput input,
  ) => throw UnimplementedError();
}

class _ClubJoinFarmRepository implements FarmRepository {
  _ClubJoinFarmRepository({this.failCreate = false});

  final bool failCreate;
  final createdFarmInputs = <CreateFarmInput>[];
  final createdCropInputs = <CreateCropCycleInput>[];

  @override
  Future<List<CropReference>> listReferenceCrops() async => const [
    CropReference(
      id: 'crop-wheat',
      code: 'WHEAT',
      nameEn: 'Wheat',
      nameHi: 'गेहूँ',
    ),
  ];

  @override
  Future<FarmerFarm> create(CreateFarmInput input) async {
    createdFarmInputs.add(input);
    if (failCreate) throw Exception('farm save failed');
    return FarmerFarm(
      id: 'farm-created',
      name: input.name,
      village: input.village,
      pincode: input.pincode,
      areaAcres: input.areaAcres,
      ownershipType: input.ownershipType,
      isActive: true,
      cropCycles: const [],
    );
  }

  @override
  Future<FarmCropCycleSummary> createCropCycle(
    String farmId,
    CreateCropCycleInput input,
  ) async {
    createdCropInputs.add(input);
    return FarmCropCycleSummary(
      id: 'cycle-created',
      cropId: input.cropId,
      cropNameEn: 'Wheat',
      cropNameHi: 'गेहूँ',
      areaAcres: input.areaAcres,
      season: input.season,
      status: CropCycleStatus.active,
      varietyName: input.varietyName,
      sowingDate: input.sowingDate,
    );
  }

  @override
  Future<List<FarmerFarm>> listMine() async => const [];
  @override
  Future<FarmerFarm> update(String farmId, UpdateFarmInput input) =>
      throw UnimplementedError();
  @override
  Future<FarmCropCycleSummary> updateCropCycle(
    String farmId,
    String cycleId,
    UpdateCropCycleInput input,
  ) => throw UnimplementedError();
  @override
  Future<List<FarmActivity>> listActivities(String cycleId) =>
      throw UnimplementedError();
  @override
  Future<FarmActivity> createActivity(
    String cycleId,
    CreateFarmActivityInput input,
  ) => throw UnimplementedError();
  @override
  Future<FarmCropCycleSummary> harvestCropCycle(
    String farmId,
    String cycleId,
    HarvestCropCycleInput input,
  ) => throw UnimplementedError();
}

class _FakeFarmerAddressRepository implements FarmerAddressRepository {
  final defaultAddressIds = <String>[];
  var addresses = <FarmerAddress>[
    _testProfile.addresses.single,
    const FarmerAddress(
      id: 'address-2',
      label: 'Farm',
      recipientName: 'Test Farmer',
      phone: '+919876543210',
      addressLine1: 'Field number 42',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302002',
      isDefault: false,
    ),
  ];

  @override
  Future<FarmerAddress> createAddress(FarmerAddressInput input) =>
      throw UnimplementedError();

  @override
  Future<List<FarmerAddress>> listAddresses() async => addresses;

  @override
  Future<FarmerAddress> setDefaultAddress(String addressId) async {
    defaultAddressIds.add(addressId);
    addresses = [
      for (final address in addresses)
        FarmerAddress(
          id: address.id,
          label: address.label,
          recipientName: address.recipientName,
          phone: address.phone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          village: address.village,
          city: address.city,
          district: address.district,
          state: address.state,
          pincode: address.pincode,
          landmark: address.landmark,
          isDefault: address.id == addressId,
        ),
    ];
    return addresses.firstWhere((address) => address.id == addressId);
  }

  @override
  Future<FarmerAddress> updateAddress(
    String addressId,
    FarmerAddressInput input,
  ) => throw UnimplementedError();
}

const _testProfile = FarmerProfile(
  id: 'profile-1',
  fullName: 'Test Farmer',
  preferredLocale: 'en-IN',
  village: 'Old Village',
  district: 'Jaipur',
  state: 'Rajasthan',
  primaryPincode: '302001',
  cropInterests: ['Wheat'],
  addresses: [
    FarmerAddress(
      id: 'address-1',
      label: 'Home',
      recipientName: 'Test Farmer',
      phone: '+919876543210',
      addressLine1: 'Farm road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      isDefault: true,
    ),
  ],
);

const _testCart = FarmerCart(
  id: 'cart-1',
  deliveryAddress: null,
  serviceablePincode: '302001',
  status: 'ACTIVE',
  itemCount: 1,
  subtotalPaise: 120000,
  items: [
    FarmerCartItem(
      id: 'cart-item-1',
      offerId: 'offer-1',
      distributorOrganisationId: 'distributor-1',
      quantity: 1,
      priceSnapshotPaise: 120000,
      availableQuantitySnapshot: 42,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 10,
      serviceablePincodeSnapshot: '302001',
      productNameSnapshot: 'Hybrid Bajra Seed',
      variantNameSnapshot: '1 kg pack',
      sellerNameSnapshot: 'Jaipur Krishi Distributor',
      warehouseNameSnapshot: 'Jaipur Warehouse',
      fulfilmentModeSnapshot: 'DISTRIBUTOR_FULFILLED',
      deliverySlaDaysSnapshot: 2,
      lineTotalPaise: 120000,
    ),
  ],
);

const _emptyTestCart = FarmerCart(
  id: 'cart-1',
  deliveryAddress: null,
  serviceablePincode: null,
  status: 'ACTIVE',
  itemCount: 0,
  subtotalPaise: 0,
  items: [],
);

const _testCheckout = FarmerCheckout(
  id: 'checkout-1',
  deliveryAddress: FarmerAddress(
    id: 'address-1',
    label: 'Home',
    recipientName: 'Test Farmer',
    phone: '+919876543210',
    addressLine1: 'Farm road',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    isDefault: true,
  ),
  serviceablePincode: '302001',
  status: 'PENDING_PAYMENT',
  subtotalPaise: 120000,
  itemCount: 1,
  childOrderCount: 1,
  orders: [
    FarmerChildOrder(
      id: 'order-1',
      orderNumber: 'VA-1001',
      status: 'INVENTORY_RESERVED',
      sellerNameSnapshot: 'Jaipur Krishi Distributor',
      sellerGstinSnapshot: '08ABCDE1234F1Z5',
      subtotalPaise: 120000,
      itemCount: 1,
      items: [
        FarmerCheckoutItem(
          id: 'order-item-1',
          quantity: 1,
          unitPricePaise: 120000,
          lineTotalPaise: 120000,
          productNameSnapshot: 'Hybrid Bajra Seed',
          variantNameSnapshot: '1 kg pack',
          warehouseNameSnapshot: 'Jaipur Warehouse',
          fulfilmentModeSnapshot: 'DISTRIBUTOR_FULFILLED',
          deliverySlaDaysSnapshot: 2,
          reservations: [
            FarmerInventoryReservation(
              id: 'reservation-1',
              batchId: 'batch-1',
              batchNumber: 'B-2026',
              quantity: 1,
            ),
          ],
        ),
      ],
    ),
  ],
);

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
          batch: null,
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

final _marketplaceProductDetail = MarketplaceProductDetail(
  product: _marketplaceProductPage.items.first,
  description: 'High-yield hybrid seed suitable for dry conditions.',
  variants: const [
    MarketplaceVariantSummary(
      id: 'variant-1',
      variantName: '1 kg pack',
      packSize: '1',
      packUnit: 'kg',
      mrpPaise: 125000,
    ),
  ],
  documents: [],
);

final _deliveredTestOrder = _orderFixture(
  status: 'DELIVERED',
  invoice: FarmerOrderInvoice(
    invoiceNumber: 'INV-1001',
    status: 'GENERATED',
    currency: 'INR',
    subtotalPaise: 120000,
    taxPaise: 0,
    totalPaise: 120000,
    sellerLegalNameSnapshot: 'Jaipur Distributor Private Limited',
    sellerDisplayNameSnapshot: 'Jaipur Krishi Distributor',
    sellerGstinSnapshot: '08ABCDE1234F1Z5',
    farmerNameSnapshot: 'Test Farmer',
    generatedAt: DateTime.utc(2026, 8, 8, 10),
  ),
);

final _failedTestOrder = _orderFixture(status: 'PAYMENT_FAILED');

FarmerOrder _orderFixture({
  required String status,
  FarmerOrderInvoice? invoice,
}) => FarmerOrder(
  id: 'order-1',
  checkoutId: 'checkout-1',
  orderNumber: 'VA-1001',
  status: status,
  serviceablePincode: '302001',
  sellerNameSnapshot: 'Jaipur Krishi Distributor',
  sellerGstinSnapshot: '08ABCDE1234F1Z5',
  deliveryAddress: const FarmerOrderAddress(
    recipientName: 'Test Farmer',
    phone: '+919876543210',
    addressLine1: 'Farm road',
    addressLine2: null,
    village: 'Demo village',
    city: 'Jaipur',
    district: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    landmark: null,
  ),
  subtotalPaise: 120000,
  itemCount: 1,
  items: const [
    FarmerOrderItem(
      id: 'item-1',
      quantity: 1,
      unitPricePaise: 120000,
      lineTotalPaise: 120000,
      productNameSnapshot: 'Hybrid Bajra Seed',
      variantNameSnapshot: '1 kg pack',
      warehouseNameSnapshot: 'Jaipur Warehouse',
      fulfilmentModeSnapshot: 'DISTRIBUTOR_FULFILLED',
      deliverySlaDaysSnapshot: 2,
      batchNumbers: ['B-2026'],
    ),
  ],
  statusHistory: [
    FarmerOrderStatusEvent(
      fromStatus: null,
      toStatus: 'INVENTORY_RESERVED',
      reason: 'Inventory reserved',
      createdAt: DateTime.utc(2026, 8, 8, 8),
    ),
    FarmerOrderStatusEvent(
      fromStatus: 'OUT_FOR_DELIVERY',
      toStatus: status,
      reason: status == 'DELIVERED'
          ? 'Delivery OTP verified'
          : 'Payment was declined',
      createdAt: DateTime.utc(2026, 8, 9, 8),
    ),
  ],
  invoice: invoice,
  dispatchNumber: invoice == null ? null : 'DSP-1001',
  deliveryAssignmentNumber: invoice == null ? null : 'DEL-1001',
  deliveryAssignmentStatus: invoice == null ? null : status,
  createdAt: DateTime.utc(2026, 8, 8, 8),
  updatedAt: DateTime.utc(2026, 8, 9, 8),
);

final _openSupportTicket = _supportTicketFixture(status: 'OPEN');
final _resolvedSupportTicket = _supportTicketFixture(status: 'RESOLVED');

FarmerSupportTicket _supportTicketFixture({
  required String status,
  String subject = 'Delivery delayed',
  String description = 'The seller order has not arrived.',
  String? productOrderId = 'order-1',
}) => FarmerSupportTicket(
  id: 'ticket-1',
  productOrderId: productOrderId,
  category: 'DELIVERY_ISSUE',
  priority: 'HIGH',
  subject: subject,
  description: description,
  status: status,
  slaDueAt: DateTime.utc(2026, 8, 10, 8),
  resolutionNote: status == 'RESOLVED' ? 'Carrier contacted.' : null,
  resolvedAt: status == 'RESOLVED' ? DateTime.utc(2026, 8, 9, 8) : null,
  closedAt: null,
  createdAt: DateTime.utc(2026, 8, 8, 8),
  updatedAt: DateTime.utc(2026, 8, 9, 8),
);

const _testSession = AuthSession(
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  membershipId: 'membership-1',
  organisationId: 'organisation-1',
  role: 'FARMER',
  expiresIn: '15m',
);

final _testClubMembership = KisanClubMembership(
  id: 'club-membership-1',
  memberNumber: 'VKC-TEST-001',
  status: KisanClubMembershipStatus.pendingProfile,
  homePincode: '302001',
  joinedAt: DateTime.utc(2026, 8, 11),
  termsVersion: kisanClubTermsVersion,
  advisoryConsent: false,
  marketingConsent: false,
  preciseLocationConsent: false,
);
