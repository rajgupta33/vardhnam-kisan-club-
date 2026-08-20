import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../kisan_club/kisan_club_promoter_repository.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';

class MyPromoterScreen extends ConsumerStatefulWidget {
  const MyPromoterScreen({super.key});

  @override
  ConsumerState<MyPromoterScreen> createState() => _MyPromoterScreenState();
}

class _MyPromoterScreenState extends ConsumerState<MyPromoterScreen> {
  KisanClubPromoterAssignment? _assignment;
  Object? _error;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final assignment = await ref
          .read(kisanClubPromoterRepositoryProvider)
          .getMine();
      if (!mounted) return;
      setState(() => _assignment = assignment);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.myPromoterTitle)),
      body: SafeArea(
        child: switch ((_loading, _assignment, _error)) {
          (true, null, _) => FarmerDetailLoadingState(
            label: strings.myPromoterLoading,
          ),
          (false, null, final Object error) => VardhnamEmptyState(
            icon: Icons.cloud_off_outlined,
            title: strings.myPromoterTitle,
            message: apiErrorMessage(strings, error),
            actionLabel: strings.retryActionLabel,
            onAction: _load,
          ),
          (false, null, null) => VardhnamEmptyState(
            icon: Icons.person_search_outlined,
            title: strings.myPromoterAwaitingSubtitle,
            message: strings.myPromoterAwaitingMessage,
          ),
          (_, final KisanClubPromoterAssignment assignment, _) =>
            RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(VardhnamSpacing.large),
                children: [
                  VardhnamPromoterCard(
                    title: strings.myPromoterCardTitle,
                    name:
                        assignment.displayName ??
                        strings.myPromoterNameUnavailable,
                    assignedLabel: strings.myPromoterAssignedOn(
                      DateFormat.yMMMd(
                        Localizations.localeOf(context).toLanguageTag(),
                      ).format(assignment.assignedAt.toLocal()),
                    ),
                    territoryLabel: _territoryLabel(strings, assignment),
                    phoneLabel: assignment.phone == null
                        ? null
                        : strings.myPromoterPhone(assignment.phone!),
                    phoneActionLabel: assignment.phone == null
                        ? null
                        : strings.myPromoterCopyPhoneAction,
                    onPhoneAction: assignment.phone == null
                        ? null
                        : () => _copyPhone(context, assignment.phone!),
                  ),
                  const SizedBox(height: VardhnamSpacing.medium),
                  VardhnamAlertCard(
                    icon: Icons.privacy_tip_outlined,
                    title: strings.myPromoterPrivacyTitle,
                    message: strings.myPromoterPrivacyMessage,
                    backgroundColor: VardhnamColors.surfaceGreen,
                  ),
                ],
              ),
            ),
        },
      ),
    );
  }
}

Future<void> _copyPhone(BuildContext context, String phone) async {
  await Clipboard.setData(ClipboardData(text: phone));
  if (!context.mounted) return;
  final strings = AppLocalizations.of(context)!;
  ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(strings.myPromoterPhoneCopied)));
}

String? _territory(KisanClubPromoterAssignment assignment) {
  final values = [
    assignment.territoryName,
    assignment.territoryDistrict,
    assignment.territoryState,
  ].whereType<String>().where((value) => value.trim().isNotEmpty).toList();
  return values.isEmpty ? null : values.join(', ');
}

String? _territoryLabel(
  AppLocalizations strings,
  KisanClubPromoterAssignment assignment,
) {
  final territory = _territory(assignment);
  return territory == null ? null : strings.myPromoterTerritory(territory);
}
