import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../cart/farmer_cart.dart';
import '../cart/farmer_cart_repository.dart';
import '../core/widgets/vardhnam_components.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key, this.repository});

  final FarmerCartRepository? repository;

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen>
    with WidgetsBindingObserver {
  late final FarmerCartRepository _repository;
  FarmerCart? _cart;
  String? _errorMessage;
  final _busyItemIds = <String>{};
  var _isLoading = true;
  var _isClearing = false;
  var _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _repository = widget.repository ?? ref.read(farmerCartRepositoryProvider);
    unawaited(_loadCart());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        !_isLoading &&
        !_isRefreshing &&
        !_isClearing &&
        _busyItemIds.isEmpty) {
      unawaited(_loadCart(showLoading: false));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final cart = _cart;

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.cartTitle),
        actions: [
          if (cart != null && cart.items.isNotEmpty)
            IconButton(
              tooltip: strings.cartClear,
              onPressed: _isClearing ? null : _confirmClearCart,
              icon: _isClearing
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.delete_outline),
            ),
        ],
      ),
      body: SafeArea(
        child: switch ((_isLoading, cart)) {
          (true, null) => FarmerListLoadingState(
            label: strings.loadingCartLabel,
          ),
          (false, null) => _CartErrorState(
            message: _errorMessage ?? strings.cartLoadFailed,
            retryLabel: strings.retryActionLabel,
            onRetry: _loadCart,
          ),
          (_, final FarmerCart loadedCart) => RefreshIndicator(
            onRefresh: _loadCart,
            child: _CartBody(
              cart: loadedCart,
              operationError: _errorMessage,
              busyItemIds: _busyItemIds,
              onQuantityChanged: _updateQuantity,
              onRemove: _removeItem,
            ),
          ),
        },
      ),
    );
  }

  Future<void> _loadCart({bool showLoading = true}) async {
    if (_isRefreshing) return;
    _isRefreshing = true;
    setState(() {
      if (showLoading) _isLoading = true;
      _errorMessage = null;
    });
    try {
      final cart = await _repository.getCart();
      if (!mounted) return;
      setState(() {
        _cart = cart;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = _messageFor(error);
      });
    } finally {
      _isRefreshing = false;
    }
  }

  Future<void> _updateQuantity(FarmerCartItem item, int quantity) async {
    if (_busyItemIds.contains(item.id) || quantity < 1) return;
    setState(() {
      _busyItemIds.add(item.id);
      _errorMessage = null;
    });
    try {
      final cart = await _repository.updateItem(item.id, quantity);
      if (!mounted) return;
      setState(() => _cart = cart);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _busyItemIds.remove(item.id));
    }
  }

  Future<void> _removeItem(FarmerCartItem item) async {
    if (_busyItemIds.contains(item.id)) return;
    setState(() {
      _busyItemIds.add(item.id);
      _errorMessage = null;
    });
    try {
      final cart = await _repository.removeItem(item.id);
      if (!mounted) return;
      setState(() => _cart = cart);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _busyItemIds.remove(item.id));
    }
  }

  Future<void> _confirmClearCart() async {
    final strings = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(strings.clearCartTitle),
        content: Text(strings.clearCartConfirmation),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(strings.cancelAction),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(strings.cartClear),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _isClearing = true;
      _errorMessage = null;
    });
    try {
      final cart = await _repository.clearCart();
      if (!mounted) return;
      setState(() => _cart = cart);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _isClearing = false);
    }
  }

  String _messageFor(Object error) =>
      apiErrorMessage(AppLocalizations.of(context)!, error);
}

class _CartBody extends StatelessWidget {
  const _CartBody({
    required this.cart,
    required this.operationError,
    required this.busyItemIds,
    required this.onQuantityChanged,
    required this.onRemove,
  });

  final FarmerCart cart;
  final String? operationError;
  final Set<String> busyItemIds;
  final void Function(FarmerCartItem item, int quantity) onQuantityChanged;
  final ValueChanged<FarmerCartItem> onRemove;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        _PincodePanel(
          label: strings.cartAddressLabel,
          pincode: cart.serviceablePincode ?? strings.cartPincodeNotSelected,
        ),
        if (operationError != null) ...[
          const SizedBox(height: 12),
          _InlineError(message: operationError!),
        ],
        const SizedBox(height: 14),
        if (cart.items.isEmpty)
          _EmptyCart(onBrowse: () => context.go(AppRoutes.browse))
        else ...[
          for (final group in cart.sellerGroups) ...[
            _SellerGroupHeader(group: group),
            const SizedBox(height: 8),
            for (final item in group.items)
              _CartItemCard(
                item: item,
                isBusy: busyItemIds.contains(item.id),
                onDecrease: switch (item.nextLowerQuantity) {
                  final int quantity => () => onQuantityChanged(item, quantity),
                  null => null,
                },
                onIncrease: switch (item.nextHigherQuantity) {
                  final int quantity => () => onQuantityChanged(item, quantity),
                  null => null,
                },
                onRemove: () => onRemove(item),
              ),
          ],
          const SizedBox(height: 4),
          Divider(color: theme.colorScheme.outlineVariant),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  strings.cartSubtotalLabel,
                  style: theme.textTheme.titleMedium,
                ),
              ),
              Text(
                _formatPaise(cart.subtotalPaise),
                style: theme.textTheme.titleLarge?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          if (cart.clubBenefitPaise > 0) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: Text(strings.kisanClubBenefitLabel)),
                Text('-${_formatPaise(cart.clubBenefitPaise)}'),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Text(
                    strings.kisanClubFarmerPayableLabel,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                Text(
                  _formatPaise(
                    cart.farmerPayablePaise ??
                        cart.subtotalPaise - cart.clubBenefitPaise,
                  ),
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 4),
          Text(
            strings.backendCalculatedTotalLabel,
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: () => context.push(AppRoutes.checkout),
            icon: const Icon(Icons.fact_check_outlined),
            label: Text(strings.checkoutActionLabel),
          ),
          const SizedBox(height: 10),
          FilledButton.tonalIcon(
            onPressed: () => context.go(AppRoutes.browse),
            icon: const Icon(Icons.add_shopping_cart_outlined),
            label: Text(strings.cartAddMore),
          ),
        ],
      ],
    );
  }
}

class _SellerGroupHeader extends StatelessWidget {
  const _SellerGroupHeader({required this.group});

  final FarmerCartSellerGroup group;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Semantics(
      header: true,
      child: VardhnamInfoCard(
        backgroundColor: VardhnamColors.surfaceGreen,
        padding: const EdgeInsets.all(VardhnamSpacing.large),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.storefront_outlined),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    strings.cartSellerGroupTitle(group.sellerNameSnapshot),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 2),
                  Text(strings.cartSellerGroupItems(group.items.length)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PincodePanel extends StatelessWidget {
  const _PincodePanel({required this.label, required this.pincode});
  final String label;
  final String pincode;

  @override
  Widget build(BuildContext context) => VardhnamInfoCard(
    padding: EdgeInsets.zero,
    child: ListTile(
      leading: const Icon(Icons.location_on_outlined),
      title: Text(label),
      subtitle: Text(pincode),
    ),
  );
}

class _CartItemCard extends StatelessWidget {
  const _CartItemCard({
    required this.item,
    required this.isBusy,
    required this.onDecrease,
    required this.onIncrease,
    required this.onRemove,
  });

  final FarmerCartItem item;
  final bool isBusy;
  final VoidCallback? onDecrease;
  final VoidCallback? onIncrease;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: VardhnamSpacing.medium),
      child: VardhnamInfoCard(
        padding: const EdgeInsets.all(VardhnamSpacing.large),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.productNameSnapshot,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(item.variantNameSnapshot),
                    ],
                  ),
                ),
                Text(
                  _formatPaise(item.lineTotalPaise),
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text('${strings.sellerLabel}: ${item.sellerNameSnapshot}'),
            Text('${strings.warehouseLabel}: ${item.warehouseNameSnapshot}'),
            Text(
              '${strings.cartSnapshotLabel}: '
              '${item.availableQuantitySnapshot} ${strings.availableUnit}',
              style: theme.textTheme.bodySmall,
            ),
            Text(
              strings.cartQuantityRangeLabel(
                item.minimumOrderQuantity,
                item.maximumSelectableQuantity,
              ),
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                IconButton.outlined(
                  tooltip: strings.decreaseQuantityLabel,
                  onPressed: isBusy ? null : onDecrease,
                  icon: const Icon(Icons.remove),
                ),
                SizedBox(
                  width: 46,
                  child: Center(
                    child: isBusy
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            '${item.quantity}',
                            style: theme.textTheme.titleMedium,
                          ),
                  ),
                ),
                IconButton.outlined(
                  tooltip: strings.increaseQuantityLabel,
                  onPressed: isBusy ? null : onIncrease,
                  icon: const Icon(Icons.add),
                ),
                const Spacer(),
                IconButton(
                  tooltip: strings.removeItemLabel,
                  onPressed: isBusy ? null : onRemove,
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
            Text(
              '${strings.priceSnapshotLabel}: '
              '${_formatPaise(item.priceSnapshotPaise)} ${strings.perUnitLabel}',
              style: theme.textTheme.bodySmall,
            ),
            if (item.clubBenefitSnapshotPaise > 0) ...[
              const SizedBox(height: 6),
              Text(
                strings.kisanClubLineBenefitLabel(
                  _formatPaise(item.clubBenefitSnapshotPaise),
                ),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart({required this.onBrowse});
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          const Icon(Icons.shopping_cart_outlined, size: 48),
          const SizedBox(height: 14),
          Text(
            strings.emptyCartLabel,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          FilledButton.tonal(
            onPressed: onBrowse,
            child: Text(strings.browseTitle),
          ),
        ],
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      border: Border.all(color: Theme.of(context).colorScheme.error),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Row(
      children: [
        Icon(Icons.error_outline, color: Theme.of(context).colorScheme.error),
        const SizedBox(width: 10),
        Expanded(child: Text(message)),
      ],
    ),
  );
}

class _CartErrorState extends StatelessWidget {
  const _CartErrorState({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });
  final String message;
  final String retryLabel;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => unawaited(onRetry()),
          child: Text(retryLabel),
        ),
      ],
    ),
  );
}

String _formatPaise(int value) {
  final rupees = value ~/ 100;
  final paise = value % 100;
  return paise == 0
      ? '\u20b9$rupees'
      : '\u20b9$rupees.${paise.toString().padLeft(2, '0')}';
}
