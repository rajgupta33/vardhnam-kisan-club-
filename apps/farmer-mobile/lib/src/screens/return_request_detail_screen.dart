import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_error_presentation.dart';
import '../orders/order_presentation.dart';
import '../orders/invoice_download_launcher.dart';
import '../presentation/farmer_loading_state.dart';
import '../returns/farmer_credit_note.dart';
import '../returns/farmer_return.dart';
import '../returns/farmer_return_repository.dart';
import '../returns/return_presentation.dart';
import '../routing/app_routes.dart';

class ReturnRequestDetailScreen extends ConsumerStatefulWidget {
  const ReturnRequestDetailScreen({required this.returnRequestId, super.key});

  final String returnRequestId;

  @override
  ConsumerState<ReturnRequestDetailScreen> createState() =>
      _ReturnRequestDetailScreenState();
}

class _ReturnRequestDetailScreenState
    extends ConsumerState<ReturnRequestDetailScreen>
    with WidgetsBindingObserver {
  late final FarmerReturnRepository _repository;
  FarmerReturnRequest? _request;
  String? _errorMessage;
  var _isLoading = true;
  var _isCancelling = false;
  var _isCreditNoteBusy = false;
  FarmerCreditNote? _creditNote;
  String? _creditNoteMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _repository = ref.read(farmerReturnRepositoryProvider);
    unawaited(_load());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_isLoading) {
      unawaited(_load(showLoading: false));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.returnDetailTitle)),
      body: SafeArea(
        child: switch ((_isLoading, _request)) {
          (true, null) => FarmerDetailLoadingState(
            label: strings.loadingReturnDetailLabel,
          ),
          (_, final FarmerReturnRequest request) => RefreshIndicator(
            onRefresh: _load,
            child: _ReturnDetailBody(
              request: request,
              errorMessage: _errorMessage,
              isCancelling: _isCancelling,
              isCreditNoteBusy: _isCreditNoteBusy,
              creditNote: _creditNote,
              creditNoteMessage: _creditNoteMessage,
              onCancel: _cancelReturn,
              onCreditNote: () => _openCreditNote(request),
            ),
          ),
          _ => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _errorMessage ?? strings.returnDetailLoadFailed,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () => unawaited(_load()),
                    child: Text(strings.retryActionLabel),
                  ),
                ],
              ),
            ),
          ),
        },
      ),
    );
  }

  Future<void> _load({bool showLoading = true}) async {
    setState(() {
      if (showLoading) _isLoading = true;
      _errorMessage = null;
    });
    try {
      final request = await _repository.getReturnRequest(
        widget.returnRequestId,
      );
      if (mounted) setState(() => _request = request);
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

  Future<void> _cancelReturn() async {
    if (_isCancelling) return;
    final strings = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(strings.cancelReturnDialogTitle),
        content: Text(strings.cancelReturnDialogMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(strings.keepReturnAction),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(strings.cancelReturnAction),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _isCancelling = true;
      _errorMessage = null;
    });
    try {
      final request = await _repository.cancelReturnRequest(
        widget.returnRequestId,
      );
      if (!mounted) return;
      setState(() => _request = request);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.returnCancelledMessage)));
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _errorMessage = apiErrorMessage(
          AppLocalizations.of(context)!,
          error,
        ),
      );
    } finally {
      if (mounted) setState(() => _isCancelling = false);
    }
  }

  Future<void> _openCreditNote(FarmerReturnRequest request) async {
    if (_isCreditNoteBusy || request.refunds.isEmpty) return;
    final refund = request.refunds.first;
    if (refund.status != 'SUCCEEDED') return;
    final strings = AppLocalizations.of(context)!;
    setState(() {
      _isCreditNoteBusy = true;
      _creditNoteMessage = null;
    });
    try {
      final note = await _repository.getCreditNote(refund.id);
      if (!mounted) return;
      setState(() => _creditNote = note);
      final document = note.document;
      if (document?.isAvailable == true) {
        final download = await _repository.getCreditNoteDownload(refund.id);
        final launched = await ref
            .read(invoiceDownloadLauncherProvider)
            .launch(download.downloadUri);
        if (!mounted) return;
        setState(
          () => _creditNoteMessage = launched
              ? strings.creditNoteOpenedMessage
              : strings.creditNoteOpenFailedMessage,
        );
      } else {
        setState(
          () => _creditNoteMessage = document?.status == 'FAILED'
              ? strings.creditNoteFailedMessage
              : strings.creditNotePreparingMessage,
        );
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _creditNoteMessage = apiErrorMessage(strings, error));
    } finally {
      if (mounted) setState(() => _isCreditNoteBusy = false);
    }
  }
}

class _ReturnDetailBody extends StatelessWidget {
  const _ReturnDetailBody({
    required this.request,
    required this.isCancelling,
    required this.isCreditNoteBusy,
    required this.creditNote,
    required this.creditNoteMessage,
    required this.onCancel,
    required this.onCreditNote,
    this.errorMessage,
  });

  final FarmerReturnRequest request;
  final String? errorMessage;
  final bool isCancelling;
  final bool isCreditNoteBusy;
  final FarmerCreditNote? creditNote;
  final String? creditNoteMessage;
  final Future<void> Function() onCancel;
  final Future<void> Function() onCreditNote;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        Text(request.sellerName, style: theme.textTheme.headlineSmall),
        Text('${strings.orderNumberLabel}: ${request.orderNumber}'),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: Chip(label: Text(returnStatusLabel(strings, request.status))),
        ),
        Text(
          strings.returnRequestedOnLabel(
            formatOrderDateTime(context, request.requestedAt),
          ),
        ),
        Text(
          strings.returnExpectedAmountLabel(
            formatPaise(request.refundableAmountPaise),
          ),
        ),
        if (request.approvedRefundAmountPaise != null)
          Text(
            strings.returnApprovedAmountLabel(
              formatPaise(request.approvedRefundAmountPaise!),
            ),
          ),
        if (request.inspectionNote != null) ...[
          const SizedBox(height: 8),
          Text(
            '${strings.returnInspectionNoteLabel}: ${request.inspectionNote}',
          ),
        ],
        if (request.refunds.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            strings.returnRefundStatusLabel(
              refundStatusLabel(strings, request.refunds.first.status),
            ),
          ),
          if (request.refunds.first.providerRefundReference != null)
            Text(
              strings.returnRefundReferenceLabel(
                request.refunds.first.providerRefundReference!,
              ),
            ),
          if (request.refunds.first.status == 'SUCCEEDED') ...[
            const SizedBox(height: 12),
            _CreditNoteCard(
              note: creditNote,
              isBusy: isCreditNoteBusy,
              message: creditNoteMessage,
              onPressed: onCreditNote,
            ),
          ],
        ],
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  strings.returnReasonLabel,
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(returnReasonLabel(strings, request.reasonCode)),
                if (request.reasonNote != null) ...[
                  const SizedBox(height: 4),
                  Text(request.reasonNote!),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(strings.returnItemsTitle, style: theme.textTheme.titleLarge),
        const SizedBox(height: 6),
        for (final item in request.items)
          Card(
            child: ListTile(
              title: Text(item.productName),
              subtitle: Text(item.variantName),
              trailing: Text(
                '${item.quantity} × ${formatPaise(item.unitPricePaise)}\n'
                '${formatPaise(item.lineRefundPaise)}',
                textAlign: TextAlign.end,
              ),
            ),
          ),
        const SizedBox(height: 12),
        Text(strings.returnTimelineTitle, style: theme.textTheme.titleLarge),
        const SizedBox(height: 6),
        if (request.statusHistory.isEmpty)
          Text(strings.returnTimelineEmptyMessage)
        else
          for (var index = 0; index < request.statusHistory.length; index++)
            _TimelineEntry(
              history: request.statusHistory[index],
              isLast: index == request.statusHistory.length - 1,
            ),
        const SizedBox(height: 12),
        if (request.status == 'REQUESTED' || request.status == 'APPROVED')
          OutlinedButton.icon(
            onPressed: isCancelling ? null : () => unawaited(onCancel()),
            icon: isCancelling
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.cancel_outlined),
            label: Text(strings.cancelReturnAction),
          ),
        OutlinedButton.icon(
          onPressed: () =>
              context.push(AppRoutes.order(request.productOrderId)),
          icon: const Icon(Icons.receipt_long_outlined),
          label: Text(strings.openRelatedOrderAction),
        ),
        if (errorMessage != null) ...[
          const SizedBox(height: 10),
          Text(errorMessage!, style: TextStyle(color: theme.colorScheme.error)),
        ],
      ],
    );
  }
}

class _CreditNoteCard extends StatelessWidget {
  const _CreditNoteCard({
    required this.note,
    required this.isBusy,
    required this.message,
    required this.onPressed,
  });

  final FarmerCreditNote? note;
  final bool isBusy;
  final String? message;
  final Future<void> Function() onPressed;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              strings.creditNoteTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (note != null) ...[
              const SizedBox(height: 6),
              Text(strings.creditNoteNumberLabel(note!.creditNoteNumber)),
              Text(
                strings.creditNoteOriginalInvoiceLabel(
                  note!.originalInvoiceNumber,
                ),
              ),
              Text(
                strings.creditNoteRefundAmountLabel(
                  formatPaise(note!.farmerRefundPaise),
                ),
              ),
              Text(strings.creditNoteTaxLabel(formatPaise(note!.taxPaise))),
            ],
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: isBusy ? null : () => unawaited(onPressed()),
              icon: isBusy
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.download_outlined),
              label: Text(
                note == null
                    ? strings.creditNoteViewAction
                    : note!.document?.isAvailable == true
                    ? strings.creditNoteDownloadAction
                    : strings.creditNoteCheckStatusAction,
              ),
            ),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(message!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

class _TimelineEntry extends StatelessWidget {
  const _TimelineEntry({required this.history, required this.isLast});

  final FarmerReturnStatusHistory history;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Semantics(
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              const Icon(Icons.check_circle, size: 22),
              if (!isLast) Container(width: 2, height: 48, color: Colors.grey),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    returnStatusLabel(strings, history.toStatus),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  Text(formatOrderDateTime(context, history.createdAt)),
                  if (history.reason != null) Text(history.reason!),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
