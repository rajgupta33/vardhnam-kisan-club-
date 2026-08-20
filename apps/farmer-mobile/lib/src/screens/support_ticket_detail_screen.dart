import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_error_presentation.dart';
import '../orders/order_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';
import '../support/farmer_support_repository.dart';
import '../support/farmer_support_ticket.dart';
import '../support/support_presentation.dart';

class SupportTicketDetailScreen extends ConsumerStatefulWidget {
  const SupportTicketDetailScreen({required this.ticketId, super.key});

  final String ticketId;

  @override
  ConsumerState<SupportTicketDetailScreen> createState() =>
      _SupportTicketDetailScreenState();
}

class _SupportTicketDetailScreenState
    extends ConsumerState<SupportTicketDetailScreen>
    with WidgetsBindingObserver {
  late final FarmerSupportRepository _repository;
  FarmerSupportTicket? _ticket;
  String? _errorMessage;
  var _isLoading = true;
  var _isReopening = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _repository = ref.read(farmerSupportRepositoryProvider);
    unawaited(_loadTicket());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_isLoading && !_isReopening) {
      unawaited(_loadTicket());
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.supportTicketDetailTitle)),
      body: SafeArea(
        child: switch ((_isLoading, _ticket)) {
          (true, null) => FarmerDetailLoadingState(
            label: strings.loadingSupportTicketDetailLabel,
          ),
          (_, final FarmerSupportTicket ticket) => RefreshIndicator(
            onRefresh: _loadTicket,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  ticket.subject,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Chip(
                      label: Text(supportStatusLabel(strings, ticket.status)),
                    ),
                    Chip(
                      label: Text(
                        supportPriorityLabel(strings, ticket.priority),
                      ),
                    ),
                    Chip(
                      label: Text(
                        supportCategoryLabel(strings, ticket.category),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(ticket.description),
                const SizedBox(height: 16),
                _TicketField(
                  label: strings.supportCreatedLabel,
                  value: formatOrderDateTime(context, ticket.createdAt),
                ),
                _TicketField(
                  label: strings.supportSlaDueLabel,
                  value: formatOrderDateTime(context, ticket.slaDueAt),
                ),
                if (ticket.productOrderId != null)
                  Card(
                    child: ListTile(
                      onTap: () =>
                          context.push(AppRoutes.order(ticket.productOrderId!)),
                      leading: const Icon(Icons.receipt_long_outlined),
                      title: Text(strings.linkedOrderLabel),
                      subtitle: Text(ticket.productOrderId!),
                      trailing: const Icon(Icons.chevron_right),
                    ),
                  ),
                if (ticket.resolutionNote != null) ...[
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.supportResolutionTitle,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 6),
                          Text(ticket.resolutionNote!),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                if (ticket.canReopen)
                  FilledButton.icon(
                    onPressed: _isReopening ? null : _reopenTicket,
                    icon: _isReopening
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh),
                    label: Text(strings.reopenSupportTicketAction),
                  ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    _errorMessage!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Text(
                  strings.supportConversationUnavailableMessage,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          _ => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_errorMessage ?? strings.supportTicketLoadFailed),
                OutlinedButton(
                  onPressed: () => unawaited(_loadTicket()),
                  child: Text(strings.retryActionLabel),
                ),
              ],
            ),
          ),
        },
      ),
    );
  }

  Future<void> _loadTicket() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final ticket = await _repository.getTicket(widget.ticketId);
      if (mounted) setState(() => _ticket = ticket);
    } catch (error) {
      if (mounted) setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _reopenTicket() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => const _ReopenTicketDialog(),
    );
    if (reason == null || !mounted) return;

    setState(() {
      _isReopening = true;
      _errorMessage = null;
    });
    try {
      final ticket = await _repository.reopenTicket(widget.ticketId, reason);
      if (mounted) setState(() => _ticket = ticket);
    } catch (error) {
      if (mounted) setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _isReopening = false);
    }
  }

  String _messageFor(Object error) =>
      apiErrorMessage(AppLocalizations.of(context)!, error);
}

class _ReopenTicketDialog extends StatefulWidget {
  const _ReopenTicketDialog();

  @override
  State<_ReopenTicketDialog> createState() => _ReopenTicketDialogState();
}

class _ReopenTicketDialogState extends State<_ReopenTicketDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return AlertDialog(
      title: Text(strings.reopenSupportTicketTitle),
      content: TextField(
        controller: _controller,
        minLines: 2,
        maxLines: 4,
        maxLength: 500,
        decoration: InputDecoration(
          labelText: strings.reopenReasonLabel,
          border: const OutlineInputBorder(),
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
            if (value.length >= 3) Navigator.pop(context, value);
          },
          child: Text(strings.reopenSupportTicketAction),
        ),
      ],
    );
  }
}

class _TicketField extends StatelessWidget {
  const _TicketField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 120, child: Text(label)),
        Expanded(child: Text(value)),
      ],
    ),
  );
}
