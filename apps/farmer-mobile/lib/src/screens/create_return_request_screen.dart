import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_error_presentation.dart';
import '../returns/farmer_return.dart';
import '../returns/farmer_return_repository.dart';

class CreateReturnRequestScreen extends ConsumerStatefulWidget {
  const CreateReturnRequestScreen({required this.orderId, super.key});

  final String orderId;

  @override
  ConsumerState<CreateReturnRequestScreen> createState() =>
      _CreateReturnRequestScreenState();
}

class _CreateReturnRequestScreenState
    extends ConsumerState<CreateReturnRequestScreen> {
  final _noteController = TextEditingController();
  final _quantities = <String, int>{};
  FarmerReturnEligibility? _eligibility;
  String _reasonCode = 'DAMAGED_IN_TRANSIT';
  String? _error;
  var _loading = true;
  var _submitting = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final eligibility = await ref
          .read(farmerReturnRepositoryProvider)
          .getEligibility(widget.orderId);
      if (!mounted) return;
      setState(() => _eligibility = eligibility);
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = apiErrorMessage(AppLocalizations.of(context)!, error),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting || !_canSubmit) return;
    final strings = AppLocalizations.of(context)!;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref
          .read(farmerReturnRepositoryProvider)
          .createReturnRequest(
            orderId: widget.orderId,
            reasonCode: _reasonCode,
            reasonNote: _noteController.text,
            itemQuantities: _quantities,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(strings.returnRequestSubmittedMessage)),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = apiErrorMessage(strings, error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  bool get _canSubmit {
    if (_eligibility?.eligible != true ||
        !_quantities.values.any((value) => value > 0)) {
      return false;
    }
    return _reasonCode != 'OTHER' || _noteController.text.trim().isNotEmpty;
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.returnRequestTitle)),
      body: SafeArea(
        child: _loading
            ? Center(
                child: CircularProgressIndicator(
                  semanticsLabel: strings.loadingReturnEligibilityLabel,
                ),
              )
            : _buildBody(strings),
      ),
    );
  }

  Widget _buildBody(AppLocalizations strings) {
    final eligibility = _eligibility;
    if (eligibility == null) {
      return _ErrorBody(
        message: _error ?? strings.returnEligibilityLoadFailed,
        onRetry: _load,
      );
    }
    if (!eligibility.eligible) {
      return _ErrorBody(
        message: eligibility.reason ?? strings.returnNotEligibleMessage,
        onRetry: _load,
      );
    }

    final windowDate = eligibility.windowExpiresAt;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(strings.returnRequestIntro),
        if (windowDate != null) ...[
          const SizedBox(height: 8),
          Text(
            strings.returnWindowEndsLabel(
              MaterialLocalizations.of(context).formatMediumDate(windowDate),
            ),
          ),
        ],
        const SizedBox(height: 18),
        Text(
          strings.returnItemsTitle,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        for (final item in eligibility.items)
          _ReturnItemQuantity(
            item: item,
            quantity: _quantities[item.productOrderItemId] ?? 0,
            onChanged: (quantity) =>
                setState(() => _quantities[item.productOrderItemId] = quantity),
          ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          isExpanded: true,
          initialValue: _reasonCode,
          decoration: InputDecoration(labelText: strings.returnReasonLabel),
          items: _reasonCodes
              .map(
                (code) => DropdownMenuItem(
                  value: code,
                  child: Text(_reasonLabel(strings, code)),
                ),
              )
              .toList(growable: false),
          onChanged: _submitting
              ? null
              : (value) => setState(() => _reasonCode = value!),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _noteController,
          maxLength: 1000,
          maxLines: 4,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            labelText: strings.returnReasonNoteLabel,
            helperText: _reasonCode == 'OTHER'
                ? strings.returnReasonNoteRequiredMessage
                : null,
          ),
        ),
        Text(
          strings.returnInventorySafetyMessage,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(
            _error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 18),
        FilledButton.icon(
          onPressed: _canSubmit && !_submitting ? _submit : null,
          icon: _submitting
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.assignment_return_outlined),
          label: Text(strings.submitReturnRequestAction),
        ),
      ],
    );
  }
}

class _ReturnItemQuantity extends StatelessWidget {
  const _ReturnItemQuantity({
    required this.item,
    required this.quantity,
    required this.onChanged,
  });

  final FarmerReturnEligibleItem item;
  final int quantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Card(
      child: ListTile(
        title: Text(item.productName),
        subtitle: Text(item.variantName),
        trailing: DropdownButton<int>(
          value: quantity,
          hint: Text(strings.quantityLabel),
          items: [
            for (var value = 0; value <= item.orderedQuantity; value++)
              DropdownMenuItem(
                value: value,
                child: Text(
                  value == 0 ? strings.doNotReturnItemLabel : '$value',
                ),
              ),
          ],
          onChanged: (value) => onChanged(value!),
        ),
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => unawaited(onRetry()),
            child: Text(AppLocalizations.of(context)!.retryActionLabel),
          ),
        ],
      ),
    ),
  );
}

const _reasonCodes = [
  'DAMAGED_IN_TRANSIT',
  'WRONG_ITEM',
  'EXPIRED_OR_NEAR_EXPIRY',
  'QUALITY_ISSUE',
  'NOT_AS_DESCRIBED',
  'ORDERED_BY_MISTAKE',
  'OTHER',
];

String _reasonLabel(AppLocalizations strings, String code) => switch (code) {
  'DAMAGED_IN_TRANSIT' => strings.returnReasonDamaged,
  'WRONG_ITEM' => strings.returnReasonWrongItem,
  'EXPIRED_OR_NEAR_EXPIRY' => strings.returnReasonExpiry,
  'QUALITY_ISSUE' => strings.returnReasonQuality,
  'NOT_AS_DESCRIBED' => strings.returnReasonNotAsDescribed,
  'ORDERED_BY_MISTAKE' => strings.returnReasonMistake,
  _ => strings.returnReasonOther,
};
