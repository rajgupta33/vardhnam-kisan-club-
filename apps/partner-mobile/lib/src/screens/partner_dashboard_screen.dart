import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../auth/partner_auth_models.dart';
import '../auth/partner_session_controller.dart';
import 'delivery_availability_card.dart';
import '../localization/partner_locale_controller.dart';
import '../routing/partner_routes.dart';

class PartnerDashboardScreen extends ConsumerWidget {
  const PartnerDashboardScreen({required this.role, super.key});

  final PartnerRole role;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context);
    final session = ref.watch(partnerSessionControllerProvider);
    final roleName = _roleLabel(strings, role);
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.welcomeRole(roleName)),
        actions: [
          PopupMenuButton<String>(
            tooltip: strings.language,
            icon: const Icon(Icons.language),
            onSelected: (value) => ref
                .read(partnerLocaleControllerProvider.notifier)
                .select(value),
            itemBuilder: (context) => [
              PopupMenuItem(value: 'en', child: Text(strings.english)),
              PopupMenuItem(value: 'hi', child: Text(strings.hindi)),
            ],
          ),
          IconButton(
            tooltip: strings.logout,
            onPressed: () =>
                ref.read(partnerSessionControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Icon(_roleIcon(role), size: 56),
            const SizedBox(height: 16),
            Text(
              strings.welcomeRole(roleName),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(_boundary(strings, role)),
            const SizedBox(height: 16),
            if (session != null)
              Text(
                strings.signedInOrganisation(
                  session.organisationName ?? session.organisationId,
                ),
              ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () => context.push(PartnerRoutes.earnings),
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: Text(strings.earningsStatement),
            ),
            if (role == PartnerRole.promoter ||
                role == PartnerRole.salesPartner) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => context.push(PartnerRoutes.farmerLeads),
                icon: const Icon(Icons.person_search),
                label: Text(strings.farmerLeads),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => context.push(PartnerRoutes.promoterTerritory),
                icon: const Icon(Icons.map_outlined),
                label: Text(strings.myTerritory),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => context.push(PartnerRoutes.promoterVisits),
                icon: const Icon(Icons.place_outlined),
                label: Text(strings.promoterVisits),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => context.push(PartnerRoutes.kisanClub),
                icon: const Icon(Icons.agriculture),
                label: Text(strings.kisanClub),
              ),
            ],
            if (role == PartnerRole.deliveryPartner) ...[
              const SizedBox(height: 24),
              const DeliveryAvailabilityCard(),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () =>
                    context.push(PartnerRoutes.deliveryAssignments),
                icon: const Icon(Icons.assignment_outlined),
                label: Text(strings.deliveryAssignments),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => context.push(PartnerRoutes.returnPickups),
                icon: const Icon(Icons.assignment_return_outlined),
                label: Text(strings.returnPickups),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _roleLabel(AppLocalizations strings, PartnerRole role) => switch (role) {
  PartnerRole.promoter => strings.promoterRole,
  PartnerRole.salesPartner => strings.salesPartnerRole,
  PartnerRole.serviceProvider => strings.serviceProviderRole,
  PartnerRole.deliveryPartner => strings.deliveryPartnerRole,
};

String _boundary(AppLocalizations strings, PartnerRole role) => switch (role) {
  PartnerRole.promoter => strings.promoterBoundary,
  PartnerRole.salesPartner => strings.salesPartnerBoundary,
  PartnerRole.serviceProvider => strings.serviceProviderBoundary,
  PartnerRole.deliveryPartner => strings.deliveryPartnerBoundary,
};

IconData _roleIcon(PartnerRole role) => switch (role) {
  PartnerRole.promoter => Icons.groups,
  PartnerRole.salesPartner => Icons.handshake,
  PartnerRole.serviceProvider => Icons.agriculture,
  PartnerRole.deliveryPartner => Icons.local_shipping,
};
