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
import '../routing/app_routes.dart';

class AdvisoryDetailScreen extends ConsumerStatefulWidget {
  const AdvisoryDetailScreen({required this.advisoryId, super.key});

  final String advisoryId;

  @override
  ConsumerState<AdvisoryDetailScreen> createState() =>
      _AdvisoryDetailScreenState();
}

class _AdvisoryDetailScreenState extends ConsumerState<AdvisoryDetailScreen> {
  FarmerAdvisory? _item;
  Object? _error;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final item = await ref
          .read(advisoryRepositoryProvider)
          .get(widget.advisoryId);
      if (item.status != AdvisoryStatus.read &&
          item.status != AdvisoryStatus.dismissed) {
        await ref.read(advisoryRepositoryProvider).markRead(widget.advisoryId);
      }
      if (mounted) setState(() => _item = item);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _dismiss() async {
    setState(() => _busy = true);
    try {
      await ref.read(advisoryRepositoryProvider).dismiss(widget.advisoryId);
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(AppLocalizations.of(context)!, error),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final item = _item;
    return Scaffold(
      appBar: AppBar(title: Text(strings.advisoryDetailTitle)),
      body: SafeArea(
        child: item == null
            ? _error == null
                  ? const Center(child: CircularProgressIndicator())
                  : Padding(
                      padding: const EdgeInsets.all(VardhnamSpacing.large),
                      child: VardhnamErrorState(
                        message: apiErrorMessage(strings, _error!),
                        retryLabel: strings.retryActionLabel,
                        onRetry: _load,
                      ),
                    )
            : ListView(
                padding: const EdgeInsets.all(VardhnamSpacing.large),
                children: [
                  VardhnamStatusChip(
                    label: DateUtils.isSameDay(item.dueOn, DateTime.now())
                        ? strings.advisoryImportantToday
                        : strings.advisoryApprovedLabel,
                    icon: Icons.verified_outlined,
                    backgroundColor:
                        DateUtils.isSameDay(item.dueOn, DateTime.now())
                        ? VardhnamColors.surfaceOrange
                        : VardhnamColors.surfaceGreen,
                  ),
                  const SizedBox(height: VardhnamSpacing.medium),
                  Text(
                    item.title,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: VardhnamSpacing.xSmall),
                  Text(strings.advisoryCropLabel(item.cropName)),
                  if (item.varietyName case final variety?) Text(variety),
                  const SizedBox(height: VardhnamSpacing.xLarge),
                  VardhnamSectionHeader(title: strings.advisoryWhatToDoTitle),
                  const SizedBox(height: VardhnamSpacing.medium),
                  VardhnamInfoCard(
                    backgroundColor: VardhnamColors.surfaceGreen,
                    child: Text(
                      item.body,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  ),
                  const SizedBox(height: VardhnamSpacing.xLarge),
                  VardhnamSectionHeader(title: strings.advisoryWhenToActTitle),
                  const SizedBox(height: VardhnamSpacing.medium),
                  VardhnamInfoCard(
                    child: Row(
                      children: [
                        const Icon(
                          Icons.calendar_today_outlined,
                          color: VardhnamColors.primaryGreenDark,
                        ),
                        const SizedBox(width: VardhnamSpacing.medium),
                        Expanded(
                          child: Text(
                            strings.advisoryDueLabel(
                              DateFormat.yMMMd(
                                Localizations.localeOf(context).toLanguageTag(),
                              ).format(item.dueOn),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (item.sourceReference case final source?) ...[
                    const SizedBox(height: VardhnamSpacing.medium),
                    ExpansionTile(
                      title: Text(strings.advisoryTechnicalDetailsTitle),
                      childrenPadding: const EdgeInsets.fromLTRB(
                        VardhnamSpacing.large,
                        0,
                        VardhnamSpacing.large,
                        VardhnamSpacing.large,
                      ),
                      children: [Text(strings.advisorySourceLabel(source))],
                    ),
                  ],
                  const SizedBox(height: VardhnamSpacing.xLarge),
                  VardhnamAlertCard(
                    icon: Icons.verified_user_outlined,
                    title: strings.advisoryHumanApprovedTitle,
                    message: strings.advisoryDisclaimer,
                    backgroundColor: VardhnamColors.surfaceOrange,
                  ),
                  const SizedBox(height: VardhnamSpacing.large),
                  FilledButton.icon(
                    onPressed: () => context.push(AppRoutes.myPromoter),
                    icon: const Icon(Icons.support_agent_outlined),
                    label: Text(strings.advisoryContactPromoterAction),
                  ),
                  const SizedBox(height: VardhnamSpacing.small),
                  OutlinedButton(
                    onPressed: _busy ? null : _dismiss,
                    child: Text(strings.advisoryDismissAction),
                  ),
                ],
              ),
      ),
    );
  }
}
