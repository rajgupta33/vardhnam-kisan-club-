import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../app/assets/app_assets.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../auth/auth_controller.dart';
import '../core/widgets/vardhnam_components.dart';
import '../core/widgets/vardhnam_image_frame.dart';
import '../kisan_club/kisan_club_membership_repository.dart';
import '../kisan_club/kisan_club_models.dart';
import '../localization/locale_controller.dart';
import '../profile/farmer_profile.dart';
import '../profile/farmer_profile_repository.dart';
import '../routing/app_routes.dart';
import 'home_sections.dart';

class FarmerDashboardScreen extends ConsumerWidget {
  const FarmerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;
    final selectedLanguage = ref.watch(localeControllerProvider).languageCode;

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        titleSpacing: VardhnamSpacing.medium,
        title: const _HomeAppBarTitle(),
        actions: [
          IconButton(
            tooltip: strings.notificationsTitle,
            onPressed: () => context.push(AppRoutes.notifications),
            icon: const Icon(Icons.notifications_outlined),
          ),
          PopupMenuButton<String>(
            tooltip: strings.languageActionLabel,
            initialValue: selectedLanguage,
            onSelected: (languageCode) {
              unawaited(_selectLanguage(context, ref, languageCode));
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'en',
                child: Text(strings.englishLanguageLabel),
              ),
              PopupMenuItem(
                value: 'hi',
                child: Text(strings.hindiLanguageLabel),
              ),
            ],
            icon: const Icon(Icons.language),
          ),
          IconButton(
            tooltip: strings.logoutAction,
            onPressed: () {
              unawaited(
                ref.read(authSessionControllerProvider.notifier).logout(),
              );
            },
            icon: const Icon(Icons.logout),
          ),
          const SizedBox(width: VardhnamSpacing.xSmall),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            VardhnamSpacing.large,
            VardhnamSpacing.small,
            VardhnamSpacing.large,
            VardhnamSpacing.xLarge,
          ),
          children: [
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton.icon(
                onPressed: () => context.push(AppRoutes.cart),
                icon: const Icon(Icons.shopping_cart_outlined),
                label: Text(strings.cart),
              ),
            ),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: () => context.push(AppRoutes.support),
                icon: const Icon(Icons.help_outline),
                label: Text(strings.supportAccess),
              ),
            ),
            const SizedBox(height: VardhnamSpacing.large),
            _WeatherUnavailableCard(strings: strings),
            const SizedBox(height: VardhnamSpacing.large),
            _KisanClubDashboardCard(
              state: ref.watch(kisanClubMembershipProvider),
              onRetry: () => ref.invalidate(kisanClubMembershipProvider),
            ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            VardhnamSectionHeader(title: strings.homeQuickActionsTitle),
            const SizedBox(height: VardhnamSpacing.medium),
            _QuickActions(strings: strings),
            const SizedBox(height: VardhnamSpacing.xLarge),
            // Blueprint §10.5 and §10.6. Both hide themselves when there is
            // nothing to show, so a farmer with no crop and no order in flight
            // sees a shorter home screen rather than two empty states.
            const HomeActiveCropCard(),
            const HomeActiveOrderCard(),
            VardhnamSectionHeader(
              title: strings.myFarmsTitle,
              actionLabel: strings.homeViewAllAction,
              onAction: () => context.push(AppRoutes.farms),
            ),
            const SizedBox(height: VardhnamSpacing.medium),
            VardhnamInfoCard(
              backgroundColor: VardhnamColors.surfaceGreen,
              onTap: () => context.push(AppRoutes.farms),
              child: Row(
                children: [
                  const Icon(
                    Icons.grass,
                    size: 36,
                    color: VardhnamColors.primaryGreen,
                  ),
                  const SizedBox(width: VardhnamSpacing.medium),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          strings.homeFarmCardTitle,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: VardhnamSpacing.xSmall),
                        Text(strings.myFarmsSubtitle),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            // Blueprint §10.7: one small real product strip instead of a static
            // teaser card. Hides itself when discovery has nothing for this
            // pincode.
            const HomeRecommendedProductsSection(),
            const SizedBox(height: VardhnamSpacing.large),
            VardhnamActionCard(
              icon: Icons.manage_accounts_outlined,
              label: strings.farmProfile,
              onTap: () => context.push(AppRoutes.profile),
            ),
          ],
        ),
      ),
      // The navigation bar belongs to VardhnamTabShell now, so it persists
      // across every tab instead of only appearing here.
    );
  }

  Future<void> _selectLanguage(
    BuildContext context,
    WidgetRef ref,
    String languageCode,
  ) async {
    try {
      await ref
          .read(localeControllerProvider.notifier)
          .selectLanguage(languageCode);
    } on Exception {
      if (context.mounted) {
        final strings = AppLocalizations.of(context)!;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(strings.languageSaveFailed)));
      }
    }
  }
}

class _HomeAppBarTitle extends ConsumerWidget {
  const _HomeAppBarTitle();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;
    final profile = ref
        .watch(farmerProfileProvider)
        .when<FarmerProfile?>(
          data: (value) => value,
          error: (error, stackTrace) => null,
          loading: () => null,
        );
    final name = profile?.fullName.trim();
    final greeting = name == null || name.isEmpty
        ? strings.welcomeTitle
        : strings.homeGreeting(name);
    final location = profile == null
        ? strings.homeLocationContext
        : _selectedLocation(strings, profile);

    return Row(
      children: [
        Semantics(
          image: true,
          label: strings.appTitle,
          child: ExcludeSemantics(
            child: Image.asset(
              AppAssets.vardhnamLogoFull,
              width: 44,
              height: 44,
              fit: BoxFit.contain,
            ),
          ),
        ),
        const SizedBox(width: VardhnamSpacing.small),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(
                  greeting,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Semantics(
                button: true,
                label: location,
                child: InkWell(
                  onTap: () => context.push(AppRoutes.addresses),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.location_on_outlined,
                          size: 16,
                          color: VardhnamColors.primaryGreen,
                        ),
                        const SizedBox(width: VardhnamSpacing.xSmall),
                        Expanded(
                          child: Text(
                            location,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                        const Icon(Icons.expand_more, size: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _selectedLocation(AppLocalizations strings, FarmerProfile profile) {
    FarmerAddress? selectedAddress;
    for (final address in profile.addresses) {
      if (address.isDefault) {
        selectedAddress = address;
        break;
      }
    }
    selectedAddress ??= profile.addresses.isEmpty
        ? null
        : profile.addresses.first;

    final pincode = _firstNonEmpty([
      selectedAddress?.pincode,
      profile.primaryPincode,
    ]);
    final locality = _firstNonEmpty([
      selectedAddress?.village,
      selectedAddress?.district,
      selectedAddress?.city,
      profile.village,
      profile.district,
      profile.state,
    ]);

    if (locality != null && pincode != null) {
      return strings.homeLocationWithPincode(locality, pincode);
    }
    if (locality != null) return locality;
    if (pincode != null) return strings.homePincodeOnly(pincode);
    return strings.homeLocationContext;
  }

  String? _firstNonEmpty(Iterable<String?> values) {
    for (final value in values) {
      final trimmed = value?.trim();
      if (trimmed != null && trimmed.isNotEmpty) return trimmed;
    }
    return null;
  }
}

class _WeatherUnavailableCard extends StatelessWidget {
  const _WeatherUnavailableCard({required this.strings});

  final AppLocalizations strings;

  @override
  Widget build(BuildContext context) => VardhnamInfoCard(
    child: Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: const BoxDecoration(
            color: VardhnamColors.surfaceGreen,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.cloud_outlined,
            color: VardhnamColors.primaryGreen,
          ),
        ),
        const SizedBox(width: VardhnamSpacing.medium),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                strings.homeWeatherTitle,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: VardhnamSpacing.xSmall),
              Text(strings.homeWeatherUnavailable),
            ],
          ),
        ),
      ],
    ),
  );
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.strings});

  final AppLocalizations strings;

  @override
  Widget build(BuildContext context) {
    final actions = [
      (
        icon: Icons.grass_outlined,
        label: strings.myFarmsTitle,
        route: AppRoutes.farms,
      ),
      (
        icon: Icons.eco_outlined,
        label: strings.advisoryTitle,
        route: AppRoutes.advisories,
      ),
      (
        icon: Icons.support_agent_outlined,
        label: strings.myPromoterTitle,
        route: AppRoutes.myPromoter,
      ),
      (
        icon: Icons.help_outline,
        label: strings.supportAccess,
        route: AppRoutes.support,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        final oneColumn = constraints.maxWidth < 340 || textScale > 1.3;
        final width = oneColumn
            ? constraints.maxWidth
            : (constraints.maxWidth - VardhnamSpacing.medium) / 2;
        return Wrap(
          spacing: VardhnamSpacing.medium,
          runSpacing: VardhnamSpacing.medium,
          children: [
            for (final action in actions)
              SizedBox(
                width: width,
                child: VardhnamActionCard(
                  icon: action.icon,
                  label: action.label,
                  onTap: () => context.push(action.route),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _KisanClubDashboardCard extends StatelessWidget {
  const _KisanClubDashboardCard({required this.state, required this.onRetry});

  final AsyncValue<KisanClubMembershipAvailability> state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return state.when(
      loading: () => const VardhnamSkeleton(height: 176),
      error: (error, stackTrace) => VardhnamErrorState(
        message: strings.kisanClubLoadFailed,
        retryLabel: strings.retryActionLabel,
        onRetry: onRetry,
      ),
      data: (availability) {
        if (!availability.isEnabled) return const SizedBox.shrink();
        final membership = availability.membership;
        final title = membership == null
            ? strings.kisanClubJoinTitle
            : strings.kisanClubOpenAction;
        final subtitle = membership == null
            ? strings.kisanClubJoinSubtitle
            : _membershipCardSubtitle(strings, membership.status);
        final route = membership == null
            ? AppRoutes.kisanClubJoin
            : AppRoutes.kisanClub;

        return VardhnamInfoCard(
          backgroundColor: VardhnamColors.surfaceOrange,
          borderColor: VardhnamColors.saffron,
          onTap: () => context.push(route),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final textScale = MediaQuery.textScalerOf(context).scale(1);
              final stacked = constraints.maxWidth < 360 || textScale > 1.3;
              final copy = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    strings.kisanClubFreeBadge,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: VardhnamColors.primaryGreenDark,
                    ),
                  ),
                  const SizedBox(height: VardhnamSpacing.small),
                  Text(title, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: VardhnamSpacing.small),
                  Text(subtitle),
                  const SizedBox(height: VardhnamSpacing.medium),
                  FilledButton(
                    onPressed: () => context.push(route),
                    child: Text(
                      membership == null
                          ? strings.kisanClubJoinAction
                          : strings.kisanClubOpenAction,
                    ),
                  ),
                ],
              );
              final image = SizedBox(
                width: 112,
                child: VardhnamImageFrame(
                  aspectRatio: 1,
                  semanticLabel: strings.kisanClubPlaceholderLabel,
                  placeholder: const Icon(
                    Icons.agriculture,
                    size: 52,
                    color: VardhnamColors.saffron,
                  ),
                ),
              );
              if (stacked) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [copy, const SizedBox(height: 16), image],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(child: copy),
                  const SizedBox(width: VardhnamSpacing.medium),
                  image,
                ],
              );
            },
          ),
        );
      },
    );
  }

  String _membershipCardSubtitle(
    AppLocalizations strings,
    KisanClubMembershipStatus status,
  ) => switch (status) {
    KisanClubMembershipStatus.pendingProfile =>
      strings.kisanClubCompleteProfileMessage,
    KisanClubMembershipStatus.awaitingPromoter =>
      strings.kisanClubFindingPromoterMessage,
    KisanClubMembershipStatus.active => strings.kisanClubActiveMessage,
    KisanClubMembershipStatus.suspended => strings.kisanClubSuspendedMessage,
    KisanClubMembershipStatus.inactive ||
    KisanClubMembershipStatus.closed => strings.kisanClubInactiveMessage,
  };
}
