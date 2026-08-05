import 'package:flutter/material.dart';
import '../strings/app_strings.dart';

class CheckoutReviewScreen extends StatelessWidget {
  const CheckoutReviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.en;
    final theme = Theme.of(context);
    final subtotalPaise = _orders.fold<int>(
      0,
      (total, order) => total + order.subtotalPaise,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.checkoutReviewTitle),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _AddressPanel(strings: strings),
            const SizedBox(height: 14),
            _MockPaymentPanel(
              amountPaise: subtotalPaise,
              payment: _mockPayment,
              strings: strings,
            ),
            const SizedBox(height: 14),
            _CancellationPanel(strings: strings),
            const SizedBox(height: 14),
            Text(
              strings.childOrdersLabel,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 10),
            for (final order in _orders) _ChildOrderCard(order: order),
            const SizedBox(height: 10),
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
                  _formatPaise(subtotalPaise),
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CancellationPanel extends StatelessWidget {
  const _CancellationPanel({required this.strings});

  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.cancel_outlined, color: theme.colorScheme.error),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    strings.cancellationTitle,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                _StatusChip(label: strings.cancellationStatusLabel),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              strings.cancellationSubtitle,
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _StatusChip(label: '${strings.orderStatusLabel}: PAYMENT_FAILED'),
                _StatusChip(label: '${strings.reservationReleaseLabel}: READY'),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.undo_outlined),
                label: Text(strings.cancellationActionLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MockPaymentPanel extends StatelessWidget {
  const _MockPaymentPanel({
    required this.amountPaise,
    required this.payment,
    required this.strings,
  });

  final int amountPaise;
  final _MockPaymentPreview payment;
  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.payments_outlined, color: theme.colorScheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    strings.mockPaymentTitle,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                _StatusChip(label: payment.statusLabel),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              strings.mockPaymentSubtitle,
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _StatusChip(
                  label: '${strings.paymentAmountLabel}: ${_formatPaise(amountPaise)}',
                ),
                _StatusChip(
                  label: '${strings.paymentReferenceLabel}: ${payment.reference}',
                ),
                _StatusChip(
                  label: '${strings.paymentStatusLabel}: ${payment.intentStatus}',
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: null,
                icon: const Icon(Icons.check_circle_outline),
                label: Text(strings.mockPaymentActionLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddressPanel extends StatelessWidget {
  const _AddressPanel({required this.strings});

  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: ListTile(
        leading: const Icon(Icons.home_outlined),
        title: Text(strings.cartAddressLabel),
        subtitle: const Text('Rampura, Jaipur - 302001'),
      ),
    );
  }
}

class _ChildOrderCard extends StatelessWidget {
  const _ChildOrderCard({required this.order});

  final _ChildOrderPreview order;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.en;
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    order.sellerName,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                const SizedBox(width: 12),
                _StatusChip(
                  label: '${strings.orderStatusLabel}: ${order.statusLabel}',
                ),
              ],
            ),
            const SizedBox(height: 12),
            for (final item in order.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.inventory_2_outlined, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('${item.productName} - ${item.variantName}'),
                    ),
                    const SizedBox(width: 8),
                    Text('${strings.quantityLabel} ${item.quantity}'),
                  ],
                ),
              ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _StatusChip(
                  label: '${strings.reservedStockLabel}: ${order.reservedQuantity}',
                ),
                _StatusChip(
                  label: _formatPaise(order.subtotalPaise),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label),
    );
  }
}

class _ChildOrderPreview {
  const _ChildOrderPreview({
    required this.sellerName,
    required this.statusLabel,
    required this.reservedQuantity,
    required this.subtotalPaise,
    required this.items,
  });

  final String sellerName;
  final String statusLabel;
  final int reservedQuantity;
  final int subtotalPaise;
  final List<_ChildOrderItemPreview> items;
}

class _ChildOrderItemPreview {
  const _ChildOrderItemPreview({
    required this.productName,
    required this.variantName,
    required this.quantity,
  });

  final String productName;
  final String variantName;
  final int quantity;
}

class _MockPaymentPreview {
  const _MockPaymentPreview({
    required this.reference,
    required this.statusLabel,
    required this.intentStatus,
  });

  final String reference;
  final String statusLabel;
  final String intentStatus;
}

String _formatPaise(int value) {
  final rupees = value ~/ 100;
  final paise = value % 100;
  return paise == 0 ? 'Rs $rupees' : 'Rs $rupees.${paise.toString().padLeft(2, '0')}';
}

const _mockPayment = _MockPaymentPreview(
  reference: 'mock_phase3c_001',
  statusLabel: 'Mock only',
  intentStatus: 'PROCESSING',
);

const _orders = [
  _ChildOrderPreview(
    sellerName: 'Jaipur Krishi Distributor',
    statusLabel: 'Inventory reserved',
    reservedQuantity: 2,
    subtotalPaise: 240000,
    items: [
      _ChildOrderItemPreview(
        productName: 'Hybrid Bajra Seed',
        variantName: '1 kg pack',
        quantity: 2,
      ),
    ],
  ),
  _ChildOrderPreview(
    sellerName: 'Vardhnam Rural Supply',
    statusLabel: 'Inventory reserved',
    reservedQuantity: 1,
    subtotalPaise: 86000,
    items: [
      _ChildOrderItemPreview(
        productName: 'Soil Nutrition Mix',
        variantName: '5 kg pack',
        quantity: 1,
      ),
    ],
  ),
];
