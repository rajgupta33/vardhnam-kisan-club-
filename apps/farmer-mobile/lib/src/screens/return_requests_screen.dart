import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_error_presentation.dart';
import '../orders/order_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../returns/farmer_return.dart';
import '../returns/farmer_return_repository.dart';
import '../returns/return_presentation.dart';
import '../routing/app_routes.dart';

class ReturnRequestsScreen extends ConsumerStatefulWidget {
  const ReturnRequestsScreen({super.key});

  @override
  ConsumerState<ReturnRequestsScreen> createState() =>
      _ReturnRequestsScreenState();
}

class _ReturnRequestsScreenState extends ConsumerState<ReturnRequestsScreen>
    with WidgetsBindingObserver {
  late final FarmerReturnRepository _repository;
  List<FarmerReturnRequest> _requests = const [];
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
    _repository = ref.read(farmerReturnRepositoryProvider);
    unawaited(_loadRequests());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_isLoading && !_isLoadingMore) {
      unawaited(_loadRequests());
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.myReturnsTitle)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadRequests,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              Text(strings.myReturnsSubtitle),
              const SizedBox(height: 16),
              DropdownButtonFormField<String?>(
                initialValue: _status,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: strings.returnStatusFilterLabel,
                  border: const OutlineInputBorder(),
                ),
                items: [
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(strings.allReturnsFilter),
                  ),
                  for (final status in _statuses)
                    DropdownMenuItem<String?>(
                      value: status,
                      child: Text(returnStatusLabel(strings, status)),
                    ),
                ],
                onChanged: _isLoading
                    ? null
                    : (status) {
                        setState(() => _status = status);
                        unawaited(_loadRequests());
                      },
              ),
              const SizedBox(height: 14),
              if (_isLoading)
                FarmerListLoadingState(label: strings.loadingReturnsLabel)
              else if (_errorMessage != null)
                _ReturnMessage(
                  message: _errorMessage!,
                  actionLabel: strings.retryActionLabel,
                  onAction: _loadRequests,
                )
              else if (_requests.isEmpty)
                _ReturnMessage(message: strings.noReturnsMessage)
              else ...[
                for (final request in _requests)
                  Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      onTap: () => _openRequest(request.id),
                      leading: const Icon(Icons.assignment_return_outlined),
                      title: Text(request.sellerName),
                      subtitle: Text(
                        '${strings.orderNumberLabel}: ${request.orderNumber}\n'
                        '${formatOrderDateTime(context, request.requestedAt)}',
                      ),
                      isThreeLine: true,
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(returnStatusLabel(strings, request.status)),
                          Text(formatPaise(request.refundableAmountPaise)),
                        ],
                      ),
                    ),
                  ),
                if (_requests.length < _total)
                  OutlinedButton(
                    onPressed: _isLoadingMore
                        ? null
                        : () => unawaited(_loadMore()),
                    child: Text(
                      _isLoadingMore
                          ? strings.loadingMoreReturnsLabel
                          : strings.loadMoreReturnsAction,
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loadRequests() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final page = await _repository.listMyReturnRequests(status: _status);
      if (!mounted) return;
      setState(() {
        _requests = page.items;
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
      final page = await _repository.listMyReturnRequests(
        page: _page + 1,
        status: _status,
      );
      if (!mounted) return;
      setState(() {
        _requests = [..._requests, ...page.items];
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

  Future<void> _openRequest(String returnRequestId) async {
    await context.push(AppRoutes.returnRequest(returnRequestId));
    if (mounted) await _loadRequests();
  }
}

class _ReturnMessage extends StatelessWidget {
  const _ReturnMessage({
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
        const Icon(Icons.assignment_return_outlined, size: 44),
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

const _statuses = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTED',
  'COMPLETED',
  'CANCELLED',
];
