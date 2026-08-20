import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../earnings/partner_earnings_models.dart';
import '../earnings/partner_earnings_presentation.dart';
import '../earnings/partner_earnings_repository.dart';
import '../routing/partner_routes.dart';

class PartnerEarningsScreen extends ConsumerStatefulWidget {
  const PartnerEarningsScreen({super.key});

  @override
  ConsumerState<PartnerEarningsScreen> createState() =>
      _PartnerEarningsScreenState();
}

class _PartnerEarningsScreenState extends ConsumerState<PartnerEarningsScreen> {
  final _items = <EarningsEntry>[];
  PayoutAccountView? _account;
  Map<EarningsStatus, int> _totals = const {};
  EarningsStatus? _status;
  bool _loading = true;
  bool _loadingMore = false;
  bool _accountLoaded = false;
  bool _accountError = false;
  Object? _error;
  int _page = 0;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _reload(includeAccount: true);
  }

  Future<void> _reload({bool includeAccount = false}) async {
    setState(() {
      _loading = true;
      _error = null;
      _page = 0;
      _total = 0;
      _items.clear();
    });
    if (includeAccount || !_accountLoaded) {
      try {
        final account = await ref
            .read(partnerEarningsRepositoryProvider)
            .getMyPayoutAccount();
        if (mounted) {
          setState(() {
            _account = account;
            _accountLoaded = true;
            _accountError = false;
          });
        }
      } on Object {
        if (mounted) {
          setState(() {
            _accountLoaded = true;
            _accountError = true;
          });
        }
      }
    }
    await _loadPage(1);
  }

  Future<void> _loadPage(int page) async {
    if (page > 1) setState(() => _loadingMore = true);
    try {
      final result = await ref
          .read(partnerEarningsRepositoryProvider)
          .getMyStatement(status: _status, page: page);
      if (!mounted) return;
      final byId = {for (final item in _items) item.id: item};
      for (final item in result.items) {
        byId[item.id] = item;
      }
      setState(() {
        _items
          ..clear()
          ..addAll(byId.values);
        _page = result.page;
        _total = result.total;
        _totals = result.totalsByStatus;
        _error = null;
      });
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
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
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.earningsStatement)),
      body: RefreshIndicator(
        onRefresh: () => _reload(includeAccount: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Text(strings.earningsBackendNotice),
            const SizedBox(height: 12),
            _PayoutAccountCard(
              account: _account,
              loaded: _accountLoaded,
              hasError: _accountError,
              onManage: _managePayoutAccount,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final status in EarningsStatus.values)
                  _TotalCard(
                    label: earningsStatusLabel(strings, status),
                    amountPaise: _totals[status] ?? 0,
                  ),
              ],
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<EarningsStatus?>(
              key: ValueKey(_status),
              initialValue: _status,
              decoration: InputDecoration(
                labelText: strings.earningsStatusFilter,
              ),
              items: [
                DropdownMenuItem(value: null, child: Text(strings.allStatuses)),
                for (final status in EarningsStatus.values)
                  DropdownMenuItem(
                    value: status,
                    child: Text(earningsStatusLabel(strings, status)),
                  ),
              ],
              onChanged: (value) {
                _status = value;
                _reload();
              },
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_error != null && _items.isEmpty)
              _ErrorPanel(onRetry: _reload)
            else if (_items.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Center(child: Text(strings.noEarnings)),
              )
            else ...[
              for (final item in _items) _EarningsCard(item: item),
              if (_items.length < _total)
                OutlinedButton(
                  onPressed: _loadingMore ? null : () => _loadPage(_page + 1),
                  child: _loadingMore
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(strings.loadMore),
                ),
              if (_error != null)
                _ErrorPanel(onRetry: () => _loadPage(_page + 1)),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _managePayoutAccount() async {
    final saved = await context.push<PayoutAccountView>(
      PartnerRoutes.payoutAccount,
    );
    if (!mounted || saved == null) return;
    setState(() {
      _account = saved;
      _accountLoaded = true;
      _accountError = false;
    });
  }
}

class _PayoutAccountCard extends StatelessWidget {
  const _PayoutAccountCard({
    required this.account,
    required this.loaded,
    required this.hasError,
    required this.onManage,
  });

  final PayoutAccountView? account;
  final bool loaded;
  final bool hasError;
  final VoidCallback onManage;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final value = account;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              strings.payoutAccount,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            if (!loaded)
              const LinearProgressIndicator()
            else if (hasError)
              Text(strings.payoutAccountLoadFailed)
            else if (value == null)
              Text(strings.noPayoutAccount)
            else ...[
              Text(value.accountHolderName),
              Text('${value.bankName} · ${value.maskedAccountNumber}'),
              Text(strings.ifsc(value.ifscCode)),
              Text(
                strings.payoutStatus(
                  payoutAccountStatusLabel(strings, value.status),
                ),
              ),
              if (value.rejectionReason case final reason?)
                Text(strings.payoutRejectionReason(reason)),
            ],
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: loaded && !hasError ? onManage : null,
              child: Text(
                value == null
                    ? strings.addPayoutAccount
                    : strings.editPayoutAccount,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TotalCard extends StatelessWidget {
  const _TotalCard({required this.label, required this.amountPaise});
  final String label;
  final int amountPaise;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [Text(label), Text(formatPaise(amountPaise))],
      ),
    ),
  );
}

class _EarningsCard extends StatelessWidget {
  const _EarningsCard({required this.item});
  final EarningsEntry item;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Card(
      child: ListTile(
        title: Text(formatPaise(item.amountPaise)),
        subtitle: Text(
          '${earningsTypeLabel(strings, item.type)} · '
          '${earningsStatusLabel(strings, item.status)}\n'
          '${strings.eligibleOn(earningsDate(item.eligibleAt))}\n'
          '${strings.orderReference(item.productOrderId)}',
        ),
        isThreeLine: true,
        trailing: Icon(
          item.status == EarningsStatus.finalised
              ? Icons.check_circle_outline
              : item.status == EarningsStatus.reversed
              ? Icons.undo
              : Icons.schedule,
        ),
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.onRetry});
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Column(
      children: [
        Text(strings.earningsLoadFailed),
        TextButton(onPressed: onRetry, child: Text(strings.tryAgain)),
      ],
    );
  }
}
