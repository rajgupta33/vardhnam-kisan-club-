import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../kisan_club/promoter_club_models.dart';
import '../kisan_club/promoter_club_repository.dart';
import '../routing/partner_routes.dart';

class PromoterClubFarmerDetailScreen extends ConsumerStatefulWidget {
  const PromoterClubFarmerDetailScreen({required this.membershipId, super.key});

  final String membershipId;

  @override
  ConsumerState<PromoterClubFarmerDetailScreen> createState() =>
      _PromoterClubFarmerDetailScreenState();
}

class _PromoterClubFarmerDetailScreenState
    extends ConsumerState<PromoterClubFarmerDetailScreen> {
  late Future<PromoterFarmerSummary> _farmer;

  @override
  void initState() {
    super.initState();
    _farmer = _load();
  }

  Future<PromoterFarmerSummary> _load() => ref
      .read(promoterClubRepositoryProvider)
      .getAssignedFarmer(widget.membershipId);

  void _retry() => setState(() => _farmer = _load());

  Future<void> _openSurvey(String membershipId) async {
    final created = await context.push<bool>(
      PartnerRoutes.surveyForFarmer(membershipId),
    );
    if (created == true && mounted) _retry();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.kisanClub)),
      body: FutureBuilder<PromoterFarmerSummary>(
        future: _farmer,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(strings.loadFailed),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _retry,
                    child: Text(strings.tryAgain),
                  ),
                ],
              ),
            );
          }
          final farmer = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                farmer.fullName,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text(strings.memberNumber(farmer.memberNumber)),
              Text(
                strings.farmerLocation(
                  farmer.village ?? '—',
                  farmer.district ?? '—',
                  farmer.pincode,
                ),
              ),
              const SizedBox(height: 20),
              for (final farm in farmer.farms) _FarmCard(farm: farm),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => _openSurvey(farmer.membershipId),
                icon: const Icon(Icons.agriculture),
                label: Text(strings.recordFarmSurvey),
              ),
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: () => context.push(
                  PartnerRoutes.redeemForFarmer(farmer.membershipId),
                ),
                icon: const Icon(Icons.redeem),
                label: Text(strings.redeemBenefitToken),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _FarmCard extends StatelessWidget {
  const _FarmCard({required this.farm});

  final PromoterFarm farm;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(farm.name, style: Theme.of(context).textTheme.titleMedium),
            Text(strings.farmArea(farm.areaAcres)),
            if (!farm.isActive) Text(strings.inactiveFarm),
            const SizedBox(height: 8),
            for (final crop in farm.cropCycles)
              Text(strings.cropSummary(crop.crop, crop.areaAcres, crop.status)),
          ],
        ),
      ),
    );
  }
}
