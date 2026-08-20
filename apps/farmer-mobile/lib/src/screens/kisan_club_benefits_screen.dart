import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../kisan_club/kisan_club_benefit_token_repository.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';

class KisanClubBenefitsScreen extends ConsumerStatefulWidget {
  const KisanClubBenefitsScreen({super.key});

  @override
  ConsumerState<KisanClubBenefitsScreen> createState() =>
      _KisanClubBenefitsScreenState();
}

class _KisanClubBenefitsScreenState
    extends ConsumerState<KisanClubBenefitsScreen> {
  List<KisanClubBenefitToken>? _tokens;
  Object? _error;
  var _loading = true;
  var _loadingMore = false;
  var _page = 0;
  var _total = 0;
  KisanClubBenefitTokenStatus? _status;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({required bool reset}) async {
    setState(() {
      if (reset) {
        _loading = true;
        _tokens = null;
        _page = 0;
        _total = 0;
      } else {
        _loadingMore = true;
      }
      _error = null;
    });
    try {
      final result = await ref
          .read(kisanClubBenefitTokenRepositoryProvider)
          .list(status: _status, page: reset ? 1 : _page + 1);
      if (!mounted) return;
      setState(() {
        final merged = <String, KisanClubBenefitToken>{
          if (!reset)
            for (final token in _tokens ?? const <KisanClubBenefitToken>[])
              token.id: token,
          for (final token in result.items) token.id: token,
        };
        _tokens = merged.values.toList(growable: false);
        _page = result.page;
        _total = result.total;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.kisanClubBenefitsTitle)),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: DropdownButtonFormField<KisanClubBenefitTokenStatus?>(
                initialValue: _status,
                decoration: InputDecoration(
                  labelText: strings.kisanClubTokenStatusFilterLabel,
                ),
                isExpanded: true,
                items: [
                  DropdownMenuItem<KisanClubBenefitTokenStatus?>(
                    value: null,
                    child: Text(strings.kisanClubTokenStatusAll),
                  ),
                  ...KisanClubBenefitTokenStatus.values.map(
                    (status) => DropdownMenuItem(
                      value: status,
                      child: Text(_statusLabel(strings, status)),
                    ),
                  ),
                ],
                onChanged: _loading || _loadingMore
                    ? null
                    : (status) {
                        setState(() => _status = status);
                        unawaited(_load(reset: true));
                      },
              ),
            ),
            Expanded(
              child: switch ((_loading, _tokens, _error)) {
                (true, null, _) => FarmerDetailLoadingState(
                  label: strings.kisanClubBenefitsLoading,
                ),
                (false, null, final Object error) => VardhnamEmptyState(
                  icon: Icons.cloud_off_outlined,
                  title: strings.kisanClubBenefitsTitle,
                  message: apiErrorMessage(strings, error),
                  actionLabel: strings.retryActionLabel,
                  onAction: () => _load(reset: true),
                ),
                (_, final List<KisanClubBenefitToken> tokens, _) =>
                  RefreshIndicator(
                    onRefresh: () => _load(reset: true),
                    child: tokens.isEmpty
                        ? ListView(
                            padding: const EdgeInsets.all(
                              VardhnamSpacing.large,
                            ),
                            children: [
                              VardhnamEmptyState(
                                icon: Icons.confirmation_number_outlined,
                                title: strings.kisanClubBenefitsTitle,
                                message: strings.kisanClubBenefitsEmpty,
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount:
                                tokens.length +
                                (tokens.length < _total || _error != null
                                    ? 1
                                    : 0),
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) =>
                                index < tokens.length
                                ? _TokenCard(token: tokens[index])
                                : _LoadMoreFooter(
                                    error: _error,
                                    loading: _loadingMore,
                                    onPressed: () => _load(reset: false),
                                  ),
                          ),
                  ),
                _ => const SizedBox.shrink(),
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadMoreFooter extends StatelessWidget {
  const _LoadMoreFooter({
    required this.error,
    required this.loading,
    required this.onPressed,
  });

  final Object? error;
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Column(
      children: [
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              apiErrorMessage(strings, error!),
              textAlign: TextAlign.center,
            ),
          ),
        OutlinedButton(
          onPressed: loading ? null : onPressed,
          child: Text(
            loading
                ? strings.kisanClubBenefitsLoadingMore
                : strings.kisanClubBenefitsLoadMore,
          ),
        ),
      ],
    );
  }
}

class _TokenCard extends StatelessWidget {
  const _TokenCard({required this.token});

  final KisanClubBenefitToken token;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final status = _statusLabel(strings, token.status);
    return VardhnamInfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  token.productName,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              VardhnamStatusChip(label: status),
            ],
          ),
          Text(token.variantName),
          const SizedBox(height: 8),
          Text(strings.kisanClubTokenReference(token.tokenReference)),
          Text(strings.kisanClubTokenSeller(token.sellerName)),
          Text(strings.kisanClubTokenQuantity(token.quantity)),
          Text(
            strings.kisanClubTokenBenefit(
              _formatPaise(token.quotedBenefitPaise),
            ),
          ),
          Text(
            strings.kisanClubTokenPayable(
              _formatPaise(token.quotedFarmerPayablePaise),
            ),
          ),
          Text(
            strings.kisanClubTokenExpires(
              DateFormat.yMMMd(
                locale,
              ).add_jm().format(token.expiresAt.toLocal()),
            ),
          ),
          if (token.status == KisanClubBenefitTokenStatus.issued) ...[
            const SizedBox(height: 8),
            Text(
              strings.kisanClubTokenCodeNotRecoverable,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

String _formatPaise(int paise) => NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: 2,
).format(paise / 100);

String _statusLabel(
  AppLocalizations strings,
  KisanClubBenefitTokenStatus status,
) => switch (status) {
  KisanClubBenefitTokenStatus.issued => strings.kisanClubTokenStatusIssued,
  KisanClubBenefitTokenStatus.redeemed => strings.kisanClubTokenStatusRedeemed,
  KisanClubBenefitTokenStatus.expired => strings.kisanClubTokenStatusExpired,
  KisanClubBenefitTokenStatus.cancelled =>
    strings.kisanClubTokenStatusCancelled,
};
