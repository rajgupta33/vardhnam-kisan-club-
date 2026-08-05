import 'package:flutter/material.dart';
import 'checkout_review_screen.dart';
import '../strings/app_strings.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.en;
    final theme = Theme.of(context);
    final subtotalPaise = _cartItems.fold<int>(
      0,
      (total, item) => total + item.priceSnapshotPaise * item.quantity,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.cartTitle),
        actions: [
          IconButton(
            tooltip: strings.cartClear,
            onPressed: () {},
            icon: const Icon(Icons.delete_outline),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _PincodePanel(
              label: strings.cartAddressLabel,
              pincode: _cartPincode,
            ),
            const SizedBox(height: 14),
            for (final item in _cartItems) _CartItemCard(item: item),
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
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const CheckoutReviewScreen(),
                  ),
                );
              },
              icon: const Icon(Icons.fact_check_outlined),
              label: Text(strings.checkoutActionLabel),
            ),
            const SizedBox(height: 10),
            FilledButton.tonalIcon(
              onPressed: () {
                if (Navigator.of(context).canPop()) {
                  Navigator.of(context).pop();
                }
              },
              icon: const Icon(Icons.add_shopping_cart_outlined),
              label: Text(strings.cartAddMore),
            ),
          ],
        ),
      ),
    );
  }
}

class _PincodePanel extends StatelessWidget {
  const _PincodePanel({
    required this.label,
    required this.pincode,
  });

  final String label;
  final String pincode;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: ListTile(
        leading: const Icon(Icons.location_on_outlined),
        title: Text(label),
        subtitle: Text(pincode),
      ),
    );
  }
}

class _CartItemCard extends StatelessWidget {
  const _CartItemCard({required this.item});

  final _CartItemPreview item;

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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.productName,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(item.variantName),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  _formatPaise(item.priceSnapshotPaise),
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _CartChip(
                  icon: Icons.format_list_numbered,
                  label: '${strings.quantityLabel} ${item.quantity}',
                ),
                _CartChip(
                  icon: Icons.inventory_2_outlined,
                  label:
                      '${strings.cartSnapshotLabel}: ${item.availableQuantitySnapshot}',
                ),
                _CartChip(
                  icon: Icons.storefront_outlined,
                  label: '${strings.sellerLabel}: ${item.sellerName}',
                ),
                _CartChip(
                  icon: Icons.sell_outlined,
                  label: strings.priceSnapshotLabel,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CartChip extends StatelessWidget {
  const _CartChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: 6),
          Text(label),
        ],
      ),
    );
  }
}

class _CartItemPreview {
  const _CartItemPreview({
    required this.productName,
    required this.variantName,
    required this.sellerName,
    required this.quantity,
    required this.priceSnapshotPaise,
    required this.availableQuantitySnapshot,
  });

  final String productName;
  final String variantName;
  final String sellerName;
  final int quantity;
  final int priceSnapshotPaise;
  final int availableQuantitySnapshot;
}

String _formatPaise(int value) {
  final rupees = value ~/ 100;
  final paise = value % 100;
  return paise == 0 ? 'Rs $rupees' : 'Rs $rupees.${paise.toString().padLeft(2, '0')}';
}

const _cartPincode = '302001';

const _cartItems = [
  _CartItemPreview(
    productName: 'Hybrid Bajra Seed',
    variantName: '1 kg pack',
    sellerName: 'Jaipur Krishi Distributor',
    quantity: 2,
    priceSnapshotPaise: 120000,
    availableQuantitySnapshot: 42,
  ),
  _CartItemPreview(
    productName: 'Soil Nutrition Mix',
    variantName: '5 kg pack',
    sellerName: 'Vardhnam Rural Supply',
    quantity: 1,
    priceSnapshotPaise: 86000,
    availableQuantitySnapshot: 18,
  ),
];
