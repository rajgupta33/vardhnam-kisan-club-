import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../return_pickups/return_pickup_models.dart';
import '../return_pickups/return_pickup_repository.dart';
import '../routing/partner_routes.dart';

class ReturnPickupsScreen extends ConsumerStatefulWidget {
  const ReturnPickupsScreen({super.key});
  @override
  ConsumerState<ReturnPickupsScreen> createState() =>
      _ReturnPickupsScreenState();
}

class _ReturnPickupsScreenState extends ConsumerState<ReturnPickupsScreen> {
  final _items = <ReturnPickup>[];
  bool _loading = true;
  bool _failed = false;
  int _page = 1;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _load(true);
  }

  Future<void> _load(bool refresh) async {
    if (refresh) {
      setState(() {
        _loading = true;
        _failed = false;
      });
    }
    try {
      final result = await ref
          .read(returnPickupRepositoryProvider)
          .list(page: refresh ? 1 : _page + 1);
      if (!mounted) return;
      setState(() {
        if (refresh) _items.clear();
        final ids = _items.map((item) => item.id).toSet();
        _items.addAll(result.items.where((item) => ids.add(item.id)));
        _page = result.page;
        _total = result.total;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.returnPickups)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _load(true),
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _failed && _items.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(strings.returnPickupsLoadFailed),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => _load(true),
                      child: Text(strings.tryAgain),
                    ),
                  ],
                )
              : _items.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [Text(strings.noReturnPickups)],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _items.length + (_items.length < _total ? 1 : 0),
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    if (index == _items.length) {
                      return OutlinedButton(
                        onPressed: () => _load(false),
                        child: Text(strings.loadMore),
                      );
                    }
                    final item = _items[index];
                    return Card(
                      child: ListTile(
                        minVerticalPadding: 16,
                        title: Text(strings.orderNumber(item.orderNumber)),
                        subtitle: Text(
                          '${_status(strings, item.status)}\n${item.pickupAddress.recipientName} · ${item.pickupAddress.pincode}',
                        ),
                        isThreeLine: true,
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () async {
                          await context.push(
                            PartnerRoutes.returnPickup(item.id),
                          );
                          if (mounted) await _load(true);
                        },
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

String _status(AppLocalizations strings, ReturnPickupStatus status) =>
    switch (status) {
      ReturnPickupStatus.assigned => strings.deliveryStatusAssigned,
      ReturnPickupStatus.accepted => strings.deliveryStatusAccepted,
      ReturnPickupStatus.rejected => strings.deliveryStatusRejected,
      ReturnPickupStatus.collected => strings.returnPickupCollected,
      ReturnPickupStatus.cancelled => strings.statusCancelled,
    };
