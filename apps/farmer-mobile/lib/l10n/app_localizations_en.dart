// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get farmerContextSelectionTitle => 'Choose your farmer context';

  @override
  String get farmerContextSelectionMessage =>
      'This mobile number has more than one active farmer context. Select the one you want to use.';

  @override
  String get firstLaunchLanguageTitle => 'Choose your language';

  @override
  String get firstLaunchLanguageMessage =>
      'Select the language you want to use. You can change it later from the app.';

  @override
  String cartQuantityRangeLabel(int minimum, int maximum) {
    return 'Allowed quantity: $minimum–$maximum';
  }

  @override
  String get appTitle => 'Vardhnam Farmer';

  @override
  String get homeNavLabel => 'Home';

  @override
  String get shopNavLabel => 'Product browsing';

  @override
  String get ordersNavLabel => 'My orders';

  @override
  String get accountNavLabel => 'Farm profile';

  @override
  String get homeLocationContext => 'Your farm and delivery area';

  @override
  String homeGreeting(String farmerName) {
    return 'Namaste, $farmerName';
  }

  @override
  String homeLocationWithPincode(String location, String pincode) {
    return '$location, $pincode';
  }

  @override
  String homePincodeOnly(String pincode) {
    return 'Pincode $pincode';
  }

  @override
  String get homeWeatherTitle => 'Today\'s farm conditions';

  @override
  String get homeWeatherUnavailable => 'Live weather is not connected yet.';

  @override
  String get homeQuickActionsTitle => 'Quick help';

  @override
  String get homeViewAllAction => 'View all';

  @override
  String get homeFarmCardTitle => 'Your farms and crops';

  @override
  String get homeShopSectionTitle => 'Products for your farm';

  @override
  String get kisanClubFreeBadge => '100% FREE';

  @override
  String get kisanClubOpenAction => 'Open Kisan Club';

  @override
  String get productPlaceholderLabel => 'Product image placeholder';

  @override
  String get kisanClubPlaceholderLabel => 'Kisan Club image placeholder';

  @override
  String get kisanClubLandingDescription =>
      'A free farmer-support programme from Vardhnam.';

  @override
  String get kisanClubLandingAdvisoryBenefit => 'Crop advisory';

  @override
  String get kisanClubLandingPromoterBenefit =>
      'Local Vardhnam promoter support';

  @override
  String get kisanClubLandingProductBenefit =>
      'Special Vardhnam product benefits';

  @override
  String get kisanClubLandingFarmBenefit => 'Farm and crop assistance';

  @override
  String get kisanClubNoMembershipFee => 'No membership fee.';

  @override
  String kisanClubJoinProgress(int current) {
    return 'Step $current of 4';
  }

  @override
  String get kisanClubBasicInformationTitle => 'Confirm your location';

  @override
  String get kisanClubFarmInformationTitle => 'Add your farm';

  @override
  String get kisanClubFarmInformationMessage =>
      'Tell us about the farm you want Club support for.';

  @override
  String get kisanClubCropInformationTitle => 'Add your current crop';

  @override
  String get kisanClubCropInformationMessage =>
      'Choose an approved crop and record the cultivated area and sowing date.';

  @override
  String get kisanClubFarmerDetailsTitle => 'Farmer details';

  @override
  String kisanClubPreferredLanguageLabel(String language) {
    return 'Preferred language: $language';
  }

  @override
  String get kisanClubSelectCropAction => 'Choose crop';

  @override
  String get kisanClubChangeCropAction => 'Change crop';

  @override
  String get kisanClubSearchCropLabel => 'Search approved crops';

  @override
  String get kisanClubSowingDateLabel => 'Sowing date';

  @override
  String get kisanClubSelectSowingDateAction => 'Choose sowing date';

  @override
  String get kisanClubSowingDateRequired => 'Choose the crop sowing date.';

  @override
  String get kisanClubFarmReviewTitle => 'Farm';

  @override
  String get kisanClubCropReviewTitle => 'Crop';

  @override
  String get kisanClubProfileSetupPartial =>
      'Your free membership was created, but the farm profile could not be completed. Continue from the saved step.';

  @override
  String get kisanClubJoinConsentWarning =>
      'Membership and farm profile were saved, but optional permissions could not be updated. You can change them from Kisan Club.';

  @override
  String get kisanClubConfirmDetailsTitle => 'Review and join';

  @override
  String get continueActionLabel => 'Continue';

  @override
  String get backActionLabel => 'Back';

  @override
  String get kisanClubMyCropSection => 'My crop';

  @override
  String get kisanClubTodaySection => 'Today\'s advisory';

  @override
  String get kisanClubCropProblemTitle => 'Crop problem?';

  @override
  String get kisanClubCropProblemAction => 'Ask Vardhnam for help';

  @override
  String get kisanClubCropProblemMessage =>
      'Share what you observed with support. The app will not generate an automatic diagnosis.';

  @override
  String get kisanClubSupportSection => 'Your Vardhnam promoter';

  @override
  String get kisanClubProgrammeBenefitsTitle => 'Kisan Club benefits';

  @override
  String get kisanClubMembershipSettingsTitle => 'Membership permissions';

  @override
  String get myPromoterCardTitle => 'Your Vardhnam promoter';

  @override
  String get addFirstFarmTitle => 'Add your first farm';

  @override
  String get viewFarmAction => 'View farm';

  @override
  String get currentCropsTitle => 'Current crops';

  @override
  String get previousCropsTitle => 'Previous crop cycles';

  @override
  String get noActiveCropTitle => 'No active crop added';

  @override
  String get farmStatusActive => 'Active farm';

  @override
  String get farmStatusInactive => 'Inactive farm';

  @override
  String get farmLocationUnavailable => 'Farm location not recorded';

  @override
  String cropImagePlaceholderLabel(String cropName) {
    return 'Image placeholder for $cropName';
  }

  @override
  String get cropVarietyDisplayLabel => 'Variety';

  @override
  String get cropTodayTitle => 'Today';

  @override
  String get approvedGuidanceTitle => 'Approved crop guidance';

  @override
  String get approvedGuidanceMessage =>
      'No crop-specific action is available here until approved advisory data is returned by the server.';

  @override
  String get nextSevenDaysTitle => 'Next 7 days';

  @override
  String get cropPlanUnavailableMessage =>
      'A seven-day crop plan will appear when approved scheduled guidance is available.';

  @override
  String get openCropDiaryAction => 'Open crop activity diary';

  @override
  String get cropStatusPlanned => 'Planned';

  @override
  String get cropStatusActive => 'Active';

  @override
  String get cropStatusHarvested => 'Harvested';

  @override
  String get cropStatusAbandoned => 'Stopped';

  @override
  String get welcomeTitle => 'Farmer workspace';

  @override
  String get phaseBoundary =>
      'Browse products, manage your cart and complete the development mock-payment journey.';

  @override
  String get languageActionLabel => 'Language';

  @override
  String get englishLanguageLabel => 'English';

  @override
  String get hindiLanguageLabel => 'हिन्दी';

  @override
  String get languageSaveFailed =>
      'Could not save the language choice. Please try again.';

  @override
  String get farmerLoginTitle => 'Farmer login';

  @override
  String get loginIntro =>
      'Enter your name and mobile number. We will verify the number with a six-digit OTP.';

  @override
  String get fullNameLabel => 'Full name';

  @override
  String get mobileNumberLabel => 'Mobile number';

  @override
  String get mobileNumberHint => '10-digit Indian mobile number';

  @override
  String get requestOtpAction => 'Send OTP';

  @override
  String get otpCodeLabel => 'Six-digit OTP';

  @override
  String get verifyOtpAction => 'Verify and continue';

  @override
  String get resendOtpAction => 'Resend OTP';

  @override
  String resendOtpCountdown(int seconds) {
    return 'Resend OTP in ${seconds}s';
  }

  @override
  String mockOtpLabel(String code) {
    return 'Development OTP (mock provider): $code';
  }

  @override
  String get otpSentMessage => 'OTP sent. Enter the code to continue.';

  @override
  String get invalidNameMessage => 'Enter your full name.';

  @override
  String get invalidPhoneMessage =>
      'Enter a valid 10-digit Indian mobile number.';

  @override
  String get invalidOtpMessage => 'Enter the six-digit OTP.';

  @override
  String get invalidCredentialsMessage =>
      'The OTP is incorrect, expired or has reached its attempt limit.';

  @override
  String get rateLimitedMessage =>
      'Too many attempts. Please wait before trying again.';

  @override
  String get networkErrorMessage =>
      'Could not connect. Check your internet connection and try again.';

  @override
  String get networkTimeoutMessage =>
      'The request took too long. Check your connection and try again.';

  @override
  String get invalidServerResponseMessage =>
      'The service returned an unexpected response. Please try again.';

  @override
  String get unexpectedErrorMessage =>
      'Something went wrong. Please try again.';

  @override
  String cachedProductsNotice(String age) {
    return 'Saved results from $age. Prices and stock may have changed; reconnect before adding to cart.';
  }

  @override
  String get cachedProductsJustNow => 'just now';

  @override
  String cachedProductsMinutesAgo(int minutes) {
    return '$minutes minute(s) ago';
  }

  @override
  String cachedProductsHoursAgo(int hours) {
    return '$hours hour(s) ago';
  }

  @override
  String get multipleMembershipsMessage =>
      'This number has multiple farmer contexts. Selection support is not available yet.';

  @override
  String get authenticationErrorMessage =>
      'Could not complete login. Please try again.';

  @override
  String get browseWithoutLoginAction => 'Browse products without login';

  @override
  String get logoutAction => 'Log out';

  @override
  String get otpLogin => 'OTP login';

  @override
  String get otpLoginSubtitle =>
      'Secure OTP sign-in with a development SMS provider.';

  @override
  String get farmProfile => 'Farm profile';

  @override
  String get accountTitle => 'Account';

  @override
  String get accountServicesTitle => 'Your account';

  @override
  String get accountProfileDetailsTitle => 'Profile details';

  @override
  String get supportAccountLabel => 'Support';

  @override
  String get privacyPolicyLabel => 'Privacy policy';

  @override
  String get termsAndConditionsLabel => 'Terms and conditions';

  @override
  String get requestAccountDeletionLabel => 'Request account deletion';

  @override
  String get legalLinkNotConfigured => 'This legal page is not available yet.';

  @override
  String get legalLinkOpenFailed => 'Could not open the selected legal page.';

  @override
  String get farmProfileSubtitle =>
      'Keep your location and crop interests up to date.';

  @override
  String get profileIntro =>
      'These details help show products and delivery options relevant to your farm.';

  @override
  String get loadingProfile => 'Loading farmer profile...';

  @override
  String get profileLoadFailed => 'Could not load your farmer profile.';

  @override
  String get profileSaveFailed =>
      'Could not save your farmer profile. Please try again.';

  @override
  String get profileSavedMessage => 'Farmer profile saved.';

  @override
  String get saveProfileAction => 'Save profile';

  @override
  String get alternatePhoneLabel => 'Alternate phone (optional)';

  @override
  String get villageLabel => 'Village';

  @override
  String get districtLabel => 'District';

  @override
  String get stateLabel => 'State';

  @override
  String get primaryPincodeLabel => 'Farm pincode';

  @override
  String get cropInterestsLabel => 'Crop interests';

  @override
  String get cropInterestsHelp =>
      'Separate crops with commas, for example: Wheat, Mustard';

  @override
  String get invalidCropsMessage =>
      'Enter no more than 20 crops, with short crop names.';

  @override
  String get savedAddressesTitle => 'Saved delivery addresses';

  @override
  String get noSavedAddresses => 'No delivery address has been saved yet.';

  @override
  String get defaultAddressLabel => 'Default';

  @override
  String get manageAddressesAction => 'Manage addresses';

  @override
  String get addressesTitle => 'Delivery addresses';

  @override
  String get loadingAddresses => 'Loading delivery addresses...';

  @override
  String get addressesLoadFailed => 'Could not load your delivery addresses.';

  @override
  String get addAddressAction => 'Add address';

  @override
  String get editAddressAction => 'Edit';

  @override
  String get setDefaultAddressAction => 'Set as default';

  @override
  String get defaultAddressUpdatedMessage =>
      'Default delivery address updated.';

  @override
  String get addressSaveFailed =>
      'Could not save the delivery address. Please try again.';

  @override
  String get addAddressTitle => 'Add delivery address';

  @override
  String get editAddressTitle => 'Edit delivery address';

  @override
  String get addressLabelField => 'Address label';

  @override
  String get recipientNameLabel => 'Recipient name';

  @override
  String get addressPhoneLabel => 'Recipient mobile number';

  @override
  String get addressLine1Label => 'Address line 1';

  @override
  String get addressLine2Label => 'Address line 2 (optional)';

  @override
  String get cityLabel => 'City';

  @override
  String get landmarkLabel => 'Landmark (optional)';

  @override
  String get makeDefaultAddressLabel => 'Use as default delivery address';

  @override
  String get defaultAddressCannotBeUnsetHelp =>
      'Choose another address as default before replacing this one.';

  @override
  String get saveAddressAction => 'Save address';

  @override
  String get requiredFieldMessage => 'This field is required.';

  @override
  String get closeAction => 'Close';

  @override
  String get productBrowsing => 'Product browsing';

  @override
  String get productBrowsingSubtitle =>
      'Approved offers shown by pincode, seller and stock.';

  @override
  String get cart => 'Cart';

  @override
  String get cartSubtitle => 'Review selected products, seller and pincode.';

  @override
  String get browseTitle => 'Browse products';

  @override
  String get deliveringToTitle => 'Delivering to';

  @override
  String get pincodeLabel => 'Pincode';

  @override
  String get productSearchLabel => 'Search crop, brand or product';

  @override
  String get shopByCategoryTitle => 'Shop by category';

  @override
  String get shopByCropTitle => 'Shop by crop';

  @override
  String get shopByBrandTitle => 'Shop by brand';

  @override
  String get allCategory => 'All';

  @override
  String get brandFilterLabel => 'Brand';

  @override
  String get allBrandsFilterLabel => 'All brands';

  @override
  String get cropFilterLabel => 'Crop';

  @override
  String get allCropsFilterLabel => 'All crops';

  @override
  String get seedsCategory => 'Seeds';

  @override
  String get fertiliserCategory => 'Fertiliser';

  @override
  String get cropCareCategory => 'Crop care';

  @override
  String get discoveryPreviewLabel => 'All products';

  @override
  String get loadingProducts => 'Loading approved offers...';

  @override
  String get loadMoreProductsAction => 'Load more products';

  @override
  String get loadingMoreProductsLabel => 'Loading more products...';

  @override
  String get enterValidPincode =>
      'Enter a valid six-digit pincode to see available products.';

  @override
  String get productLoadFailed =>
      'Could not load products from the marketplace API.';

  @override
  String get retryActionLabel => 'Retry';

  @override
  String get startingPriceLabel => 'Starting at';

  @override
  String get sellersLabel => 'Sellers';

  @override
  String get offersLabel => 'Offers';

  @override
  String get distributorDeliveryLabel => 'Distributor delivery';

  @override
  String get vardhnamFulfilmentLabel => 'Vardhnam fulfilment';

  @override
  String get pickupLabel => 'Pickup';

  @override
  String get fulfilmentPendingLabel => 'Fulfilment pending';

  @override
  String get availableUnit => 'available';

  @override
  String get warehouseLabel => 'Warehouse';

  @override
  String get noProductsForPincode =>
      'No approved offers found for this pincode.';

  @override
  String get viewProductDetailsAction => 'View details';

  @override
  String productImagePlaceholder(String productName) {
    return 'Product image placeholder for $productName';
  }

  @override
  String get productDetailsTitle => 'Product details';

  @override
  String get loadingProductDetails => 'Loading product and seller offers...';

  @override
  String get productDetailLoadFailed => 'Could not load this product.';

  @override
  String get brandOwnerLabel => 'Brand owner';

  @override
  String get suitableForCropsTitle => 'Suitable for crops';

  @override
  String get deliveryToLabel => 'Delivery to';

  @override
  String get chooseSellerOfferTitle => 'Choose a seller offer';

  @override
  String get chooseSellerOfferSubtitle =>
      'The selected distributor is the seller and will issue the product invoice.';

  @override
  String get sellerInvoiceTitle => 'Seller and invoice';

  @override
  String get sellerInvoiceMessage =>
      'Your selected distributor is the legal seller and will issue the invoice. Vardhnam operates the marketplace.';

  @override
  String get sellerOfRecordLabel => 'Seller of record';

  @override
  String get selectedOfferLabel => 'Selected offer';

  @override
  String get availableVariantsTitle => 'Available pack variants';

  @override
  String get productDocumentsTitle => 'Product documents';

  @override
  String get mrpLabel => 'MRP';

  @override
  String get minimumQuantityLabel => 'Minimum qty';

  @override
  String get deliverySlaPendingLabel => 'Delivery time pending';

  @override
  String get dayLabel => 'day';

  @override
  String get daysLabel => 'days';

  @override
  String get batchLabel => 'Batch';

  @override
  String get expiryLabel => 'Expiry';

  @override
  String get germinationLabel => 'Germination';

  @override
  String get addSelectedOfferToCartAction => 'Add selected offer to cart';

  @override
  String get addingToCartLabel => 'Adding to cart...';

  @override
  String get addedToCartMessage => 'Offer added to your cart.';

  @override
  String get offerNoLongerAvailableMessage =>
      'This seller offer is no longer available. Choose another live offer.';

  @override
  String get offerInsufficientStockMessage =>
      'This offer no longer has enough sellable stock for its minimum order. Choose another offer or refresh later.';

  @override
  String get priceChangedDialogTitle => 'Price updated';

  @override
  String priceChangedDialogMessage(String oldPrice, String newPrice) {
    return 'The seller changed this offer from $oldPrice to $newPrice. The item is in your cart at the new backend price. Review it before checkout.';
  }

  @override
  String get stayOnProductAction => 'Stay here';

  @override
  String get reviewCartAction => 'Review cart';

  @override
  String get signInToAddCartMessage =>
      'Sign in to add this offer to your cart.';

  @override
  String get cartTitle => 'My cart';

  @override
  String get loadingCartLabel => 'Loading your cart...';

  @override
  String get cartLoadFailed => 'Could not load your cart.';

  @override
  String get cartPincodeNotSelected => 'Not selected';

  @override
  String get cartAddressLabel => 'Delivery pincode';

  @override
  String get cartSnapshotLabel => 'Availability snapshot';

  @override
  String cartSellerGroupTitle(String seller) {
    return 'Sold by $seller';
  }

  @override
  String cartSellerGroupItems(int count) {
    return '$count product(s) · separate seller order and invoice';
  }

  @override
  String get cartSubtotalLabel => 'Subtotal';

  @override
  String get cartAddMore => 'Add more';

  @override
  String get cartClear => 'Clear';

  @override
  String get clearCartTitle => 'Clear cart?';

  @override
  String get clearCartConfirmation => 'This removes every item from your cart.';

  @override
  String get cancelAction => 'Cancel';

  @override
  String get emptyCartLabel => 'Your cart is empty.';

  @override
  String get decreaseQuantityLabel => 'Decrease quantity';

  @override
  String get increaseQuantityLabel => 'Increase quantity';

  @override
  String get removeItemLabel => 'Remove item';

  @override
  String get perUnitLabel => 'per unit';

  @override
  String get backendCalculatedTotalLabel =>
      'Subtotal calculated and validated by the marketplace server.';

  @override
  String get checkoutActionLabel => 'Review checkout';

  @override
  String get checkoutReviewTitle => 'Checkout review';

  @override
  String get loadingCheckoutReview => 'Loading cart and delivery addresses...';

  @override
  String get checkoutReviewLoadFailed => 'Could not prepare checkout review.';

  @override
  String get checkoutEmptyCartMessage =>
      'Your cart is empty. Add a product before checkout.';

  @override
  String get selectDeliveryAddressTitle => 'Select delivery address';

  @override
  String get noMatchingCheckoutAddress =>
      'Add or edit an address with the same pincode as this cart before checkout.';

  @override
  String get orderItemsTitle => 'Order items';

  @override
  String get checkoutRevalidationNotice =>
      'The server will revalidate offers, stock, batches, prices and delivery before creating orders.';

  @override
  String get creatingCheckoutLabel => 'Creating secure checkout...';

  @override
  String get confirmCheckoutAction => 'Confirm and create checkout';

  @override
  String get checkoutCreatedMessage =>
      'Checkout created and inventory reserved successfully.';

  @override
  String get deliveryAddressTitle => 'Delivery address';

  @override
  String get paymentNextStepMessage =>
      'Your child orders are waiting for payment.';

  @override
  String get orderNumberLabel => 'Order number';

  @override
  String get mockPaymentTitle => 'Mock payment';

  @override
  String get mockPaymentSubtitle =>
      'Server confirmation will move child orders from reserved to confirmed.';

  @override
  String get mockPaymentActionLabel => 'Confirm mock payment';

  @override
  String get mockPaymentEnvironmentNotice =>
      'Development mode only: this server-backed mock flow does not collect or transfer real money.';

  @override
  String get mockPaymentSuccessAction => 'Complete mock payment';

  @override
  String get mockPaymentFailureAction => 'Simulate declined payment';

  @override
  String get mockPaymentSucceededMessage =>
      'The server confirmed payment and moved each child order to confirmed.';

  @override
  String get checkoutCancelledMessage =>
      'Checkout cancelled. The server released its reserved inventory.';

  @override
  String get cancelCheckoutDialogTitle => 'Cancel this checkout?';

  @override
  String get cancelCheckoutDialogMessage =>
      'The server will cancel every eligible child order and release its inventory reservations.';

  @override
  String get keepCheckoutAction => 'Keep checkout';

  @override
  String get cancellationTitle => 'Cancellation';

  @override
  String get cancellationSubtitle => 'Available before successful payment.';

  @override
  String get cancellationActionLabel => 'Cancel checkout';

  @override
  String get cancellationStatusLabel => 'Eligible';

  @override
  String get reservationReleaseLabel => 'Reservation release';

  @override
  String get paymentStatusLabel => 'Payment status';

  @override
  String get paymentReferenceLabel => 'Reference';

  @override
  String get paymentAmountLabel => 'Payment amount';

  @override
  String get childOrdersLabel => 'Child orders';

  @override
  String get orderHistoryTitle => 'My orders';

  @override
  String get orderHistorySubtitle =>
      'Track each seller order, delivery and invoice separately.';

  @override
  String get orderDetailTitle => 'Order details';

  @override
  String get orderStatusFilterLabel => 'Filter by status';

  @override
  String get allOrdersFilterLabel => 'All orders';

  @override
  String get noOrdersMessage => 'No product orders found for this filter.';

  @override
  String get noOrdersTitle => 'No orders yet';

  @override
  String get noOrdersBrowseMessage =>
      'Browse products available for delivery in your area.';

  @override
  String get goToShopAction => 'Go to shop';

  @override
  String get orderSellerLabel => 'Seller';

  @override
  String get trackOrderAction => 'Track order';

  @override
  String get orderLoadFailed => 'Could not load this order.';

  @override
  String get loadMoreOrdersAction => 'Load more orders';

  @override
  String get loadingMoreOrdersLabel => 'Loading more orders...';

  @override
  String get loadingOrdersLabel => 'Loading your orders...';

  @override
  String get loadingOrderDetailLabel => 'Loading order details...';

  @override
  String get orderPlacedLabel => 'Placed';

  @override
  String orderItemCountLabel(int count) {
    return '$count item(s)';
  }

  @override
  String get orderTimelineTitle => 'Order timeline';

  @override
  String get noOrderTimelineMessage => 'No status history is available yet.';

  @override
  String get fulfilmentTrackingTitle => 'Fulfilment tracking';

  @override
  String get dispatchNumberLabel => 'Dispatch number';

  @override
  String get deliveryAssignmentLabel => 'Delivery assignment';

  @override
  String get invoiceTitle => 'Distributor invoice';

  @override
  String get invoiceNumberLabel => 'Invoice number';

  @override
  String get invoiceSellerLabel => 'Seller';

  @override
  String get invoiceBuyerLabel => 'Buyer';

  @override
  String get invoiceGeneratedLabel => 'Generated';

  @override
  String get invoiceTaxLabel => 'Tax';

  @override
  String get invoiceTotalLabel => 'Total';

  @override
  String get invoiceNotGeneratedMessage =>
      'The distributor invoice has not been generated yet.';

  @override
  String get invoicePdfPrepareAction => 'Prepare invoice PDF';

  @override
  String get invoicePdfCheckStatusAction => 'Check PDF status';

  @override
  String get invoicePdfDownloadAction => 'Download invoice PDF';

  @override
  String get invoicePdfPreparingMessage =>
      'Your invoice PDF is being prepared. Check again shortly.';

  @override
  String get invoicePdfFailedMessage =>
      'The invoice PDF could not be prepared. Try again.';

  @override
  String get invoicePdfOpenedMessage => 'Invoice PDF opened in your browser.';

  @override
  String get invoicePdfOpenFailedMessage =>
      'Could not open the invoice PDF. Try again.';

  @override
  String get cancelOrderAction => 'Cancel this order';

  @override
  String get cancelOrderDialogTitle => 'Cancel this seller order?';

  @override
  String get cancelOrderDialogMessage =>
      'Only this child order will be cancelled. The server will release its inventory reservation. Other seller orders remain independent.';

  @override
  String get keepOrderAction => 'Keep order';

  @override
  String get orderStatusPendingPayment => 'Pending payment';

  @override
  String get orderStatusConfirmed => 'Confirmed';

  @override
  String get orderStatusAccepted => 'Accepted by distributor';

  @override
  String get orderStatusRejected => 'Rejected by distributor';

  @override
  String get orderStatusReadyToPack => 'Ready to pack';

  @override
  String get orderStatusPacked => 'Packed';

  @override
  String get orderStatusReadyForPickup => 'Ready for pickup';

  @override
  String get orderStatusOutForDelivery => 'Out for delivery';

  @override
  String get orderStatusDelivered => 'Delivered';

  @override
  String get orderStatusReturnRequested => 'Return requested';

  @override
  String get orderStatusDeliveryFailed => 'Delivery failed';

  @override
  String get orderStatusCancelled => 'Cancelled';

  @override
  String get orderStatusClosed => 'Closed';

  @override
  String get orderStatusLabel => 'Status';

  @override
  String get reservedStockLabel => 'Reserved stock';

  @override
  String get mockOnlyStatus => 'Preview only';

  @override
  String get paymentProcessingStatus => 'Processing';

  @override
  String get paymentFailedStatus => 'Payment failed';

  @override
  String get readyStatus => 'Ready';

  @override
  String get inventoryReservedStatus => 'Inventory reserved';

  @override
  String get quantityLabel => 'Qty';

  @override
  String get sellerLabel => 'Seller';

  @override
  String get priceSnapshotLabel => 'Price snapshot';

  @override
  String get supportAccess => 'Support access';

  @override
  String get supportAccessSubtitle => 'Create and track your support tickets.';

  @override
  String get supportTicketsTitle => 'Support tickets';

  @override
  String get createSupportTicketAction => 'New ticket';

  @override
  String get createSupportTicketTitle => 'Create support ticket';

  @override
  String get supportTicketDetailTitle => 'Support ticket';

  @override
  String get supportTicketCreateIntro =>
      'Describe the issue clearly. Support staff will manage the ticket through the marketplace.';

  @override
  String get supportStatusFilterLabel => 'Filter by status';

  @override
  String get allSupportTicketsFilter => 'All tickets';

  @override
  String get noSupportTicketsMessage =>
      'You have not created any support tickets yet.';

  @override
  String get supportTicketLoadFailed => 'Could not load this support ticket.';

  @override
  String get loadMoreSupportTicketsAction => 'Load more tickets';

  @override
  String get loadingMoreSupportTickets => 'Loading more tickets...';

  @override
  String get loadingSupportTicketsLabel => 'Loading your support tickets...';

  @override
  String get loadingSupportTicketDetailLabel =>
      'Loading support ticket details...';

  @override
  String get supportCategoryLabel => 'Issue category';

  @override
  String get supportPriorityLabel => 'Priority';

  @override
  String get supportSubjectLabel => 'Subject';

  @override
  String get supportDescriptionLabel => 'Describe the issue';

  @override
  String get supportMinimumLengthMessage => 'Enter at least 3 characters.';

  @override
  String get submitSupportTicketAction => 'Submit ticket';

  @override
  String get linkedOrderLabel => 'Linked seller order';

  @override
  String get getHelpWithOrderAction => 'Get help with this order';

  @override
  String get supportCreatedLabel => 'Created';

  @override
  String get supportSlaDueLabel => 'Response target';

  @override
  String get supportResolutionTitle => 'Resolution note';

  @override
  String get reopenSupportTicketAction => 'Reopen ticket';

  @override
  String get reopenSupportTicketTitle => 'Reopen this ticket?';

  @override
  String get reopenReasonLabel => 'What is still unresolved?';

  @override
  String get supportEvidenceUnavailableMessage =>
      'Attachments are unavailable until secure authorised file upload is implemented.';

  @override
  String get supportConversationUnavailableMessage =>
      'Ticket replies are not available yet. Pull down to refresh status and resolution updates.';

  @override
  String get supportStatusOpen => 'Open';

  @override
  String get supportStatusAssigned => 'Assigned';

  @override
  String get supportStatusWaitingForCustomer => 'Waiting for you';

  @override
  String get supportStatusWaitingForSeller => 'Waiting for seller';

  @override
  String get supportStatusEscalated => 'Escalated';

  @override
  String get supportStatusResolved => 'Resolved';

  @override
  String get supportStatusClosed => 'Closed';

  @override
  String get supportStatusReopened => 'Reopened';

  @override
  String get supportCategoryOrder => 'Order issue';

  @override
  String get supportCategoryPayment => 'Payment issue';

  @override
  String get supportCategoryDelivery => 'Delivery issue';

  @override
  String get supportCategoryProductQuality => 'Product quality';

  @override
  String get supportCategoryAccount => 'Account issue';

  @override
  String get supportCategoryOnboarding => 'Onboarding issue';

  @override
  String get supportCategoryOther => 'Other';

  @override
  String get supportPriorityLow => 'Low';

  @override
  String get supportPriorityMedium => 'Medium';

  @override
  String get supportPriorityHigh => 'High';

  @override
  String get supportPriorityUrgent => 'Urgent';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsSubtitle =>
      'Read marketplace, order and support updates.';

  @override
  String get notificationDetailTitle => 'Notification';

  @override
  String get unreadNotificationsOnlyLabel => 'Show unread only';

  @override
  String get noNotificationsMessage =>
      'You do not have any in-app notifications yet.';

  @override
  String get noUnreadNotificationsMessage =>
      'You have read all your notifications.';

  @override
  String get noNotificationsTitle => 'No notifications yet';

  @override
  String get notificationOrdersCategory => 'Orders';

  @override
  String get notificationKisanClubCategory => 'Kisan Club';

  @override
  String get notificationAdvisoryCategory => 'Advisory';

  @override
  String get notificationSupportCategory => 'Support';

  @override
  String get notificationReturnsCategory => 'Returns';

  @override
  String get notificationOtherCategory => 'Updates';

  @override
  String get notificationLoadFailed => 'Could not load this notification.';

  @override
  String get loadMoreNotificationsAction => 'Load more notifications';

  @override
  String get loadingMoreNotificationsLabel => 'Loading more notifications...';

  @override
  String get loadingNotificationsLabel => 'Loading your notifications...';

  @override
  String get loadingNotificationDetailLabel =>
      'Loading notification details...';

  @override
  String get openNotificationResourceAction => 'Open related item';

  @override
  String get contactSupportTitle => 'Contact support';

  @override
  String get contactSupportSubtitle =>
      'Call or message the configured Vardhnam support desk.';

  @override
  String get callSupportAction => 'Call support';

  @override
  String get whatsAppSupportAction => 'WhatsApp support';

  @override
  String get whatsAppSupportMessage =>
      'Hello Vardhnam Support, I need help with the farmer app.';

  @override
  String get supportContactUnavailableMessage =>
      'Phone and WhatsApp support details are not configured for this environment. You can still create a support ticket below.';

  @override
  String get supportContactLaunchFailed =>
      'Could not open the selected support app.';

  @override
  String get requestReturnAction => 'Request a return';

  @override
  String get returnRequestTitle => 'Return request';

  @override
  String get returnRequestIntro =>
      'Choose the items and quantities to return from this seller order. Eligibility and amounts are checked by the marketplace server.';

  @override
  String get loadingReturnEligibilityLabel => 'Checking return eligibility...';

  @override
  String get returnEligibilityLoadFailed =>
      'Could not check return eligibility.';

  @override
  String get returnNotEligibleMessage =>
      'This order is not eligible for a return.';

  @override
  String returnWindowEndsLabel(String date) {
    return 'Return window ends on $date';
  }

  @override
  String get returnItemsTitle => 'Items to return';

  @override
  String get doNotReturnItemLabel => 'No';

  @override
  String get returnReasonLabel => 'Reason for return';

  @override
  String get returnReasonNoteLabel => 'Additional details';

  @override
  String get returnReasonNoteRequiredMessage =>
      'Details are required when you select Other.';

  @override
  String get returnInventorySafetyMessage =>
      'Submitting a return does not put the goods back into sellable stock. The seller must inspect them first.';

  @override
  String get submitReturnRequestAction => 'Submit return request';

  @override
  String get returnRequestSubmittedMessage =>
      'Your return request was submitted.';

  @override
  String get returnReasonDamaged => 'Damaged in transit';

  @override
  String get returnReasonWrongItem => 'Wrong item';

  @override
  String get returnReasonExpiry => 'Expired or near expiry';

  @override
  String get returnReasonQuality => 'Quality issue';

  @override
  String get returnReasonNotAsDescribed => 'Not as described';

  @override
  String get returnReasonMistake => 'Ordered by mistake';

  @override
  String get returnReasonOther => 'Other';

  @override
  String get myReturnsTitle => 'My returns';

  @override
  String get myReturnsSubtitle =>
      'Track return requests for each seller order.';

  @override
  String get returnStatusFilterLabel => 'Return status';

  @override
  String get allReturnsFilter => 'All returns';

  @override
  String get loadingReturnsLabel => 'Loading your return requests...';

  @override
  String get loadingMoreReturnsLabel => 'Loading more returns...';

  @override
  String get loadMoreReturnsAction => 'Load more returns';

  @override
  String get noReturnsMessage => 'You have not requested a return yet.';

  @override
  String get returnDetailTitle => 'Return details';

  @override
  String get loadingReturnDetailLabel => 'Loading return details...';

  @override
  String get returnDetailLoadFailed => 'Could not load this return request.';

  @override
  String returnRequestedOnLabel(String date) {
    return 'Requested on $date';
  }

  @override
  String returnExpectedAmountLabel(String amount) {
    return 'Expected return amount: $amount';
  }

  @override
  String get returnTimelineTitle => 'Return timeline';

  @override
  String get returnTimelineEmptyMessage =>
      'No return status updates are available yet.';

  @override
  String get openRelatedOrderAction => 'Open seller order';

  @override
  String get returnStatusRequested => 'Requested';

  @override
  String get returnStatusApproved => 'Approved';

  @override
  String get returnStatusRejected => 'Rejected';

  @override
  String get returnStatusInTransit => 'In transit';

  @override
  String get returnStatusReceived => 'Received by seller';

  @override
  String get returnStatusInspected => 'Inspected';

  @override
  String get returnStatusCompleted => 'Completed';

  @override
  String get returnStatusCancelled => 'Cancelled';

  @override
  String get cancelReturnAction => 'Cancel return';

  @override
  String get cancelReturnDialogTitle => 'Cancel this return?';

  @override
  String get cancelReturnDialogMessage =>
      'You can cancel before pickup. The seller order will return to Delivered status.';

  @override
  String get keepReturnAction => 'Keep return';

  @override
  String get returnCancelledMessage => 'Your return request was cancelled.';

  @override
  String returnApprovedAmountLabel(String amount) {
    return 'Approved refund amount: $amount';
  }

  @override
  String get returnInspectionNoteLabel => 'Inspection note';

  @override
  String returnRefundStatusLabel(String status) {
    return 'Refund status: $status';
  }

  @override
  String returnRefundReferenceLabel(String reference) {
    return 'Refund reference: $reference';
  }

  @override
  String get creditNoteTitle => 'Refund credit note';

  @override
  String get creditNoteViewAction => 'View credit note';

  @override
  String get creditNoteCheckStatusAction => 'Check credit note status';

  @override
  String get creditNoteDownloadAction => 'Download credit note PDF';

  @override
  String get creditNotePreparingMessage =>
      'Your credit note PDF is being prepared. Check again shortly.';

  @override
  String get creditNoteFailedMessage =>
      'The credit note PDF could not be prepared. Check again later.';

  @override
  String get creditNoteOpenedMessage =>
      'Credit note PDF opened in your browser.';

  @override
  String get creditNoteOpenFailedMessage =>
      'Could not open the credit note PDF. Try again.';

  @override
  String creditNoteNumberLabel(String number) {
    return 'Credit note: $number';
  }

  @override
  String creditNoteOriginalInvoiceLabel(String number) {
    return 'Original invoice: $number';
  }

  @override
  String creditNoteRefundAmountLabel(String amount) {
    return 'Refund amount: $amount';
  }

  @override
  String creditNoteTaxLabel(String amount) {
    return 'Tax credited: $amount';
  }

  @override
  String get refundStatusPending => 'Pending';

  @override
  String get refundStatusProcessing => 'Processing';

  @override
  String get refundStatusSucceeded => 'Completed';

  @override
  String get refundStatusFailed => 'Failed';

  @override
  String get refundStatusCancelled => 'Cancelled';

  @override
  String get kisanClubTitle => 'Kisan Club';

  @override
  String get kisanClubLoading => 'Checking your Kisan Club membership...';

  @override
  String get kisanClubLoadFailed => 'Could not load Kisan Club right now.';

  @override
  String get kisanClubUnavailable =>
      'Kisan Club is not available in this environment.';

  @override
  String get kisanClubJoinTitle => 'Join Kisan Club';

  @override
  String get kisanClubJoinSubtitle =>
      'Free membership, local support and eligible product benefits.';

  @override
  String get kisanClubFreeMembership =>
      'Kisan Club membership is free. Only your pincode and acceptance of the programme terms are required to join.';

  @override
  String get kisanClubTermsSummary =>
      'By joining, you agree to the current Kisan Club programme terms. Advisory, marketing and precise-location permissions are separate and optional.';

  @override
  String get kisanClubAcceptTerms => 'I accept the Kisan Club programme terms';

  @override
  String get kisanClubTermsRequired =>
      'Accept the programme terms to join Kisan Club.';

  @override
  String get kisanClubOptionalConsentsTitle => 'Optional permissions';

  @override
  String get kisanClubOptionalConsentsMessage =>
      'You can decline or change these choices later without losing membership.';

  @override
  String get kisanClubAdvisoryConsent => 'Crop and farm advisory messages';

  @override
  String get kisanClubMarketingConsent => 'Offers and marketing messages';

  @override
  String get kisanClubLocationConsent => 'Precise farm location';

  @override
  String get kisanClubLocationConsentHelp =>
      'Location is optional. Pincode-level service continues when it is off.';

  @override
  String get kisanClubJoinAction => 'Join free';

  @override
  String get kisanClubJoinSuccess => 'You joined Kisan Club.';

  @override
  String get kisanClubJoinFailed =>
      'Could not join Kisan Club. Please try again.';

  @override
  String get kisanClubConsentSaved => 'Your permission choices were saved.';

  @override
  String get kisanClubConsentSaveFailed =>
      'Membership was saved, but permission choices could not be updated. You can retry from Kisan Club.';

  @override
  String get kisanClubSaveConsentsAction => 'Save choices';

  @override
  String get kisanClubHomeIntro =>
      'Your Kisan Club membership and programme progress.';

  @override
  String kisanClubMemberNumber(String memberNumber) {
    return 'Member number: $memberNumber';
  }

  @override
  String kisanClubHomePincode(String pincode) {
    return 'Home pincode: $pincode';
  }

  @override
  String get kisanClubStatusPendingProfile => 'Farm profile incomplete';

  @override
  String get kisanClubStatusAwaitingPromoter => 'Waiting for local promoter';

  @override
  String get kisanClubStatusActive => 'Active member';

  @override
  String get kisanClubStatusSuspended => 'Membership suspended';

  @override
  String get kisanClubStatusInactive => 'Membership inactive';

  @override
  String get kisanClubStatusClosed => 'Membership closed';

  @override
  String get kisanClubCompleteProfileMessage =>
      'Complete your farm details to continue.';

  @override
  String get kisanClubCompleteProfileAction => 'Complete profile';

  @override
  String get kisanClubProfileCompletionTitle => 'Complete Club profile';

  @override
  String get kisanClubProfileStepOneTitle => 'Step 1 of 2: Add your first farm';

  @override
  String get kisanClubProfileStepOneMessage =>
      'Add the farm name, pincode, area and ownership details. Use the Add farm button below.';

  @override
  String get kisanClubProfileStepTwoTitle =>
      'Step 2 of 2: Add the crop you are growing';

  @override
  String get kisanClubProfileStepTwoMessage =>
      'Use Add crop cycle on a farm and select the crop, cultivated area and season.';

  @override
  String get kisanClubProfileSavedProgressMessage =>
      'Your progress is saved securely. You can leave and continue later.';

  @override
  String get kisanClubProfileCompletedMessage => 'Club farm profile completed.';

  @override
  String get kisanClubFindingPromoterMessage =>
      'We are finding your local Kisan Club partner.';

  @override
  String get kisanClubActiveMessage => 'Your Kisan Club membership is active.';

  @override
  String get kisanClubSuspendedMessage =>
      'Your membership is read-only. Contact support for help.';

  @override
  String get kisanClubInactiveMessage =>
      'This membership is not active. Contact support for help.';

  @override
  String get kisanClubOpenSupportAction => 'Open support';

  @override
  String get kisanClubCatalogueTitle => 'Club products';

  @override
  String get kisanClubCatalogueSubtitle =>
      'Browse products selected for your Kisan Club area.';

  @override
  String get kisanClubEligibleProductsLabel => 'Eligible Club products';

  @override
  String get kisanClubEligibleBadge => 'Kisan Club Benefit';

  @override
  String get kisanClubBenefitCalculatedInCart =>
      'Choose a seller offer. Any available Club benefit is calculated securely when it is added to your cart.';

  @override
  String kisanClubBenefitAddedMessage(String amount) {
    return 'Added to cart with an estimated Club benefit of $amount.';
  }

  @override
  String get kisanClubBenefitLabel => 'Kisan Club benefit';

  @override
  String get kisanClubFarmerPayableLabel => 'You pay';

  @override
  String kisanClubLineBenefitLabel(String amount) {
    return 'Club benefit: $amount';
  }

  @override
  String get kisanClubBenefitsTitle => 'Benefit tokens';

  @override
  String get kisanClubBenefitsSubtitle =>
      'View codes created for promoter-assisted purchases.';

  @override
  String get kisanClubBenefitsLoading => 'Loading your benefit tokens...';

  @override
  String get kisanClubBenefitsLoadingMore => 'Loading more tokens...';

  @override
  String get kisanClubBenefitsLoadMore => 'Load more tokens';

  @override
  String get kisanClubBenefitsEmpty =>
      'No benefit tokens yet. Choose an eligible Club product to create one.';

  @override
  String get kisanClubTokenStatusFilterLabel => 'Token status';

  @override
  String get kisanClubTokenStatusAll => 'All token statuses';

  @override
  String get kisanClubTokenCreateAction => 'Create promoter token';

  @override
  String get kisanClubTokenCreating => 'Creating secure token...';

  @override
  String get kisanClubTokenCreatedTitle => 'Benefit token created';

  @override
  String get kisanClubTokenCreatedMessage =>
      'Share this code only with your assigned Kisan Club promoter. It is shown only once.';

  @override
  String get kisanClubTokenSecurityWarning =>
      'The code authorises an assisted order. The current price and benefit will be checked again before the order is created. You will still pay in the app.';

  @override
  String get kisanClubTokenSavedAction => 'I saved the code';

  @override
  String get kisanClubTokenCodeNotRecoverable =>
      'For security, the complete code cannot be shown again. Create a new token if you did not save it.';

  @override
  String get kisanClubTokenStatusIssued => 'Ready';

  @override
  String get kisanClubTokenStatusRedeemed => 'Used';

  @override
  String get kisanClubTokenStatusExpired => 'Expired';

  @override
  String get kisanClubTokenStatusCancelled => 'Cancelled';

  @override
  String kisanClubTokenReference(String reference) {
    return 'Reference: $reference';
  }

  @override
  String kisanClubTokenSeller(String seller) {
    return 'Seller: $seller';
  }

  @override
  String kisanClubTokenQuantity(int quantity) {
    return 'Quantity: $quantity';
  }

  @override
  String kisanClubTokenBenefit(String amount) {
    return 'Quoted Club benefit: $amount';
  }

  @override
  String kisanClubTokenPayable(String amount) {
    return 'Quoted amount to pay: $amount';
  }

  @override
  String kisanClubTokenExpires(String date) {
    return 'Expires: $date';
  }

  @override
  String get myFarmsTitle => 'My farms';

  @override
  String get myFarmsSubtitle =>
      'Record farm area and crops for Kisan Club support.';

  @override
  String get myFarmsLoading => 'Loading your farms...';

  @override
  String get myFarmsEmpty =>
      'No farms have been added yet. Add your first farm to continue your Club profile.';

  @override
  String get addFarmAction => 'Add farm';

  @override
  String get addFarmTitle => 'Add a farm';

  @override
  String get editFarmAction => 'Edit farm';

  @override
  String get editFarmTitle => 'Edit farm details';

  @override
  String get farmActiveLabel => 'Farm is active';

  @override
  String get saveFarmChangesAction => 'Save changes';

  @override
  String get savingFarmChangesLabel => 'Saving changes...';

  @override
  String get farmNameLabel => 'Farm name';

  @override
  String get farmVillageLabel => 'Village (optional)';

  @override
  String get farmAreaLabel => 'Area in acres';

  @override
  String get farmOwnershipLabel => 'Ownership';

  @override
  String get farmOwnershipOwned => 'Owned';

  @override
  String get farmOwnershipLeased => 'Leased';

  @override
  String get farmOwnershipSharecropped => 'Sharecropped';

  @override
  String get farmOwnershipOther => 'Other';

  @override
  String get invalidFarmAreaMessage => 'Enter a farm area greater than zero.';

  @override
  String get saveFarmAction => 'Save farm';

  @override
  String get savingFarmLabel => 'Saving farm...';

  @override
  String farmAreaAndPincode(String area, String pincode) {
    return '$area acres · $pincode';
  }

  @override
  String cropCyclesCount(int count) {
    return 'Crop cycles: $count';
  }

  @override
  String get noCropCyclesYet => 'No crop cycle added yet.';

  @override
  String get acresUnit => 'acres';

  @override
  String get addCropCycleAction => 'Add crop cycle';

  @override
  String addCropCycleTitle(String farmName) {
    return 'Add crop to $farmName';
  }

  @override
  String get referenceCropsLoading => 'Loading crop list...';

  @override
  String get referenceCropsEmpty =>
      'No approved crop references are available. Please contact support.';

  @override
  String get cropReferenceLabel => 'Crop';

  @override
  String get cropReferenceRequired => 'Select a crop from the approved list.';

  @override
  String get cropVarietyLabel => 'Variety name (optional)';

  @override
  String get cropAreaLabel => 'Crop area in acres';

  @override
  String cropAreaLimit(String area) {
    return 'Cannot exceed this farm\'s $area acres.';
  }

  @override
  String get invalidCropAreaMessage =>
      'Enter a crop area greater than zero and within the farm area.';

  @override
  String get cropSeasonLabel => 'Season code';

  @override
  String get cropSeasonHint => 'Example: RABI_2026_27';

  @override
  String get invalidCropSeasonMessage =>
      'Use 2–40 letters, numbers, hyphens or underscores.';

  @override
  String get saveCropCycleAction => 'Save crop cycle';

  @override
  String get savingCropCycleLabel => 'Saving crop cycle...';

  @override
  String get editCropCycleAction => 'Edit crop cycle';

  @override
  String get editCropCycleTitle => 'Edit crop cycle';

  @override
  String get saveCropCycleChangesAction => 'Save changes';

  @override
  String get savingCropCycleChangesLabel => 'Saving changes...';

  @override
  String get myPromoterTitle => 'My Kisan Club promoter';

  @override
  String get myPromoterSubtitle => 'View your assigned local Club partner.';

  @override
  String get myPromoterAwaitingSubtitle =>
      'We are still finding your local Club partner.';

  @override
  String get myPromoterLoading => 'Loading your promoter assignment...';

  @override
  String get myPromoterAwaitingMessage =>
      'No promoter is assigned yet. Kisan Club operations are finding an eligible local partner for you.';

  @override
  String get myPromoterNameUnavailable => 'Assigned Kisan Club promoter';

  @override
  String myPromoterAssignedOn(String date) {
    return 'Assigned on $date';
  }

  @override
  String myPromoterTerritory(String territory) {
    return 'Area: $territory';
  }

  @override
  String myPromoterPhone(String phone) {
    return 'Phone: $phone';
  }

  @override
  String get myPromoterCopyPhoneAction => 'Copy phone number';

  @override
  String get myPromoterPhoneCopied => 'Promoter phone number copied.';

  @override
  String get myPromoterPrivacyTitle => 'Your information stays scoped';

  @override
  String get myPromoterPrivacyMessage =>
      'Your assigned promoter can access only the Club farm and crop information needed to support you. Payment details and unrelated seller orders are not shared.';

  @override
  String get cropDiaryTitle => 'Crop activity diary';

  @override
  String cropDiaryFor(String cropName) {
    return '$cropName activity diary';
  }

  @override
  String get cropDiaryLoading => 'Loading crop activities...';

  @override
  String get cropDiaryEmpty => 'No crop activities have been recorded yet.';

  @override
  String get addCropActivityAction => 'Add activity';

  @override
  String get addCropActivityTitle => 'Record crop activity';

  @override
  String get cropActivityTypeLabel => 'Activity type';

  @override
  String get cropActivityDateLabel => 'Date of activity';

  @override
  String get cropActivityNotesLabel => 'What happened? (optional)';

  @override
  String get cropActivityFactualHelp =>
      'Record what you observed or did. This diary does not provide pesticide or treatment recommendations.';

  @override
  String get saveCropActivity => 'Save activity';

  @override
  String get savingCropActivity => 'Saving activity...';

  @override
  String get activitySowing => 'Sowing';

  @override
  String get activityIrrigation => 'Irrigation';

  @override
  String get activityFertilizerApplied => 'Fertilizer applied';

  @override
  String get activityCropProtectionApplied => 'Crop-protection product applied';

  @override
  String get activityPestObserved => 'Pest observed';

  @override
  String get activityDiseaseObserved => 'Disease observed';

  @override
  String get activityWeeding => 'Weeding';

  @override
  String get activityCropDamage => 'Crop damage';

  @override
  String get activityHarvest => 'Harvest';

  @override
  String get activityOther => 'Other activity';

  @override
  String get activitySourceFarmer => 'Recorded by you';

  @override
  String get activitySourcePromoter => 'Recorded by your assigned promoter';

  @override
  String get activitySourceSystem => 'Recorded by the system';

  @override
  String get harvestCropAction => 'Record harvest';

  @override
  String get harvestCropTitle => 'Complete this crop cycle';

  @override
  String get actualHarvestDateLabel => 'Actual harvest date';

  @override
  String get harvestYieldLabel => 'Yield in quintals (optional)';

  @override
  String get harvestYieldOptionalHelp =>
      'Enter the measured harvest yield when available.';

  @override
  String get invalidHarvestYieldMessage => 'Enter zero or a positive yield.';

  @override
  String get confirmHarvestAction => 'Confirm harvest';

  @override
  String get savingHarvestLabel => 'Recording harvest...';

  @override
  String get advisoryTitle => 'Crop advisories';

  @override
  String get advisorySubtitle =>
      'Read approved guidance matched to your active crops.';

  @override
  String get advisoryLoading => 'Loading your crop advisories...';

  @override
  String get advisoryEmptyTitle => 'You are up to date';

  @override
  String get advisoryEmpty =>
      'No advisories are due for your active crops right now.';

  @override
  String get advisoryDetailTitle => 'Crop advisory';

  @override
  String advisoryCropLabel(String cropName) {
    return 'Crop: $cropName';
  }

  @override
  String advisoryDueLabel(String date) {
    return 'Due on: $date';
  }

  @override
  String advisorySourceLabel(String source) {
    return 'Source: $source';
  }

  @override
  String get advisoryHumanApprovedTitle => 'Human-authored and approved';

  @override
  String get advisoryDisclaimer =>
      'Use this as general crop guidance. Field conditions vary; speak with your assigned promoter or a qualified agronomist before taking treatment decisions.';

  @override
  String get advisoryImportantToday => 'Important today';

  @override
  String get advisoryApprovedLabel => 'Approved guidance';

  @override
  String get advisoryUnreadLabel => 'New';

  @override
  String get advisoryReadAction => 'Read guidance';

  @override
  String get advisoryWhatToDoTitle => 'What you should do';

  @override
  String get advisoryWhenToActTitle => 'When to act';

  @override
  String get advisoryTechnicalDetailsTitle => 'Source and technical details';

  @override
  String get advisoryContactPromoterAction => 'Contact promoter or expert';

  @override
  String get advisoryDismissAction => 'Dismiss advisory';

  @override
  String get cropDoctorTitle => 'Crop Doctor';

  @override
  String get cropDoctorProblemTitle => 'Problem in your crop?';

  @override
  String get cropDoctorIntro =>
      'Take clear photos of the affected crop so a support expert can understand what you observed.';

  @override
  String get cropDoctorPhotoGuideTitle => 'How to take a useful photo';

  @override
  String get cropDoctorGuideAffectedLeaf =>
      'Keep the affected leaf or plant clearly visible.';

  @override
  String get cropDoctorGuideDaylight =>
      'Use good daylight and avoid heavy shadows.';

  @override
  String get cropDoctorGuideClosePhoto =>
      'Move close enough to show the damage clearly.';

  @override
  String get cropDoctorCaptureUnavailableTitle =>
      'Photo diagnosis is coming later';

  @override
  String get cropDoctorCaptureUnavailableMessage =>
      'Secure photo upload and a diagnosis provider are not connected. Photo controls remain disabled until an approved backend is available.';

  @override
  String get cropDoctorTakePhotoAction => 'Take photo';

  @override
  String get cropDoctorChoosePhotoAction => 'Choose photo';

  @override
  String get cropDoctorHumanHelpAction => 'Describe the problem to support';

  @override
  String get cropDoctorNoDiagnosisMessage =>
      'This screen does not diagnose crops or recommend treatment automatically.';

  @override
  String get cropDoctorOpenAction => 'Open photo guide';

  @override
  String get shopTabLabel => 'Shop';

  @override
  String get ordersTabLabel => 'Orders';

  @override
  String get accountTabLabel => 'Account';

  @override
  String get homeActiveCropTitle => 'Your crop';

  @override
  String homeActiveCropDay(int days) {
    return 'Day $days';
  }

  @override
  String get homeActiveCropViewAction => 'View crop';

  @override
  String get homeActiveCropEmpty =>
      'Add your farm and crop to see crop guidance here.';

  @override
  String get homeActiveCropMore => 'View all crops';

  @override
  String get homeActiveOrderTitle => 'Your order';

  @override
  String get homeActiveOrderTrackAction => 'Track';

  @override
  String get homeRecommendedTitle => 'For your farm';

  @override
  String get homeRecommendedViewAll => 'View all';

  @override
  String get homeSectionUnavailable => 'Could not load. Pull down to retry.';
}
