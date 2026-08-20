import 'package:flutter/material.dart';

import '../../app/theme/vardhnam_colors.dart';
import '../../app/theme/vardhnam_radius.dart';
import '../../app/theme/vardhnam_spacing.dart';
import 'vardhnam_image_frame.dart';

class VardhnamSectionHeader extends StatelessWidget {
  const VardhnamSectionHeader({
    required this.title,
    super.key,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Expanded(
        child: Semantics(
          header: true,
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
      ),
      if (actionLabel != null)
        TextButton(onPressed: onAction, child: Text(actionLabel!)),
    ],
  );
}

class VardhnamInfoCard extends StatelessWidget {
  const VardhnamInfoCard({
    required this.child,
    super.key,
    this.padding = const EdgeInsets.all(VardhnamSpacing.large),
    this.backgroundColor,
    this.borderColor,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? backgroundColor;
  final Color? borderColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: backgroundColor ?? VardhnamColors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(VardhnamRadius.card),
      side: BorderSide(color: borderColor ?? VardhnamColors.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

class VardhnamActionCard extends StatelessWidget {
  const VardhnamActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => VardhnamInfoCard(
    padding: const EdgeInsets.all(VardhnamSpacing.medium),
    onTap: onTap,
    child: Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: const BoxDecoration(
            color: VardhnamColors.surfaceGreen,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: VardhnamColors.primaryGreen),
        ),
        const SizedBox(width: VardhnamSpacing.medium),
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.titleMedium),
        ),
        const Icon(Icons.chevron_right),
      ],
    ),
  );
}

class VardhnamErrorState extends StatelessWidget {
  const VardhnamErrorState({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
    super.key,
  });

  final String message;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final useStackedLayout =
        MediaQuery.sizeOf(context).width <= 360 &&
        MediaQuery.textScalerOf(context).scale(1) >= 1.5;
    final messageRow = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.cloud_off_outlined),
        const SizedBox(width: VardhnamSpacing.medium),
        Expanded(child: Text(message)),
      ],
    );

    return VardhnamInfoCard(
      child: useStackedLayout
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                messageRow,
                const SizedBox(height: VardhnamSpacing.medium),
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton(
                    onPressed: onRetry,
                    child: Text(retryLabel),
                  ),
                ),
              ],
            )
          : Row(
              children: [
                Expanded(child: messageRow),
                TextButton(onPressed: onRetry, child: Text(retryLabel)),
              ],
            ),
    );
  }
}

class VardhnamSkeleton extends StatelessWidget {
  const VardhnamSkeleton({super.key, this.height = 120});

  final double height;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      height: height,
      decoration: BoxDecoration(
        color: VardhnamColors.surfaceGreen,
        borderRadius: BorderRadius.circular(VardhnamRadius.card),
        border: Border.all(color: VardhnamColors.border),
      ),
    ),
  );
}

class VardhnamStatusChip extends StatelessWidget {
  const VardhnamStatusChip({
    required this.label,
    super.key,
    this.icon,
    this.backgroundColor = VardhnamColors.surfaceGreen,
    this.foregroundColor = VardhnamColors.primaryGreenDark,
  });

  final String label;
  final IconData? icon;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) => Chip(
    avatar: icon == null ? null : Icon(icon, size: 18, color: foregroundColor),
    label: Text(label),
    labelStyle: Theme.of(context).textTheme.bodySmall?.copyWith(
      color: foregroundColor,
      fontWeight: FontWeight.w600,
    ),
    backgroundColor: backgroundColor,
    side: BorderSide.none,
    shape: const StadiumBorder(),
  );
}

class VardhnamAlertCard extends StatelessWidget {
  const VardhnamAlertCard({
    required this.icon,
    required this.title,
    required this.message,
    super.key,
    this.actionLabel,
    this.onAction,
    this.backgroundColor = VardhnamColors.surfaceOrange,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) => VardhnamInfoCard(
    backgroundColor: backgroundColor,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: VardhnamColors.primaryGreenDark),
            const SizedBox(width: VardhnamSpacing.medium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: VardhnamSpacing.xSmall),
                  Text(message),
                ],
              ),
            ),
          ],
        ),
        if (actionLabel != null) ...[
          const SizedBox(height: VardhnamSpacing.medium),
          OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ],
    ),
  );
}

class VardhnamEmptyState extends StatelessWidget {
  const VardhnamEmptyState({
    required this.icon,
    required this.title,
    required this.message,
    super.key,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(VardhnamSpacing.xLarge),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 88,
          height: 88,
          decoration: const BoxDecoration(
            color: VardhnamColors.surfaceGreen,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 44, color: VardhnamColors.primaryGreen),
        ),
        const SizedBox(height: VardhnamSpacing.large),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: VardhnamSpacing.small),
        Text(message, textAlign: TextAlign.center),
        if (actionLabel != null) ...[
          const SizedBox(height: VardhnamSpacing.large),
          FilledButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ],
    ),
  );
}

class VardhnamPromoterCard extends StatelessWidget {
  const VardhnamPromoterCard({
    required this.title,
    required this.name,
    required this.assignedLabel,
    super.key,
    this.territoryLabel,
    this.phoneLabel,
    this.phoneActionLabel,
    this.onPhoneAction,
  });

  final String title;
  final String name;
  final String assignedLabel;
  final String? territoryLabel;
  final String? phoneLabel;
  final String? phoneActionLabel;
  final VoidCallback? onPhoneAction;

  @override
  Widget build(BuildContext context) => VardhnamInfoCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: VardhnamSpacing.large),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: VardhnamColors.surfaceGreen,
              foregroundColor: VardhnamColors.primaryGreenDark,
              child: Text(
                _initial(name),
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            const SizedBox(width: VardhnamSpacing.medium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: VardhnamSpacing.xSmall),
                  Text(assignedLabel),
                  if (territoryLabel != null) Text(territoryLabel!),
                ],
              ),
            ),
          ],
        ),
        if (phoneLabel != null) ...[
          const SizedBox(height: VardhnamSpacing.large),
          SelectableText(
            phoneLabel!,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
        if (phoneActionLabel != null) ...[
          const SizedBox(height: VardhnamSpacing.small),
          OutlinedButton.icon(
            onPressed: onPhoneAction,
            icon: const Icon(Icons.copy_outlined),
            label: Text(phoneActionLabel!),
          ),
        ],
      ],
    ),
  );
}

class VardhnamProductCard extends StatelessWidget {
  const VardhnamProductCard({
    required this.productName,
    required this.brandName,
    required this.packLabel,
    required this.priceLabel,
    required this.availabilityLabel,
    required this.deliveryLabel,
    required this.imageSemanticLabel,
    required this.viewLabel,
    required this.onTap,
    super.key,
    this.imageUrl,
    this.badgeLabel,
  });

  final String productName;
  final String brandName;
  final String packLabel;
  final String priceLabel;
  final String availabilityLabel;
  final String deliveryLabel;
  final String imageSemanticLabel;
  final String viewLabel;
  final VoidCallback onTap;

  /// Pack shot URL, or null when the catalogue has no photography yet -- the
  /// frame then shows a labelled placeholder rather than a broken image.
  final String? imageUrl;
  final String? badgeLabel;

  @override
  Widget build(BuildContext context) => VardhnamInfoCard(
    padding: EdgeInsets.zero,
    onTap: onTap,
    child: LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 380;
        final image = VardhnamImageFrame(
          aspectRatio: compact ? 16 / 7 : 1,
          semanticLabel: imageSemanticLabel,
          imageUrl: imageUrl,
          // Pack shots are portrait product photography on a transparent
          // background, so contain avoids cropping the pack.
          fit: BoxFit.contain,
          borderRadius: compact
              ? const BorderRadius.vertical(
                  top: Radius.circular(VardhnamRadius.card),
                )
              : const BorderRadius.horizontal(
                  left: Radius.circular(VardhnamRadius.card),
                ),
          placeholder: const Icon(
            Icons.inventory_2_outlined,
            size: 44,
            color: VardhnamColors.leafGreen,
          ),
        );
        final details = Padding(
          padding: const EdgeInsets.all(VardhnamSpacing.large),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (badgeLabel != null) ...[
                VardhnamStatusChip(
                  label: badgeLabel!,
                  icon: Icons.verified_outlined,
                ),
                const SizedBox(height: VardhnamSpacing.small),
              ],
              Text(
                brandName,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: VardhnamColors.primaryGreenDark,
                ),
              ),
              const SizedBox(height: VardhnamSpacing.xSmall),
              Text(productName, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: VardhnamSpacing.xSmall),
              Text(packLabel, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: VardhnamSpacing.medium),
              Text(
                priceLabel,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: VardhnamColors.primaryGreenDark,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: VardhnamSpacing.small),
              Text(availabilityLabel),
              Text(deliveryLabel),
              const SizedBox(height: VardhnamSpacing.small),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton.icon(
                  onPressed: onTap,
                  icon: const Icon(Icons.arrow_forward),
                  label: Text(viewLabel),
                ),
              ),
            ],
          ),
        );

        if (compact) return Column(children: [image, details]);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 148, child: image),
            Expanded(child: details),
          ],
        );
      },
    ),
  );
}

String _initial(String name) {
  final trimmed = name.trim();
  return trimmed.isEmpty ? '?' : trimmed.characters.first.toUpperCase();
}
