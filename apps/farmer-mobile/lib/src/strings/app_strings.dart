class AppStrings {
  const AppStrings({
    required this.appTitle,
    required this.welcomeTitle,
    required this.phaseBoundary,
    required this.otpLogin,
    required this.otpLoginSubtitle,
    required this.farmProfile,
    required this.farmProfileSubtitle,
    required this.productBrowsing,
    required this.productBrowsingSubtitle,
    required this.cart,
    required this.cartSubtitle,
    required this.cartTitle,
    required this.cartAddressLabel,
    required this.cartSnapshotLabel,
    required this.cartSubtotalLabel,
    required this.cartAddMore,
    required this.cartClear,
    required this.checkoutActionLabel,
    required this.checkoutReviewTitle,
    required this.mockPaymentTitle,
    required this.mockPaymentSubtitle,
    required this.mockPaymentActionLabel,
    required this.cancellationTitle,
    required this.cancellationSubtitle,
    required this.cancellationActionLabel,
    required this.cancellationStatusLabel,
    required this.reservationReleaseLabel,
    required this.paymentStatusLabel,
    required this.paymentReferenceLabel,
    required this.paymentAmountLabel,
    required this.childOrdersLabel,
    required this.orderStatusLabel,
    required this.reservedStockLabel,
    required this.quantityLabel,
    required this.sellerLabel,
    required this.priceSnapshotLabel,
    required this.browseTitle,
    required this.pincodeLabel,
    required this.productSearchLabel,
    required this.allCategory,
    required this.discoveryPreviewLabel,
    required this.loadingProducts,
    required this.enterValidPincode,
    required this.productLoadFailed,
    required this.retryActionLabel,
    required this.startingPriceLabel,
    required this.sellersLabel,
    required this.offersLabel,
    required this.distributorDeliveryLabel,
    required this.vardhnamFulfilmentLabel,
    required this.pickupLabel,
    required this.fulfilmentPendingLabel,
    required this.availableUnit,
    required this.warehouseLabel,
    required this.noProductsForPincode,
    required this.supportAccess,
    required this.supportAccessSubtitle,
  });

  final String appTitle;
  final String welcomeTitle;
  final String phaseBoundary;
  final String otpLogin;
  final String otpLoginSubtitle;
  final String farmProfile;
  final String farmProfileSubtitle;
  final String productBrowsing;
  final String productBrowsingSubtitle;
  final String cart;
  final String cartSubtitle;
  final String cartTitle;
  final String cartAddressLabel;
  final String cartSnapshotLabel;
  final String cartSubtotalLabel;
  final String cartAddMore;
  final String cartClear;
  final String checkoutActionLabel;
  final String checkoutReviewTitle;
  final String mockPaymentTitle;
  final String mockPaymentSubtitle;
  final String mockPaymentActionLabel;
  final String cancellationTitle;
  final String cancellationSubtitle;
  final String cancellationActionLabel;
  final String cancellationStatusLabel;
  final String reservationReleaseLabel;
  final String paymentStatusLabel;
  final String paymentReferenceLabel;
  final String paymentAmountLabel;
  final String childOrdersLabel;
  final String orderStatusLabel;
  final String reservedStockLabel;
  final String quantityLabel;
  final String sellerLabel;
  final String priceSnapshotLabel;
  final String browseTitle;
  final String pincodeLabel;
  final String productSearchLabel;
  final String allCategory;
  final String discoveryPreviewLabel;
  final String loadingProducts;
  final String enterValidPincode;
  final String productLoadFailed;
  final String retryActionLabel;
  final String startingPriceLabel;
  final String sellersLabel;
  final String offersLabel;
  final String distributorDeliveryLabel;
  final String vardhnamFulfilmentLabel;
  final String pickupLabel;
  final String fulfilmentPendingLabel;
  final String availableUnit;
  final String warehouseLabel;
  final String noProductsForPincode;
  final String supportAccess;
  final String supportAccessSubtitle;

  static const en = AppStrings(
    appTitle: 'Vardhnam Farmer',
    welcomeTitle: 'Farmer workspace',
    phaseBoundary:
        'Phase 3D enables product discovery, cart review, checkout order, mock payment and eligible cancellation foundations.',
    otpLogin: 'OTP login',
    otpLoginSubtitle: 'Mock-only authentication foundation for now.',
    farmProfile: 'Farm profile',
    farmProfileSubtitle: 'Prepare fields for crop and acreage details.',
    productBrowsing: 'Product browsing',
    productBrowsingSubtitle: 'Approved offers shown by pincode, seller and stock.',
    cart: 'Cart',
    cartSubtitle: 'Review selected products, seller and pincode.',
    cartTitle: 'My cart',
    cartAddressLabel: 'Delivery pincode',
    cartSnapshotLabel: 'Availability snapshot',
    cartSubtotalLabel: 'Subtotal',
    cartAddMore: 'Add more',
    cartClear: 'Clear',
    checkoutActionLabel: 'Review checkout',
    checkoutReviewTitle: 'Checkout review',
    mockPaymentTitle: 'Mock payment',
    mockPaymentSubtitle: 'Server confirmation will move child orders from reserved to confirmed.',
    mockPaymentActionLabel: 'Confirm mock payment',
    cancellationTitle: 'Cancellation',
    cancellationSubtitle: 'Available before successful payment.',
    cancellationActionLabel: 'Cancel checkout',
    cancellationStatusLabel: 'Eligible',
    reservationReleaseLabel: 'Reservation release',
    paymentStatusLabel: 'Payment status',
    paymentReferenceLabel: 'Reference',
    paymentAmountLabel: 'Payment amount',
    childOrdersLabel: 'Child orders',
    orderStatusLabel: 'Status',
    reservedStockLabel: 'Reserved stock',
    quantityLabel: 'Qty',
    sellerLabel: 'Seller',
    priceSnapshotLabel: 'Price snapshot',
    browseTitle: 'Browse products',
    pincodeLabel: 'Pincode',
    productSearchLabel: 'Search crop, brand or product',
    allCategory: 'All',
    discoveryPreviewLabel: 'Available products',
    loadingProducts: 'Loading approved offers...',
    enterValidPincode: 'Enter a valid six-digit pincode to see available products.',
    productLoadFailed: 'Could not load products from the marketplace API.',
    retryActionLabel: 'Retry',
    startingPriceLabel: 'Starting at',
    sellersLabel: 'Sellers',
    offersLabel: 'Offers',
    distributorDeliveryLabel: 'Distributor delivery',
    vardhnamFulfilmentLabel: 'Vardhnam fulfilment',
    pickupLabel: 'Pickup',
    fulfilmentPendingLabel: 'Fulfilment pending',
    availableUnit: 'available',
    warehouseLabel: 'Warehouse',
    noProductsForPincode: 'No approved offers found for this pincode.',
    supportAccess: 'Support access',
    supportAccessSubtitle: 'Phone and WhatsApp entry points will use mock providers first.',
  );

  static const hi = AppStrings(
    appTitle: 'Vardhnam Kisan',
    welcomeTitle: 'Kisan workspace',
    phaseBoundary:
        'Phase 3D product discovery, cart review, checkout order, mock payment aur eligible cancellation foundations deta hai.',
    otpLogin: 'OTP login',
    otpLoginSubtitle: 'Abhi mock-only authentication foundation hai.',
    farmProfile: 'Farm profile',
    farmProfileSubtitle: 'Crop aur acreage details ke liye fields taiyar.',
    productBrowsing: 'Product browsing',
    productBrowsingSubtitle: 'Approved offers pincode, seller aur stock ke saath dikhte hain.',
    cart: 'Cart',
    cartSubtitle: 'Selected products, seller aur pincode dekhein.',
    cartTitle: 'Mera cart',
    cartAddressLabel: 'Delivery pincode',
    cartSnapshotLabel: 'Availability snapshot',
    cartSubtotalLabel: 'Subtotal',
    cartAddMore: 'Aur jodein',
    cartClear: 'Clear',
    checkoutActionLabel: 'Checkout review',
    checkoutReviewTitle: 'Checkout review',
    mockPaymentTitle: 'Mock payment',
    mockPaymentSubtitle: 'Server confirmation reserved child orders ko confirmed banata hai.',
    mockPaymentActionLabel: 'Confirm mock payment',
    cancellationTitle: 'Cancellation',
    cancellationSubtitle: 'Successful payment se pehle available.',
    cancellationActionLabel: 'Cancel checkout',
    cancellationStatusLabel: 'Eligible',
    reservationReleaseLabel: 'Reservation release',
    paymentStatusLabel: 'Payment status',
    paymentReferenceLabel: 'Reference',
    paymentAmountLabel: 'Payment amount',
    childOrdersLabel: 'Child orders',
    orderStatusLabel: 'Status',
    reservedStockLabel: 'Reserved stock',
    quantityLabel: 'Qty',
    sellerLabel: 'Seller',
    priceSnapshotLabel: 'Price snapshot',
    browseTitle: 'Products dekhein',
    pincodeLabel: 'Pincode',
    productSearchLabel: 'Crop, brand ya product search karein',
    allCategory: 'All',
    discoveryPreviewLabel: 'Available products',
    loadingProducts: 'Approved offers load ho rahe hain...',
    enterValidPincode: 'Available products ke liye valid six-digit pincode daalein.',
    productLoadFailed: 'Marketplace API se products load nahi ho paye.',
    retryActionLabel: 'Retry',
    startingPriceLabel: 'Starting at',
    sellersLabel: 'Sellers',
    offersLabel: 'Offers',
    distributorDeliveryLabel: 'Distributor delivery',
    vardhnamFulfilmentLabel: 'Vardhnam fulfilment',
    pickupLabel: 'Pickup',
    fulfilmentPendingLabel: 'Fulfilment pending',
    availableUnit: 'available',
    warehouseLabel: 'Warehouse',
    noProductsForPincode: 'Is pincode ke liye approved offers nahi mile.',
    supportAccess: 'Support',
    supportAccessSubtitle: 'Phone aur WhatsApp pehle mock providers se judenge.',
  );
}
