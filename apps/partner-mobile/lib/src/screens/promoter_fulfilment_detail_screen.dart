import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../kisan_club/promoter_fulfilment_models.dart';
import '../kisan_club/promoter_fulfilment_presentation.dart';
import '../kisan_club/promoter_fulfilment_repository.dart';

class PromoterFulfilmentDetailScreen extends ConsumerStatefulWidget {
  const PromoterFulfilmentDetailScreen({required this.assignmentId, super.key});

  final String assignmentId;

  @override
  ConsumerState<PromoterFulfilmentDetailScreen> createState() =>
      _PromoterFulfilmentDetailScreenState();
}

class _PromoterFulfilmentDetailScreenState
    extends ConsumerState<PromoterFulfilmentDetailScreen> {
  ClubFulfilmentAssignment? _assignment;
  bool _loading = true;
  bool _acting = false;
  Object? _error;

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
          .read(promoterFulfilmentRepositoryProvider)
          .get(widget.assignmentId);
      if (mounted) setState(() => _assignment = assignment);
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _promptAction(ClubFulfilmentAction action) async {
    final strings = AppLocalizations.of(context);
    var showReasonError = false;
    var enteredReason = '';
    final reason = await showDialog<String?>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(fulfilmentActionLabel(strings, action)),
          content: action.reasonRequired
              ? TextFormField(
                  key: const Key('fulfilment-reason'),
                  maxLength: 500,
                  onChanged: (value) => enteredReason = value,
                  decoration: InputDecoration(
                    labelText: strings.reasonLabel,
                    errorText: showReasonError ? strings.reasonRequired : null,
                  ),
                )
              : Text(strings.confirmAction),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(strings.cancelAction),
            ),
            FilledButton(
              onPressed: () {
                final value = enteredReason.trim();
                if (action.reasonRequired && value.length < 3) {
                  setDialogState(() => showReasonError = true);
                  return;
                }
                Navigator.pop(context, value);
              },
              child: Text(strings.confirmAction),
            ),
          ],
        ),
      ),
    );
    if (reason == null) return;
    await _transition(action, reason);
  }

  Future<void> _transition(ClubFulfilmentAction action, String reason) async {
    setState(() {
      _acting = true;
      _error = null;
    });
    try {
      await ref
          .read(promoterFulfilmentRepositoryProvider)
          .transition(
            assignmentId: widget.assignmentId,
            action: action,
            reason: reason,
          );
      final current = await ref
          .read(promoterFulfilmentRepositoryProvider)
          .get(widget.assignmentId);
      if (mounted) setState(() => _assignment = current);
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final assignment = _assignment;
    return Scaffold(
      appBar: AppBar(title: Text(strings.fulfilmentAssignments)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : assignment == null
          ? Center(
              child: OutlinedButton(
                onPressed: _load,
                child: Text(strings.tryAgain),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    strings.orderNumber(assignment.orderNumber),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  Text(assignment.farmerName),
                  Text(strings.memberNumber(assignment.memberNumber)),
                  Text('${assignment.village ?? '—'} · ${assignment.pincode}'),
                  const SizedBox(height: 12),
                  Text(strings.sellerName(assignment.sellerName)),
                  Text(strings.sellerOrderStatus(assignment.orderStatus)),
                  Text(
                    strings.coordinationStatus(
                      fulfilmentStatusLabel(strings, assignment.status),
                    ),
                  ),
                  Text(strings.fulfilmentMode(assignment.mode)),
                  Text(
                    strings.farmerPayable(
                      _money(assignment.farmerPayablePaise),
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (_acting) const LinearProgressIndicator(),
                  if (_error != null) ...[
                    Text(
                      strings.transitionFailed,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  for (final action in promoterActionsFor(assignment.status))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: FilledButton.tonal(
                        onPressed: _acting ? null : () => _promptAction(action),
                        child: Text(fulfilmentActionLabel(strings, action)),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Text(
                    strings.statusHistory,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (final item in assignment.history)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        strings.historyItem(
                          fulfilmentStatusLabel(strings, item.status),
                          shortDate(item.createdAt),
                        ),
                      ),
                      subtitle: item.reason == null ? null : Text(item.reason!),
                    ),
                ],
              ),
            ),
    );
  }
}

String _money(int paise) =>
    '${paise ~/ 100}.${(paise % 100).toString().padLeft(2, '0')}';
