import 'dart:async';

import 'package:flutter/material.dart';

import '../marketplace/marketplace_api.dart';
import '../strings/app_strings.dart';
import 'cart_screen.dart';

class ProductBrowseScreen extends StatefulWidget {
  const ProductBrowseScreen({
    super.key,
    this.repository,
  });

  final MarketplaceProductRepository? repository;

  @override
  State<ProductBrowseScreen> createState() => _ProductBrowseScreenState();
}

class _ProductBrowseScreenState extends State<ProductBrowseScreen> {
  final _pincodeController = TextEditingController(text: '302001');
  final _searchController = TextEditingController();
  late final MarketplaceProductRepository _repository;
  MarketplaceProductPage? _productPage;
  Timer? _searchDebounce;
  String _selectedCategory = _allCategory;
  String? _errorMessage;
  var _isLoading = false;
  var _requestSequence = 0;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? MarketplaceHttpProductRepository();
    unawaited(_loadProducts());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _pincodeController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.en;
    final products = _productPage?.items ?? const <MarketplaceProductSummary>[];

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.browseTitle),
        actions: [
          IconButton(
            tooltip: strings.cartTitle,
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const CartScreen(),
                ),
              );
            },
            icon: const Icon(Icons.shopping_cart_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadProducts,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextField(
                controller: _pincodeController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: InputDecoration(
                  counterText: '',
                  labelText: strings.pincodeLabel,
                  prefixIcon: const Icon(Icons.location_on_outlined),
                  border: const OutlineInputBorder(),
                ),
                onChanged: (_) => _scheduleProductLoad(),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  labelText: strings.productSearchLabel,
                  prefixIcon: const Icon(Icons.search),
                  border: const OutlineInputBorder(),
                ),
                onChanged: (_) => _scheduleProductLoad(),
              ),
              const SizedBox(height: 14),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final category in _categories)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(
                            category == _allCategory
                                ? strings.allCategory
                                : category,
                          ),
                          selected: _selectedCategory == category,
                          onSelected: (_) {
                            setState(() {
                              _selectedCategory = category;
                            });
                            unawaited(_loadProducts());
                          },
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Text(
                strings.discoveryPreviewLabel,
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              if (!_hasValidPincode)
                _EmptyBrowseState(message: strings.enterValidPincode)
              else if (_isLoading && products.isEmpty)
                _LoadingBrowseState(message: strings.loadingProducts)
              else if (_errorMessage != null && products.isEmpty)
                _ErrorBrowseState(
                  message: '${strings.productLoadFailed} $_errorMessage',
                  retryLabel: strings.retryActionLabel,
                  onRetry: _loadProducts,
                )
              else if (products.isEmpty)
                _EmptyBrowseState(message: strings.noProductsForPincode)
              else ...[
                if (_errorMessage != null)
                  _InlineErrorBanner(
                    message: '${strings.productLoadFailed} $_errorMessage',
                    retryLabel: strings.retryActionLabel,
                    onRetry: _loadProducts,
                  ),
                for (final product in products)
                  _ProductCard(
                    product: product,
                    strings: strings,
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  bool get _hasValidPincode {
    return RegExp(r'^[1-9][0-9]{5}$').hasMatch(_pincodeController.text.trim());
  }

  void _scheduleProductLoad() {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(
      const Duration(milliseconds: 350),
      () => unawaited(_loadProducts()),
    );
  }

  Future<void> _loadProducts() async {
    _searchDebounce?.cancel();
    final requestId = ++_requestSequence;
    final pincode = _pincodeController.text.trim();

    if (!_hasValidPincode) {
      setState(() {
        _isLoading = false;
        _errorMessage = null;
        _productPage = null;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final page = await _repository.listProducts(
        MarketplaceProductQuery(
          pincode: pincode,
          category: _selectedCategory == _allCategory ? null : _selectedCategory,
          search: _searchController.text.trim(),
        ),
      );
      if (!mounted || requestId != _requestSequence) {
        return;
      }
      setState(() {
        _productPage = page;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted || requestId != _requestSequence) {
        return;
      }
      setState(() {
        _isLoading = false;
        _errorMessage = error.toString();
      });
    }
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.strings,
  });

  final MarketplaceProductSummary product;
  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primaryOffer = product.primaryOffer;

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
                        product.name,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text('${product.brand.name} - ${product.category}'),
                      if (primaryOffer != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          primaryOffer.variant.displayLabel,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      strings.startingPriceLabel,
                      style: theme.textTheme.labelSmall,
                    ),
                    Text(
                      _formatPaise(product.lowestPricePaise),
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoChip(
                  icon: Icons.inventory_2_outlined,
                  label:
                      '${product.availableQuantity} ${strings.availableUnit}',
                ),
                _InfoChip(
                  icon: Icons.storefront_outlined,
                  label: _sellerLabel(product, strings),
                ),
                _InfoChip(
                  icon: Icons.receipt_long_outlined,
                  label: '${strings.offersLabel}: ${product.offerCount}',
                ),
                _InfoChip(
                  icon: Icons.local_shipping_outlined,
                  label: _fulfilmentLabel(product, strings),
                ),
                _InfoChip(
                  icon: Icons.grass_outlined,
                  label: product.cropTargets.isEmpty
                      ? product.category
                      : product.cropTargets.take(2).join(', '),
                ),
              ],
            ),
            if (primaryOffer != null) ...[
              const SizedBox(height: 12),
              Text(
                '${strings.warehouseLabel}: '
                '${primaryOffer.warehouse.city}, ${primaryOffer.warehouse.state}',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _sellerLabel(
    MarketplaceProductSummary product,
    AppStrings strings,
  ) {
    if (product.sellerCount == 1 && product.primaryOffer != null) {
      return product.primaryOffer!.seller.displayName;
    }
    return '${strings.sellersLabel}: ${product.sellerCount}';
  }

  String _fulfilmentLabel(
    MarketplaceProductSummary product,
    AppStrings strings,
  ) {
    final primaryOffer = product.primaryOffer;
    if (primaryOffer != null) {
      return _formatFulfilmentMode(primaryOffer.fulfilmentMode, strings);
    }
    if (product.fulfilmentModes.isEmpty) {
      return strings.fulfilmentPendingLabel;
    }
    return product.fulfilmentModes
        .map((mode) => _formatFulfilmentMode(mode, strings))
        .join(', ');
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final maxLabelWidth = (MediaQuery.sizeOf(context).width - 96).clamp(
      96.0,
      320.0,
    ).toDouble();

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
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxLabelWidth),
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingBrowseState extends StatelessWidget {
  const _LoadingBrowseState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(message, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _EmptyBrowseState extends StatelessWidget {
  const _EmptyBrowseState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
      ),
    );
  }
}

class _ErrorBrowseState extends StatelessWidget {
  const _ErrorBrowseState({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String message;
  final String retryLabel;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Column(
        children: [
          Icon(
            Icons.cloud_off_outlined,
            size: 36,
            color: Theme.of(context).colorScheme.error,
          ),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => unawaited(onRetry()),
            icon: const Icon(Icons.refresh),
            label: Text(retryLabel),
          ),
        ],
      ),
    );
  }
}

class _InlineErrorBanner extends StatelessWidget {
  const _InlineErrorBanner({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String message;
  final String retryLabel;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.error),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.cloud_off_outlined, color: theme.colorScheme.error),
          const SizedBox(width: 10),
          Expanded(child: Text(message)),
          TextButton(
            onPressed: () => unawaited(onRetry()),
            child: Text(retryLabel),
          ),
        ],
      ),
    );
  }
}

String _formatFulfilmentMode(String mode, AppStrings strings) {
  return switch (mode) {
    'DISTRIBUTOR_FULFILLED' => strings.distributorDeliveryLabel,
    'VARDHNAM_FULFILLED' => strings.vardhnamFulfilmentLabel,
    'PICKUP' => strings.pickupLabel,
    _ => mode.replaceAll('_', ' ').toLowerCase(),
  };
}

String _formatPaise(int value) {
  final rupees = value ~/ 100;
  final paise = value % 100;
  return paise == 0
      ? 'Rs $rupees'
      : 'Rs $rupees.${paise.toString().padLeft(2, '0')}';
}

const _allCategory = 'All';
const _categories = [_allCategory, 'Seeds', 'Fertiliser', 'Crop Care'];
