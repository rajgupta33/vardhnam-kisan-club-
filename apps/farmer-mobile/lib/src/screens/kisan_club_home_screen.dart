import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../advisory/advisory_repository.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../crop_doctor/crop_doctor_feature.dart';
import '../core/widgets/vardhnam_image_frame.dart';
import '../kisan_club/kisan_club_membership_repository.dart';
import '../kisan_club/kisan_club_models.dart';
import '../profile/farmer_profile_repository.dart';
import '../routing/app_routes.dart';
import 'home_sections.dart';

/// The first current, server-approved advisory for the Club dashboard.
///
/// The full advisory list remains authoritative; this provider only selects a
/// concise dashboard summary and never generates crop guidance locally.
final kisanClubDashboardAdvisoryProvider =
    FutureProvider.autoDispose<FarmerAdvisory?>((ref) async {
      final page = await ref.watch(advisoryRepositoryProvider).list(limit: 5);
      for (final advisory in page.items) {
        if (advisory.status != AdvisoryStatus.dismissed) return advisory;
      }
      return null;
    });

class KisanClubHomeScreen extends ConsumerWidget {
  const KisanClubHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;
    final state = ref.watch(kisanClubMembershipProvider);
    return Scaffold(
      appBar: AppBar(title: Text(strings.kisanClubTitle)),
      body: SafeArea(
        child: state.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(VardhnamSpacing.large),
            children: [
              Semantics(
                liveRegion: true,
                child: Text(strings.kisanClubLoading),
              ),
              const SizedBox(height: VardhnamSpacing.medium),
              const VardhnamSkeleton(height: 220),
              const SizedBox(height: VardhnamSpacing.medium),
              const VardhnamSkeleton(height: 120),
            ],
          ),
          error: (error, stackTrace) => VardhnamEmptyState(
            icon: Icons.cloud_off_outlined,
            title: strings.kisanClubLoadFailed,
            message: strings.networkErrorMessage,
            actionLabel: strings.retryActionLabel,
            onAction: () => ref.invalidate(kisanClubMembershipProvider),
          ),
          data: (availability) {
            if (!availability.isEnabled) {
              return VardhnamEmptyState(
                icon: Icons.agriculture_outlined,
                title: strings.kisanClubTitle,
                message: strings.kisanClubUnavailable,
              );
            }
            final membership = availability.membership;
            if (membership == null) return const _JoinLanding();
            return _MembershipHome(membership: membership);
          },
        ),
      ),
    );
  }
}

class _JoinLanding extends StatelessWidget {
  const _JoinLanding();

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return ListView(
      padding: const EdgeInsets.all(VardhnamSpacing.large),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: VardhnamImageFrame(
              aspectRatio: 4 / 3,
              semanticLabel: strings.kisanClubPlaceholderLabel,
              placeholder: const Icon(
                Icons.agriculture,
                size: 72,
                color: VardhnamColors.leafGreen,
              ),
            ),
          ),
        ),
        const SizedBox(height: VardhnamSpacing.xLarge),
        Text(
          strings.kisanClubTitle,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: VardhnamSpacing.small),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: VardhnamStatusChip(
            label: strings.kisanClubFreeBadge,
            icon: Icons.check_circle_outline,
            backgroundColor: VardhnamColors.surfaceOrange,
            foregroundColor: VardhnamColors.primaryGreenDark,
          ),
        ),
        const SizedBox(height: VardhnamSpacing.medium),
        Text(
          strings.kisanClubLandingDescription,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: VardhnamSpacing.xLarge),
        _BenefitRow(
          icon: Icons.eco_outlined,
          label: strings.kisanClubLandingAdvisoryBenefit,
        ),
        _BenefitRow(
          icon: Icons.support_agent_outlined,
          label: strings.kisanClubLandingPromoterBenefit,
        ),
        _BenefitRow(
          icon: Icons.local_offer_outlined,
          label: strings.kisanClubLandingProductBenefit,
        ),
        _BenefitRow(
          icon: Icons.grass_outlined,
          label: strings.kisanClubLandingFarmBenefit,
        ),
        const SizedBox(height: VardhnamSpacing.large),
        FilledButton.icon(
          onPressed: () => context.push(AppRoutes.kisanClubJoin),
          icon: const Icon(Icons.agriculture),
          label: Text(strings.kisanClubJoinTitle),
        ),
        const SizedBox(height: VardhnamSpacing.small),
        Text(
          strings.kisanClubNoMembershipFee,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: VardhnamSpacing.medium),
    child: Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: const BoxDecoration(
            color: VardhnamColors.surfaceGreen,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: VardhnamColors.primaryGreenDark),
        ),
        const SizedBox(width: VardhnamSpacing.medium),
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.titleMedium),
        ),
      ],
    ),
  );
}

class _MembershipHome extends ConsumerWidget {
  const _MembershipHome({required this.membership});

  final KisanClubMembership membership;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;
    final cropDoctorEnabled = ref.watch(cropDoctorShellEnabledProvider);
    final activeOrAwaiting =
        membership.status == KisanClubMembershipStatus.active ||
        membership.status == KisanClubMembershipStatus.awaitingPromoter;
    return ListView(
      padding: const EdgeInsets.all(VardhnamSpacing.large),
      children: [
        _MemberHeader(membership: membership),
        const SizedBox(height: VardhnamSpacing.medium),
        _StatusCard(membership: membership),
        const SizedBox(height: VardhnamSpacing.xLarge),
        if (activeOrAwaiting) ...[
          const HomeActiveCropCard(),
          if (membership.advisoryConsent) const _TodayAdvisorySection(),
          VardhnamSectionHeader(title: strings.kisanClubCropProblemTitle),
          const SizedBox(height: VardhnamSpacing.medium),
          VardhnamInfoCard(
            backgroundColor: VardhnamColors.surfaceOrange,
            onTap: () => context.push(
              cropDoctorEnabled
                  ? AppRoutes.cropDoctor
                  : AppRoutes.newSupportTicket,
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.add_a_photo_outlined,
                  size: 36,
                  color: VardhnamColors.primaryGreenDark,
                ),
                const SizedBox(width: VardhnamSpacing.medium),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        strings.kisanClubCropProblemAction,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: VardhnamSpacing.xSmall),
                      Text(strings.kisanClubCropProblemMessage),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
          ),
          const SizedBox(height: VardhnamSpacing.xLarge),
          VardhnamSectionHeader(title: strings.kisanClubSupportSection),
          const SizedBox(height: VardhnamSpacing.medium),
          VardhnamActionCard(
            icon: Icons.support_agent_outlined,
            label:
                membership.status == KisanClubMembershipStatus.awaitingPromoter
                ? strings.myPromoterAwaitingSubtitle
                : strings.myPromoterTitle,
            onTap: () => context.push(AppRoutes.myPromoter),
          ),
          const SizedBox(height: VardhnamSpacing.xLarge),
          VardhnamSectionHeader(title: strings.kisanClubProgrammeBenefitsTitle),
          const SizedBox(height: VardhnamSpacing.medium),
          VardhnamActionCard(
            icon: Icons.confirmation_number_outlined,
            label: strings.kisanClubBenefitsTitle,
            onTap: () => context.push(AppRoutes.kisanClubBenefits),
          ),
          const SizedBox(height: VardhnamSpacing.medium),
        ],
        if (membership.status != KisanClubMembershipStatus.closed) ...[
          VardhnamActionCard(
            icon: Icons.local_offer_outlined,
            label: strings.kisanClubCatalogueTitle,
            onTap: () => context.push(
              AppRoutes.kisanClubProducts(membership.homePincode),
            ),
          ),
          const SizedBox(height: VardhnamSpacing.xLarge),
          VardhnamSectionHeader(title: strings.myFarmsTitle),
          const SizedBox(height: VardhnamSpacing.medium),
          VardhnamActionCard(
            icon: Icons.landscape_outlined,
            label: strings.myFarmsSubtitle,
            onTap: () =>
                context.push(AppRoutes.myFarms(membership.homePincode)),
          ),
        ],
        const SizedBox(height: VardhnamSpacing.xLarge),
        _ConsentCard(
          key: ValueKey(
            '${membership.id}-${membership.advisoryConsent}-${membership.marketingConsent}-${membership.preciseLocationConsent}',
          ),
          membership: membership,
          onSaved: () => ref.invalidate(kisanClubMembershipProvider),
        ),
      ],
    );
  }
}

class _MemberHeader extends ConsumerWidget {
  const _MemberHeader({required this.membership});

  final KisanClubMembership membership;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;
    final farmerName = ref
        .watch(farmerProfileProvider)
        .when<String?>(
          data: (profile) {
            final name = profile.fullName.trim();
            return name.isEmpty ? null : name;
          },
          error: (error, stackTrace) => null,
          loading: () => null,
        );

    return VardhnamInfoCard(
      backgroundColor: VardhnamColors.surfaceGreen,
      borderColor: VardhnamColors.leafGreen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            strings.kisanClubTitle,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          if (farmerName != null) ...[
            const SizedBox(height: VardhnamSpacing.xSmall),
            Text(farmerName, style: Theme.of(context).textTheme.titleLarge),
          ],
          const SizedBox(height: VardhnamSpacing.small),
          VardhnamStatusChip(
            label: _statusLabel(strings, membership.status),
            icon: _statusIcon(membership.status),
          ),
          const SizedBox(height: VardhnamSpacing.medium),
          Text(strings.kisanClubMemberNumber(membership.memberNumber)),
          Text(strings.kisanClubHomePincode(membership.homePincode)),
        ],
      ),
    );
  }
}

class _TodayAdvisorySection extends ConsumerWidget {
  const _TodayAdvisorySection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;
    final state = ref.watch(kisanClubDashboardAdvisoryProvider);

    return Padding(
      padding: const EdgeInsets.only(bottom: VardhnamSpacing.xLarge),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          VardhnamSectionHeader(
            title: strings.kisanClubTodaySection,
            actionLabel: strings.homeViewAllAction,
            onAction: () => context.push(AppRoutes.advisories),
          ),
          const SizedBox(height: VardhnamSpacing.medium),
          state.when(
            loading: () => const VardhnamSkeleton(height: 132),
            error: (error, stackTrace) => VardhnamErrorState(
              message: strings.networkErrorMessage,
              retryLabel: strings.retryActionLabel,
              onRetry: () => ref.invalidate(kisanClubDashboardAdvisoryProvider),
            ),
            data: (advisory) {
              if (advisory == null) {
                return VardhnamInfoCard(
                  child: Row(
                    children: [
                      const Icon(
                        Icons.eco_outlined,
                        color: VardhnamColors.primaryGreen,
                      ),
                      const SizedBox(width: VardhnamSpacing.medium),
                      Expanded(child: Text(strings.advisoryEmpty)),
                    ],
                  ),
                );
              }
              return VardhnamInfoCard(
                backgroundColor: VardhnamColors.surfaceGreen,
                onTap: () => context.push(AppRoutes.advisory(advisory.id)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.eco_outlined,
                      size: 32,
                      color: VardhnamColors.primaryGreen,
                    ),
                    const SizedBox(width: VardhnamSpacing.medium),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            advisory.title,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: VardhnamSpacing.xSmall),
                          Text(strings.advisoryCropLabel(advisory.cropName)),
                          const SizedBox(height: VardhnamSpacing.xSmall),
                          Text(
                            advisory.body,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.membership});

  final KisanClubMembership membership;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final (message, actionLabel, route) = switch (membership.status) {
      KisanClubMembershipStatus.pendingProfile => (
        strings.kisanClubCompleteProfileMessage,
        strings.kisanClubCompleteProfileAction,
        AppRoutes.completeKisanClubProfile(membership.homePincode),
      ),
      KisanClubMembershipStatus.awaitingPromoter => (
        strings.kisanClubFindingPromoterMessage,
        null,
        null,
      ),
      KisanClubMembershipStatus.active => (
        strings.kisanClubActiveMessage,
        null,
        null,
      ),
      KisanClubMembershipStatus.suspended => (
        membership.suspendedReason ?? strings.kisanClubSuspendedMessage,
        strings.kisanClubOpenSupportAction,
        AppRoutes.support,
      ),
      KisanClubMembershipStatus.inactive ||
      KisanClubMembershipStatus.closed => (
        strings.kisanClubInactiveMessage,
        strings.kisanClubOpenSupportAction,
        AppRoutes.support,
      ),
    };
    return VardhnamAlertCard(
      icon: _statusIcon(membership.status),
      title: _statusLabel(strings, membership.status),
      message: message,
      actionLabel: actionLabel,
      onAction: route == null ? null : () => context.push(route),
      backgroundColor: membership.status == KisanClubMembershipStatus.active
          ? VardhnamColors.surfaceGreen
          : VardhnamColors.surfaceOrange,
    );
  }
}

class _ConsentCard extends ConsumerStatefulWidget {
  const _ConsentCard({
    required this.membership,
    required this.onSaved,
    super.key,
  });

  final KisanClubMembership membership;
  final VoidCallback onSaved;

  @override
  ConsumerState<_ConsentCard> createState() => _ConsentCardState();
}

class _ConsentCardState extends ConsumerState<_ConsentCard> {
  late bool _advisory = widget.membership.advisoryConsent;
  late bool _marketing = widget.membership.marketingConsent;
  late bool _location = widget.membership.preciseLocationConsent;
  var _saving = false;

  Future<void> _save() async {
    final strings = AppLocalizations.of(context)!;
    setState(() => _saving = true);
    try {
      await ref
          .read(kisanClubMembershipRepositoryProvider)
          .updateConsents(
            KisanClubConsentInput(
              advisoryConsent: _advisory,
              marketingConsent: _marketing,
              preciseLocationConsent: _location,
            ),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.kisanClubConsentSaved)));
      widget.onSaved();
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(strings.kisanClubConsentSaveFailed)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final editable = widget.membership.status.canEdit;
    return VardhnamInfoCard(
      padding: EdgeInsets.zero,
      child: ExpansionTile(
        leading: const Icon(Icons.tune_outlined),
        title: Text(strings.kisanClubMembershipSettingsTitle),
        subtitle: Text(strings.kisanClubOptionalConsentsMessage),
        childrenPadding: const EdgeInsets.fromLTRB(
          VardhnamSpacing.large,
          0,
          VardhnamSpacing.large,
          VardhnamSpacing.large,
        ),
        children: [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _advisory,
            title: Text(strings.kisanClubAdvisoryConsent),
            onChanged: editable && !_saving
                ? (value) => setState(() => _advisory = value)
                : null,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _marketing,
            title: Text(strings.kisanClubMarketingConsent),
            onChanged: editable && !_saving
                ? (value) => setState(() => _marketing = value)
                : null,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _location,
            title: Text(strings.kisanClubLocationConsent),
            subtitle: Text(strings.kisanClubLocationConsentHelp),
            onChanged: editable && !_saving
                ? (value) => setState(() => _location = value)
                : null,
          ),
          if (editable)
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(strings.kisanClubSaveConsentsAction),
              ),
            ),
        ],
      ),
    );
  }
}

String _statusLabel(
  AppLocalizations strings,
  KisanClubMembershipStatus status,
) => switch (status) {
  KisanClubMembershipStatus.pendingProfile =>
    strings.kisanClubStatusPendingProfile,
  KisanClubMembershipStatus.awaitingPromoter =>
    strings.kisanClubStatusAwaitingPromoter,
  KisanClubMembershipStatus.active => strings.kisanClubStatusActive,
  KisanClubMembershipStatus.suspended => strings.kisanClubStatusSuspended,
  KisanClubMembershipStatus.inactive => strings.kisanClubStatusInactive,
  KisanClubMembershipStatus.closed => strings.kisanClubStatusClosed,
};

IconData _statusIcon(KisanClubMembershipStatus status) => switch (status) {
  KisanClubMembershipStatus.active => Icons.check_circle_outline,
  KisanClubMembershipStatus.pendingProfile => Icons.edit_note_outlined,
  KisanClubMembershipStatus.awaitingPromoter => Icons.person_search_outlined,
  KisanClubMembershipStatus.suspended => Icons.pause_circle_outline,
  KisanClubMembershipStatus.inactive => Icons.info_outline,
  KisanClubMembershipStatus.closed => Icons.lock_outline,
};
