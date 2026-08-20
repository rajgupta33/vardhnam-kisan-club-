import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_error_presentation.dart';
import '../notifications/farmer_notification.dart';
import '../notifications/farmer_notification_repository.dart';
import '../notifications/notification_presentation.dart';
import '../orders/order_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';

class NotificationDetailScreen extends ConsumerStatefulWidget {
  const NotificationDetailScreen({required this.notificationId, super.key});

  final String notificationId;

  @override
  ConsumerState<NotificationDetailScreen> createState() =>
      _NotificationDetailScreenState();
}

class _NotificationDetailScreenState
    extends ConsumerState<NotificationDetailScreen> {
  late final FarmerNotificationRepository _repository;
  FarmerNotification? _notification;
  String? _errorMessage;
  var _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repository = ref.read(farmerNotificationRepositoryProvider);
    unawaited(_loadAndMarkRead());
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final notification = _notification;
    return Scaffold(
      appBar: AppBar(title: Text(strings.notificationDetailTitle)),
      body: SafeArea(
        child: switch ((_isLoading, notification)) {
          (true, null) => FarmerDetailLoadingState(
            label: strings.loadingNotificationDetailLabel,
          ),
          (_, final FarmerNotification item) => RefreshIndicator(
            onRefresh: _loadAndMarkRead,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: VardhnamStatusChip(
                    label: notificationCategoryLabel(strings, item.category),
                    icon: notificationCategoryIcon(item.category),
                    backgroundColor: VardhnamColors.surfaceGreen,
                  ),
                ),
                const SizedBox(height: VardhnamSpacing.medium),
                Text(
                  item.title,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(formatOrderDateTime(context, item.createdAt)),
                const SizedBox(height: VardhnamSpacing.large),
                VardhnamInfoCard(
                  child: Text(
                    item.body,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
                if (_safeRoute(item) case final String route) ...[
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () => context.push(route),
                    icon: const Icon(Icons.open_in_new),
                    label: Text(strings.openNotificationResourceAction),
                  ),
                ],
                if (_errorMessage != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _errorMessage!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
              ],
            ),
          ),
          _ => Padding(
            padding: const EdgeInsets.all(VardhnamSpacing.large),
            child: VardhnamErrorState(
              message: _errorMessage ?? strings.notificationLoadFailed,
              retryLabel: strings.retryActionLabel,
              onRetry: () => unawaited(_loadAndMarkRead()),
            ),
          ),
        },
      ),
    );
  }

  Future<void> _loadAndMarkRead() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      var notification = await _repository.getNotification(
        widget.notificationId,
      );
      if (notification.isUnread) {
        notification = await _repository.markRead(widget.notificationId);
      }
      if (mounted) setState(() => _notification = notification);
    } catch (error) {
      if (mounted) setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String? _safeRoute(FarmerNotification notification) {
    final id = notification.relatedResourceId;
    if (id == null) return null;
    return switch (notification.relatedResourceType) {
      'ProductOrder' => AppRoutes.order(id),
      'SupportTicket' => AppRoutes.supportTicket(id),
      'ReturnRequest' => AppRoutes.returnRequest(id),
      'AdvisoryEvent' => AppRoutes.advisory(id),
      _ => null,
    };
  }

  String _messageFor(Object error) =>
      apiErrorMessage(AppLocalizations.of(context)!, error);
}
