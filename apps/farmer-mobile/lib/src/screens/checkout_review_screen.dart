import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../addresses/farmer_address_repository.dart';
import '../cart/farmer_cart.dart';
import '../cart/farmer_cart_repository.dart';
import '../checkout/farmer_checkout.dart';
import '../checkout/farmer_checkout_repository.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../payments/farmer_payment.dart';
import '../payments/farmer_payment_repository.dart';
import '../profile/farmer_profile.dart';
import '../routing/app_routes.dart';

class CheckoutReviewScreen extends ConsumerStatefulWidget {
  const CheckoutReviewScreen({super.key});

  @override
  ConsumerState<CheckoutReviewScreen> createState() =>
      _CheckoutReviewScreenState();
}

class _CheckoutReviewScreenState extends ConsumerState<CheckoutReviewScreen> {
  late final FarmerCartRepository _cartRepository;
  late final FarmerAddressRepository _addressRepository;
  late final FarmerCheckoutRepository _checkoutRepository;
  late final FarmerPaymentRepository _paymentRepository;
  FarmerCart? _cart;
  List<FarmerAddress> _addresses = const [];
  String? _selectedAddressId;
  FarmerCheckout? _checkout;
  FarmerPaymentIntent? _paymentIntent;
  String? _errorMessage;
  var _isLoading = true;
  var _isCreating = false;
  var _isMutatingCheckout = false;

  @override
  void initState() {
    super.initState();
    _cartRepository = ref.read(farmerCartRepositoryProvider);
    _addressRepository = ref.read(farmerAddressRepositoryProvider);
    _checkoutRepository = ref.read(farmerCheckoutRepositoryProvider);
    _paymentRepository = ref.read(farmerPaymentRepositoryProvider);
    unawaited(_loadReview());
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppBar(title: Text(strings.checkoutReviewTitle)),
      body: SafeArea(
        child: switch ((_isLoading, _cart, _checkout)) {
          (true, null, null) => FarmerDetailLoadingState(
            label: strings.loadingCheckoutReview,
          ),
          (_, _, final FarmerCheckout checkout) => _CheckoutCreatedBody(
            checkout: checkout,
            paymentIntent: _paymentIntent,
            errorMessage: _errorMessage,
            isMutating: _isMutatingCheckout,
            onConfirmPayment: (outcome) => _confirmPayment(checkout, outcome),
            onCancelCheckout: () => _cancelCheckout(checkout),
          ),
          (false, final FarmerCart cart, null) => RefreshIndicator(
            onRefresh: _loadReview,
            child: _CheckoutReviewBody(
              cart: cart,
              eligibleAddresses: _eligibleAddresses(cart),
              selectedAddressId: _selectedAddressId,
              errorMessage: _errorMessage,
              isCreating: _isCreating,
              onAddressSelected: (addressId) {
                setState(() {
                  _selectedAddressId = addressId;
                  _errorMessage = null;
                });
              },
              onManageAddresses: _manageAddresses,
              onCreateCheckout: _createCheckout,
            ),
          ),
          _ => _CheckoutErrorState(
            message: _errorMessage ?? strings.checkoutReviewLoadFailed,
            retryLabel: strings.retryActionLabel,
            onRetry: _loadReview,
          ),
        },
      ),
    );
  }

  List<FarmerAddress> _eligibleAddresses(FarmerCart cart) => _addresses
      .where((address) => address.pincode == cart.serviceablePincode)
      .toList(growable: false);

  Future<void> _loadReview() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final results = await Future.wait<Object>([
        _cartRepository.getCart(),
        _addressRepository.listAddresses(),
      ]);
      if (!mounted) return;
      final cart = results[0] as FarmerCart;
      final addresses = results[1] as List<FarmerAddress>;
      final eligible = addresses
          .where((address) => address.pincode == cart.serviceablePincode)
          .toList(growable: false);
      final currentSelectionIsEligible = eligible.any(
        (address) => address.id == _selectedAddressId,
      );
      final cartAddressIsEligible = eligible.any(
        (address) => address.id == cart.deliveryAddress?.id,
      );
      final defaultAddress = eligible
          .where((address) => address.isDefault)
          .firstOrNull;

      setState(() {
        _cart = cart;
        _addresses = addresses;
        _selectedAddressId = currentSelectionIsEligible
            ? _selectedAddressId
            : cartAddressIsEligible
            ? cart.deliveryAddress?.id
            : defaultAddress?.id ?? eligible.firstOrNull?.id;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = _messageFor(error);
      });
    }
  }

  Future<void> _manageAddresses() async {
    await context.push(AppRoutes.addresses);
    if (mounted) await _loadReview();
  }

  Future<void> _createCheckout() async {
    final addressId = _selectedAddressId;
    if (addressId == null || _isCreating) return;
    setState(() {
      _isCreating = true;
      _errorMessage = null;
    });
    try {
      final checkout = await _checkoutRepository.createCheckout(addressId);
      if (!mounted) return;
      setState(() => _checkout = checkout);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  Future<void> _confirmPayment(
    FarmerCheckout checkout,
    MockPaymentOutcome outcome,
  ) async {
    if (_isMutatingCheckout) return;
    setState(() {
      _isMutatingCheckout = true;
      _errorMessage = null;
    });
    try {
      final reusableIntent = switch (_paymentIntent?.status) {
        'PENDING' || 'PROCESSING' => _paymentIntent,
        _ => null,
      };
      final intent =
          reusableIntent ?? await _paymentRepository.createIntent(checkout.id);
      if (mounted) setState(() => _paymentIntent = intent);
      final confirmed = await _paymentRepository.confirmIntent(
        intent.id,
        outcome,
      );
      final refreshedCheckout = await _checkoutRepository.getCheckout(
        checkout.id,
      );
      if (!mounted) return;
      setState(() {
        _paymentIntent = confirmed;
        _checkout = refreshedCheckout;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _isMutatingCheckout = false);
    }
  }

  Future<void> _cancelCheckout(FarmerCheckout checkout) async {
    if (_isMutatingCheckout) return;
    final strings = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(strings.cancelCheckoutDialogTitle),
        content: Text(strings.cancelCheckoutDialogMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(strings.keepCheckoutAction),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(strings.cancellationActionLabel),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _isMutatingCheckout = true;
      _errorMessage = null;
    });
    try {
      final cancelled = await _checkoutRepository.cancelCheckout(checkout.id);
      if (!mounted) return;
      setState(() => _checkout = cancelled);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageFor(error));
    } finally {
      if (mounted) setState(() => _isMutatingCheckout = false);
    }
  }

  String _messageFor(Object error) =>
      apiErrorMessage(AppLocalizations.of(context)!, error);
}

class _CheckoutReviewBody extends StatelessWidget {
  const _CheckoutReviewBody({
    required this.cart,
    required this.eligibleAddresses,
    required this.selectedAddressId,
    required this.errorMessage,
    required this.isCreating,
    required this.onAddressSelected,
    required this.onManageAddresses,
    required this.onCreateCheckout,
  });

  final FarmerCart cart;
  final List<FarmerAddress> eligibleAddresses;
  final String? selectedAddressId;
  final String? errorMessage;
  final bool isCreating;
  final ValueChanged<String> onAddressSelected;
  final Future<void> Function() onManageAddresses;
  final Future<void> Function() onCreateCheckout;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        if (cart.items.isEmpty)
          _MessagePanel(
            icon: Icons.remove_shopping_cart_outlined,
            message: strings.checkoutEmptyCartMessage,
          )
        else ...[
          Text(
            strings.selectDeliveryAddressTitle,
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(
            '${strings.cartAddressLabel}: ${cart.serviceablePincode}',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          if (eligibleAddresses.isEmpty)
            _MessagePanel(
              icon: Icons.location_off_outlined,
              message: strings.noMatchingCheckoutAddress,
            )
          else
            for (final address in eligibleAddresses)
              _AddressChoice(
                address: address,
                selected: address.id == selectedAddressId,
                onTap: () => onAddressSelected(address.id),
              ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => unawaited(onManageAddresses()),
              icon: const Icon(Icons.edit_location_alt_outlined),
              label: Text(strings.manageAddressesAction),
            ),
          ),
          const SizedBox(height: 14),
          Text(strings.orderItemsTitle, style: theme.textTheme.titleLarge),
          const SizedBox(height: 8),
          for (final item in cart.items)
            Card(
              child: ListTile(
                title: Text(item.productNameSnapshot),
                subtitle: Text(
                  '${item.variantNameSnapshot}\n'
                  '${strings.sellerLabel}: ${item.sellerNameSnapshot}',
                ),
                isThreeLine: true,
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${strings.quantityLabel} ${item.quantity}'),
                    Text(_formatPaise(item.lineTotalPaise)),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 12),
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
          const SizedBox(height: 4),
          Text(
            strings.checkoutRevalidationNotice,
            style: theme.textTheme.bodySmall,
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(
              errorMessage!,
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ],
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: selectedAddressId == null || isCreating
                ? null
                : () => unawaited(onCreateCheckout()),
            icon: isCreating
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.lock_outline),
            label: Text(
              isCreating
                  ? strings.creatingCheckoutLabel
                  : strings.confirmCheckoutAction,
            ),
          ),
        ],
      ],
    );
  }
}

class _CheckoutCreatedBody extends StatelessWidget {
  const _CheckoutCreatedBody({
    required this.checkout,
    required this.paymentIntent,
    required this.errorMessage,
    required this.isMutating,
    required this.onConfirmPayment,
    required this.onCancelCheckout,
  });
  final FarmerCheckout checkout;
  final FarmerPaymentIntent? paymentIntent;
  final String? errorMessage;
  final bool isMutating;
  final Future<void> Function(MockPaymentOutcome outcome) onConfirmPayment;
  final Future<void> Function() onCancelCheckout;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    final address = checkout.deliveryAddress;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _MessagePanel(
          icon: Icons.check_circle_outline,
          message: strings.checkoutCreatedMessage,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(
              label: Text(
                '${strings.orderStatusLabel}: ${_formatCode(checkout.status)}',
              ),
            ),
            Chip(
              label: Text(
                '${strings.childOrdersLabel}: ${checkout.childOrderCount}',
              ),
            ),
            Chip(label: Text(_formatPaise(checkout.subtotalPaise))),
          ],
        ),
        if (checkout.clubBenefitPaise > 0) ...[
          const SizedBox(height: 12),
          _ClubBenefitSummary(
            benefitPaise: checkout.clubBenefitPaise,
            payablePaise:
                checkout.farmerPayablePaise ??
                checkout.subtotalPaise - checkout.clubBenefitPaise,
          ),
        ],
        if (address != null) ...[
          const SizedBox(height: 16),
          Text(
            strings.deliveryAddressTitle,
            style: theme.textTheme.titleMedium,
          ),
          Text(_formatAddress(address)),
        ],
        const SizedBox(height: 18),
        Text(strings.childOrdersLabel, style: theme.textTheme.titleLarge),
        const SizedBox(height: 8),
        for (final order in checkout.orders) _ChildOrderCard(order: order),
        const SizedBox(height: 12),
        _PaymentAndCancellationPanel(
          checkout: checkout,
          paymentIntent: paymentIntent,
          errorMessage: errorMessage,
          isMutating: isMutating,
          onConfirmPayment: onConfirmPayment,
          onCancelCheckout: onCancelCheckout,
        ),
      ],
    );
  }
}

class _PaymentAndCancellationPanel extends StatelessWidget {
  const _PaymentAndCancellationPanel({
    required this.checkout,
    required this.paymentIntent,
    required this.errorMessage,
    required this.isMutating,
    required this.onConfirmPayment,
    required this.onCancelCheckout,
  });

  final FarmerCheckout checkout;
  final FarmerPaymentIntent? paymentIntent;
  final String? errorMessage;
  final bool isMutating;
  final Future<void> Function(MockPaymentOutcome outcome) onConfirmPayment;
  final Future<void> Function() onCancelCheckout;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    final paymentSucceeded = checkout.status == 'PAID';
    final cancelled = checkout.status == 'CANCELLED';
    final canPay =
        checkout.status == 'PENDING_PAYMENT' ||
        checkout.status == 'PAYMENT_FAILED';
    final canCancel = canPay;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(strings.mockPaymentTitle, style: theme.textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(strings.mockPaymentEnvironmentNotice),
            const SizedBox(height: 12),
            Text(
              '${strings.paymentStatusLabel}: '
              '${_formatCode(paymentIntent?.status ?? checkout.status)}',
            ),
            if (paymentIntent != null) ...[
              Text(
                '${strings.paymentReferenceLabel}: '
                '${paymentIntent!.providerReference}',
              ),
              Text(
                '${strings.paymentAmountLabel}: '
                '${_formatPaise(paymentIntent!.amountPaise)}',
              ),
            ],
            if (paymentSucceeded) ...[
              const SizedBox(height: 12),
              _MessagePanel(
                icon: Icons.verified_outlined,
                message: strings.mockPaymentSucceededMessage,
              ),
            ] else if (cancelled) ...[
              const SizedBox(height: 12),
              _MessagePanel(
                icon: Icons.cancel_outlined,
                message: strings.checkoutCancelledMessage,
              ),
            ] else if (canPay) ...[
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: isMutating
                    ? null
                    : () => unawaited(
                        onConfirmPayment(MockPaymentOutcome.success),
                      ),
                icon: isMutating
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.payments_outlined),
                label: Text(strings.mockPaymentSuccessAction),
              ),
              TextButton(
                onPressed: isMutating
                    ? null
                    : () => unawaited(
                        onConfirmPayment(MockPaymentOutcome.failure),
                      ),
                child: Text(strings.mockPaymentFailureAction),
              ),
              const Divider(height: 28),
              OutlinedButton.icon(
                onPressed: canCancel && !isMutating
                    ? () => unawaited(onCancelCheckout())
                    : null,
                icon: const Icon(Icons.cancel_outlined),
                label: Text(strings.cancellationActionLabel),
              ),
            ],
            if (errorMessage != null) ...[
              const SizedBox(height: 10),
              Text(
                errorMessage!,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChildOrderCard extends StatelessWidget {
  const _ChildOrderCard({required this.order});
  final FarmerChildOrder order;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(order.sellerNameSnapshot, style: theme.textTheme.titleMedium),
            Text('${strings.orderNumberLabel}: ${order.orderNumber}'),
            if (order.sellerGstinSnapshot != null)
              Text('GSTIN: ${order.sellerGstinSnapshot}'),
            Text('${strings.orderStatusLabel}: ${_formatCode(order.status)}'),
            const Divider(height: 24),
            for (final item in order.items) ...[
              Text(item.productNameSnapshot, style: theme.textTheme.titleSmall),
              Text(
                '${item.variantNameSnapshot} · ${strings.quantityLabel} ${item.quantity}',
              ),
              Text('${strings.warehouseLabel}: ${item.warehouseNameSnapshot}'),
              Text('${strings.reservedStockLabel}: ${_reservationLabel(item)}'),
              Align(
                alignment: Alignment.centerRight,
                child: Text(_formatPaise(item.lineTotalPaise)),
              ),
              if (item.clubBenefitPaise > 0)
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    strings.kisanClubLineBenefitLabel(
                      _formatPaise(item.clubBenefitPaise),
                    ),
                  ),
                ),
              const SizedBox(height: 10),
            ],
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                _formatPaise(order.subtotalPaise),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (order.clubBenefitPaise > 0)
              _ClubBenefitSummary(
                benefitPaise: order.clubBenefitPaise,
                payablePaise:
                    order.farmerPayablePaise ??
                    order.subtotalPaise - order.clubBenefitPaise,
              ),
          ],
        ),
      ),
    );
  }
}

class _ClubBenefitSummary extends StatelessWidget {
  const _ClubBenefitSummary({
    required this.benefitPaise,
    required this.payablePaise,
  });

  final int benefitPaise;
  final int payablePaise;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(child: Text(strings.kisanClubBenefitLabel)),
                Text('-${_formatPaise(benefitPaise)}'),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: Text(
                    strings.kisanClubFarmerPayableLabel,
                    style: theme.textTheme.titleSmall,
                  ),
                ),
                Text(
                  _formatPaise(payablePaise),
                  style: theme.textTheme.titleMedium,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AddressChoice extends StatelessWidget {
  const _AddressChoice({
    required this.address,
    required this.selected,
    required this.onTap,
  });
  final FarmerAddress address;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    color: selected ? Theme.of(context).colorScheme.primaryContainer : null,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: ListTile(
        leading: Icon(
          selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
        ),
        title: Text('${address.label} · ${address.recipientName}'),
        subtitle: Text(_formatAddress(address)),
      ),
    ),
  );
}

class _MessagePanel extends StatelessWidget {
  const _MessagePanel({required this.icon, required this.message});
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Row(
      children: [
        Icon(icon),
        const SizedBox(width: 10),
        Expanded(child: Text(message)),
      ],
    ),
  );
}

class _CheckoutErrorState extends StatelessWidget {
  const _CheckoutErrorState({
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

String _reservationLabel(FarmerCheckoutItem item) => item.reservations
    .map(
      (reservation) => '${reservation.batchNumber} × ${reservation.quantity}',
    )
    .join(', ');

String _formatAddress(FarmerAddress address) => [
  address.addressLine1,
  if (address.addressLine2 != null) address.addressLine2!,
  if (address.village != null) address.village!,
  address.city,
  if (address.district != null) address.district!,
  address.state,
  address.pincode,
].join(', ');

String _formatCode(String value) => value
    .split('_')
    .map(
      (part) =>
          part.isEmpty ? part : '${part[0]}${part.substring(1).toLowerCase()}',
    )
    .join(' ');

String _formatPaise(int value) {
  final rupees = value ~/ 100;
  final paise = value % 100;
  return paise == 0
      ? '\u20b9$rupees'
      : '\u20b9$rupees.${paise.toString().padLeft(2, '0')}';
}
