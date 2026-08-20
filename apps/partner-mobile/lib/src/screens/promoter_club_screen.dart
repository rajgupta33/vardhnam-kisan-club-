import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../kisan_club/promoter_club_models.dart';
import '../kisan_club/promoter_club_repository.dart';
import '../routing/partner_routes.dart';

class PromoterClubScreen extends ConsumerStatefulWidget {
  const PromoterClubScreen({super.key});

  @override
  ConsumerState<PromoterClubScreen> createState() => _PromoterClubScreenState();
}

class _PromoterClubScreenState extends ConsumerState<PromoterClubScreen> {
  late Future<List<PromoterFarmerSummary>> _farmers;

  @override
  void initState() {
    super.initState();
    _farmers = _load();
  }

  Future<List<PromoterFarmerSummary>> _load() =>
      ref.read(promoterClubRepositoryProvider).listAssignedFarmers();

  Future<void> _refresh() async {
    final request = _load();
    setState(() => _farmers = request);
    await request;
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.assignedFarmers)),
      body: FutureBuilder<List<PromoterFarmerSummary>>(
        future: _farmers,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _LoadError(onRetry: _refresh);
          }
          final farmers = snapshot.data ?? const [];
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(strings.assignedFarmersHelp),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () =>
                      context.push(PartnerRoutes.kisanClubFulfilment),
                  icon: const Icon(Icons.inventory_2_outlined),
                  label: Text(strings.fulfilmentAssignments),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () =>
                      context.push(PartnerRoutes.kisanClubEarnings),
                  icon: const Icon(Icons.account_balance_wallet_outlined),
                  label: Text(strings.earningsStatement),
                ),
                const SizedBox(height: 12),
                if (farmers.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 48),
                    child: Center(child: Text(strings.noAssignedFarmers)),
                  ),
                for (final farmer in farmers)
                  Card(
                    child: ListTile(
                      title: Text(farmer.fullName),
                      subtitle: Text(
                        '${strings.memberNumber(farmer.memberNumber)}\n'
                        '${_location(strings, farmer)}\n'
                        '${strings.farmCount(farmer.farms.length)}',
                      ),
                      isThreeLine: true,
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push(
                        PartnerRoutes.farmer(farmer.membershipId),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

String _location(AppLocalizations strings, PromoterFarmerSummary farmer) =>
    strings.farmerLocation(
      farmer.village ?? '—',
      farmer.district ?? '—',
      farmer.pincode,
    );

class _LoadError extends StatelessWidget {
  const _LoadError({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(strings.loadFailed, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: Text(strings.tryAgain)),
          ],
        ),
      ),
    );
  }
}
