import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../routing/app_routes.dart';

class CropDoctorScreen extends StatelessWidget {
  const CropDoctorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.cropDoctorTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(VardhnamSpacing.large),
          children: [
            VardhnamAlertCard(
              icon: Icons.photo_camera_outlined,
              title: strings.cropDoctorProblemTitle,
              message: strings.cropDoctorIntro,
              backgroundColor: VardhnamColors.surfaceOrange,
            ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            VardhnamSectionHeader(title: strings.cropDoctorPhotoGuideTitle),
            const SizedBox(height: VardhnamSpacing.medium),
            LayoutBuilder(
              builder: (context, constraints) {
                final cards = [
                  _PhotoGuideCard(
                    icon: Icons.center_focus_strong_outlined,
                    label: strings.cropDoctorGuideAffectedLeaf,
                  ),
                  _PhotoGuideCard(
                    icon: Icons.wb_sunny_outlined,
                    label: strings.cropDoctorGuideDaylight,
                  ),
                  _PhotoGuideCard(
                    icon: Icons.zoom_in_outlined,
                    label: strings.cropDoctorGuideClosePhoto,
                  ),
                ];
                if (constraints.maxWidth < 480) {
                  return Column(
                    children: [
                      for (var index = 0; index < cards.length; index++) ...[
                        cards[index],
                        if (index < cards.length - 1)
                          const SizedBox(height: VardhnamSpacing.small),
                      ],
                    ],
                  );
                }
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var index = 0; index < cards.length; index++) ...[
                      Expanded(child: cards[index]),
                      if (index < cards.length - 1)
                        const SizedBox(width: VardhnamSpacing.small),
                    ],
                  ],
                );
              },
            ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            VardhnamInfoCard(
              backgroundColor: VardhnamColors.surfaceGreen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    strings.cropDoctorCaptureUnavailableTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: VardhnamSpacing.xSmall),
                  Text(strings.cropDoctorCaptureUnavailableMessage),
                  const SizedBox(height: VardhnamSpacing.medium),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: null,
                          icon: const Icon(Icons.photo_camera_outlined),
                          label: Text(strings.cropDoctorTakePhotoAction),
                        ),
                      ),
                      const SizedBox(width: VardhnamSpacing.small),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: null,
                          icon: const Icon(Icons.photo_library_outlined),
                          label: Text(strings.cropDoctorChoosePhotoAction),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: VardhnamSpacing.xLarge),
            FilledButton.icon(
              onPressed: () => context.push(AppRoutes.newSupportTicket),
              icon: const Icon(Icons.support_agent_outlined),
              label: Text(strings.cropDoctorHumanHelpAction),
            ),
            const SizedBox(height: VardhnamSpacing.small),
            Text(
              strings.cropDoctorNoDiagnosisMessage,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _PhotoGuideCard extends StatelessWidget {
  const _PhotoGuideCard({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => VardhnamInfoCard(
    child: Column(
      children: [
        Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            color: VardhnamColors.surfaceGreen,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 42, color: VardhnamColors.primaryGreenDark),
        ),
        const SizedBox(height: VardhnamSpacing.medium),
        Text(label, textAlign: TextAlign.center),
      ],
    ),
  );
}
