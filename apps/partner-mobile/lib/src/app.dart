import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import 'auth/partner_auth_models.dart';
import 'auth/partner_auth_repository.dart';
import 'auth/partner_session_controller.dart';
import 'auth/partner_session_store.dart';
import 'earnings/partner_earnings_repository.dart';
import 'delivery/delivery_assignment_repository.dart';
import 'delivery/delivery_location_proof.dart';
import 'delivery/delivery_partner_profile_repository.dart';
import 'localization/partner_locale_controller.dart';
import 'kisan_club/promoter_club_repository.dart';
import 'kisan_club/promoter_fulfilment_repository.dart';
import 'leads/farmer_lead_repository.dart';
import 'leads/farmer_lead_models.dart';
import 'routing/partner_routes.dart';
import 'return_pickups/return_pickup_repository.dart';
import 'territory/promoter_territory_repository.dart';
import 'surveys/promoter_survey_repository.dart';
import 'visits/promoter_visit_repository.dart';
import 'screens/assisted_token_redemption_screen.dart';
import 'screens/delivery_assignment_detail_screen.dart';
import 'screens/delivery_assignments_screen.dart';
import 'screens/create_farmer_lead_screen.dart';
import 'screens/farmer_leads_screen.dart';
import 'screens/promoter_club_farmer_detail_screen.dart';
import 'screens/promoter_club_screen.dart';
import 'screens/promoter_farm_survey_screen.dart';
import 'screens/promoter_fulfilment_detail_screen.dart';
import 'screens/promoter_fulfilment_screen.dart';
import 'screens/promoter_territory_screen.dart';
import 'screens/promoter_visits_screen.dart';
import 'screens/record_promoter_visit_screen.dart';
import 'screens/partner_dashboard_screen.dart';
import 'screens/partner_earnings_screen.dart';
import 'screens/payout_account_screen.dart';
import 'screens/partner_login_screen.dart';
import 'screens/return_pickup_detail_screen.dart';
import 'screens/return_pickups_screen.dart';

class PartnerApp extends StatelessWidget {
  const PartnerApp({
    super.key,
    this.initialLocale = const Locale('en'),
    this.localeStore = const NoOpPartnerLocaleStore(),
    this.authRepository,
    this.sessionStore = const NoOpPartnerSessionStore(),
    this.initialSession,
    this.promoterClubRepository,
    this.promoterFulfilmentRepository,
    this.partnerEarningsRepository,
    this.deliveryAssignmentRepository,
    this.deliveryPartnerProfileRepository,
    this.deliveryLocationProofCollector,
    this.returnPickupRepository,
    this.farmerLeadRepository,
    this.promoterTerritoryRepository,
    this.promoterSurveyRepository,
    this.promoterVisitRepository,
  });

  final Locale initialLocale;
  final PartnerLocaleStore localeStore;
  final PartnerAuthRepository? authRepository;
  final PartnerSessionStore sessionStore;
  final PartnerSession? initialSession;
  final PromoterClubRepository? promoterClubRepository;
  final PromoterFulfilmentRepository? promoterFulfilmentRepository;
  final PartnerEarningsRepository? partnerEarningsRepository;
  final DeliveryAssignmentRepository? deliveryAssignmentRepository;
  final DeliveryPartnerProfileRepository? deliveryPartnerProfileRepository;
  final DeliveryLocationProofCollector? deliveryLocationProofCollector;
  final ReturnPickupRepository? returnPickupRepository;
  final FarmerLeadRepository? farmerLeadRepository;
  final PromoterTerritoryRepository? promoterTerritoryRepository;
  final PromoterSurveyRepository? promoterSurveyRepository;
  final PromoterVisitRepository? promoterVisitRepository;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        initialPartnerLocaleProvider.overrideWithValue(initialLocale),
        partnerLocaleStoreProvider.overrideWithValue(localeStore),
        if (authRepository != null)
          partnerAuthRepositoryProvider.overrideWithValue(authRepository!),
        partnerSessionStoreProvider.overrideWithValue(sessionStore),
        initialPartnerSessionProvider.overrideWithValue(initialSession),
        if (promoterClubRepository != null)
          promoterClubRepositoryProvider.overrideWithValue(
            promoterClubRepository!,
          ),
        if (promoterFulfilmentRepository != null)
          promoterFulfilmentRepositoryProvider.overrideWithValue(
            promoterFulfilmentRepository!,
          ),
        if (partnerEarningsRepository != null)
          partnerEarningsRepositoryProvider.overrideWithValue(
            partnerEarningsRepository!,
          ),
        if (deliveryAssignmentRepository != null)
          deliveryAssignmentRepositoryProvider.overrideWithValue(
            deliveryAssignmentRepository!,
          ),
        if (deliveryPartnerProfileRepository != null)
          deliveryPartnerProfileRepositoryProvider.overrideWithValue(
            deliveryPartnerProfileRepository!,
          ),
        if (deliveryLocationProofCollector != null)
          deliveryLocationProofCollectorProvider.overrideWithValue(
            deliveryLocationProofCollector!,
          ),
        if (returnPickupRepository != null)
          returnPickupRepositoryProvider.overrideWithValue(
            returnPickupRepository!,
          ),
        if (farmerLeadRepository != null)
          farmerLeadRepositoryProvider.overrideWithValue(farmerLeadRepository!),
        if (promoterTerritoryRepository != null)
          promoterTerritoryRepositoryProvider.overrideWithValue(
            promoterTerritoryRepository!,
          ),
        if (promoterSurveyRepository != null)
          promoterSurveyRepositoryProvider.overrideWithValue(
            promoterSurveyRepository!,
          ),
        if (promoterVisitRepository != null)
          promoterVisitRepositoryProvider.overrideWithValue(
            promoterVisitRepository!,
          ),
      ],
      child: const _PartnerAppView(),
    );
  }
}

class _PartnerAppView extends ConsumerStatefulWidget {
  const _PartnerAppView();

  @override
  ConsumerState<_PartnerAppView> createState() => _PartnerAppViewState();
}

class _PartnerAppViewState extends ConsumerState<_PartnerAppView> {
  late final GoRouter _router;
  late final ProviderSubscription<PartnerSession?> _sessionSubscription;

  @override
  void initState() {
    super.initState();
    _router = GoRouter(
      initialLocation: PartnerRoutes.login,
      redirect: (context, state) {
        final session = ref.read(partnerSessionControllerProvider);
        if (session == null) {
          return state.uri.path == PartnerRoutes.login
              ? null
              : PartnerRoutes.login;
        }
        final expected = PartnerRoutes.forRole(session.role);
        final canUseClub =
            session.role == PartnerRole.promoter ||
            session.role == PartnerRole.salesPartner;
        final canUseDelivery = session.role == PartnerRole.deliveryPartner;
        if (state.uri.path == expected ||
            state.uri.path == PartnerRoutes.earnings ||
            state.uri.path == PartnerRoutes.payoutAccount ||
            (canUseClub &&
                (state.uri.path.startsWith(PartnerRoutes.kisanClub) ||
                    state.uri.path.startsWith(PartnerRoutes.farmerLeads))) ||
            (canUseClub && state.uri.path == PartnerRoutes.promoterTerritory) ||
            (canUseClub && state.uri.path == PartnerRoutes.promoterSurvey) ||
            (canUseClub &&
                state.uri.path.startsWith(PartnerRoutes.promoterVisits)) ||
            (canUseDelivery &&
                (state.uri.path.startsWith(PartnerRoutes.deliveryAssignments) ||
                    state.uri.path.startsWith(PartnerRoutes.returnPickups)))) {
          return null;
        }
        return expected;
      },
      routes: [
        GoRoute(
          path: PartnerRoutes.login,
          builder: (context, state) => const PartnerLoginScreen(),
        ),
        for (final role in PartnerRole.values)
          GoRoute(
            path: PartnerRoutes.forRole(role),
            builder: (context, state) => PartnerDashboardScreen(role: role),
          ),
        GoRoute(
          path: PartnerRoutes.kisanClub,
          builder: (context, state) => const PromoterClubScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.kisanClubFarmer,
          builder: (context, state) => PromoterClubFarmerDetailScreen(
            membershipId: state.pathParameters['membershipId']!,
          ),
        ),
        GoRoute(
          path: PartnerRoutes.kisanClubRedeem,
          builder: (context, state) => AssistedTokenRedemptionScreen(
            membershipId: state.pathParameters['membershipId']!,
          ),
        ),
        GoRoute(
          path: PartnerRoutes.kisanClubSurvey,
          builder: (context, state) => PromoterFarmSurveyScreen(
            membershipId: state.pathParameters['membershipId']!,
          ),
        ),
        GoRoute(
          path: PartnerRoutes.kisanClubFulfilment,
          builder: (context, state) => const PromoterFulfilmentScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.kisanClubEarnings,
          builder: (context, state) => const PartnerEarningsScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.earnings,
          builder: (context, state) => const PartnerEarningsScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.payoutAccount,
          builder: (context, state) => const PayoutAccountScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.farmerLeads,
          builder: (context, state) => const FarmerLeadsScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.createFarmerLead,
          builder: (context, state) => const CreateFarmerLeadScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.promoterTerritory,
          builder: (context, state) => const PromoterTerritoryScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.promoterSurvey,
          builder: (context, state) {
            final lead = state.extra! as FarmerLead;
            return PromoterFarmSurveyScreen.attributed(
              farmerProfileId: lead.convertedFarmerProfileId!,
              initialVillage: lead.village,
              initialDistrict: lead.district,
              initialState: lead.state,
              initialPincode: lead.pincode,
            );
          },
        ),
        GoRoute(
          path: PartnerRoutes.promoterVisits,
          builder: (context, state) => const PromoterVisitsScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.recordPromoterVisit,
          builder: (context, state) =>
              RecordPromoterVisitScreen(lead: state.extra! as FarmerLead),
        ),
        GoRoute(
          path: PartnerRoutes.kisanClubFulfilmentDetail,
          builder: (context, state) => PromoterFulfilmentDetailScreen(
            assignmentId: state.pathParameters['assignmentId']!,
          ),
        ),
        GoRoute(
          path: PartnerRoutes.deliveryAssignments,
          builder: (context, state) => const DeliveryAssignmentsScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.deliveryAssignmentDetail,
          builder: (context, state) => DeliveryAssignmentDetailScreen(
            orderId: state.pathParameters['orderId']!,
          ),
        ),
        GoRoute(
          path: PartnerRoutes.returnPickups,
          builder: (context, state) => const ReturnPickupsScreen(),
        ),
        GoRoute(
          path: PartnerRoutes.returnPickupDetail,
          builder: (context, state) => ReturnPickupDetailScreen(
            assignmentId: state.pathParameters['assignmentId']!,
          ),
        ),
      ],
    );
    _sessionSubscription = ref.listenManual<PartnerSession?>(
      partnerSessionControllerProvider,
      (previous, next) => _router.refresh(),
    );
  }

  @override
  void dispose() {
    _sessionSubscription.close();
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(partnerLocaleControllerProvider);
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xff277da1),
          secondary: const Color(0xffd9a441),
        ),
        useMaterial3: true,
      ),
      routerConfig: _router,
    );
  }
}
