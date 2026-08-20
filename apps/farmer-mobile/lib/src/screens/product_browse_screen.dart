import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../marketplace/marketplace_api.dart';
import '../marketplace/marketplace_discovery_cache.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';

class ProductBrowseScreen extends StatefulWidget {
  const ProductBrowseScreen({
    super.key,
    this.repository,
    this.cache = const NoOpMarketplaceDiscoveryCache(),
    this.initialPincode = '302001',
    this.kisanClubMode = false,
  });

  final MarketplaceProductRepository? repository;
  final MarketplaceDiscoveryCache cache;
  final String initialPincode;
  final bool kisanClubMode;

  @override
  State<ProductBrowseScreen> createState() => _ProductBrowseScreenState();
}

class _ProductBrowseScreenState extends State<ProductBrowseScreen> {
  late final TextEditingController _pincodeController;
  final _searchController = TextEditingController();
  late final MarketplaceProductRepository _repository;
  late final MarketplaceDiscoveryCache _cache;
  MarketplaceProductPage? _productPage;
  MarketplaceFilterOptions? _filterOptions;
  DateTime? _cachedAt;
  Timer? _searchDebounce;
  String _selectedCategory = _allCategory;
  String? _selectedBrandId;
  String? _selectedCropTarget;
  String? _errorMessage;
  var _isLoading = false;
  var _isLoadingMore = false;
  var _requestSequence = 0;
  String? _activeQueryKey;

  @override
  void initState() {
    super.initState();
    _pincodeController = TextEditingController(text: widget.initialPincode);
    _repository = widget.repository ?? MarketplaceHttpProductRepository();
    _cache = widget.cache;
    if (!widget.kisanClubMode) unawaited(_loadFilterOptions());
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
    final strings = AppLocalizations.of(context)!;
    final products = _productPage?.items ?? const <MarketplaceProductSummary>[];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.kisanClubMode
              ? strings.kisanClubCatalogueTitle
              : strings.browseTitle,
        ),
        actions: [
          IconButton(
            tooltip: strings.cartTitle,
            onPressed: () => context.push(AppRoutes.cart),
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
              VardhnamInfoCard(
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: TextField(
                  controller: _pincodeController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: InputDecoration(
                    counterText: '',
                    labelText: strings.deliveringToTitle,
                    helperText: strings.pincodeLabel,
                    prefixIcon: const Icon(Icons.location_on_outlined),
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: (_) {
                    setState(() {
                      _selectedCategory = _allCategory;
                      _selectedBrandId = null;
                      _selectedCropTarget = null;
                      _filterOptions = null;
                    });
                    _scheduleProductLoad(reloadOptions: true);
                  },
                ),
              ),
              const SizedBox(height: VardhnamSpacing.large),
              TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  labelText: strings.productSearchLabel,
                  prefixIcon: const Icon(Icons.search),
                  border: const OutlineInputBorder(),
                ),
                onChanged: (_) => _scheduleProductLoad(),
              ),
              const SizedBox(height: VardhnamSpacing.large),
              if (!widget.kisanClubMode && _filterOptions != null) ...[
                if (_filterOptions!.cropTargets.isNotEmpty) ...[
                  VardhnamSectionHeader(title: strings.shopByCropTitle),
                  const SizedBox(height: VardhnamSpacing.small),
                  _MarketplaceFilterChips<String?>(
                    values: [null, ..._filterOptions!.cropTargets],
                    selected: _selectedCropTarget,
                    label: (crop) => crop ?? strings.allCropsFilterLabel,
                    icon: (crop) => crop == null
                        ? Icons.apps_outlined
                        : Icons.grass_outlined,
                    onSelected: (crop) {
                      setState(() => _selectedCropTarget = crop);
                      unawaited(_loadProducts());
                    },
                  ),
                  const SizedBox(height: VardhnamSpacing.large),
                ],
                if (_filterOptions!.categories.isNotEmpty) ...[
                  VardhnamSectionHeader(title: strings.shopByCategoryTitle),
                  const SizedBox(height: VardhnamSpacing.small),
                  _MarketplaceFilterChips<String>(
                    values: [_allCategory, ..._filterOptions!.categories],
                    selected: _selectedCategory,
                    label: (category) => category == _allCategory
                        ? strings.allCategory
                        : _formatCategory(category, strings),
                    icon: (category) => category == _allCategory
                        ? Icons.grid_view_outlined
                        : Icons.category_outlined,
                    onSelected: (category) {
                      setState(() => _selectedCategory = category);
                      unawaited(_loadProducts());
                    },
                  ),
                  const SizedBox(height: VardhnamSpacing.large),
                ],
                if (_filterOptions!.brands.isNotEmpty) ...[
                  VardhnamSectionHeader(title: strings.shopByBrandTitle),
                  const SizedBox(height: VardhnamSpacing.small),
                  _MarketplaceFilterChips<String?>(
                    values: [
                      null,
                      ..._filterOptions!.brands.map((brand) => brand.id),
                    ],
                    selected: _selectedBrandId,
                    label: (brandId) => brandId == null
                        ? strings.allBrandsFilterLabel
                        : _filterOptions!.brands
                              .firstWhere((brand) => brand.id == brandId)
                              .name,
                    icon: (brandId) => brandId == null
                        ? Icons.apps_outlined
                        : Icons.verified_outlined,
                    onSelected: (brandId) {
                      setState(() => _selectedBrandId = brandId);
                      unawaited(_loadProducts());
                    },
                  ),
                ],
              ],
              const SizedBox(height: VardhnamSpacing.xLarge),
              VardhnamSectionHeader(
                title: widget.kisanClubMode
                    ? strings.kisanClubEligibleProductsLabel
                    : strings.discoveryPreviewLabel,
              ),
              const SizedBox(height: 8),
              if (!_hasValidPincode)
                _EmptyBrowseState(message: strings.enterValidPincode)
              else if (_isLoading && products.isEmpty)
                FarmerListLoadingState(label: strings.loadingProducts)
              else if (_errorMessage != null &&
                  products.isEmpty &&
                  _cachedAt == null)
                _ErrorBrowseState(
                  message: '${strings.productLoadFailed} $_errorMessage',
                  retryLabel: strings.retryActionLabel,
                  onRetry: _loadProducts,
                )
              else ...[
                if (_cachedAt != null)
                  _InlineErrorBanner(
                    message: strings.cachedProductsNotice(
                      _formatCacheAge(strings, _cachedAt!),
                    ),
                    retryLabel: strings.retryActionLabel,
                    onRetry: _loadProducts,
                  ),
                if (products.isEmpty)
                  _EmptyBrowseState(message: strings.noProductsForPincode)
                else
                  for (final product in products)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: VardhnamProductCard(
                        productName: product.name,
                        brandName: product.brand.name,
                        imageUrl: product.primaryImageUrl,
                        packLabel:
                            product.primaryOffer?.variant.displayLabel ??
                            product.category,
                        priceLabel:
                            '${strings.startingPriceLabel} '
                            '${_formatPaise(product.lowestPricePaise)}',
                        availabilityLabel:
                            '${product.availableQuantity} '
                            '${strings.availableUnit}',
                        deliveryLabel: _productDeliveryLabel(product, strings),
                        imageSemanticLabel: strings.productImagePlaceholder(
                          product.name,
                        ),
                        viewLabel: strings.viewProductDetailsAction,
                        badgeLabel:
                            widget.kisanClubMode &&
                                product.clubProgrammes.isNotEmpty
                            ? strings.kisanClubEligibleBadge
                            : null,
                        onTap: () => context.push(
                          widget.kisanClubMode
                              ? AppRoutes.kisanClubProduct(
                                  product.id,
                                  _pincodeController.text.trim(),
                                )
                              : AppRoutes.product(
                                  product.id,
                                  _pincodeController.text.trim(),
                                ),
                        ),
                      ),
                    ),
                if (products.length < (_productPage?.total ?? 0)) ...[
                  const SizedBox(height: 4),
                  OutlinedButton(
                    onPressed: _isLoadingMore
                        ? null
                        : () => unawaited(_loadMoreProducts()),
                    child: Text(
                      _isLoadingMore
                          ? strings.loadingMoreProductsLabel
                          : strings.loadMoreProductsAction,
                    ),
                  ),
                ],
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

  void _scheduleProductLoad({bool reloadOptions = false}) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      if (reloadOptions && !widget.kisanClubMode) {
        unawaited(_loadFilterOptions());
      }
      unawaited(_loadProducts());
    });
  }

  Future<void> _loadFilterOptions() async {
    final pincode = _pincodeController.text.trim();
    if (!RegExp(r'^[1-9][0-9]{5}$').hasMatch(pincode)) return;
    try {
      final options = await _repository.getFilterOptions(pincode);
      if (!mounted || pincode != _pincodeController.text.trim()) return;
      setState(() => _filterOptions = options);
    } on Object {
      // Product discovery remains available when optional filters cannot load.
    }
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
        _cachedAt = null;
        _activeQueryKey = null;
      });
      return;
    }

    final query = MarketplaceProductQuery(
      pincode: pincode,
      category: _selectedCategory == _allCategory ? null : _selectedCategory,
      search: _searchController.text.trim(),
      brandId: _selectedBrandId,
      cropTarget: _selectedCropTarget,
    );
    final changedQuery = query.cacheKey != _activeQueryKey;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _cachedAt = null;
      if (changedQuery) _productPage = null;
      _activeQueryKey = query.cacheKey;
    });

    try {
      final page = await _repository.listProducts(query);
      if (!mounted || requestId != _requestSequence) {
        return;
      }
      setState(() {
        _productPage = page;
        _isLoading = false;
      });
      await _cache.write(query, page);
    } catch (error) {
      if (!mounted || requestId != _requestSequence) {
        return;
      }
      final cached = await _cache.read(query);
      if (!mounted || requestId != _requestSequence) return;
      setState(() {
        _isLoading = false;
        _errorMessage = apiErrorMessage(AppLocalizations.of(context)!, error);
        _productPage = cached?.page;
        _cachedAt = cached?.cachedAt;
      });
    }
  }

  Future<void> _loadMoreProducts() async {
    final currentPage = _productPage;
    if (_isLoading ||
        _isLoadingMore ||
        currentPage == null ||
        currentPage.items.length >= currentPage.total) {
      return;
    }

    final requestId = _requestSequence;
    final query = MarketplaceProductQuery(
      pincode: _pincodeController.text.trim(),
      category: _selectedCategory == _allCategory ? null : _selectedCategory,
      search: _searchController.text.trim(),
      brandId: _selectedBrandId,
      cropTarget: _selectedCropTarget,
      page: currentPage.page + 1,
      limit: currentPage.limit,
    );
    setState(() => _isLoadingMore = true);

    try {
      final nextPage = await _repository.listProducts(query);
      if (!mounted || requestId != _requestSequence) return;
      _appendPage(nextPage);
      await _cache.write(query, nextPage);
    } catch (error) {
      final cached = await _cache.read(query);
      if (!mounted || requestId != _requestSequence) return;
      if (cached != null) {
        _appendPage(cached.page, cachedAt: cached.cachedAt);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(AppLocalizations.of(context)!, error),
            ),
          ),
        );
      }
    } finally {
      if (mounted && requestId == _requestSequence) {
        setState(() => _isLoadingMore = false);
      }
    }
  }

  void _appendPage(MarketplaceProductPage nextPage, {DateTime? cachedAt}) {
    final currentItems = _productPage?.items ?? const [];
    final existingIds = currentItems.map((item) => item.id).toSet();
    final newItems = nextPage.items.where((item) => existingIds.add(item.id));
    setState(() {
      _productPage = MarketplaceProductPage(
        items: [...currentItems, ...newItems],
        page: nextPage.page,
        limit: nextPage.limit,
        total: nextPage.total,
      );
      if (cachedAt != null) _cachedAt = cachedAt;
    });
  }

  String _formatCacheAge(AppLocalizations strings, DateTime cachedAt) {
    final age = DateTime.now().toUtc().difference(cachedAt.toUtc());
    if (age.inMinutes < 1) return strings.cachedProductsJustNow;
    if (age.inHours < 1) {
      return strings.cachedProductsMinutesAgo(age.inMinutes);
    }
    return strings.cachedProductsHoursAgo(age.inHours);
  }
}

class _MarketplaceFilterChips<T> extends StatelessWidget {
  const _MarketplaceFilterChips({
    required this.values,
    required this.selected,
    required this.label,
    required this.icon,
    required this.onSelected,
  });

  final List<T> values;
  final T selected;
  final String Function(T value) label;
  final IconData Function(T value) icon;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        for (final value in values)
          Padding(
            padding: const EdgeInsetsDirectional.only(
              end: VardhnamSpacing.small,
            ),
            child: ChoiceChip(
              avatar: Icon(icon(value), size: 18),
              label: Text(label(value)),
              selected: selected == value,
              onSelected: (_) => onSelected(value),
            ),
          ),
      ],
    ),
  );
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

String _formatFulfilmentMode(String mode, AppLocalizations strings) {
  return switch (mode) {
    'DISTRIBUTOR_FULFILLED' => strings.distributorDeliveryLabel,
    'VARDHNAM_FULFILLED' => strings.vardhnamFulfilmentLabel,
    'PICKUP' => strings.pickupLabel,
    _ => mode.replaceAll('_', ' ').toLowerCase(),
  };
}

String _productDeliveryLabel(
  MarketplaceProductSummary product,
  AppLocalizations strings,
) {
  final offer = product.primaryOffer;
  final fulfilment = offer == null
      ? strings.fulfilmentPendingLabel
      : _formatFulfilmentMode(offer.fulfilmentMode, strings);
  final sla = offer?.deliverySlaDays;
  return sla == null
      ? fulfilment
      : '$fulfilment · $sla ${sla == 1 ? strings.dayLabel : strings.daysLabel}';
}

String _formatCategory(String category, AppLocalizations strings) {
  return switch (category) {
    'Seeds' => strings.seedsCategory,
    'Fertiliser' => strings.fertiliserCategory,
    'Crop Care' => strings.cropCareCategory,
    _ => category,
  };
}

String _formatPaise(int value) {
  final rupees = value ~/ 100;
  final paise = value % 100;
  return paise == 0
      ? '₹$rupees'
      : '₹$rupees.${paise.toString().padLeft(2, '0')}';
}

const _allCategory = 'All';
