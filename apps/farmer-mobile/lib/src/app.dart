import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import 'addresses/farmer_address_repository.dart';
import 'advisory/advisory_repository.dart';
import 'auth/auth_controller.dart';
import 'auth/auth_models.dart';
import 'auth/auth_repository.dart';
import 'auth/session_store.dart';
import 'cart/farmer_cart_repository.dart';
import 'checkout/farmer_checkout_repository.dart';
import 'crop_doctor/crop_doctor_feature.dart';
import 'farms/farm_repository.dart';
import 'localization/locale_controller.dart';
import 'localization/locale_preferences.dart';
import 'kisan_club/kisan_club_membership_repository.dart';
import 'kisan_club/kisan_club_catalogue_repository.dart';
import 'kisan_club/kisan_club_benefit_token_repository.dart';
import 'kisan_club/kisan_club_promoter_repository.dart';
import 'legal/farmer_legal_links.dart';
import 'marketplace/marketplace_api.dart';
import 'marketplace/marketplace_providers.dart';
import 'marketplace/marketplace_discovery_cache.dart';
import 'notifications/farmer_notification_repository.dart';
import 'payments/farmer_payment_repository.dart';
import 'orders/farmer_order_repository.dart';
import 'orders/invoice_download_launcher.dart';
import 'profile/farmer_profile_repository.dart';
import 'returns/farmer_return_repository.dart';
import 'routing/app_routes.dart';
import 'screens/cart_screen.dart';
import 'screens/checkout_review_screen.dart';
import 'screens/farmer_dashboard_screen.dart';
import 'screens/farmer_login_screen.dart';
import 'screens/language_choice_screen.dart';
import 'screens/farmer_profile_screen.dart';
import 'screens/farmer_addresses_screen.dart';
import 'screens/product_browse_screen.dart';
import 'screens/product_detail_screen.dart';
import 'screens/order_detail_screen.dart';
import 'screens/order_history_screen.dart';
import 'screens/notification_detail_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/create_support_ticket_screen.dart';
import 'screens/crop_doctor_screen.dart';
import 'screens/create_return_request_screen.dart';
import 'screens/return_request_detail_screen.dart';
import 'screens/return_requests_screen.dart';
import 'screens/support_ticket_detail_screen.dart';
import 'screens/support_tickets_screen.dart';
import 'screens/kisan_club_home_screen.dart';
import 'screens/kisan_club_join_screen.dart';
import 'screens/kisan_club_benefits_screen.dart';
import 'screens/my_farms_screen.dart';
import 'screens/my_promoter_screen.dart';
import 'screens/crop_activity_screen.dart';
import 'screens/advisory_list_screen.dart';
import 'screens/advisory_detail_screen.dart';
import 'support/farmer_support_repository.dart';
import 'support/support_contact.dart';
import 'app/theme/vardhnam_theme.dart';
import 'core/widgets/vardhnam_tab_shell.dart';

class FarmerApp extends StatelessWidget {
  const FarmerApp({
    super.key,
    this.marketplaceProductRepository,
    this.marketplaceDiscoveryCache = const NoOpMarketplaceDiscoveryCache(),
    this.initialLocale = const Locale('en'),
    this.requiresLanguageChoice = false,
    this.localePreferenceStore = const NoOpLocalePreferenceStore(),
    this.initialLocation = AppRoutes.dashboard,
    this.authRepository,
    this.authSessionStore = const NoOpAuthSessionStore(),
    this.initialSession,
    this.farmerProfileRepository,
    this.farmerAddressRepository,
    this.farmerCartRepository,
    this.farmerCheckoutRepository,
    this.farmerPaymentRepository,
    this.farmerOrderRepository,
    this.invoiceDownloadLauncher,
    this.farmerReturnRepository,
    this.farmerSupportRepository,
    this.farmerNotificationRepository,
    this.supportContactConfiguration,
    this.externalSupportLauncher,
    this.farmerLegalLinks,
    this.externalLegalLinkLauncher,
    this.kisanClubMembershipRepository,
    this.kisanClubCatalogueRepository,
    this.kisanClubBenefitTokenRepository,
    this.farmRepository,
    this.kisanClubPromoterRepository,
    this.advisoryRepository,
  });

  final MarketplaceProductRepository? marketplaceProductRepository;
  final MarketplaceDiscoveryCache marketplaceDiscoveryCache;
  final Locale initialLocale;
  final bool requiresLanguageChoice;
  final LocalePreferenceStore localePreferenceStore;
  final String initialLocation;
  final FarmerAuthRepository? authRepository;
  final AuthSessionStore authSessionStore;
  final AuthSession? initialSession;
  final FarmerProfileRepository? farmerProfileRepository;
  final FarmerAddressRepository? farmerAddressRepository;
  final FarmerCartRepository? farmerCartRepository;
  final FarmerCheckoutRepository? farmerCheckoutRepository;
  final FarmerPaymentRepository? farmerPaymentRepository;
  final FarmerOrderRepository? farmerOrderRepository;
  final InvoiceDownloadLauncher? invoiceDownloadLauncher;
  final FarmerReturnRepository? farmerReturnRepository;
  final FarmerSupportRepository? farmerSupportRepository;
  final FarmerNotificationRepository? farmerNotificationRepository;
  final SupportContactConfiguration? supportContactConfiguration;
  final ExternalSupportLauncher? externalSupportLauncher;
  final FarmerLegalLinks? farmerLegalLinks;
  final ExternalLegalLinkLauncher? externalLegalLinkLauncher;
  final KisanClubMembershipRepository? kisanClubMembershipRepository;
  final MarketplaceProductRepository? kisanClubCatalogueRepository;
  final KisanClubBenefitTokenRepository? kisanClubBenefitTokenRepository;
  final FarmRepository? farmRepository;
  final KisanClubPromoterRepository? kisanClubPromoterRepository;
  final AdvisoryRepository? advisoryRepository;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        initialLocaleProvider.overrideWithValue(initialLocale),
        localePreferenceStoreProvider.overrideWithValue(localePreferenceStore),
        if (authRepository != null)
          farmerAuthRepositoryProvider.overrideWithValue(authRepository!),
        authSessionStoreProvider.overrideWithValue(authSessionStore),
        initialAuthSessionProvider.overrideWithValue(initialSession),
        if (farmerProfileRepository != null)
          farmerProfileRepositoryProvider.overrideWithValue(
            farmerProfileRepository!,
          ),
        if (farmerAddressRepository != null)
          farmerAddressRepositoryProvider.overrideWithValue(
            farmerAddressRepository!,
          ),
        if (farmerCartRepository != null)
          farmerCartRepositoryProvider.overrideWithValue(farmerCartRepository!),
        if (farmerCheckoutRepository != null)
          farmerCheckoutRepositoryProvider.overrideWithValue(
            farmerCheckoutRepository!,
          ),
        if (farmerPaymentRepository != null)
          farmerPaymentRepositoryProvider.overrideWithValue(
            farmerPaymentRepository!,
          ),
        if (farmerOrderRepository != null)
          farmerOrderRepositoryProvider.overrideWithValue(
            farmerOrderRepository!,
          ),
        if (invoiceDownloadLauncher != null)
          invoiceDownloadLauncherProvider.overrideWithValue(
            invoiceDownloadLauncher!,
          ),
        if (farmerReturnRepository != null)
          farmerReturnRepositoryProvider.overrideWithValue(
            farmerReturnRepository!,
          ),
        if (farmerSupportRepository != null)
          farmerSupportRepositoryProvider.overrideWithValue(
            farmerSupportRepository!,
          ),
        if (farmerNotificationRepository != null)
          farmerNotificationRepositoryProvider.overrideWithValue(
            farmerNotificationRepository!,
          ),
        if (supportContactConfiguration != null)
          supportContactConfigurationProvider.overrideWithValue(
            supportContactConfiguration!,
          ),
        if (externalSupportLauncher != null)
          externalSupportLauncherProvider.overrideWithValue(
            externalSupportLauncher!,
          ),
        if (farmerLegalLinks != null)
          farmerLegalLinksProvider.overrideWithValue(farmerLegalLinks!),
        if (externalLegalLinkLauncher != null)
          externalLegalLinkLauncherProvider.overrideWithValue(
            externalLegalLinkLauncher!,
          ),
        if (kisanClubMembershipRepository != null)
          kisanClubMembershipRepositoryProvider.overrideWithValue(
            kisanClubMembershipRepository!,
          ),
        if (kisanClubCatalogueRepository != null)
          kisanClubCatalogueRepositoryProvider.overrideWithValue(
            kisanClubCatalogueRepository!,
          ),
        // The home product strip resolves its repository from the provider
        // rather than a constructor argument, so the same injected fake has to
        // reach it -- otherwise a widget test would make a real HTTP call.
        if (marketplaceProductRepository != null)
          marketplaceProductRepositoryProvider.overrideWithValue(
            marketplaceProductRepository!,
          ),
        if (kisanClubBenefitTokenRepository != null)
          kisanClubBenefitTokenRepositoryProvider.overrideWithValue(
            kisanClubBenefitTokenRepository!,
          ),
        if (farmRepository != null)
          farmRepositoryProvider.overrideWithValue(farmRepository!),
        if (kisanClubPromoterRepository != null)
          kisanClubPromoterRepositoryProvider.overrideWithValue(
            kisanClubPromoterRepository!,
          ),
        if (advisoryRepository != null)
          advisoryRepositoryProvider.overrideWithValue(advisoryRepository!),
      ],
      child: _FarmerAppView(
        marketplaceProductRepository: marketplaceProductRepository,
        marketplaceDiscoveryCache: marketplaceDiscoveryCache,
        initialLocation: initialLocation,
        requiresLanguageChoice: requiresLanguageChoice,
      ),
    );
  }
}

class _FarmerAppView extends ConsumerStatefulWidget {
  const _FarmerAppView({
    required this.marketplaceProductRepository,
    required this.marketplaceDiscoveryCache,
    required this.initialLocation,
    required this.requiresLanguageChoice,
  });

  final MarketplaceProductRepository? marketplaceProductRepository;
  final MarketplaceDiscoveryCache marketplaceDiscoveryCache;
  final String initialLocation;
  final bool requiresLanguageChoice;

  @override
  ConsumerState<_FarmerAppView> createState() => _FarmerAppViewState();
}

class _FarmerAppViewState extends ConsumerState<_FarmerAppView> {
  late final GoRouter _router;
  late final ProviderSubscription<AuthSession?> _authSubscription;
  late bool _requiresLanguageChoice;

  @override
  void initState() {
    super.initState();
    _requiresLanguageChoice = widget.requiresLanguageChoice;
    _router = GoRouter(
      initialLocation: widget.initialLocation,
      redirect: (context, state) {
        final hasSession = ref.read(authSessionControllerProvider) != null;
        final path = state.uri.path;
        final isLanguageChoice = path == AppRoutes.language;
        final isLogin = path == AppRoutes.login;
        final isPublic =
            isLogin ||
            path == AppRoutes.browse ||
            path.startsWith('/products/');

        if (_requiresLanguageChoice && !isLanguageChoice) {
          return AppRoutes.language;
        }
        if (!_requiresLanguageChoice && isLanguageChoice) {
          return hasSession ? AppRoutes.dashboard : AppRoutes.login;
        }
        if (!hasSession && !isPublic && !isLanguageChoice) {
          return AppRoutes.login;
        }
        if (hasSession && isLogin) {
          return AppRoutes.dashboard;
        }
        return null;
      },
      routes: [
        GoRoute(
          path: AppRoutes.language,
          builder: (context, state) =>
              LanguageChoiceScreen(onCompleted: _completeLanguageChoice),
        ),
        GoRoute(
          path: AppRoutes.login,
          builder: (context, state) => const FarmerLoginScreen(),
        ),
        // Focused tasks that deliberately cover the tab bar. A farmer paying for
        // an order or writing a support ticket should not be one stray tap from
        // abandoning it, so these push over the shell on the root navigator.
        GoRoute(
          path: AppRoutes.cart,
          builder: (context, state) => const CartScreen(),
        ),
        GoRoute(
          path: AppRoutes.checkout,
          builder: (context, state) => const CheckoutReviewScreen(),
        ),
        GoRoute(
          path: AppRoutes.newReturnRequest,
          builder: (context, state) => CreateReturnRequestScreen(
            orderId: state.pathParameters['orderId']!,
          ),
        ),
        GoRoute(
          path: AppRoutes.newSupportTicket,
          builder: (context, state) => CreateSupportTicketScreen(
            orderId: state.uri.queryParameters['orderId'],
          ),
        ),
        GoRoute(
          path: AppRoutes.kisanClubJoin,
          builder: (context, state) => const KisanClubJoinScreen(),
        ),
        GoRoute(
          path: AppRoutes.kisanClubProfileCompletion,
          builder: (context, state) => MyFarmsScreen(
            defaultPincode: state.uri.queryParameters['pincode'] ?? '',
            completionMode: true,
          ),
        ),

        // Everything else lives inside a tab, so the bar stays visible and each
        // tab keeps its own history.
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) =>
              VardhnamTabShell(navigationShell: navigationShell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.dashboard,
                  builder: (context, state) => const FarmerDashboardScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.browse,
                  builder: (context, state) => ProductBrowseScreen(
                    repository: widget.marketplaceProductRepository,
                    cache: widget.marketplaceDiscoveryCache,
                  ),
                ),
                GoRoute(
                  path: AppRoutes.productDetail,
                  builder: (context, state) => ProductDetailScreen(
                    productId: state.pathParameters['productId']!,
                    pincode: state.uri.queryParameters['pincode'] ?? '',
                    repository: widget.marketplaceProductRepository,
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.kisanClub,
                  builder: (context, state) => const KisanClubHomeScreen(),
                ),
                GoRoute(
                  path: AppRoutes.kisanClubCatalogue,
                  builder: (context, state) => ProductBrowseScreen(
                    repository: ref.read(kisanClubCatalogueRepositoryProvider),
                    initialPincode: state.uri.queryParameters['pincode'] ?? '',
                    kisanClubMode: true,
                  ),
                ),
                GoRoute(
                  path: AppRoutes.kisanClubProductDetail,
                  builder: (context, state) => ProductDetailScreen(
                    productId: state.pathParameters['productId']!,
                    pincode: state.uri.queryParameters['pincode'] ?? '',
                    repository: ref.read(kisanClubCatalogueRepositoryProvider),
                    kisanClubMode: true,
                  ),
                ),
                GoRoute(
                  path: AppRoutes.kisanClubBenefits,
                  builder: (context, state) => const KisanClubBenefitsScreen(),
                ),
                GoRoute(
                  path: AppRoutes.farms,
                  builder: (context, state) => MyFarmsScreen(
                    defaultPincode: state.uri.queryParameters['pincode'] ?? '',
                  ),
                ),
                GoRoute(
                  path: AppRoutes.myPromoter,
                  builder: (context, state) => const MyPromoterScreen(),
                ),
                GoRoute(
                  path: AppRoutes.cropActivity,
                  builder: (context, state) => CropActivityScreen(
                    farmId: state.uri.queryParameters['farmId'] ?? '',
                    cycleId: state.pathParameters['cycleId']!,
                    cropName: state.uri.queryParameters['cropName'] ?? '',
                    initialStatus: state.uri.queryParameters['status'] ?? '',
                  ),
                ),
                GoRoute(
                  path: AppRoutes.advisories,
                  builder: (context, state) => const AdvisoryListScreen(),
                ),
                GoRoute(
                  path: AppRoutes.advisoryDetail,
                  builder: (context, state) => AdvisoryDetailScreen(
                    advisoryId: state.pathParameters['advisoryId']!,
                  ),
                ),
                GoRoute(
                  path: AppRoutes.cropDoctor,
                  redirect: (context, state) =>
                      ref.read(cropDoctorShellEnabledProvider)
                      ? null
                      : AppRoutes.support,
                  builder: (context, state) => const CropDoctorScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.orders,
                  builder: (context, state) => const OrderHistoryScreen(),
                ),
                GoRoute(
                  path: AppRoutes.orderDetail,
                  builder: (context, state) => OrderDetailScreen(
                    orderId: state.pathParameters['orderId']!,
                  ),
                ),
                GoRoute(
                  path: AppRoutes.returns,
                  builder: (context, state) => const ReturnRequestsScreen(),
                ),
                GoRoute(
                  path: AppRoutes.returnRequestDetail,
                  builder: (context, state) => ReturnRequestDetailScreen(
                    returnRequestId: state.pathParameters['returnRequestId']!,
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.profile,
                  builder: (context, state) => const FarmerProfileScreen(),
                ),
                GoRoute(
                  path: AppRoutes.addresses,
                  builder: (context, state) => const FarmerAddressesScreen(),
                ),
                GoRoute(
                  path: AppRoutes.support,
                  builder: (context, state) => const SupportTicketsScreen(),
                ),
                GoRoute(
                  path: AppRoutes.supportTicketDetail,
                  builder: (context, state) => SupportTicketDetailScreen(
                    ticketId: state.pathParameters['ticketId']!,
                  ),
                ),
                GoRoute(
                  path: AppRoutes.notifications,
                  builder: (context, state) => const NotificationsScreen(),
                ),
                GoRoute(
                  path: AppRoutes.notificationDetail,
                  builder: (context, state) => NotificationDetailScreen(
                    notificationId: state.pathParameters['notificationId']!,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
    _authSubscription = ref.listenManual<AuthSession?>(
      authSessionControllerProvider,
      (previous, next) => _router.refresh(),
    );
  }

  void _completeLanguageChoice() {
    if (!_requiresLanguageChoice) return;
    setState(() => _requiresLanguageChoice = false);
    final hasSession = ref.read(authSessionControllerProvider) != null;
    _router.go(hasSession ? AppRoutes.dashboard : AppRoutes.login);
  }

  @override
  void dispose() {
    _authSubscription.close();
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(localeControllerProvider);

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (context) => AppLocalizations.of(context)!.appTitle,
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: _router,
      theme: VardhnamTheme.light,
    );
  }
}
