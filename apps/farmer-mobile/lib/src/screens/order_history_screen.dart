import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_error_presentation.dart';
import '../orders/farmer_order.dart';
import '../orders/farmer_order_repository.dart';
import '../orders/order_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';

class OrderHistoryScreen extends ConsumerStatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  ConsumerState<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends ConsumerState<OrderHistoryScreen>
    with WidgetsBindingObserver {
  late final FarmerOrderRepository _repository;
  List<FarmerOrder> _orders = const [];
  String? _status;
  String? _errorMessage;
  var _page = 1;
  var _total = 0;
  var _isLoading = true;
  var _isLoadingMore = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _repository = ref.read(farmerOrderRepositoryProvider);
    unawaited(_loadOrders());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_isLoading && !_isLoadingMore) {
      unawaited(_loadOrders());
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.orderHistoryTitle)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadOrders,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              VardhnamSectionHeader(title: strings.orderStatusFilterLabel),
              const SizedBox(height: VardhnamSpacing.small),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final status in <String?>[null, ..._filterStatuses])
                      Padding(
                        padding: const EdgeInsetsDirectional.only(
                          end: VardhnamSpacing.small,
                        ),
                        child: ChoiceChip(
                          label: Text(
                            status == null
                                ? strings.allOrdersFilterLabel
                                : orderStatusLabel(strings, status),
                          ),
                          avatar: Icon(
                            status == null
                                ? Icons.receipt_long_outlined
                                : _orderStatusIcon(status),
                            size: 18,
                          ),
                          selected: _status == status,
                          onSelected: _isLoading
                              ? null
                              : (_) {
                                  setState(() => _status = status);
                                  unawaited(_loadOrders());
                                },
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              if (_isLoading)
                FarmerListLoadingState(label: strings.loadingOrdersLabel)
              else if (_errorMessage != null)
                VardhnamErrorState(
                  message: _errorMessage!,
                  retryLabel: strings.retryActionLabel,
                  onRetry: () => unawaited(_loadOrders()),
                )
              else if (_orders.isEmpty)
                VardhnamEmptyState(
                  icon: Icons.receipt_long_outlined,
                  title: strings.noOrdersTitle,
                  message: strings.noOrdersBrowseMessage,
                  actionLabel: strings.goToShopAction,
                  onAction: () => context.go(AppRoutes.browse),
                )
              else ...[
                for (final order in _orders)
                  _OrderSummaryCard(
                    order: order,
                    onTap: () => _openOrder(order.id),
                  ),
                if (_orders.length < _total)
                  OutlinedButton(
                    onPressed: _isLoadingMore
                        ? null
                        : () => unawaited(_loadMore()),
                    child: Text(
                      _isLoadingMore
                          ? strings.loadingMoreOrdersLabel
                          : strings.loadMoreOrdersAction,
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final result = await _repository.listOrders(status: _status);
      if (!mounted) return;
      setState(() {
        _orders = result.items;
        _page = result.page;
        _total = result.total;
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _errorMessage = apiErrorMessage(
          AppLocalizations.of(context)!,
          error,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMore() async {
    setState(() => _isLoadingMore = true);
    try {
      final result = await _repository.listOrders(
        page: _page + 1,
        status: _status,
      );
      if (!mounted) return;
      setState(() {
        _orders = [..._orders, ...result.items];
        _page = result.page;
        _total = result.total;
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(apiErrorMessage(AppLocalizations.of(context)!, error)),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoadingMore = false);
    }
  }

  Future<void> _openOrder(String orderId) async {
    await context.push(AppRoutes.order(orderId));
    if (mounted) await _loadOrders();
  }
}

class _OrderSummaryCard extends StatelessWidget {
  const _OrderSummaryCard({required this.order, required this.onTap});

  final FarmerOrder order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: VardhnamInfoCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${strings.orderNumberLabel}: ${order.orderNumber}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: VardhnamSpacing.xSmall),
                      Text(
                        '${strings.orderSellerLabel}: '
                        '${order.sellerNameSnapshot}',
                      ),
                    ],
                  ),
                ),
                VardhnamStatusChip(
                  label: orderStatusLabel(strings, order.status),
                  icon: Icons.local_shipping_outlined,
                ),
              ],
            ),
            const SizedBox(height: VardhnamSpacing.medium),
            Text(
              '${strings.orderPlacedLabel}: '
              '${formatOrderDateTime(context, order.createdAt)}',
            ),
            const SizedBox(height: VardhnamSpacing.medium),
            Row(
              children: [
                Expanded(
                  child: Text(strings.orderItemCountLabel(order.itemCount)),
                ),
                Text(
                  formatPaise(order.subtotalPaise),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: VardhnamSpacing.small),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton.icon(
                onPressed: onTap,
                icon: const Icon(Icons.route_outlined),
                label: Text(strings.trackOrderAction),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const _filterStatuses = [
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'CONFIRMED',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

IconData _orderStatusIcon(String status) => switch (status) {
  'PENDING_PAYMENT' => Icons.payments_outlined,
  'PAYMENT_FAILED' => Icons.error_outline,
  'CONFIRMED' => Icons.check_circle_outline,
  'READY_FOR_PICKUP' => Icons.inventory_2_outlined,
  'OUT_FOR_DELIVERY' => Icons.local_shipping_outlined,
  'DELIVERED' => Icons.task_alt_outlined,
  'CANCELLED' => Icons.cancel_outlined,
  _ => Icons.receipt_long_outlined,
};
