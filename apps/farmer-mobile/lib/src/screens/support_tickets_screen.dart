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
import '../support/support_contact_actions.dart';

class SupportTicketsScreen extends ConsumerStatefulWidget {
  const SupportTicketsScreen({super.key});

  @override
  ConsumerState<SupportTicketsScreen> createState() =>
      _SupportTicketsScreenState();
}

class _SupportTicketsScreenState extends ConsumerState<SupportTicketsScreen>
    with WidgetsBindingObserver {
  late final FarmerSupportRepository _repository;
  List<FarmerSupportTicket> _tickets = const [];
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
    _repository = ref.read(farmerSupportRepositoryProvider);
    unawaited(_loadTickets());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_isLoading && !_isLoadingMore) {
      unawaited(_loadTickets());
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.supportTicketsTitle)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNewTicket,
        icon: const Icon(Icons.add),
        label: Text(strings.createSupportTicketAction),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadTickets,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
            children: [
              const SupportContactActions(),
              DropdownButtonFormField<String?>(
                initialValue: _status,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: strings.supportStatusFilterLabel,
                  border: const OutlineInputBorder(),
                ),
                items: [
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(strings.allSupportTicketsFilter),
                  ),
                  for (final status in _filterStatuses)
                    DropdownMenuItem<String?>(
                      value: status,
                      child: Text(supportStatusLabel(strings, status)),
                    ),
                ],
                onChanged: _isLoading
                    ? null
                    : (status) {
                        setState(() => _status = status);
                        unawaited(_loadTickets());
                      },
              ),
              const SizedBox(height: 14),
              if (_isLoading)
                FarmerListLoadingState(
                  label: strings.loadingSupportTicketsLabel,
                )
              else if (_errorMessage != null)
                _SupportMessage(
                  message: _errorMessage!,
                  actionLabel: strings.retryActionLabel,
                  onAction: _loadTickets,
                )
              else if (_tickets.isEmpty)
                _SupportMessage(message: strings.noSupportTicketsMessage)
              else ...[
                for (final ticket in _tickets)
                  Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      onTap: () => _openTicket(ticket.id),
                      title: Text(ticket.subject),
                      subtitle: Text(
                        '${supportCategoryLabel(strings, ticket.category)}\n'
                        '${formatOrderDateTime(context, ticket.createdAt)}',
                      ),
                      isThreeLine: true,
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(supportStatusLabel(strings, ticket.status)),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                    ),
                  ),
                if (_tickets.length < _total)
                  OutlinedButton(
                    onPressed: _isLoadingMore
                        ? null
                        : () => unawaited(_loadMore()),
                    child: Text(
                      _isLoadingMore
                          ? strings.loadingMoreSupportTickets
                          : strings.loadMoreSupportTicketsAction,
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loadTickets() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final page = await _repository.listMyTickets(status: _status);
      if (!mounted) return;
      setState(() {
        _tickets = page.items;
        _page = page.page;
        _total = page.total;
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
      final page = await _repository.listMyTickets(
        page: _page + 1,
        status: _status,
      );
      if (!mounted) return;
      setState(() {
        _tickets = [..._tickets, ...page.items];
        _page = page.page;
        _total = page.total;
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(AppLocalizations.of(context)!, error),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoadingMore = false);
    }
  }

  Future<void> _openNewTicket() async {
    await context.push(AppRoutes.newSupportTicket);
    if (mounted) await _loadTickets();
  }

  Future<void> _openTicket(String ticketId) async {
    await context.push(AppRoutes.supportTicket(ticketId));
    if (mounted) await _loadTickets();
  }
}

class _SupportMessage extends StatelessWidget {
  const _SupportMessage({
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final String? actionLabel;
  final Future<void> Function()? onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 36),
    child: Column(
      children: [
        const Icon(Icons.support_agent, size: 44),
        const SizedBox(height: 12),
        Text(message, textAlign: TextAlign.center),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => unawaited(onAction!()),
            child: Text(actionLabel!),
          ),
        ],
      ],
    ),
  );
}

const _filterStatuses = ['OPEN', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];
