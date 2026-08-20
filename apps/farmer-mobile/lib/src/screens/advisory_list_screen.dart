import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../advisory/advisory_repository.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';

class AdvisoryListScreen extends ConsumerStatefulWidget {
  const AdvisoryListScreen({super.key});

  @override
  ConsumerState<AdvisoryListScreen> createState() => _AdvisoryListScreenState();
}

class _AdvisoryListScreenState extends ConsumerState<AdvisoryListScreen> {
  FarmerAdvisoryPage? _page;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final page = await ref.read(advisoryRepositoryProvider).list();
      if (mounted) setState(() => _page = page);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.advisoryTitle)),
      body: SafeArea(
        child: switch ((_page, _error)) {
          (null, null) => FarmerListLoadingState(
            label: strings.advisoryLoading,
          ),
          (null, final Object error) => Padding(
            padding: const EdgeInsets.all(VardhnamSpacing.large),
            child: VardhnamErrorState(
              message: apiErrorMessage(strings, error),
              retryLabel: strings.retryActionLabel,
              onRetry: _load,
            ),
          ),
          (final FarmerAdvisoryPage page, _) => RefreshIndicator(
            onRefresh: _load,
            child: page.items.isEmpty
                ? ListView(
                    children: [
                      VardhnamEmptyState(
                        icon: Icons.task_alt_outlined,
                        title: strings.advisoryEmptyTitle,
                        message: strings.advisoryEmpty,
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(VardhnamSpacing.large),
                    itemCount: page.items.length + 1,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: VardhnamSpacing.medium),
                    itemBuilder: (context, index) {
                      if (index == 0) {
                        return VardhnamAlertCard(
                          icon: Icons.verified_user_outlined,
                          title: strings.advisoryHumanApprovedTitle,
                          message: strings.advisorySubtitle,
                          backgroundColor: VardhnamColors.surfaceGreen,
                        );
                      }
                      final item = page.items[index - 1];
                      return _AdvisoryCard(
                        item: item,
                        onTap: () => context
                            .push(AppRoutes.advisory(item.id))
                            .then((_) => _load()),
                      );
                    },
                  ),
          ),
        },
      ),
    );
  }
}

class _AdvisoryCard extends StatelessWidget {
  const _AdvisoryCard({required this.item, required this.onTap});

  final FarmerAdvisory item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final dueToday = DateUtils.isSameDay(item.dueOn, DateTime.now());
    final unread =
        item.status == AdvisoryStatus.delivered ||
        item.status == AdvisoryStatus.pending;
    return VardhnamInfoCard(
      onTap: onTap,
      borderColor: unread ? VardhnamColors.primaryGreen : VardhnamColors.border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: VardhnamSpacing.small,
            runSpacing: VardhnamSpacing.small,
            children: [
              VardhnamStatusChip(
                label: dueToday
                    ? strings.advisoryImportantToday
                    : DateFormat.yMMMd(locale).format(item.dueOn),
                icon: dueToday
                    ? Icons.priority_high
                    : Icons.calendar_today_outlined,
                backgroundColor: dueToday
                    ? VardhnamColors.surfaceOrange
                    : VardhnamColors.surfaceGreen,
              ),
              if (unread)
                VardhnamStatusChip(
                  label: strings.advisoryUnreadLabel,
                  icon: Icons.fiber_new_outlined,
                ),
            ],
          ),
          const SizedBox(height: VardhnamSpacing.medium),
          Text(item.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: VardhnamSpacing.xSmall),
          Text(strings.advisoryCropLabel(item.cropName)),
          const SizedBox(height: VardhnamSpacing.small),
          Text(item.body, maxLines: 3, overflow: TextOverflow.ellipsis),
          const SizedBox(height: VardhnamSpacing.medium),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton.icon(
              onPressed: onTap,
              icon: const Icon(Icons.arrow_forward),
              label: Text(strings.advisoryReadAction),
            ),
          ),
        ],
      ),
    );
  }
}
