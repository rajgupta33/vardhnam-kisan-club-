import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../advisory/advisory_repository.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../core/widgets/vardhnam_image_frame.dart';
import '../crop_doctor/crop_doctor_feature.dart';
import '../farms/farm_repository.dart';
import '../network/api_error_presentation.dart';
import '../routing/app_routes.dart';

class CropDetailScreen extends ConsumerStatefulWidget {
  const CropDetailScreen({
    required this.farm,
    required this.cycle,
    required this.onEdit,
    required this.onOpenDiary,
    super.key,
  });

  final FarmerFarm farm;
  final FarmCropCycleSummary cycle;
  final Future<void> Function() onEdit;
  final Future<void> Function() onOpenDiary;

  @override
  ConsumerState<CropDetailScreen> createState() => _CropDetailScreenState();
}

class _CropDetailScreenState extends ConsumerState<CropDetailScreen> {
  List<FarmerAdvisory>? _advisories;
  Object? _advisoryError;

  @override
  void initState() {
    super.initState();
    _loadAdvisories();
  }

  Future<void> _loadAdvisories() async {
    try {
      final page = await ref.read(advisoryRepositoryProvider).list(limit: 100);
      if (!mounted) return;
      setState(() {
        _advisories =
            page.items
                .where(
                  (item) =>
                      item.cropCycleId == widget.cycle.id &&
                      item.status != AdvisoryStatus.dismissed,
                )
                .toList(growable: false)
              ..sort((a, b) => a.dueOn.compareTo(b.dueOn));
      });
    } catch (error) {
      if (mounted) setState(() => _advisoryError = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    final cycle = widget.cycle;
    final farm = widget.farm;
    final cropName = isHindi ? cycle.cropNameHi : cycle.cropNameEn;
    final today = DateUtils.dateOnly(DateTime.now());
    final nextWeek = today.add(const Duration(days: 7));
    final currentAdvisories = (_advisories ?? const <FarmerAdvisory>[])
        .where((item) => DateUtils.dateOnly(item.dueOn) == today)
        .toList(growable: false);
    final upcomingAdvisories = (_advisories ?? const <FarmerAdvisory>[])
        .where((item) {
          final due = DateUtils.dateOnly(item.dueOn);
          return due.isAfter(today) && !due.isAfter(nextWeek);
        })
        .toList(growable: false);

    return Scaffold(
      appBar: AppBar(
        title: Text(cropName),
        actions: [
          if (cycle.status == CropCycleStatus.active ||
              cycle.status == CropCycleStatus.planned)
            IconButton(
              tooltip: strings.editCropCycleAction,
              onPressed: () async {
                await widget.onEdit();
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
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: VardhnamImageFrame(
                  aspectRatio: 3 / 2,
                  semanticLabel: strings.cropImagePlaceholderLabel(cropName),
                  placeholder: const Icon(
                    Icons.grass,
                    size: 72,
                    color: VardhnamColors.leafGreen,
                  ),
                ),
              ),
            ),
            const SizedBox(height: VardhnamSpacing.large),
            Text(cropName, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: VardhnamSpacing.xSmall),
            Text(farm.name, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: VardhnamSpacing.medium),
            Wrap(
              spacing: VardhnamSpacing.small,
              runSpacing: VardhnamSpacing.small,
              children: [
                VardhnamStatusChip(
                  label: '${_number(cycle.areaAcres)} ${strings.acresUnit}',
                  icon: Icons.square_foot_outlined,
                ),
                VardhnamStatusChip(
                  label: _cropStatusLabel(strings, cycle.status),
                  icon: _cropStatusIcon(cycle.status),
                ),
                if (cycle.daysAfterSowing case final days?)
                  VardhnamStatusChip(
                    label: strings.homeActiveCropDay(days),
                    icon: Icons.calendar_today_outlined,
                  ),
              ],
            ),
            const SizedBox(height: VardhnamSpacing.medium),
            VardhnamInfoCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _DetailRow(
                    label: strings.cropSeasonLabel,
                    value: cycle.season,
                  ),
                  if (cycle.varietyName?.trim().isNotEmpty ?? false)
                    _DetailRow(
                      label: strings.cropVarietyDisplayLabel,
                      value: cycle.varietyName!,
                    ),
                ],
              ),
            ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            VardhnamSectionHeader(title: strings.cropTodayTitle),
            const SizedBox(height: VardhnamSpacing.medium),
            if (_advisories == null && _advisoryError == null)
              const Center(child: CircularProgressIndicator())
            else if (currentAdvisories.isNotEmpty)
              for (final advisory in currentAdvisories) ...[
                _AdvisoryTimelineCard(
                  advisory: advisory,
                  onTap: () => context.push(AppRoutes.advisory(advisory.id)),
                ),
                const SizedBox(height: VardhnamSpacing.small),
              ]
            else
              VardhnamAlertCard(
                icon: _advisoryError == null
                    ? Icons.verified_outlined
                    : Icons.cloud_off_outlined,
                title: strings.approvedGuidanceTitle,
                message: _advisoryError == null
                    ? strings.approvedGuidanceMessage
                    : apiErrorMessage(strings, _advisoryError!),
                backgroundColor: VardhnamColors.surfaceGreen,
              ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            VardhnamSectionHeader(title: strings.nextSevenDaysTitle),
            const SizedBox(height: VardhnamSpacing.medium),
            if (upcomingAdvisories.isEmpty)
              VardhnamInfoCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.calendar_month_outlined,
                      color: VardhnamColors.primaryGreenDark,
                    ),
                    const SizedBox(width: VardhnamSpacing.medium),
                    Expanded(child: Text(strings.cropPlanUnavailableMessage)),
                  ],
                ),
              )
            else
              VardhnamInfoCard(
                child: Column(
                  children: [
                    for (
                      var index = 0;
                      index < upcomingAdvisories.length;
                      index++
                    )
                      _AdvisoryTimelineCard(
                        advisory: upcomingAdvisories[index],
                        showConnector: index < upcomingAdvisories.length - 1,
                        onTap: () => context.push(
                          AppRoutes.advisory(upcomingAdvisories[index].id),
                        ),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            if (ref.watch(cropDoctorShellEnabledProvider)) ...[
              VardhnamAlertCard(
                icon: Icons.add_a_photo_outlined,
                title: strings.cropDoctorProblemTitle,
                message: strings.cropDoctorNoDiagnosisMessage,
                actionLabel: strings.cropDoctorOpenAction,
                onAction: () => context.push(AppRoutes.cropDoctor),
                backgroundColor: VardhnamColors.surfaceOrange,
              ),
              const SizedBox(height: VardhnamSpacing.xLarge),
            ],
            FilledButton.icon(
              onPressed: widget.onOpenDiary,
              icon: const Icon(Icons.menu_book_outlined),
              label: Text(strings.openCropDiaryAction),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdvisoryTimelineCard extends StatelessWidget {
  const _AdvisoryTimelineCard({
    required this.advisory,
    required this.onTap,
    this.showConnector = false,
  });

  final FarmerAdvisory advisory;
  final VoidCallback onTap;
  final bool showConnector;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final due = DateUtils.dateOnly(advisory.dueOn);
    final today = DateUtils.dateOnly(DateTime.now());
    final daysAway = due.difference(today).inDays;
    final dueLabel = daysAway == 0
        ? strings.cropTodayTitle
        : strings.homeActiveCropDay(daysAway);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: VardhnamSpacing.small),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                const Icon(
                  Icons.check_circle,
                  color: VardhnamColors.primaryGreenDark,
                ),
                if (showConnector)
                  Container(width: 2, height: 28, color: VardhnamColors.border),
              ],
            ),
            const SizedBox(width: VardhnamSpacing.medium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(dueLabel, style: Theme.of(context).textTheme.labelLarge),
                  Text(
                    advisory.title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    advisory.body,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: VardhnamSpacing.small),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label)),
        const SizedBox(width: VardhnamSpacing.medium),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
      ],
    ),
  );
}

String _cropStatusLabel(AppLocalizations strings, CropCycleStatus status) =>
    switch (status) {
      CropCycleStatus.planned => strings.cropStatusPlanned,
      CropCycleStatus.active => strings.cropStatusActive,
      CropCycleStatus.harvested => strings.cropStatusHarvested,
      CropCycleStatus.abandoned => strings.cropStatusAbandoned,
    };

IconData _cropStatusIcon(CropCycleStatus status) => switch (status) {
  CropCycleStatus.planned => Icons.schedule_outlined,
  CropCycleStatus.active => Icons.eco_outlined,
  CropCycleStatus.harvested => Icons.inventory_2_outlined,
  CropCycleStatus.abandoned => Icons.cancel_outlined,
};

String _number(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(1);
