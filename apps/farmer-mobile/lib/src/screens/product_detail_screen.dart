import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../auth/auth_controller.dart';
import '../cart/farmer_cart_repository.dart';
import '../kisan_club/kisan_club_benefit_token_repository.dart';
import '../marketplace/marketplace_api.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';
import '../core/widgets/vardhnam_components.dart';
import '../core/widgets/vardhnam_image_frame.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({
    required this.productId,
    required this.pincode,
    super.key,
    this.repository,
    this.kisanClubMode = false,
  });

  final String productId;
  final String pincode;
  final MarketplaceProductRepository? repository;
  final bool kisanClubMode;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  late final MarketplaceProductRepository _repository;
  MarketplaceProductDetail? _detail;
  String? _selectedOfferId;
  String? _errorMessage;
  var _isLoading = true;
  var _isAddingToCart = false;
  var _isCreatingClubToken = false;
  String? _cartErrorMessage;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? MarketplaceHttpProductRepository();
    unawaited(_loadProduct());
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final detail = _detail;

    return Scaffold(
      appBar: AppBar(
        title: Text(detail?.product.name ?? strings.productDetailsTitle),
      ),
      body: SafeArea(
        child: switch ((_isLoading, detail, _errorMessage)) {
          (true, null, _) => FarmerDetailLoadingState(
            label: strings.loadingProductDetails,
          ),
          (false, null, final String error) => _ErrorState(
            message: '${strings.productDetailLoadFailed} $error',
            retryLabel: strings.retryActionLabel,
            onRetry: _loadProduct,
          ),
          (_, final MarketplaceProductDetail productDetail, _) =>
            RefreshIndicator(
              onRefresh: _loadProduct,
              child: _ProductDetailBody(
                detail: productDetail,
                kisanClubMode: widget.kisanClubMode,
                selectedOfferId: _selectedOfferId,
                onOfferSelected: (offerId) {
                  setState(() {
                    _selectedOfferId = offerId;
                    _cartErrorMessage = null;
                  });
                },
                isAddingToCart: _isAddingToCart,
                isCreatingClubToken: _isCreatingClubToken,
                cartErrorMessage: _cartErrorMessage,
                onAddToCart: _addSelectedOfferToCart,
                onCreateClubToken: _createClubToken,
              ),
            ),
          _ => const SizedBox.shrink(),
        },
      ),
    );
  }

  Future<void> _addSelectedOfferToCart() async {
    final strings = AppLocalizations.of(context)!;
    final detail = _detail;
    final selectedOffer = detail?.product.offers
        .where((offer) => offer.id == _selectedOfferId)
        .firstOrNull;
    if (selectedOffer == null || _isAddingToCart) return;

    if (ref.read(authSessionControllerProvider) == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.signInToAddCartMessage)));
      context.push(AppRoutes.login);
      return;
    }

    setState(() {
      _isAddingToCart = true;
      _cartErrorMessage = null;
    });
    try {
      final cart = await ref
          .read(farmerCartRepositoryProvider)
          .addItem(
            offerId: selectedOffer.id,
            quantity: selectedOffer.minimumOrderQuantity,
            serviceablePincode: widget.pincode,
          );
      if (!mounted) return;
      final acceptedItem = cart.items
          .where((item) => item.offerId == selectedOffer.id)
          .firstOrNull;
      if (acceptedItem != null &&
          acceptedItem.priceSnapshotPaise != selectedOffer.sellingPricePaise) {
        final reviewCart = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(strings.priceChangedDialogTitle),
            content: Text(
              strings.priceChangedDialogMessage(
                _formatPaise(selectedOffer.sellingPricePaise),
                _formatPaise(acceptedItem.priceSnapshotPaise),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(strings.stayOnProductAction),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(strings.reviewCartAction),
              ),
            ],
          ),
        );
        if (reviewCart == true && mounted) context.push(AppRoutes.cart);
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.kisanClubMode &&
                    (acceptedItem?.clubBenefitSnapshotPaise ?? 0) > 0
                ? strings.kisanClubBenefitAddedMessage(
                    _formatPaise(acceptedItem!.clubBenefitSnapshotPaise),
                  )
                : strings.addedToCartMessage,
          ),
        ),
      );
      context.push(AppRoutes.cart);
    } catch (error) {
      if (!mounted) return;
      await _recoverFromRejectedOffer(selectedOffer, error);
    } finally {
      if (mounted) setState(() => _isAddingToCart = false);
    }
  }

  Future<void> _createClubToken() async {
    final strings = AppLocalizations.of(context)!;
    final selectedOffer = _detail?.product.offers
        .where((offer) => offer.id == _selectedOfferId)
        .firstOrNull;
    if (selectedOffer == null || _isCreatingClubToken) return;
    if (ref.read(authSessionControllerProvider) == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.signInToAddCartMessage)));
      context.push(AppRoutes.login);
      return;
    }
    setState(() => _isCreatingClubToken = true);
    try {
      final token = await ref
          .read(kisanClubBenefitTokenRepositoryProvider)
          .issue(
            offerId: selectedOffer.id,
            quantity: selectedOffer.minimumOrderQuantity,
          );
      if (!mounted) return;
      final code = token.code;
      if (code == null) {
        throw const FormatException('Token code was not returned.');
      }
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: Text(strings.kisanClubTokenCreatedTitle),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(strings.kisanClubTokenCreatedMessage),
              const SizedBox(height: 12),
              SelectableText(
                code,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              Text(strings.kisanClubTokenSecurityWarning),
            ],
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: Text(strings.kisanClubTokenSavedAction),
            ),
          ],
        ),
      );
      if (mounted) context.push(AppRoutes.kisanClubBenefits);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(apiErrorMessage(strings, error))));
    } finally {
      if (mounted) setState(() => _isCreatingClubToken = false);
    }
  }

  Future<void> _recoverFromRejectedOffer(
    MarketplaceOfferSummary rejectedOffer,
    Object originalError,
  ) async {
    final strings = AppLocalizations.of(context)!;
    try {
      final refreshed = await _repository.getProduct(
        productId: widget.productId,
        pincode: widget.pincode,
      );
      if (!mounted) return;
      final refreshedOffer = refreshed.product.offers
          .where((offer) => offer.id == rejectedOffer.id)
          .firstOrNull;
      setState(() {
        _detail = refreshed;
        if (refreshedOffer == null) {
          _selectedOfferId = refreshed.product.offers.firstOrNull?.id;
          _cartErrorMessage = strings.offerNoLongerAvailableMessage;
        } else {
          _selectedOfferId = refreshedOffer.id;
          _cartErrorMessage =
              refreshedOffer.availableQuantity <
                  refreshedOffer.minimumOrderQuantity
              ? strings.offerInsufficientStockMessage
              : apiErrorMessage(strings, originalError);
        }
      });
    } catch (refreshError) {
      if (!mounted) return;
      if (refreshError case MarketplaceApiException(statusCode: 404)) {
        setState(() {
          _detail = null;
          _selectedOfferId = null;
          _errorMessage = strings.offerNoLongerAvailableMessage;
          _cartErrorMessage = null;
        });
        return;
      }
      setState(() {
        _cartErrorMessage = apiErrorMessage(strings, originalError);
      });
    }
  }

  Future<void> _loadProduct() async {
    if (!RegExp(r'^[1-9][0-9]{5}$').hasMatch(widget.pincode)) {
      setState(() {
        _isLoading = false;
        _errorMessage = AppLocalizations.of(context)!.enterValidPincode;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final detail = await _repository.getProduct(
        productId: widget.productId,
        pincode: widget.pincode,
      );
      if (!mounted) return;
      final stillAvailable = detail.product.offers.any(
        (offer) => offer.id == _selectedOfferId,
      );
      setState(() {
        _detail = detail;
        _selectedOfferId = stillAvailable
            ? _selectedOfferId
            : detail.product.offers.firstOrNull?.id;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = apiErrorMessage(AppLocalizations.of(context)!, error);
      });
    }
  }
}

class _ProductDetailBody extends StatelessWidget {
  const _ProductDetailBody({
    required this.detail,
    required this.kisanClubMode,
    required this.selectedOfferId,
    required this.onOfferSelected,
    required this.isAddingToCart,
    required this.isCreatingClubToken,
    required this.cartErrorMessage,
    required this.onAddToCart,
    required this.onCreateClubToken,
  });

  final MarketplaceProductDetail detail;
  final bool kisanClubMode;
  final String? selectedOfferId;
  final ValueChanged<String> onOfferSelected;
  final bool isAddingToCart;
  final bool isCreatingClubToken;
  final String? cartErrorMessage;
  final Future<void> Function() onAddToCart;
  final Future<void> Function() onCreateClubToken;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final product = detail.product;
    final selectedOffer = product.offers
        .where((offer) => offer.id == selectedOfferId)
        .firstOrNull;
    final selectedOfferHasMinimumStock =
        selectedOffer != null &&
        selectedOffer.availableQuantity >= selectedOffer.minimumOrderQuantity;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        VardhnamImageFrame(
          aspectRatio: 1,
          semanticLabel: strings.productImagePlaceholder(product.name),
          imageUrl: product.primaryImageUrl,
          // Pack shots are portrait photography on a transparent background;
          // contain shows the whole pack rather than cropping its label.
          fit: BoxFit.contain,
          placeholder: Icon(
            Icons.inventory_2_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        const SizedBox(height: 18),
        if (kisanClubMode && product.clubProgrammes.isNotEmpty) ...[
          VardhnamAlertCard(
            icon: Icons.verified_outlined,
            title: strings.kisanClubEligibleBadge,
            message: strings.kisanClubBenefitCalculatedInCart,
            backgroundColor: VardhnamColors.surfaceGreen,
          ),
          const SizedBox(height: 12),
        ],
        Text(product.name, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        Text(
          product.brand.name,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        Text(product.category),
        const SizedBox(height: 4),
        Text(
          '${strings.brandOwnerLabel}: ${product.company.displayName}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (detail.description?.trim().isNotEmpty ?? false) ...[
          const SizedBox(height: 16),
          Text(detail.description!),
        ],
        if (product.cropTargets.isNotEmpty) ...[
          const SizedBox(height: VardhnamSpacing.large),
          VardhnamSectionHeader(title: strings.suitableForCropsTitle),
          const SizedBox(height: VardhnamSpacing.small),
          Wrap(
            spacing: VardhnamSpacing.small,
            runSpacing: VardhnamSpacing.small,
            children: [
              for (final crop in product.cropTargets)
                VardhnamStatusChip(label: crop, icon: Icons.grass_outlined),
            ],
          ),
        ],
        const SizedBox(height: 12),
        Text(
          '${strings.startingPriceLabel} '
          '${_formatPaise(product.lowestPricePaise)}',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: Theme.of(context).colorScheme.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 18),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(
              avatar: const Icon(Icons.location_on_outlined, size: 18),
              label: Text(
                '${strings.deliveryToLabel} ${product.serviceablePincode}',
              ),
            ),
            Chip(
              avatar: const Icon(Icons.inventory_2_outlined, size: 18),
              label: Text(
                '${product.availableQuantity} ${strings.availableUnit}',
              ),
            ),
          ],
        ),
        const SizedBox(height: 22),
        _SectionTitle(
          title: strings.chooseSellerOfferTitle,
          subtitle: strings.chooseSellerOfferSubtitle,
        ),
        const SizedBox(height: 10),
        VardhnamAlertCard(
          icon: Icons.receipt_long_outlined,
          title: strings.sellerInvoiceTitle,
          message: strings.sellerInvoiceMessage,
        ),
        const SizedBox(height: 10),
        for (final offer in product.offers)
          _OfferCard(
            offer: offer,
            selected: offer.id == selectedOfferId,
            onSelected: () => onOfferSelected(offer.id),
          ),
        if (cartErrorMessage != null || !selectedOfferHasMinimumStock) ...[
          const SizedBox(height: 4),
          Text(
            cartErrorMessage ?? strings.offerInsufficientStockMessage,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 6),
        FilledButton.icon(
          onPressed: !selectedOfferHasMinimumStock || isAddingToCart
              ? null
              : () => unawaited(onAddToCart()),
          icon: isAddingToCart
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.add_shopping_cart_outlined),
          label: Text(
            isAddingToCart
                ? strings.addingToCartLabel
                : strings.addSelectedOfferToCartAction,
          ),
        ),
        if (kisanClubMode) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: !selectedOfferHasMinimumStock || isCreatingClubToken
                ? null
                : () => unawaited(onCreateClubToken()),
            icon: isCreatingClubToken
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.confirmation_number_outlined),
            label: Text(
              isCreatingClubToken
                  ? strings.kisanClubTokenCreating
                  : strings.kisanClubTokenCreateAction,
            ),
          ),
        ],
        if (detail.variants.isNotEmpty) ...[
          const SizedBox(height: 16),
          _SectionTitle(title: strings.availableVariantsTitle),
          const SizedBox(height: 8),
          for (final variant in detail.variants)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.scale_outlined),
              title: Text(variant.displayLabel),
              trailing: variant.mrpPaise == null
                  ? null
                  : Text(
                      '${strings.mrpLabel} ${_formatPaise(variant.mrpPaise!)}',
                    ),
            ),
        ],
        if (detail.documents.isNotEmpty) ...[
          const SizedBox(height: 16),
          _SectionTitle(title: strings.productDocumentsTitle),
          const SizedBox(height: 8),
          for (final document in detail.documents)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.verified_outlined),
              title: Text(document.title ?? _formatCode(document.documentType)),
              subtitle: Text(_documentSubtitle(document, strings)),
            ),
        ],
        const SizedBox(height: 20),
      ],
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({
    required this.offer,
    required this.selected,
    required this.onSelected,
  });

  final MarketplaceOfferSummary offer;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    final batch = offer.batch;
    final useStackedHeader =
        MediaQuery.sizeOf(context).width <= 360 &&
        MediaQuery.textScalerOf(context).scale(1) >= 1.5;
    final sellerIdentity = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(offer.seller.displayName, style: theme.textTheme.titleMedium),
        Text('${strings.sellerOfRecordLabel}: ${offer.seller.legalName}'),
        if (offer.seller.gstin != null) Text('GSTIN: ${offer.seller.gstin}'),
      ],
    );
    final price = Text(
      _formatPaise(offer.sellingPricePaise),
      style: theme.textTheme.titleLarge?.copyWith(
        color: theme.colorScheme.primary,
        fontWeight: FontWeight.w700,
      ),
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: VardhnamSpacing.medium),
      child: VardhnamInfoCard(
        onTap: onSelected,
        padding: const EdgeInsets.all(VardhnamSpacing.large),
        backgroundColor: selected ? VardhnamColors.surfaceGreen : null,
        borderColor: selected
            ? VardhnamColors.primaryGreen
            : VardhnamColors.border,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (useStackedHeader) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    selected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: selected ? theme.colorScheme.primary : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: sellerIdentity),
                ],
              ),
              const SizedBox(height: VardhnamSpacing.medium),
              Padding(
                padding: const EdgeInsetsDirectional.only(start: 36),
                child: price,
              ),
            ] else
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    selected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: selected ? theme.colorScheme.primary : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: sellerIdentity),
                  const SizedBox(width: 8),
                  price,
                ],
              ),
            const Divider(height: 24),
            _DetailLine(
              icon: Icons.scale_outlined,
              text: offer.variant.displayLabel,
            ),
            _DetailLine(
              icon: Icons.inventory_2_outlined,
              text:
                  '${offer.availableQuantity} ${strings.availableUnit} · '
                  '${strings.minimumQuantityLabel}: ${offer.minimumOrderQuantity}',
            ),
            _DetailLine(
              icon: Icons.local_shipping_outlined,
              text:
                  '${_fulfilmentLabel(offer.fulfilmentMode, strings)} · '
                  '${_slaLabel(offer.deliverySlaDays, strings)}',
            ),
            _DetailLine(
              icon: Icons.warehouse_outlined,
              text:
                  '${offer.warehouse.name}, ${offer.warehouse.city}, '
                  '${offer.warehouse.state}',
            ),
            if (batch != null)
              _DetailLine(
                icon: Icons.qr_code_2,
                text: _batchLabel(batch, strings),
              ),
            if (selected) ...[
              const SizedBox(height: 8),
              Text(
                strings.selectedOfferLabel,
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DetailLine extends StatelessWidget {
  const _DetailLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(text)),
      ],
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: Theme.of(context).textTheme.titleLarge),
      if (subtitle != null) ...[
        const SizedBox(height: 3),
        Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
      ],
    ],
  );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String message;
  final String retryLabel;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: constraints.maxHeight > 48
              ? constraints.maxHeight - 48
              : 0,
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.cloud_off_outlined,
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
        ),
      ),
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

String _formatCode(String value) => value
    .split('_')
    .map(
      (part) =>
          part.isEmpty ? part : '${part[0]}${part.substring(1).toLowerCase()}',
    )
    .join(' ');

String _fulfilmentLabel(String mode, AppLocalizations strings) =>
    switch (mode) {
      'DISTRIBUTOR_FULFILLED' => strings.distributorDeliveryLabel,
      'VARDHNAM_FULFILLED' => strings.vardhnamFulfilmentLabel,
      'PICKUP' => strings.pickupLabel,
      _ => _formatCode(mode),
    };

String _slaLabel(int? days, AppLocalizations strings) => days == null
    ? strings.deliverySlaPendingLabel
    : '$days ${days == 1 ? strings.dayLabel : strings.daysLabel}';

String _batchLabel(MarketplaceBatchSummary batch, AppLocalizations strings) {
  final parts = ['${strings.batchLabel}: ${batch.batchNumber}'];
  if (batch.expiryDate != null) {
    parts.add(
      '${strings.expiryLabel}: ${DateFormat.yMMMd().format(batch.expiryDate!.toLocal())}',
    );
  }
  if (batch.germinationPercentage != null) {
    parts.add('${strings.germinationLabel}: ${batch.germinationPercentage}%');
  }
  return parts.join(' · ');
}

String _documentSubtitle(
  MarketplaceProductDocument document,
  AppLocalizations strings,
) {
  final parts = <String>[_formatCode(document.documentType)];
  if (document.documentNumber != null) parts.add(document.documentNumber!);
  if (document.expiresAt != null) {
    parts.add(
      '${strings.expiryLabel}: ${DateFormat.yMMMd().format(document.expiresAt!.toLocal())}',
    );
  }
  return parts.join(' · ');
}
