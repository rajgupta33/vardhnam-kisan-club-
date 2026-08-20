// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get myTerritory => 'My territory';

  @override
  String get territoryLoadFailed =>
      'Your territory could not be loaded. Try again.';

  @override
  String get noTerritoryAssigned =>
      'No territory is assigned to this organisation context. Contact operations if you expect an assignment.';

  @override
  String territoryDistrict(String district) {
    return 'District: $district';
  }

  @override
  String territoryState(String state) {
    return 'State: $state';
  }

  @override
  String get territoryBlocks => 'Blocks';

  @override
  String get territoryPincodes => 'Service pincodes';

  @override
  String get territoryVillages => 'Villages';

  @override
  String get territoryReadOnlyNotice =>
      'Territory assignments are managed by authorised Vardhnam operations staff.';

  @override
  String get registerFarmerWithOtp => 'Register with farmer OTP';

  @override
  String get assistedOtpConsentNotice =>
      'Ask the farmer for the OTP only while they are present and have agreed to registration. The promoter never receives the farmer\'s login session.';

  @override
  String get farmerOtpCode => 'Farmer OTP code';

  @override
  String get verifyAndRegister => 'Verify and register';

  @override
  String mockOtpCode(String code) {
    return 'Mock OTP: $code';
  }

  @override
  String get assistedOtpRequestFailed =>
      'The registration OTP could not be requested. Check the lead status and try again.';

  @override
  String get assistedOtpVerificationFailed =>
      'The OTP could not be verified. Check the code and try again.';

  @override
  String get assistedRegistrationSuccess =>
      'The farmer was OTP-verified, registered and linked to your lead.';

  @override
  String get deliveryLocationProofHelp =>
      'After confirmation, the app will ask for location permission to record the delivery point. If permission or location is unavailable, OTP delivery can still continue.';

  @override
  String get deliveryAssignments => 'My deliveries';

  @override
  String get deliveryAvailability => 'Available for new deliveries';

  @override
  String get deliveryOnlineExplanation =>
      'You are online. Operations can assign new deliveries to you.';

  @override
  String get deliveryOfflineExplanation =>
      'You are offline. Operations cannot assign new deliveries to you.';

  @override
  String get deliveryNowOnline =>
      'You are now available for delivery assignments.';

  @override
  String get deliveryNowOffline =>
      'You are now offline for new delivery assignments.';

  @override
  String get deliveryAvailabilityLoadFailed =>
      'Availability could not be loaded.';

  @override
  String get deliveryAvailabilityUpdateFailed =>
      'Availability could not be updated. Try again.';

  @override
  String get deliveryAssignmentsLoadFailed =>
      'Your delivery assignments could not be loaded.';

  @override
  String get noDeliveryAssignments =>
      'No delivery assignments are currently assigned to you.';

  @override
  String get deliveryAssignmentDetail => 'Delivery details';

  @override
  String deliveryAssignmentNumber(String number) {
    return 'Assignment: $number';
  }

  @override
  String deliveryAssignmentStatus(String status) {
    return 'Delivery status: $status';
  }

  @override
  String get deliveryStatusAssigned => 'Assigned';

  @override
  String get deliveryStatusAccepted => 'Accepted';

  @override
  String get deliveryStatusRejected => 'Rejected';

  @override
  String get deliveryStatusDelivered => 'Delivered';

  @override
  String get deliveryStatusFailed => 'Delivery failed';

  @override
  String dispatchNumber(String number) {
    return 'Dispatch: $number';
  }

  @override
  String invoiceNumber(String number) {
    return 'Invoice: $number';
  }

  @override
  String get deliveryAddress => 'Delivery address';

  @override
  String farmerPhone(String phone) {
    return 'Farmer phone: $phone';
  }

  @override
  String get packageItems => 'Package items';

  @override
  String itemQuantity(int quantity) {
    return 'Qty $quantity';
  }

  @override
  String get startDelivery => 'Package collected — start delivery';

  @override
  String get acceptDeliveryAssignment => 'Accept assignment';

  @override
  String get rejectDeliveryAssignment => 'Reject assignment';

  @override
  String get deliveryAssignmentAccepted => 'Delivery assignment accepted.';

  @override
  String get deliveryAssignmentRejected =>
      'Delivery assignment rejected. Operations can now reassign it.';

  @override
  String get scanPackageQr => 'Scan package QR';

  @override
  String get scanPackageQrHelp =>
      'Scan the QR label attached by the seller. Camera access is used only while this screen is open.';

  @override
  String get enterPackageCodeManually => 'Enter package code manually';

  @override
  String get packageCode => 'Package code';

  @override
  String get packageCodeRequired => 'Enter the complete package code.';

  @override
  String get verifyPackagePickup => 'Verify pickup';

  @override
  String get packagePickupVerified => 'Package pickup verified.';

  @override
  String get packagePickupVerificationFailed =>
      'The package code did not match. Check the label and try again.';

  @override
  String get openNavigation => 'Navigate';

  @override
  String get callFarmer => 'Call farmer';

  @override
  String get externalAppOpenFailed =>
      'No supported app could open this action.';

  @override
  String get deliveryRejectionReason => 'Reason for rejection';

  @override
  String get deliveryRejectionReasonRequired =>
      'Enter a reason so operations can reassign this delivery.';

  @override
  String get deliveryStarted => 'Delivery marked out for delivery.';

  @override
  String get completeDelivery => 'Verify OTP and complete';

  @override
  String get deliveryOtp => '6-digit delivery OTP';

  @override
  String get deliveryOtpInvalid => 'Enter the 6-digit OTP.';

  @override
  String get deliveryOtpHelp =>
      'Ask the farmer for the delivery OTP. Completion is recorded only after the backend verifies it.';

  @override
  String get deliveryProofNoteOptional => 'Delivery note (optional)';

  @override
  String get deliveryCompleted => 'Delivery completed and verified.';

  @override
  String get deliveryCompletedWithLocation =>
      'Delivery completed. OTP and delivery location were recorded.';

  @override
  String get deliveryCompletedLocationDenied =>
      'Delivery completed with OTP. Location permission was denied and that outcome was recorded.';

  @override
  String get deliveryCompletedLocationUnavailable =>
      'Delivery completed with OTP. Device location was unavailable and that outcome was recorded.';

  @override
  String get deliveryUpdateFailed =>
      'The delivery could not be updated. Refresh and try again.';

  @override
  String get deliveryOtpFailed =>
      'The OTP could not be verified. Check it with the farmer and try again.';

  @override
  String get deliveryOtpExpiryNotice =>
      'The OTP has a backend-controlled expiry and attempt limit.';

  @override
  String get deliveryLocationProof => 'Delivery location proof';

  @override
  String deliveryLocationRecorded(String accuracy) {
    return 'Location recorded (device accuracy: $accuracy m).';
  }

  @override
  String get deliveryLocationPermissionDenied =>
      'Location permission was denied. OTP completion was not blocked.';

  @override
  String get deliveryLocationUnavailable =>
      'Device location was unavailable. OTP completion was not blocked.';

  @override
  String get deliveryLocationNotRecorded =>
      'No location outcome is stored for this earlier delivery.';

  @override
  String get deliveryPhotoProofDeferred =>
      'Photo proof remains unavailable until authorised private evidence storage is enabled.';

  @override
  String get markDeliveryFailed => 'Could not deliver';

  @override
  String get deliveryFailureTitle => 'Record failed delivery';

  @override
  String get deliveryFailureReason => 'Failure reason';

  @override
  String get deliveryFailureNoteOptional => 'Details (optional)';

  @override
  String deliveryRetryAt(String date) {
    return 'Retry on $date';
  }

  @override
  String get chooseRetryDate => 'Choose retry date';

  @override
  String get chooseRetryTime => 'Choose retry time';

  @override
  String get deliveryRetryFutureRequired =>
      'Choose a retry time in the future.';

  @override
  String get deliveryFailureRecorded =>
      'Failed attempt recorded. The retry is scheduled.';

  @override
  String get retryDeliveryNow => 'Start scheduled retry';

  @override
  String get retryNotDue => 'The retry can start at the scheduled time.';

  @override
  String get deliveryRetryStarted => 'Delivery retry started with a fresh OTP.';

  @override
  String deliveryFailureAttemptCount(int count) {
    return 'Failed attempts: $count';
  }

  @override
  String get deliveryFailureFarmerUnavailable => 'Farmer unavailable';

  @override
  String get deliveryFailureFarmerRefused => 'Farmer refused delivery';

  @override
  String get deliveryFailureAddressNotFound => 'Address not found';

  @override
  String get deliveryFailureAccessRestricted => 'Access restricted';

  @override
  String get deliveryFailureVehicleBreakdown => 'Vehicle breakdown';

  @override
  String get deliveryFailureWeatherRoute => 'Weather or route blocked';

  @override
  String get deliveryFailurePackageDamaged => 'Package damaged';

  @override
  String get deliveryFailureOther => 'Other';

  @override
  String get returnPickups => 'Return pickups';

  @override
  String get returnPickupsLoadFailed =>
      'Your return pickup assignments could not be loaded.';

  @override
  String get noReturnPickups => 'No return pickups are assigned to you.';

  @override
  String get returnPickupDetail => 'Return pickup details';

  @override
  String get returnPickupCollected => 'Collected';

  @override
  String get returnPickupAccepted => 'Return pickup accepted.';

  @override
  String get returnPickupRejected => 'Return pickup rejected.';

  @override
  String get acceptReturnPickup => 'Accept return pickup';

  @override
  String get rejectReturnPickup => 'Reject return pickup';

  @override
  String get collectReturnPickup => 'Confirm collection';

  @override
  String get returnPickupNoteOptional => 'Collection note (optional)';

  @override
  String get returnPickupCollectedMessage =>
      'Return collected and sent to the seller for inspection.';

  @override
  String get returnPickupUpdateFailed =>
      'The return pickup could not be updated. Refresh and try again.';

  @override
  String get returnReason => 'Return reason';

  @override
  String get pickupAddress => 'Pickup address';

  @override
  String get appTitle => 'Vardhnam Partner';

  @override
  String get loginTitle => 'Partner sign in';

  @override
  String get phoneLabel => 'Mobile number';

  @override
  String get phoneHint => '+91 98765 43210';

  @override
  String get requestOtp => 'Request OTP';

  @override
  String get otpLabel => '6-digit OTP';

  @override
  String get verifyOtp => 'Verify and continue';

  @override
  String get changePhone => 'Change mobile number';

  @override
  String mockOtpNotice(String code) {
    return 'Development OTP: $code';
  }

  @override
  String get invalidPhone => 'Enter a valid Indian mobile number.';

  @override
  String get invalidOtp => 'Enter the 6-digit OTP.';

  @override
  String get authFailed => 'Sign-in could not be completed. Please try again.';

  @override
  String get rateLimited =>
      'Too many attempts. Please wait before trying again.';

  @override
  String get selectWorkspace => 'Select workspace';

  @override
  String get selectWorkspaceHelp =>
      'Choose the organisation and role you want to use now.';

  @override
  String get promoterRole => 'Promoter';

  @override
  String get salesPartnerRole => 'Sales partner';

  @override
  String get serviceProviderRole => 'Service provider';

  @override
  String get deliveryPartnerRole => 'Delivery partner';

  @override
  String welcomeRole(String role) {
    return '$role workspace';
  }

  @override
  String get promoterBoundary =>
      'Farmer and Kisan Club field workflows will appear here.';

  @override
  String get salesPartnerBoundary =>
      'Sales attribution and assisted-order workflows will appear here.';

  @override
  String get serviceProviderBoundary =>
      'Service availability and booking workflows will appear here.';

  @override
  String get deliveryPartnerBoundary =>
      'Delivery assignments and proof workflows will appear here.';

  @override
  String signedInOrganisation(String name) {
    return 'Organisation: $name';
  }

  @override
  String get language => 'Language';

  @override
  String get english => 'English';

  @override
  String get hindi => 'Hindi';

  @override
  String get logout => 'Sign out';

  @override
  String get kisanClub => 'Kisan Club';

  @override
  String get assignedFarmers => 'Assigned farmers';

  @override
  String get assignedFarmersHelp =>
      'Only farmers actively assigned to your Club profile are shown.';

  @override
  String get noAssignedFarmers => 'No active farmer assignments.';

  @override
  String memberNumber(String number) {
    return 'Member $number';
  }

  @override
  String farmerLocation(String village, String district, String pincode) {
    return '$village, $district · $pincode';
  }

  @override
  String farmCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count farms',
      one: '1 farm',
      zero: 'No farms',
    );
    return '$_temp0';
  }

  @override
  String farmArea(String area) {
    return '$area acres';
  }

  @override
  String cropSummary(String crop, String area, String status) {
    return '$crop · $area acres · $status';
  }

  @override
  String get inactiveFarm => 'Inactive farm';

  @override
  String get redeemBenefitToken => 'Redeem benefit token';

  @override
  String get benefitTokenCode => 'Benefit token code';

  @override
  String get benefitTokenHint => 'VKC-A1B2C3D4-123456';

  @override
  String get invalidBenefitToken =>
      'Enter the complete benefit token shown by the farmer.';

  @override
  String get confirmRedemption => 'Create assisted checkout';

  @override
  String get redemptionWarning =>
      'The backend will revalidate price, stock, serviceability and benefit. The farmer must complete payment in the farmer app.';

  @override
  String get redemptionSuccess => 'Assisted checkout created';

  @override
  String checkoutReference(String id) {
    return 'Checkout: $id';
  }

  @override
  String orderReference(String id) {
    return 'Seller order: $id';
  }

  @override
  String benefitAmount(String amount) {
    return 'Club benefit: ₹$amount';
  }

  @override
  String farmerPayable(String amount) {
    return 'Farmer payable: ₹$amount';
  }

  @override
  String get paymentStillRequired =>
      'Payment is still required in the farmer app.';

  @override
  String get loadFailed => 'Could not load this Club information.';

  @override
  String get tryAgain => 'Try again';

  @override
  String get fulfilmentAssignments => 'Club fulfilment';

  @override
  String get fulfilmentHelp =>
      'Coordination status is separate from the seller order and delivery status.';

  @override
  String get fulfilmentStatusFilter => 'Coordination status';

  @override
  String get allStatuses => 'All statuses';

  @override
  String get noFulfilmentAssignments => 'No matching Club assignments.';

  @override
  String get loadMore => 'Load more';

  @override
  String orderNumber(String number) {
    return 'Order $number';
  }

  @override
  String sellerName(String name) {
    return 'Seller: $name';
  }

  @override
  String sellerOrderStatus(String status) {
    return 'Seller order status: $status';
  }

  @override
  String coordinationStatus(String status) {
    return 'Coordination: $status';
  }

  @override
  String fulfilmentMode(String mode) {
    return 'Mode: $mode';
  }

  @override
  String get statusAssigned => 'Assigned';

  @override
  String get statusPromoterAccepted => 'Accepted';

  @override
  String get statusPromoterDeclined => 'Declined';

  @override
  String get statusProductReady => 'Product ready';

  @override
  String get statusFarmerContacted => 'Farmer contacted';

  @override
  String get statusReadyForPickup => 'Ready for pickup';

  @override
  String get statusOutForDelivery => 'Out for delivery';

  @override
  String get statusCompleted => 'Completed';

  @override
  String get statusFailed => 'Failed';

  @override
  String get statusReassigned => 'Reassigned';

  @override
  String get statusCancelled => 'Cancelled';

  @override
  String get actionAccept => 'Accept assignment';

  @override
  String get actionDecline => 'Decline assignment';

  @override
  String get actionProductReady => 'Mark product ready';

  @override
  String get actionFarmerContacted => 'Mark farmer contacted';

  @override
  String get actionReadyForPickup => 'Mark ready for pickup';

  @override
  String get actionOutForDelivery => 'Mark out for delivery';

  @override
  String get actionComplete => 'Complete coordination';

  @override
  String get actionFail => 'Mark coordination failed';

  @override
  String get confirmAction => 'Confirm action';

  @override
  String get cancelAction => 'Cancel';

  @override
  String get reasonLabel => 'Reason';

  @override
  String get reasonRequired => 'Enter at least 3 characters.';

  @override
  String get statusHistory => 'Coordination history';

  @override
  String historyItem(String status, String date) {
    return '$status · $date';
  }

  @override
  String get transitionFailed =>
      'The coordination status could not be updated. Refresh and try again.';

  @override
  String get recordFarmSurvey => 'Record farm survey';

  @override
  String get farmDetails => 'Farm details';

  @override
  String get farmName => 'Farm name';

  @override
  String get village => 'Village';

  @override
  String get district => 'District';

  @override
  String get state => 'State';

  @override
  String get pincode => 'Pincode';

  @override
  String get areaAcres => 'Area (acres)';

  @override
  String get ownershipType => 'Ownership type';

  @override
  String get irrigationSource => 'Irrigation source';

  @override
  String get notSpecified => 'Not specified';

  @override
  String get soilTypeOptional => 'Soil type (optional)';

  @override
  String get addCropCycle => 'Add current crop cycle';

  @override
  String get crop => 'Crop';

  @override
  String get varietyOptional => 'Variety (optional)';

  @override
  String get cropAreaAcres => 'Crop area (acres)';

  @override
  String get season => 'Season code';

  @override
  String get sowingDateOptional => 'Sowing date (YYYY-MM-DD, optional)';

  @override
  String get harvestDateOptional => 'Expected harvest (YYYY-MM-DD, optional)';

  @override
  String get locationNotCollected =>
      'Precise location is not collected in this survey.';

  @override
  String get submitFarmSurvey => 'Save farm survey';

  @override
  String get farmSurveyCreated =>
      'Farm survey saved and added to the farmer\'s record.';

  @override
  String get farmSurveyFailed =>
      'The farm survey could not be saved. Check the details and try again.';

  @override
  String get done => 'Done';

  @override
  String get requiredField => 'This field is required.';

  @override
  String get invalidPincode => 'Enter a 6-digit pincode.';

  @override
  String get invalidArea => 'Enter an area greater than zero.';

  @override
  String get invalidSeason =>
      'Use 2–40 letters, numbers, underscores or hyphens.';

  @override
  String get invalidDate => 'Use a valid date in YYYY-MM-DD format.';

  @override
  String get selectCropRequired => 'Select a crop.';

  @override
  String get cropAreaTooLarge => 'Crop area cannot exceed farm area.';

  @override
  String get ownershipOwned => 'Owned';

  @override
  String get ownershipLeased => 'Leased';

  @override
  String get ownershipSharecropped => 'Sharecropped';

  @override
  String get optionOther => 'Other';

  @override
  String get irrigationTubeWell => 'Tube well';

  @override
  String get irrigationCanal => 'Canal';

  @override
  String get irrigationRainFed => 'Rain-fed';

  @override
  String get irrigationPond => 'Pond';

  @override
  String get irrigationDrip => 'Drip';

  @override
  String get irrigationSprinkler => 'Sprinkler';

  @override
  String get earningsStatement => 'Earnings statement';

  @override
  String get earningsBackendNotice =>
      'Amounts and statuses come from the Vardhnam financial ledger. Provisional earnings are not yet payable.';

  @override
  String get payoutAccount => 'Payout account';

  @override
  String get noPayoutAccount =>
      'No payout account is configured. Account setup remains a separate verified workflow.';

  @override
  String ifsc(String code) {
    return 'IFSC: $code';
  }

  @override
  String payoutStatus(String status) {
    return 'Account status: $status';
  }

  @override
  String payoutRejectionReason(String reason) {
    return 'Review reason: $reason';
  }

  @override
  String get payoutPendingVerification => 'Pending verification';

  @override
  String get payoutVerified => 'Verified';

  @override
  String get payoutRejected => 'Rejected';

  @override
  String get earningsProvisional => 'Provisional';

  @override
  String get earningsFinal => 'Final';

  @override
  String get earningsReversed => 'Reversed';

  @override
  String get promoterCommission => 'Promoter commission';

  @override
  String get deliveryEarning => 'Delivery earning';

  @override
  String get earningsStatusFilter => 'Earning status';

  @override
  String get noEarnings => 'No matching earnings entries.';

  @override
  String eligibleOn(String date) {
    return 'Eligible on $date';
  }

  @override
  String get earningsLoadFailed =>
      'Your earnings statement could not be loaded.';

  @override
  String get payoutAccountLoadFailed =>
      'Your payout account status could not be loaded. Pull to refresh.';

  @override
  String get addPayoutAccount => 'Add payout account';

  @override
  String get editPayoutAccount => 'Edit payout account';

  @override
  String get managePayoutAccount => 'Manage payout account';

  @override
  String get payoutAccountPrivacyNotice =>
      'Your full bank account number is sent securely to Vardhnam and is never shown again in the app.';

  @override
  String get payoutAccountResubmissionNotice =>
      'Saving changes resets this account to pending verification. Enter the full account number again.';

  @override
  String get accountHolderName => 'Account holder name';

  @override
  String get bankName => 'Bank name';

  @override
  String get accountNumber => 'Account number';

  @override
  String get reenterAccountNumber =>
      'For security, re-enter the complete account number.';

  @override
  String get ifscCode => 'IFSC code';

  @override
  String get upiIdOptional => 'UPI ID (optional)';

  @override
  String get invalidAccountNumber => 'Enter a 6 to 20 digit account number.';

  @override
  String get invalidIfscCode => 'Enter a valid 11-character IFSC code.';

  @override
  String get fieldTooShort => 'This value is too short.';

  @override
  String get fieldTooLong => 'This value is too long.';

  @override
  String get submitForVerification => 'Submit for verification';

  @override
  String get payoutAccountSaved => 'Payout account submitted for verification.';

  @override
  String get payoutAccountSaveFailed =>
      'The payout account could not be saved. Check the details and try again.';

  @override
  String get farmerLeads => 'Farmer leads';

  @override
  String get captureLead => 'Capture lead';

  @override
  String get captureFarmerLead => 'Capture farmer lead';

  @override
  String get leadPipelineHelp =>
      'Only leads assigned to your promoter account are shown. Farmer registration and conversion are separate verified steps.';

  @override
  String get leadPrivacyNotice =>
      'Collect contact details only with the farmer\'s knowledge and use them only for authorised Vardhnam follow-up.';

  @override
  String get leadStatus => 'Lead status';

  @override
  String get leadNew => 'New';

  @override
  String get leadContacted => 'Contacted';

  @override
  String get leadConverted => 'Converted';

  @override
  String get leadLost => 'Lost';

  @override
  String get leadSource => 'Lead source';

  @override
  String get leadSourceFieldVisit => 'Field visit';

  @override
  String get leadSourceReferral => 'Referral';

  @override
  String get leadSourceCampaign => 'Campaign';

  @override
  String get leadSourceInbound => 'Inbound enquiry';

  @override
  String get leadOptionalDetails => 'Optional location, crops and notes';

  @override
  String get farmerName => 'Farmer name';

  @override
  String get phoneNumber => 'Phone number';

  @override
  String get invalidIndianPhone =>
      'Enter a valid 10-digit Indian mobile number.';

  @override
  String get pincodeOptional => 'Pincode (optional)';

  @override
  String get cropInterestsCommaSeparated => 'Crop interests (comma separated)';

  @override
  String get notesOptional => 'Notes (optional)';

  @override
  String get saveLead => 'Save lead';

  @override
  String get noFarmerLeads => 'No matching farmer leads.';

  @override
  String get leadsLoadFailed =>
      'Farmer leads could not be loaded. Pull to refresh.';

  @override
  String get leadCreateFailed =>
      'The lead could not be saved. Check for an existing open lead and try again.';

  @override
  String get markContacted => 'Mark contacted';

  @override
  String get markLeadLost => 'Mark lead lost';

  @override
  String get lossReason => 'Reason';

  @override
  String get leadUpdated => 'Lead status updated.';

  @override
  String get leadUpdateFailed => 'The lead status could not be updated.';

  @override
  String get convertFarmerLead => 'Convert farmer';

  @override
  String get convertFarmerLeadHelp =>
      'Ask the farmer to complete OTP registration in the farmer app first. Conversion links the verified farmer and assigns your promoter attribution.';

  @override
  String get confirmConversion => 'Confirm conversion';

  @override
  String get leadConvertedSuccess =>
      'The verified farmer was linked and the lead was converted.';

  @override
  String get leadConversionFailed =>
      'Conversion failed. Confirm that the farmer registered with this phone number and try again.';

  @override
  String get promoterVisits => 'Field visits';

  @override
  String get recordVisit => 'Record visit';

  @override
  String get visitPurpose => 'Visit purpose';

  @override
  String get visitPurposeLeadFollowUp => 'Lead follow-up';

  @override
  String get visitPurposeFarmerSupport => 'Farmer support';

  @override
  String get visitPurposeOrderAssistance => 'Order assistance';

  @override
  String get visitPurposeFarmSurvey => 'Farm survey';

  @override
  String get visitPurposeComplaintFollowUp => 'Complaint follow-up';

  @override
  String get visitNotes => 'Visit notes (optional)';

  @override
  String get includeVisitLocation => 'Include current location';

  @override
  String get includeVisitLocationHelp =>
      'Location is requested once when you save. It is never tracked in the background.';

  @override
  String get saveVisit => 'Save visit';

  @override
  String get visitRecorded => 'Visit recorded.';

  @override
  String get visitRecordFailed => 'The visit could not be recorded.';

  @override
  String get visitsLoadFailed => 'Field visits could not be loaded.';

  @override
  String get noPromoterVisits => 'No field visits recorded yet.';
}
