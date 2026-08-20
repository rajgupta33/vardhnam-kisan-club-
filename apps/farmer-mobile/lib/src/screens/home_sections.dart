import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../core/widgets/vardhnam_image_frame.dart';
import '../farms/farm_repository.dart';
import '../localization/locale_controller.dart';
import '../marketplace/marketplace_api.dart';
import '../marketplace/marketplace_providers.dart';
import '../orders/farmer_order.dart';
import '../orders/farmer_order_repository.dart';
import '../orders/order_presentation.dart';
import '../routing/app_routes.dart';

/// Home-screen modules that summarise data owned by other screens.
///
/// Each one is deliberately a *summary*: the blueprint (§10.5–10.7) asks home to
/// answer "what needs my attention today", not to duplicate the Crops, Orders or
/// Shop screens. Every module hides itself entirely when it has nothing useful
/// to say, so a farmer with no crops and no orders sees a short, calm home
/// screen rather than a column of empty states.

/// The farmer's current crop cycle, or null when there is none.
final activeCropProvider = FutureProvider.autoDispose<_ActiveCrop?>((
  ref,
) async {
  final farms = await ref.watch(farmRepositoryProvider).listMine();

  for (final farm in farms.where((farm) => farm.isActive)) {
    for (final cycle in farm.cropCycles) {
      if (cycle.status == CropCycleStatus.active) {
        return _ActiveCrop(farm: farm, cycle: cycle);
      }
    }
  }
  return null;
});

/// The most recent order that has not reached a terminal state.
final activeOrderProvider = FutureProvider.autoDispose<FarmerOrder?>((
  ref,
) async {
  final page = await ref
      .watch(farmerOrderRepositoryProvider)
      .listOrders(limit: 5);

  for (final order in page.items) {
    if (!_terminalOrderStatuses.contains(order.status.toUpperCase())) {
      return order;
    }
  }
  return null;
});

/// Statuses after which there is nothing left for a farmer to track.
const _terminalOrderStatuses = {
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
  'RETURNED',
  'REFUNDED',
  'CLOSED',
};

class _ActiveCrop {
  const _ActiveCrop({required this.farm, required this.cycle});

  final FarmerFarm farm;
  final FarmCropCycleSummary cycle;
}

/// §10.5 — one primary crop, with a link to the rest.
class HomeActiveCropCard extends ConsumerWidget {
  const HomeActiveCropCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;
    final hindi = ref.watch(localeControllerProvider).languageCode == 'hi';

    return ref
        .watch(activeCropProvider)
        .when(
          // Home stays quiet while loading rather than flashing a skeleton for
          // a module that may turn out to be empty.
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (active) {
            if (active == null) return const SizedBox.shrink();

            final cropName = hindi
                ? active.cycle.cropNameHi
                : active.cycle.cropNameEn;
            final days = active.cycle.daysAfterSowing;

            return Padding(
              padding: const EdgeInsets.only(bottom: VardhnamSpacing.xLarge),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  VardhnamSectionHeader(
                    title: strings.homeActiveCropTitle,
                    actionLabel: strings.homeActiveCropMore,
                    onAction: () => context.push(AppRoutes.farms),
                  ),
                  const SizedBox(height: VardhnamSpacing.medium),
                  VardhnamInfoCard(
                    backgroundColor: VardhnamColors.surfaceGreen,
                    onTap: () => context.push(AppRoutes.farms),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.eco,
                          size: 36,
                          color: VardhnamColors.primaryGreen,
                        ),
                        const SizedBox(width: VardhnamSpacing.medium),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                cropName.toUpperCase(),
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: VardhnamSpacing.xSmall),
                              Text(
                                '${active.farm.name} • '
                                '${active.cycle.areaAcres.toStringAsFixed(1)} '
                                '${strings.acresUnit}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              if (days != null) ...[
                                const SizedBox(height: VardhnamSpacing.xSmall),
                                VardhnamStatusChip(
                                  label: strings.homeActiveCropDay(days),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
  }
}

/// §10.6 — shown only while an order is actually in flight.
class HomeActiveOrderCard extends ConsumerWidget {
  const HomeActiveOrderCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;

    return ref
        .watch(activeOrderProvider)
        .when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (order) {
            if (order == null) return const SizedBox.shrink();

            return Padding(
              padding: const EdgeInsets.only(bottom: VardhnamSpacing.xLarge),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  VardhnamSectionHeader(title: strings.homeActiveOrderTitle),
                  const SizedBox(height: VardhnamSpacing.medium),
                  VardhnamInfoCard(
                    onTap: () => context.push(AppRoutes.order(order.id)),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.local_shipping_outlined,
                          size: 32,
                          color: VardhnamColors.primaryGreen,
                        ),
                        const SizedBox(width: VardhnamSpacing.medium),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                order.orderNumber,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: VardhnamSpacing.xSmall),
                              VardhnamStatusChip(
                                label: orderStatusLabel(strings, order.status),
                              ),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () =>
                              context.push(AppRoutes.order(order.id)),
                          child: Text(strings.homeActiveOrderTrackAction),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
  }
}

/// §10.7 — one small product strip, capped at four, linking to Shop.
class HomeRecommendedProductsSection extends ConsumerWidget {
  const HomeRecommendedProductsSection({super.key});

  /// The blueprint caps this at four: home is not a catalogue, and a farmer
  /// scrolling past a long product list never reaches their crop or orders.
  static const maxProducts = 4;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref
        .watch(homeRecommendedProductsProvider)
        .when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (strip) =>
              _ProductStrip(products: strip.products, pincode: strip.pincode),
        );
  }
}

class _ProductStrip extends StatelessWidget {
  const _ProductStrip({required this.products, required this.pincode});

  final List<MarketplaceProductSummary> products;
  final String pincode;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();

    final strings = AppLocalizations.of(context)!;
    final visible = products
        .take(HomeRecommendedProductsSection.maxProducts)
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        VardhnamSectionHeader(
          title: strings.homeRecommendedTitle,
          actionLabel: strings.homeRecommendedViewAll,
          onAction: () => context.push(AppRoutes.browse),
        ),
        const SizedBox(height: VardhnamSpacing.medium),
        SizedBox(
          // Tall enough for the square pack shot plus a two-line product name
          // and a price. Vardhnam names run long ("Basant Gold 9180"), so
          // clamping to one line would truncate most of the catalogue.
          height: 248,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: visible.length,
            separatorBuilder: (context, index) =>
                const SizedBox(width: VardhnamSpacing.medium),
            itemBuilder: (context, index) {
              final product = visible[index];
              return _RecommendedProductTile(
                product: product,
                onTap: () =>
                    context.push(AppRoutes.product(product.id, pincode)),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _RecommendedProductTile extends StatelessWidget {
  const _RecommendedProductTile({required this.product, required this.onTap});

  final MarketplaceProductSummary product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;

    return SizedBox(
      width: 150,
      child: VardhnamInfoCard(
        padding: const EdgeInsets.all(VardhnamSpacing.small),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            VardhnamImageFrame(
              aspectRatio: 1,
              semanticLabel: strings.productImagePlaceholder(product.name),
              imageUrl: product.primaryImageUrl,
              // Pack shots are portrait photography on a transparent
              // background; contain keeps the label readable.
              fit: BoxFit.contain,
              placeholder: const Icon(
                Icons.inventory_2_outlined,
                size: 32,
                color: VardhnamColors.leafGreen,
              ),
            ),
            const SizedBox(height: VardhnamSpacing.small),
            Text(
              product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: VardhnamSpacing.xSmall),
            Text(
              formatPaise(product.lowestPricePaise),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}
