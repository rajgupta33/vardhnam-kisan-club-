import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../delivery/delivery_assignment_models.dart';
import '../delivery/delivery_assignment_repository.dart';
import '../routing/partner_routes.dart';

class DeliveryAssignmentsScreen extends ConsumerStatefulWidget {
  const DeliveryAssignmentsScreen({super.key});

  @override
  ConsumerState<DeliveryAssignmentsScreen> createState() =>
      _DeliveryAssignmentsScreenState();
}

class _DeliveryAssignmentsScreenState
    extends ConsumerState<DeliveryAssignmentsScreen> {
  final List<DeliveryOrder> _items = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _errorCode;
  int _page = 1;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _load(refresh: true);
  }

  Future<void> _load({required bool refresh}) async {
    if (refresh) {
      setState(() {
        _loading = true;
        _errorCode = null;
      });
    } else {
      setState(() => _loadingMore = true);
    }
    try {
      final nextPage = refresh ? 1 : _page + 1;
      final result = await ref
          .read(deliveryAssignmentRepositoryProvider)
          .list(page: nextPage);
      if (!mounted) return;
      setState(() {
        if (refresh) _items.clear();
        final knownIds = _items.map((item) => item.id).toSet();
        _items.addAll(result.items.where((item) => knownIds.add(item.id)));
        _page = result.page;
        _total = result.total;
        _errorCode = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorCode = error.runtimeType.toString());
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
      appBar: AppBar(title: Text(strings.deliveryAssignments)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _load(refresh: true),
          child: _body(strings),
        ),
      ),
    );
  }

  Widget _body(AppLocalizations strings) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_errorCode != null && _items.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(strings.deliveryAssignmentsLoadFailed),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => _load(refresh: true),
            child: Text(strings.tryAgain),
          ),
        ],
      );
    }
    if (_items.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [Text(strings.noDeliveryAssignments)],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _items.length + (_items.length < _total ? 1 : 0),
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == _items.length) {
          return OutlinedButton(
            onPressed: _loadingMore ? null : () => _load(refresh: false),
            child: _loadingMore
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(strings.loadMore),
          );
        }
        final order = _items[index];
        return Card(
          child: ListTile(
            minVerticalPadding: 16,
            title: Text(strings.orderNumber(order.orderNumber)),
            subtitle: Text(
              '${_statusLabel(strings, order.assignment.status)}\n'
              '${order.address.recipientName} · ${order.serviceablePincode}\n'
              '${strings.sellerName(order.sellerName)}',
            ),
            isThreeLine: true,
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              await context.push(PartnerRoutes.delivery(order.id));
              if (mounted) await _load(refresh: true);
            },
          ),
        );
      },
    );
  }
}

String _statusLabel(
  AppLocalizations strings,
  DeliveryAssignmentStatus status,
) => switch (status) {
  DeliveryAssignmentStatus.assigned => strings.deliveryStatusAssigned,
  DeliveryAssignmentStatus.accepted => strings.deliveryStatusAccepted,
  DeliveryAssignmentStatus.rejected => strings.deliveryStatusRejected,
  DeliveryAssignmentStatus.outForDelivery => strings.statusOutForDelivery,
  DeliveryAssignmentStatus.delivered => strings.deliveryStatusDelivered,
  DeliveryAssignmentStatus.deliveryFailed => strings.deliveryStatusFailed,
  DeliveryAssignmentStatus.cancelled => strings.statusCancelled,
};
