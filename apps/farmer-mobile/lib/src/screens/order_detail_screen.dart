import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_error_presentation.dart';
import '../orders/farmer_order.dart';
import '../orders/farmer_invoice_document.dart';
import '../orders/farmer_order_repository.dart';
import '../orders/invoice_download_launcher.dart';
import '../orders/order_presentation.dart';
import '../orders/order_refresh_policy.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';
import '../core/widgets/vardhnam_components.dart';

class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({required this.orderId, super.key});

  final String orderId;

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen>
    with WidgetsBindingObserver {
  late final FarmerOrderRepository _repository;
  FarmerOrder? _order;
  String? _errorMessage;
  var _isLoading = true;
  var _isCancelling = false;
  var _isRefreshing = false;
  var _isInvoiceBusy = false;
  FarmerInvoiceDocument? _invoiceDocument;
  String? _invoiceMessage;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _repository = ref.read(farmerOrderRepositoryProvider);
    unawaited(_loadOrder());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_loadOrder(showLoading: false));
    } else if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      _pollTimer?.cancel();
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.orderDetailTitle)),
      body: SafeArea(
        child: switch ((_isLoading, _order)) {
          (true, null) => FarmerDetailLoadingState(
            label: strings.loadingOrderDetailLabel,
          ),
          (_, final FarmerOrder order) => RefreshIndicator(
            onRefresh: _loadOrder,
            child: _OrderDetailBody(
              order: order,
              errorMessage: _errorMessage,
              isCancelling: _isCancelling,
              isInvoiceBusy: _isInvoiceBusy,
              invoiceDocument: _invoiceDocument,
              invoiceMessage: _invoiceMessage,
              onCancel: () => _cancelOrder(order),
              onInvoicePdf: () => _handleInvoicePdf(order),
              onRequestReturn: () async {
                final created = await context.push<bool>(
                  AppRoutes.returnForOrder(order.id),
                );
                if (created == true && mounted) {
                  await _loadOrder(showLoading: false);
                }
              },
            ),
          ),
          _ => _OrderLoadError(
            message: _errorMessage ?? strings.orderLoadFailed,
            onRetry: _loadOrder,
          ),
        },
      ),
    );
  }

  Future<void> _loadOrder({bool showLoading = true}) async {
    if (_isRefreshing || _isCancelling) return;
    _isRefreshing = true;
    _pollTimer?.cancel();
    setState(() {
      if (showLoading) _isLoading = true;
      _errorMessage = null;
    });
    try {
      final order = await _repository.getOrder(widget.orderId);
      if (!mounted) return;
      setState(() => _order = order);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageFor(error));
    } finally {
      _isRefreshing = false;
      if (mounted) {
        setState(() => _isLoading = false);
        _schedulePolling();
      }
    }
  }

  void _schedulePolling() {
    _pollTimer?.cancel();
    final order = _order;
    if (order == null || !OrderRefreshPolicy.shouldPoll(order.status)) return;
    _pollTimer = Timer(
      OrderRefreshPolicy.pollInterval,
      () => unawaited(_loadOrder(showLoading: false)),
    );
  }

  Future<void> _cancelOrder(FarmerOrder order) async {
    if (_isCancelling || !order.canCancel) return;
    final strings = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(strings.cancelOrderDialogTitle),
        content: Text(strings.cancelOrderDialogMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(strings.keepOrderAction),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(strings.cancelOrderAction),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    _pollTimer?.cancel();
    setState(() {
      _isCancelling = true;
      _errorMessage = null;
    });
    try {
      final cancelled = await _repository.cancelOrder(order.id);
      if (!mounted) return;
      setState(() => _order = cancelled);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) {
        setState(() => _isCancelling = false);
        _schedulePolling();
      }
    }
  }

  Future<void> _handleInvoicePdf(FarmerOrder order) async {
    if (_isInvoiceBusy || order.invoice == null) return;
    final strings = AppLocalizations.of(context)!;
    setState(() {
      _isInvoiceBusy = true;
      _invoiceMessage = null;
    });
    try {
      final currentDocument = _invoiceDocument;
      final FarmerInvoiceDocument document;
      if (currentDocument == null || currentDocument.status == 'FAILED') {
        document = await _repository.requestInvoicePdf(order.id);
      } else if (!currentDocument.isAvailable) {
        document = await _repository.getInvoicePdf(order.id);
      } else {
        document = currentDocument;
      }
      if (!mounted) return;
      setState(() => _invoiceDocument = document);

      if (document.isAvailable) {
        final download = await _repository.getInvoicePdfDownload(order.id);
        final launched = await ref
            .read(invoiceDownloadLauncherProvider)
            .launch(download.downloadUri);
        if (!mounted) return;
        setState(
          () => _invoiceMessage = launched
              ? strings.invoicePdfOpenedMessage
              : strings.invoicePdfOpenFailedMessage,
        );
      } else {
        setState(() => _invoiceMessage = _invoiceStatusMessage(document));
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _invoiceMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _isInvoiceBusy = false);
    }
  }

  String _invoiceStatusMessage(FarmerInvoiceDocument document) {
    final strings = AppLocalizations.of(context)!;
    return switch (document.status) {
      'FAILED' => strings.invoicePdfFailedMessage,
      _ => strings.invoicePdfPreparingMessage,
    };
  }

  String _messageFor(Object error) =>
      apiErrorMessage(AppLocalizations.of(context)!, error);
}

class _OrderDetailBody extends StatelessWidget {
  const _OrderDetailBody({
    required this.order,
    required this.errorMessage,
    required this.isCancelling,
    required this.isInvoiceBusy,
    required this.invoiceDocument,
    required this.invoiceMessage,
    required this.onCancel,
    required this.onInvoicePdf,
    required this.onRequestReturn,
  });

  final FarmerOrder order;
  final String? errorMessage;
  final bool isCancelling;
  final bool isInvoiceBusy;
  final FarmerInvoiceDocument? invoiceDocument;
  final String? invoiceMessage;
  final Future<void> Function() onCancel;
  final Future<void> Function() onInvoicePdf;
  final Future<void> Function() onRequestReturn;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        Text(order.sellerNameSnapshot, style: theme.textTheme.headlineSmall),
        Text('${strings.orderNumberLabel}: ${order.orderNumber}'),
        if (order.sellerGstinSnapshot != null)
          Text('GSTIN: ${order.sellerGstinSnapshot}'),
        const SizedBox(height: 8),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: VardhnamStatusChip(
            label: orderStatusLabel(strings, order.status),
            icon: Icons.local_shipping_outlined,
          ),
        ),
        Text(
          '${strings.orderPlacedLabel}: '
          '${formatOrderDateTime(context, order.createdAt)}',
        ),
        const SizedBox(height: 18),
        _SectionCard(
          title: strings.deliveryAddressTitle,
          child: Text(formatOrderAddress(order.deliveryAddress)),
        ),
        _SectionCard(
          title: strings.orderItemsTitle,
          child: Column(
            children: [
              for (final item in order.items) ...[
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(item.productNameSnapshot),
                  subtitle: Text(
                    '${item.variantNameSnapshot}\n'
                    '${strings.warehouseLabel}: ${item.warehouseNameSnapshot}\n'
                    '${strings.batchLabel}: ${item.batchNumbers.join(', ')}',
                  ),
                  isThreeLine: true,
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${strings.quantityLabel} ${item.quantity}'),
                      Text(formatPaise(item.lineTotalPaise)),
                    ],
                  ),
                ),
                const Divider(),
              ],
              Row(
                children: [
                  Expanded(
                    child: Text(
                      strings.cartSubtotalLabel,
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  Text(
                    formatPaise(order.subtotalPaise),
                    style: theme.textTheme.titleMedium,
                  ),
                ],
              ),
            ],
          ),
        ),
        if (order.dispatchNumber != null ||
            order.deliveryAssignmentNumber != null)
          _SectionCard(
            title: strings.fulfilmentTrackingTitle,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (order.dispatchNumber != null)
                  Text(
                    '${strings.dispatchNumberLabel}: ${order.dispatchNumber}',
                  ),
                if (order.deliveryAssignmentNumber != null)
                  Text(
                    '${strings.deliveryAssignmentLabel}: '
                    '${order.deliveryAssignmentNumber}',
                  ),
                if (order.deliveryAssignmentStatus != null)
                  Text(
                    '${strings.orderStatusLabel}: '
                    '${orderStatusLabel(strings, order.deliveryAssignmentStatus!)}',
                  ),
              ],
            ),
          ),
        _SectionCard(
          title: strings.orderTimelineTitle,
          child: order.statusHistory.isEmpty
              ? Text(strings.noOrderTimelineMessage)
              : Column(
                  children: [
                    for (final event in order.statusHistory)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.check_circle_outline),
                        title: Text(orderStatusLabel(strings, event.toStatus)),
                        subtitle: Text(
                          [
                            formatOrderDateTime(context, event.createdAt),
                            if (event.reason != null) event.reason!,
                          ].join('\n'),
                        ),
                      ),
                  ],
                ),
        ),
        if (order.invoice != null)
          _InvoiceCard(
            invoice: order.invoice!,
            document: invoiceDocument,
            isBusy: isInvoiceBusy,
            message: invoiceMessage,
            onInvoicePdf: onInvoicePdf,
          )
        else
          _SectionCard(
            title: strings.invoiceTitle,
            child: Text(strings.invoiceNotGeneratedMessage),
          ),
        if (order.canCancel)
          OutlinedButton.icon(
            onPressed: isCancelling ? null : () => unawaited(onCancel()),
            icon: isCancelling
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.cancel_outlined),
            label: Text(strings.cancelOrderAction),
          ),
        if (order.status == 'DELIVERED')
          OutlinedButton.icon(
            onPressed: () => unawaited(onRequestReturn()),
            icon: const Icon(Icons.assignment_return_outlined),
            label: Text(strings.requestReturnAction),
          ),
        OutlinedButton.icon(
          onPressed: () =>
              context.push(AppRoutes.newSupportTicketForOrder(order.id)),
          icon: const Icon(Icons.support_agent),
          label: Text(strings.getHelpWithOrderAction),
        ),
        if (errorMessage != null) ...[
          const SizedBox(height: 10),
          Text(errorMessage!, style: TextStyle(color: theme.colorScheme.error)),
        ],
      ],
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({
    required this.invoice,
    required this.document,
    required this.isBusy,
    required this.message,
    required this.onInvoicePdf,
  });

  final FarmerOrderInvoice invoice;
  final FarmerInvoiceDocument? document;
  final bool isBusy;
  final String? message;
  final Future<void> Function() onInvoicePdf;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return _SectionCard(
      title: strings.invoiceTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${strings.invoiceNumberLabel}: ${invoice.invoiceNumber}'),
          Text(
            '${strings.invoiceSellerLabel}: ${invoice.sellerLegalNameSnapshot}',
          ),
          if (invoice.sellerGstinSnapshot != null)
            Text('GSTIN: ${invoice.sellerGstinSnapshot}'),
          Text('${strings.invoiceBuyerLabel}: ${invoice.farmerNameSnapshot}'),
          Text(
            '${strings.invoiceGeneratedLabel}: '
            '${formatOrderDateTime(context, invoice.generatedAt)}',
          ),
          const Divider(),
          Text(
            '${strings.cartSubtotalLabel}: ${formatPaise(invoice.subtotalPaise)}',
          ),
          Text('${strings.invoiceTaxLabel}: ${formatPaise(invoice.taxPaise)}'),
          Text(
            '${strings.invoiceTotalLabel}: ${formatPaise(invoice.totalPaise)}',
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: isBusy ? null : () => unawaited(onInvoicePdf()),
            icon: isBusy
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    document?.isAvailable == true
                        ? Icons.download_outlined
                        : Icons.picture_as_pdf_outlined,
                  ),
            label: Text(_invoiceActionLabel(strings)),
          ),
          if (message != null) ...[
            const SizedBox(height: 8),
            Text(message!, style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    );
  }

  String _invoiceActionLabel(AppLocalizations strings) {
    if (document?.isAvailable == true) return strings.invoicePdfDownloadAction;
    if (document == null || document?.status == 'FAILED') {
      return strings.invoicePdfPrepareAction;
    }
    return strings.invoicePdfCheckStatusAction;
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: VardhnamInfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(title, style: Theme.of(context).textTheme.titleLarge),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    ),
  );
}

class _OrderLoadError extends StatelessWidget {
  const _OrderLoadError({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => unawaited(onRetry()),
            child: Text(strings.retryActionLabel),
          ),
        ],
      ),
    );
  }
}
