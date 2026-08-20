import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/app_localizations.dart';
import '../return_pickups/return_pickup_models.dart';
import '../return_pickups/return_pickup_repository.dart';

class ReturnPickupDetailScreen extends ConsumerStatefulWidget {
  const ReturnPickupDetailScreen({required this.assignmentId, super.key});
  final String assignmentId;
  @override
  ConsumerState<ReturnPickupDetailScreen> createState() =>
      _ReturnPickupDetailScreenState();
}

class _ReturnPickupDetailScreenState
    extends ConsumerState<ReturnPickupDetailScreen> {
  ReturnPickup? _pickup;
  bool _loading = true;
  bool _submitting = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final pickup = await ref
          .read(returnPickupRepositoryProvider)
          .get(widget.assignmentId);
      if (mounted) setState(() => _pickup = pickup);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _accept() => _mutate(
    () => ref.read(returnPickupRepositoryProvider).accept(widget.assignmentId),
    AppLocalizations.of(context).returnPickupAccepted,
  );
  Future<void> _reject() async {
    final strings = AppLocalizations.of(context);
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => _NoteDialog(
        title: strings.rejectReturnPickup,
        label: strings.deliveryRejectionReason,
        required: true,
      ),
    );
    if (reason == null || !mounted) return;
    await _mutate(
      () => ref
          .read(returnPickupRepositoryProvider)
          .reject(assignmentId: widget.assignmentId, reason: reason),
      strings.returnPickupRejected,
    );
  }

  Future<void> _collect() async {
    final strings = AppLocalizations.of(context);
    final note = await showDialog<String>(
      context: context,
      builder: (_) => _NoteDialog(
        title: strings.collectReturnPickup,
        label: strings.returnPickupNoteOptional,
      ),
    );
    if (note == null || !mounted) return;
    await _mutate(
      () => ref
          .read(returnPickupRepositoryProvider)
          .collect(assignmentId: widget.assignmentId, note: note),
      strings.returnPickupCollectedMessage,
    );
  }

  Future<void> _mutate(
    Future<ReturnPickup> Function() operation,
    String message,
  ) async {
    setState(() => _submitting = true);
    try {
      final pickup = await operation();
      if (!mounted) return;
      setState(() => _pickup = pickup);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocalizations.of(context).returnPickupUpdateFailed,
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _navigate(ReturnPickup pickup) async {
    final uri = Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': pickup.pickupAddress.formatted,
    });
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _call(ReturnPickup pickup) async {
    await launchUrl(
      Uri(scheme: 'tel', path: pickup.pickupAddress.phone),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.returnPickupDetail)),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _failed || _pickup == null
            ? Center(
                child: FilledButton(
                  onPressed: _load,
                  child: Text(strings.tryAgain),
                ),
              )
            : RefreshIndicator(
                onRefresh: _load,
                child: _content(strings, _pickup!),
              ),
      ),
    );
  }

  Widget _content(AppLocalizations strings, ReturnPickup pickup) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Text(
        strings.orderNumber(pickup.orderNumber),
        style: Theme.of(context).textTheme.headlineSmall,
      ),
      Text(pickup.assignmentNumber),
      Text(pickup.sellerName),
      const Divider(height: 32),
      Text(
        strings.returnReason,
        style: Theme.of(context).textTheme.titleMedium,
      ),
      Text(pickup.returnReasonCode.replaceAll('_', ' ')),
      if (pickup.returnReasonNote?.isNotEmpty ?? false)
        Text(pickup.returnReasonNote!),
      const Divider(height: 32),
      Text(
        strings.pickupAddress,
        style: Theme.of(context).textTheme.titleMedium,
      ),
      Text(pickup.pickupAddress.recipientName),
      SelectableText(pickup.pickupAddress.formatted),
      Wrap(
        spacing: 8,
        children: [
          OutlinedButton.icon(
            onPressed: () => _navigate(pickup),
            icon: const Icon(Icons.navigation_outlined),
            label: Text(strings.openNavigation),
          ),
          OutlinedButton.icon(
            onPressed: () => _call(pickup),
            icon: const Icon(Icons.phone_outlined),
            label: Text(strings.callFarmer),
          ),
        ],
      ),
      const Divider(height: 32),
      ...pickup.items.map(
        (item) => ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(item.productName),
          subtitle: Text(item.variantName),
          trailing: Text(strings.itemQuantity(item.quantity)),
        ),
      ),
      if (pickup.status == ReturnPickupStatus.assigned) ...[
        FilledButton(
          onPressed: _submitting ? null : _accept,
          child: Text(strings.acceptReturnPickup),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _submitting ? null : _reject,
          child: Text(strings.rejectReturnPickup),
        ),
      ],
      if (pickup.status == ReturnPickupStatus.accepted)
        FilledButton.icon(
          key: const Key('collect-return-button'),
          onPressed: _submitting ? null : _collect,
          icon: const Icon(Icons.inventory_2_outlined),
          label: Text(strings.collectReturnPickup),
        ),
      if (pickup.status == ReturnPickupStatus.collected)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.check_circle_outline),
          title: Text(strings.returnPickupCollectedMessage),
          subtitle: pickup.collectionNote == null
              ? null
              : Text(pickup.collectionNote!),
        ),
      if (_submitting)
        const Padding(
          padding: EdgeInsets.all(12),
          child: Center(child: CircularProgressIndicator()),
        ),
    ],
  );
}

class _NoteDialog extends StatefulWidget {
  const _NoteDialog({
    required this.title,
    required this.label,
    this.required = false,
  });
  final String title;
  final String label;
  final bool required;
  @override
  State<_NoteDialog> createState() => _NoteDialogState();
}

class _NoteDialogState extends State<_NoteDialog> {
  final _controller = TextEditingController();
  bool _invalid = false;
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        maxLength: 500,
        maxLines: 3,
        decoration: InputDecoration(
          labelText: widget.label,
          errorText: _invalid ? strings.reasonRequired : null,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(strings.cancelAction),
        ),
        FilledButton(
          onPressed: () {
            final value = _controller.text.trim();
            if (widget.required && value.length < 3) {
              setState(() => _invalid = true);
              return;
            }
            Navigator.pop(context, value);
          },
          child: Text(strings.confirmAction),
        ),
      ],
    );
  }
}
