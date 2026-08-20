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

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen>
    with WidgetsBindingObserver {
  late final FarmerNotificationRepository _repository;
  List<FarmerNotification> _notifications = const [];
  String? _errorMessage;
  var _unreadOnly = false;
  var _page = 1;
  var _total = 0;
  var _isLoading = true;
  var _isLoadingMore = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _repository = ref.read(farmerNotificationRepositoryProvider);
    unawaited(_loadNotifications());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_isLoading && !_isLoadingMore) {
      unawaited(_loadNotifications());
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.notificationsTitle)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadNotifications,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              VardhnamInfoCard(
                padding: EdgeInsets.zero,
                child: SwitchListTile(
                  title: Text(strings.unreadNotificationsOnlyLabel),
                  secondary: const Icon(Icons.mark_email_unread_outlined),
                  value: _unreadOnly,
                  onChanged: _isLoading
                      ? null
                      : (value) {
                          setState(() => _unreadOnly = value);
                          unawaited(_loadNotifications());
                        },
                ),
              ),
              const SizedBox(height: VardhnamSpacing.large),
              if (_isLoading)
                FarmerListLoadingState(label: strings.loadingNotificationsLabel)
              else if (_errorMessage != null)
                VardhnamErrorState(
                  message: _errorMessage!,
                  retryLabel: strings.retryActionLabel,
                  onRetry: () => unawaited(_loadNotifications()),
                )
              else if (_notifications.isEmpty)
                VardhnamEmptyState(
                  icon: Icons.notifications_none,
                  title: strings.noNotificationsTitle,
                  message: _unreadOnly
                      ? strings.noUnreadNotificationsMessage
                      : strings.noNotificationsMessage,
                )
              else ...[
                for (final notification in _notifications)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: VardhnamInfoCard(
                      onTap: () => _openNotification(notification.id),
                      backgroundColor: notification.isUnread
                          ? VardhnamColors.surfaceGreen
                          : null,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            notificationCategoryIcon(notification.category),
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          const SizedBox(width: VardhnamSpacing.medium),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                VardhnamStatusChip(
                                  label: notificationCategoryLabel(
                                    strings,
                                    notification.category,
                                  ),
                                ),
                                const SizedBox(height: VardhnamSpacing.small),
                                Text(
                                  notification.title,
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(
                                        fontWeight: notification.isUnread
                                            ? FontWeight.w700
                                            : null,
                                      ),
                                ),
                                const SizedBox(height: VardhnamSpacing.xSmall),
                                Text(
                                  notification.body,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: VardhnamSpacing.small),
                                Text(
                                  formatOrderDateTime(
                                    context,
                                    notification.createdAt,
                                  ),
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                    ),
                  ),
                if (_notifications.length < _total)
                  OutlinedButton(
                    onPressed: _isLoadingMore
                        ? null
                        : () => unawaited(_loadMore()),
                    child: Text(
                      _isLoadingMore
                          ? strings.loadingMoreNotificationsLabel
                          : strings.loadMoreNotificationsAction,
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final page = await _repository.listMyNotifications(
        unreadOnly: _unreadOnly,
      );
      if (!mounted) return;
      setState(() {
        _notifications = page.items;
        _page = page.page;
        _total = page.total;
      });
    } catch (error) {
      if (mounted) {
        setState(
          () => _errorMessage = apiErrorMessage(
            AppLocalizations.of(context)!,
            error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMore() async {
    setState(() => _isLoadingMore = true);
    try {
      final page = await _repository.listMyNotifications(
        page: _page + 1,
        unreadOnly: _unreadOnly,
      );
      if (!mounted) return;
      setState(() {
        _notifications = [..._notifications, ...page.items];
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

  Future<void> _openNotification(String id) async {
    await context.push(AppRoutes.notification(id));
    if (mounted) await _loadNotifications();
  }
}
