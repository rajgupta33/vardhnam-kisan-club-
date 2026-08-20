import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../kisan_club/promoter_fulfilment_models.dart';
import '../kisan_club/promoter_fulfilment_presentation.dart';
import '../kisan_club/promoter_fulfilment_repository.dart';
import '../routing/partner_routes.dart';

class PromoterFulfilmentScreen extends ConsumerStatefulWidget {
  const PromoterFulfilmentScreen({super.key});

  @override
  ConsumerState<PromoterFulfilmentScreen> createState() =>
      _PromoterFulfilmentScreenState();
}

class _PromoterFulfilmentScreenState
    extends ConsumerState<PromoterFulfilmentScreen> {
  final _items = <ClubFulfilmentAssignment>[];
  ClubFulfilmentStatus? _status;
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;
  int _page = 0;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
      _page = 0;
      _total = 0;
      _items.clear();
    });
    await _loadPage(1);
  }

  Future<void> _loadMore() => _loadPage(_page + 1);

  Future<void> _loadPage(int page) async {
    if (page > 1) setState(() => _loadingMore = true);
    try {
      final result = await ref
          .read(promoterFulfilmentRepositoryProvider)
          .list(status: _status, page: page);
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
      appBar: AppBar(title: Text(strings.fulfilmentAssignments)),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Text(strings.fulfilmentHelp),
            const SizedBox(height: 12),
            DropdownButtonFormField<ClubFulfilmentStatus?>(
              initialValue: _status,
              decoration: InputDecoration(
                labelText: strings.fulfilmentStatusFilter,
              ),
              items: [
                DropdownMenuItem(value: null, child: Text(strings.allStatuses)),
                for (final status in ClubFulfilmentStatus.values)
                  DropdownMenuItem(
                    value: status,
                    child: Text(fulfilmentStatusLabel(strings, status)),
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
                padding: const EdgeInsets.only(top: 40),
                child: Center(child: Text(strings.noFulfilmentAssignments)),
              )
            else ...[
              for (final item in _items)
                Card(
                  child: ListTile(
                    title: Text(strings.orderNumber(item.orderNumber)),
                    subtitle: Text(
                      '${item.farmerName} · ${item.pincode}\n'
                      '${strings.coordinationStatus(fulfilmentStatusLabel(strings, item.status))}',
                    ),
                    isThreeLine: true,
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () =>
                        context.push(PartnerRoutes.fulfilment(item.id)),
                  ),
                ),
              if (_items.length < _total)
                OutlinedButton(
                  onPressed: _loadingMore ? null : _loadMore,
                  child: _loadingMore
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(strings.loadMore),
                ),
              if (_error != null) _ErrorPanel(onRetry: _loadMore),
            ],
          ],
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
        Text(strings.loadFailed),
        TextButton(onPressed: onRetry, child: Text(strings.tryAgain)),
      ],
    );
  }
}
