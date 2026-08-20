import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../farms/farm_repository.dart';
import 'crop_detail_screen.dart';

class FarmDetailScreen extends StatelessWidget {
  const FarmDetailScreen({
    required this.farm,
    required this.onEdit,
    required this.onAddCrop,
    required this.onEditCrop,
    required this.onOpenDiary,
    super.key,
  });

  final FarmerFarm farm;
  final Future<void> Function() onEdit;
  final Future<void> Function() onAddCrop;
  final Future<void> Function(FarmCropCycleSummary cycle) onEditCrop;
  final Future<void> Function(FarmCropCycleSummary cycle) onOpenDiary;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    final activeCrops = farm.cropCycles
        .where(
          (cycle) =>
              cycle.status == CropCycleStatus.active ||
              cycle.status == CropCycleStatus.planned,
        )
        .toList(growable: false);
    final previousCrops = farm.cropCycles
        .where(
          (cycle) =>
              cycle.status == CropCycleStatus.harvested ||
              cycle.status == CropCycleStatus.abandoned,
        )
        .toList(growable: false);

    return Scaffold(
      appBar: AppBar(
        title: Text(farm.name),
        actions: [
          IconButton(
            tooltip: strings.editFarmAction,
            onPressed: () async {
              await onEdit();
              if (context.mounted) Navigator.pop(context);
            },
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(VardhnamSpacing.large),
          children: [
            VardhnamInfoCard(
              backgroundColor: VardhnamColors.surfaceGreen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.landscape_outlined,
                        size: 40,
                        color: VardhnamColors.primaryGreenDark,
                      ),
                      const SizedBox(width: VardhnamSpacing.medium),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              farm.name,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                            const SizedBox(height: VardhnamSpacing.xSmall),
                            Text(_farmLocation(strings, farm)),
                            Text(
                              strings.farmAreaAndPincode(
                                _number(farm.areaAcres),
                                farm.pincode,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: VardhnamSpacing.medium),
                  Wrap(
                    spacing: VardhnamSpacing.small,
                    runSpacing: VardhnamSpacing.small,
                    children: [
                      VardhnamStatusChip(
                        label: _ownershipLabel(strings, farm.ownershipType),
                        icon: Icons.key_outlined,
                      ),
                      VardhnamStatusChip(
                        label: farm.isActive
                            ? strings.farmStatusActive
                            : strings.farmStatusInactive,
                        icon: farm.isActive
                            ? Icons.check_circle_outline
                            : Icons.pause_circle_outline,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            VardhnamSectionHeader(title: strings.currentCropsTitle),
            const SizedBox(height: VardhnamSpacing.medium),
            if (activeCrops.isEmpty)
              VardhnamEmptyState(
                icon: Icons.grass_outlined,
                title: strings.noActiveCropTitle,
                message: strings.noCropCyclesYet,
                actionLabel: farm.isActive ? strings.addCropCycleAction : null,
                onAction: farm.isActive
                    ? () async {
                        await onAddCrop();
                        if (context.mounted) Navigator.pop(context);
                      }
                    : null,
              )
            else
              for (final cycle in activeCrops) ...[
                _CropSummaryCard(
                  farm: farm,
                  cycle: cycle,
                  cropName: isHindi ? cycle.cropNameHi : cycle.cropNameEn,
                  onOpen: () => _openCrop(context, cycle),
                ),
                const SizedBox(height: VardhnamSpacing.medium),
              ],
            if (farm.isActive && activeCrops.isNotEmpty)
              OutlinedButton.icon(
                onPressed: () async {
                  await onAddCrop();
                  if (context.mounted) Navigator.pop(context);
                },
                icon: const Icon(Icons.add),
                label: Text(strings.addCropCycleAction),
              ),
            if (previousCrops.isNotEmpty) ...[
              const SizedBox(height: VardhnamSpacing.xLarge),
              VardhnamSectionHeader(title: strings.previousCropsTitle),
              const SizedBox(height: VardhnamSpacing.medium),
              for (final cycle in previousCrops) ...[
                _CropSummaryCard(
                  farm: farm,
                  cycle: cycle,
                  cropName: isHindi ? cycle.cropNameHi : cycle.cropNameEn,
                  onOpen: () => _openCrop(context, cycle),
                ),
                const SizedBox(height: VardhnamSpacing.medium),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _openCrop(
    BuildContext context,
    FarmCropCycleSummary cycle,
  ) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => CropDetailScreen(
          farm: farm,
          cycle: cycle,
          onEdit: () => onEditCrop(cycle),
          onOpenDiary: () => onOpenDiary(cycle),
        ),
      ),
    );
  }
}

class _CropSummaryCard extends StatelessWidget {
  const _CropSummaryCard({
    required this.farm,
    required this.cycle,
    required this.cropName,
    required this.onOpen,
  });

  final FarmerFarm farm;
  final FarmCropCycleSummary cycle;
  final String cropName;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return VardhnamInfoCard(
      onTap: onOpen,
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(
              color: VardhnamColors.surfaceGreen,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.grass,
              color: VardhnamColors.primaryGreenDark,
            ),
          ),
          const SizedBox(width: VardhnamSpacing.medium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(cropName, style: Theme.of(context).textTheme.titleMedium),
                Text('${_number(cycle.areaAcres)} ${strings.acresUnit}'),
                if (cycle.daysAfterSowing case final days?)
                  Text(strings.homeActiveCropDay(days)),
                Text(cycle.season),
              ],
            ),
          ),
          const Icon(Icons.chevron_right),
        ],
      ),
    );
  }
}

String _farmLocation(AppLocalizations strings, FarmerFarm farm) {
  final parts = [farm.village, farm.district, farm.state]
      .whereType<String>()
      .where((value) => value.trim().isNotEmpty)
      .toList(growable: false);
  return parts.isEmpty ? strings.farmLocationUnavailable : parts.join(', ');
}

String _number(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(1);

String _ownershipLabel(AppLocalizations strings, FarmOwnershipType value) =>
    switch (value) {
      FarmOwnershipType.owned => strings.farmOwnershipOwned,
      FarmOwnershipType.leased => strings.farmOwnershipLeased,
      FarmOwnershipType.sharecropped => strings.farmOwnershipSharecropped,
      FarmOwnershipType.other => strings.farmOwnershipOther,
    };
