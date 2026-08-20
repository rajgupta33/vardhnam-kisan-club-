import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
  ];

  /// No description provided for @myTerritory.
  ///
  /// In en, this message translates to:
  /// **'My territory'**
  String get myTerritory;

  /// No description provided for @territoryLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Your territory could not be loaded. Try again.'**
  String get territoryLoadFailed;

  /// No description provided for @noTerritoryAssigned.
  ///
  /// In en, this message translates to:
  /// **'No territory is assigned to this organisation context. Contact operations if you expect an assignment.'**
  String get noTerritoryAssigned;

  /// No description provided for @territoryDistrict.
  ///
  /// In en, this message translates to:
  /// **'District: {district}'**
  String territoryDistrict(String district);

  /// No description provided for @territoryState.
  ///
  /// In en, this message translates to:
  /// **'State: {state}'**
  String territoryState(String state);

  /// No description provided for @territoryBlocks.
  ///
  /// In en, this message translates to:
  /// **'Blocks'**
  String get territoryBlocks;

  /// No description provided for @territoryPincodes.
  ///
  /// In en, this message translates to:
  /// **'Service pincodes'**
  String get territoryPincodes;

  /// No description provided for @territoryVillages.
  ///
  /// In en, this message translates to:
  /// **'Villages'**
  String get territoryVillages;

  /// No description provided for @territoryReadOnlyNotice.
  ///
  /// In en, this message translates to:
  /// **'Territory assignments are managed by authorised Vardhnam operations staff.'**
  String get territoryReadOnlyNotice;

  /// No description provided for @registerFarmerWithOtp.
  ///
  /// In en, this message translates to:
  /// **'Register with farmer OTP'**
  String get registerFarmerWithOtp;

  /// No description provided for @assistedOtpConsentNotice.
  ///
  /// In en, this message translates to:
  /// **'Ask the farmer for the OTP only while they are present and have agreed to registration. The promoter never receives the farmer\'s login session.'**
  String get assistedOtpConsentNotice;

  /// No description provided for @farmerOtpCode.
  ///
  /// In en, this message translates to:
  /// **'Farmer OTP code'**
  String get farmerOtpCode;

  /// No description provided for @verifyAndRegister.
  ///
  /// In en, this message translates to:
  /// **'Verify and register'**
  String get verifyAndRegister;

  /// No description provided for @mockOtpCode.
  ///
  /// In en, this message translates to:
  /// **'Mock OTP: {code}'**
  String mockOtpCode(String code);

  /// No description provided for @assistedOtpRequestFailed.
  ///
  /// In en, this message translates to:
  /// **'The registration OTP could not be requested. Check the lead status and try again.'**
  String get assistedOtpRequestFailed;

  /// No description provided for @assistedOtpVerificationFailed.
  ///
  /// In en, this message translates to:
  /// **'The OTP could not be verified. Check the code and try again.'**
  String get assistedOtpVerificationFailed;

  /// No description provided for @assistedRegistrationSuccess.
  ///
  /// In en, this message translates to:
  /// **'The farmer was OTP-verified, registered and linked to your lead.'**
  String get assistedRegistrationSuccess;

  /// No description provided for @deliveryLocationProofHelp.
  ///
  /// In en, this message translates to:
  /// **'After confirmation, the app will ask for location permission to record the delivery point. If permission or location is unavailable, OTP delivery can still continue.'**
  String get deliveryLocationProofHelp;

  /// No description provided for @deliveryAssignments.
  ///
  /// In en, this message translates to:
  /// **'My deliveries'**
  String get deliveryAssignments;

  /// No description provided for @deliveryAvailability.
  ///
  /// In en, this message translates to:
  /// **'Available for new deliveries'**
  String get deliveryAvailability;

  /// No description provided for @deliveryOnlineExplanation.
  ///
  /// In en, this message translates to:
  /// **'You are online. Operations can assign new deliveries to you.'**
  String get deliveryOnlineExplanation;

  /// No description provided for @deliveryOfflineExplanation.
  ///
  /// In en, this message translates to:
  /// **'You are offline. Operations cannot assign new deliveries to you.'**
  String get deliveryOfflineExplanation;

  /// No description provided for @deliveryNowOnline.
  ///
  /// In en, this message translates to:
  /// **'You are now available for delivery assignments.'**
  String get deliveryNowOnline;

  /// No description provided for @deliveryNowOffline.
  ///
  /// In en, this message translates to:
  /// **'You are now offline for new delivery assignments.'**
  String get deliveryNowOffline;

  /// No description provided for @deliveryAvailabilityLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Availability could not be loaded.'**
  String get deliveryAvailabilityLoadFailed;

  /// No description provided for @deliveryAvailabilityUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'Availability could not be updated. Try again.'**
  String get deliveryAvailabilityUpdateFailed;

  /// No description provided for @deliveryAssignmentsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Your delivery assignments could not be loaded.'**
  String get deliveryAssignmentsLoadFailed;

  /// No description provided for @noDeliveryAssignments.
  ///
  /// In en, this message translates to:
  /// **'No delivery assignments are currently assigned to you.'**
  String get noDeliveryAssignments;

  /// No description provided for @deliveryAssignmentDetail.
  ///
  /// In en, this message translates to:
  /// **'Delivery details'**
  String get deliveryAssignmentDetail;

  /// No description provided for @deliveryAssignmentNumber.
  ///
  /// In en, this message translates to:
  /// **'Assignment: {number}'**
  String deliveryAssignmentNumber(String number);

  /// No description provided for @deliveryAssignmentStatus.
  ///
  /// In en, this message translates to:
  /// **'Delivery status: {status}'**
  String deliveryAssignmentStatus(String status);

  /// No description provided for @deliveryStatusAssigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned'**
  String get deliveryStatusAssigned;

  /// No description provided for @deliveryStatusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get deliveryStatusAccepted;

  /// No description provided for @deliveryStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get deliveryStatusRejected;

  /// No description provided for @deliveryStatusDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get deliveryStatusDelivered;

  /// No description provided for @deliveryStatusFailed.
  ///
  /// In en, this message translates to:
  /// **'Delivery failed'**
  String get deliveryStatusFailed;

  /// No description provided for @dispatchNumber.
  ///
  /// In en, this message translates to:
  /// **'Dispatch: {number}'**
  String dispatchNumber(String number);

  /// No description provided for @invoiceNumber.
  ///
  /// In en, this message translates to:
  /// **'Invoice: {number}'**
  String invoiceNumber(String number);

  /// No description provided for @deliveryAddress.
  ///
  /// In en, this message translates to:
  /// **'Delivery address'**
  String get deliveryAddress;

  /// No description provided for @farmerPhone.
  ///
  /// In en, this message translates to:
  /// **'Farmer phone: {phone}'**
  String farmerPhone(String phone);

  /// No description provided for @packageItems.
  ///
  /// In en, this message translates to:
  /// **'Package items'**
  String get packageItems;

  /// No description provided for @itemQuantity.
  ///
  /// In en, this message translates to:
  /// **'Qty {quantity}'**
  String itemQuantity(int quantity);

  /// No description provided for @startDelivery.
  ///
  /// In en, this message translates to:
  /// **'Package collected — start delivery'**
  String get startDelivery;

  /// No description provided for @acceptDeliveryAssignment.
  ///
  /// In en, this message translates to:
  /// **'Accept assignment'**
  String get acceptDeliveryAssignment;

  /// No description provided for @rejectDeliveryAssignment.
  ///
  /// In en, this message translates to:
  /// **'Reject assignment'**
  String get rejectDeliveryAssignment;

  /// No description provided for @deliveryAssignmentAccepted.
  ///
  /// In en, this message translates to:
  /// **'Delivery assignment accepted.'**
  String get deliveryAssignmentAccepted;

  /// No description provided for @deliveryAssignmentRejected.
  ///
  /// In en, this message translates to:
  /// **'Delivery assignment rejected. Operations can now reassign it.'**
  String get deliveryAssignmentRejected;

  /// No description provided for @scanPackageQr.
  ///
  /// In en, this message translates to:
  /// **'Scan package QR'**
  String get scanPackageQr;

  /// No description provided for @scanPackageQrHelp.
  ///
  /// In en, this message translates to:
  /// **'Scan the QR label attached by the seller. Camera access is used only while this screen is open.'**
  String get scanPackageQrHelp;

  /// No description provided for @enterPackageCodeManually.
  ///
  /// In en, this message translates to:
  /// **'Enter package code manually'**
  String get enterPackageCodeManually;

  /// No description provided for @packageCode.
  ///
  /// In en, this message translates to:
  /// **'Package code'**
  String get packageCode;

  /// No description provided for @packageCodeRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the complete package code.'**
  String get packageCodeRequired;

  /// No description provided for @verifyPackagePickup.
  ///
  /// In en, this message translates to:
  /// **'Verify pickup'**
  String get verifyPackagePickup;

  /// No description provided for @packagePickupVerified.
  ///
  /// In en, this message translates to:
  /// **'Package pickup verified.'**
  String get packagePickupVerified;

  /// No description provided for @packagePickupVerificationFailed.
  ///
  /// In en, this message translates to:
  /// **'The package code did not match. Check the label and try again.'**
  String get packagePickupVerificationFailed;

  /// No description provided for @openNavigation.
  ///
  /// In en, this message translates to:
  /// **'Navigate'**
  String get openNavigation;

  /// No description provided for @callFarmer.
  ///
  /// In en, this message translates to:
  /// **'Call farmer'**
  String get callFarmer;

  /// No description provided for @externalAppOpenFailed.
  ///
  /// In en, this message translates to:
  /// **'No supported app could open this action.'**
  String get externalAppOpenFailed;

  /// No description provided for @deliveryRejectionReason.
  ///
  /// In en, this message translates to:
  /// **'Reason for rejection'**
  String get deliveryRejectionReason;

  /// No description provided for @deliveryRejectionReasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a reason so operations can reassign this delivery.'**
  String get deliveryRejectionReasonRequired;

  /// No description provided for @deliveryStarted.
  ///
  /// In en, this message translates to:
  /// **'Delivery marked out for delivery.'**
  String get deliveryStarted;

  /// No description provided for @completeDelivery.
  ///
  /// In en, this message translates to:
  /// **'Verify OTP and complete'**
  String get completeDelivery;

  /// No description provided for @deliveryOtp.
  ///
  /// In en, this message translates to:
  /// **'6-digit delivery OTP'**
  String get deliveryOtp;

  /// No description provided for @deliveryOtpInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit OTP.'**
  String get deliveryOtpInvalid;

  /// No description provided for @deliveryOtpHelp.
  ///
  /// In en, this message translates to:
  /// **'Ask the farmer for the delivery OTP. Completion is recorded only after the backend verifies it.'**
  String get deliveryOtpHelp;

  /// No description provided for @deliveryProofNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Delivery note (optional)'**
  String get deliveryProofNoteOptional;

  /// No description provided for @deliveryCompleted.
  ///
  /// In en, this message translates to:
  /// **'Delivery completed and verified.'**
  String get deliveryCompleted;

  /// No description provided for @deliveryCompletedWithLocation.
  ///
  /// In en, this message translates to:
  /// **'Delivery completed. OTP and delivery location were recorded.'**
  String get deliveryCompletedWithLocation;

  /// No description provided for @deliveryCompletedLocationDenied.
  ///
  /// In en, this message translates to:
  /// **'Delivery completed with OTP. Location permission was denied and that outcome was recorded.'**
  String get deliveryCompletedLocationDenied;

  /// No description provided for @deliveryCompletedLocationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Delivery completed with OTP. Device location was unavailable and that outcome was recorded.'**
  String get deliveryCompletedLocationUnavailable;

  /// No description provided for @deliveryUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'The delivery could not be updated. Refresh and try again.'**
  String get deliveryUpdateFailed;

  /// No description provided for @deliveryOtpFailed.
  ///
  /// In en, this message translates to:
  /// **'The OTP could not be verified. Check it with the farmer and try again.'**
  String get deliveryOtpFailed;

  /// No description provided for @deliveryOtpExpiryNotice.
  ///
  /// In en, this message translates to:
  /// **'The OTP has a backend-controlled expiry and attempt limit.'**
  String get deliveryOtpExpiryNotice;

  /// No description provided for @deliveryLocationProof.
  ///
  /// In en, this message translates to:
  /// **'Delivery location proof'**
  String get deliveryLocationProof;

  /// No description provided for @deliveryLocationRecorded.
  ///
  /// In en, this message translates to:
  /// **'Location recorded (device accuracy: {accuracy} m).'**
  String deliveryLocationRecorded(String accuracy);

  /// No description provided for @deliveryLocationPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Location permission was denied. OTP completion was not blocked.'**
  String get deliveryLocationPermissionDenied;

  /// No description provided for @deliveryLocationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Device location was unavailable. OTP completion was not blocked.'**
  String get deliveryLocationUnavailable;

  /// No description provided for @deliveryLocationNotRecorded.
  ///
  /// In en, this message translates to:
  /// **'No location outcome is stored for this earlier delivery.'**
  String get deliveryLocationNotRecorded;

  /// No description provided for @deliveryPhotoProofDeferred.
  ///
  /// In en, this message translates to:
  /// **'Photo proof remains unavailable until authorised private evidence storage is enabled.'**
  String get deliveryPhotoProofDeferred;

  /// No description provided for @markDeliveryFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not deliver'**
  String get markDeliveryFailed;

  /// No description provided for @deliveryFailureTitle.
  ///
  /// In en, this message translates to:
  /// **'Record failed delivery'**
  String get deliveryFailureTitle;

  /// No description provided for @deliveryFailureReason.
  ///
  /// In en, this message translates to:
  /// **'Failure reason'**
  String get deliveryFailureReason;

  /// No description provided for @deliveryFailureNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Details (optional)'**
  String get deliveryFailureNoteOptional;

  /// No description provided for @deliveryRetryAt.
  ///
  /// In en, this message translates to:
  /// **'Retry on {date}'**
  String deliveryRetryAt(String date);

  /// No description provided for @chooseRetryDate.
  ///
  /// In en, this message translates to:
  /// **'Choose retry date'**
  String get chooseRetryDate;

  /// No description provided for @chooseRetryTime.
  ///
  /// In en, this message translates to:
  /// **'Choose retry time'**
  String get chooseRetryTime;

  /// No description provided for @deliveryRetryFutureRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose a retry time in the future.'**
  String get deliveryRetryFutureRequired;

  /// No description provided for @deliveryFailureRecorded.
  ///
  /// In en, this message translates to:
  /// **'Failed attempt recorded. The retry is scheduled.'**
  String get deliveryFailureRecorded;

  /// No description provided for @retryDeliveryNow.
  ///
  /// In en, this message translates to:
  /// **'Start scheduled retry'**
  String get retryDeliveryNow;

  /// No description provided for @retryNotDue.
  ///
  /// In en, this message translates to:
  /// **'The retry can start at the scheduled time.'**
  String get retryNotDue;

  /// No description provided for @deliveryRetryStarted.
  ///
  /// In en, this message translates to:
  /// **'Delivery retry started with a fresh OTP.'**
  String get deliveryRetryStarted;

  /// No description provided for @deliveryFailureAttemptCount.
  ///
  /// In en, this message translates to:
  /// **'Failed attempts: {count}'**
  String deliveryFailureAttemptCount(int count);

  /// No description provided for @deliveryFailureFarmerUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Farmer unavailable'**
  String get deliveryFailureFarmerUnavailable;

  /// No description provided for @deliveryFailureFarmerRefused.
  ///
  /// In en, this message translates to:
  /// **'Farmer refused delivery'**
  String get deliveryFailureFarmerRefused;

  /// No description provided for @deliveryFailureAddressNotFound.
  ///
  /// In en, this message translates to:
  /// **'Address not found'**
  String get deliveryFailureAddressNotFound;

  /// No description provided for @deliveryFailureAccessRestricted.
  ///
  /// In en, this message translates to:
  /// **'Access restricted'**
  String get deliveryFailureAccessRestricted;

  /// No description provided for @deliveryFailureVehicleBreakdown.
  ///
  /// In en, this message translates to:
  /// **'Vehicle breakdown'**
  String get deliveryFailureVehicleBreakdown;

  /// No description provided for @deliveryFailureWeatherRoute.
  ///
  /// In en, this message translates to:
  /// **'Weather or route blocked'**
  String get deliveryFailureWeatherRoute;

  /// No description provided for @deliveryFailurePackageDamaged.
  ///
  /// In en, this message translates to:
  /// **'Package damaged'**
  String get deliveryFailurePackageDamaged;

  /// No description provided for @deliveryFailureOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get deliveryFailureOther;

  /// No description provided for @returnPickups.
  ///
  /// In en, this message translates to:
  /// **'Return pickups'**
  String get returnPickups;

  /// No description provided for @returnPickupsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Your return pickup assignments could not be loaded.'**
  String get returnPickupsLoadFailed;

  /// No description provided for @noReturnPickups.
  ///
  /// In en, this message translates to:
  /// **'No return pickups are assigned to you.'**
  String get noReturnPickups;

  /// No description provided for @returnPickupDetail.
  ///
  /// In en, this message translates to:
  /// **'Return pickup details'**
  String get returnPickupDetail;

  /// No description provided for @returnPickupCollected.
  ///
  /// In en, this message translates to:
  /// **'Collected'**
  String get returnPickupCollected;

  /// No description provided for @returnPickupAccepted.
  ///
  /// In en, this message translates to:
  /// **'Return pickup accepted.'**
  String get returnPickupAccepted;

  /// No description provided for @returnPickupRejected.
  ///
  /// In en, this message translates to:
  /// **'Return pickup rejected.'**
  String get returnPickupRejected;

  /// No description provided for @acceptReturnPickup.
  ///
  /// In en, this message translates to:
  /// **'Accept return pickup'**
  String get acceptReturnPickup;

  /// No description provided for @rejectReturnPickup.
  ///
  /// In en, this message translates to:
  /// **'Reject return pickup'**
  String get rejectReturnPickup;

  /// No description provided for @collectReturnPickup.
  ///
  /// In en, this message translates to:
  /// **'Confirm collection'**
  String get collectReturnPickup;

  /// No description provided for @returnPickupNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Collection note (optional)'**
  String get returnPickupNoteOptional;

  /// No description provided for @returnPickupCollectedMessage.
  ///
  /// In en, this message translates to:
  /// **'Return collected and sent to the seller for inspection.'**
  String get returnPickupCollectedMessage;

  /// No description provided for @returnPickupUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'The return pickup could not be updated. Refresh and try again.'**
  String get returnPickupUpdateFailed;

  /// No description provided for @returnReason.
  ///
  /// In en, this message translates to:
  /// **'Return reason'**
  String get returnReason;

  /// No description provided for @pickupAddress.
  ///
  /// In en, this message translates to:
  /// **'Pickup address'**
  String get pickupAddress;

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Vardhnam Partner'**
  String get appTitle;

  /// No description provided for @loginTitle.
  ///
  /// In en, this message translates to:
  /// **'Partner sign in'**
  String get loginTitle;

  /// No description provided for @phoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get phoneLabel;

  /// No description provided for @phoneHint.
  ///
  /// In en, this message translates to:
  /// **'+91 98765 43210'**
  String get phoneHint;

  /// No description provided for @requestOtp.
  ///
  /// In en, this message translates to:
  /// **'Request OTP'**
  String get requestOtp;

  /// No description provided for @otpLabel.
  ///
  /// In en, this message translates to:
  /// **'6-digit OTP'**
  String get otpLabel;

  /// No description provided for @verifyOtp.
  ///
  /// In en, this message translates to:
  /// **'Verify and continue'**
  String get verifyOtp;

  /// No description provided for @changePhone.
  ///
  /// In en, this message translates to:
  /// **'Change mobile number'**
  String get changePhone;

  /// No description provided for @mockOtpNotice.
  ///
  /// In en, this message translates to:
  /// **'Development OTP: {code}'**
  String mockOtpNotice(String code);

  /// No description provided for @invalidPhone.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid Indian mobile number.'**
  String get invalidPhone;

  /// No description provided for @invalidOtp.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit OTP.'**
  String get invalidOtp;

  /// No description provided for @authFailed.
  ///
  /// In en, this message translates to:
  /// **'Sign-in could not be completed. Please try again.'**
  String get authFailed;

  /// No description provided for @rateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait before trying again.'**
  String get rateLimited;

  /// No description provided for @selectWorkspace.
  ///
  /// In en, this message translates to:
  /// **'Select workspace'**
  String get selectWorkspace;

  /// No description provided for @selectWorkspaceHelp.
  ///
  /// In en, this message translates to:
  /// **'Choose the organisation and role you want to use now.'**
  String get selectWorkspaceHelp;

  /// No description provided for @promoterRole.
  ///
  /// In en, this message translates to:
  /// **'Promoter'**
  String get promoterRole;

  /// No description provided for @salesPartnerRole.
  ///
  /// In en, this message translates to:
  /// **'Sales partner'**
  String get salesPartnerRole;

  /// No description provided for @serviceProviderRole.
  ///
  /// In en, this message translates to:
  /// **'Service provider'**
  String get serviceProviderRole;

  /// No description provided for @deliveryPartnerRole.
  ///
  /// In en, this message translates to:
  /// **'Delivery partner'**
  String get deliveryPartnerRole;

  /// No description provided for @welcomeRole.
  ///
  /// In en, this message translates to:
  /// **'{role} workspace'**
  String welcomeRole(String role);

  /// No description provided for @promoterBoundary.
  ///
  /// In en, this message translates to:
  /// **'Farmer and Kisan Club field workflows will appear here.'**
  String get promoterBoundary;

  /// No description provided for @salesPartnerBoundary.
  ///
  /// In en, this message translates to:
  /// **'Sales attribution and assisted-order workflows will appear here.'**
  String get salesPartnerBoundary;

  /// No description provided for @serviceProviderBoundary.
  ///
  /// In en, this message translates to:
  /// **'Service availability and booking workflows will appear here.'**
  String get serviceProviderBoundary;

  /// No description provided for @deliveryPartnerBoundary.
  ///
  /// In en, this message translates to:
  /// **'Delivery assignments and proof workflows will appear here.'**
  String get deliveryPartnerBoundary;

  /// No description provided for @signedInOrganisation.
  ///
  /// In en, this message translates to:
  /// **'Organisation: {name}'**
  String signedInOrganisation(String name);

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @english.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get english;

  /// No description provided for @hindi.
  ///
  /// In en, this message translates to:
  /// **'Hindi'**
  String get hindi;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get logout;

  /// No description provided for @kisanClub.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club'**
  String get kisanClub;

  /// No description provided for @assignedFarmers.
  ///
  /// In en, this message translates to:
  /// **'Assigned farmers'**
  String get assignedFarmers;

  /// No description provided for @assignedFarmersHelp.
  ///
  /// In en, this message translates to:
  /// **'Only farmers actively assigned to your Club profile are shown.'**
  String get assignedFarmersHelp;

  /// No description provided for @noAssignedFarmers.
  ///
  /// In en, this message translates to:
  /// **'No active farmer assignments.'**
  String get noAssignedFarmers;

  /// No description provided for @memberNumber.
  ///
  /// In en, this message translates to:
  /// **'Member {number}'**
  String memberNumber(String number);

  /// No description provided for @farmerLocation.
  ///
  /// In en, this message translates to:
  /// **'{village}, {district} · {pincode}'**
  String farmerLocation(String village, String district, String pincode);

  /// No description provided for @farmCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No farms} =1{1 farm} other{{count} farms}}'**
  String farmCount(int count);

  /// No description provided for @farmArea.
  ///
  /// In en, this message translates to:
  /// **'{area} acres'**
  String farmArea(String area);

  /// No description provided for @cropSummary.
  ///
  /// In en, this message translates to:
  /// **'{crop} · {area} acres · {status}'**
  String cropSummary(String crop, String area, String status);

  /// No description provided for @inactiveFarm.
  ///
  /// In en, this message translates to:
  /// **'Inactive farm'**
  String get inactiveFarm;

  /// No description provided for @redeemBenefitToken.
  ///
  /// In en, this message translates to:
  /// **'Redeem benefit token'**
  String get redeemBenefitToken;

  /// No description provided for @benefitTokenCode.
  ///
  /// In en, this message translates to:
  /// **'Benefit token code'**
  String get benefitTokenCode;

  /// No description provided for @benefitTokenHint.
  ///
  /// In en, this message translates to:
  /// **'VKC-A1B2C3D4-123456'**
  String get benefitTokenHint;

  /// No description provided for @invalidBenefitToken.
  ///
  /// In en, this message translates to:
  /// **'Enter the complete benefit token shown by the farmer.'**
  String get invalidBenefitToken;

  /// No description provided for @confirmRedemption.
  ///
  /// In en, this message translates to:
  /// **'Create assisted checkout'**
  String get confirmRedemption;

  /// No description provided for @redemptionWarning.
  ///
  /// In en, this message translates to:
  /// **'The backend will revalidate price, stock, serviceability and benefit. The farmer must complete payment in the farmer app.'**
  String get redemptionWarning;

  /// No description provided for @redemptionSuccess.
  ///
  /// In en, this message translates to:
  /// **'Assisted checkout created'**
  String get redemptionSuccess;

  /// No description provided for @checkoutReference.
  ///
  /// In en, this message translates to:
  /// **'Checkout: {id}'**
  String checkoutReference(String id);

  /// No description provided for @orderReference.
  ///
  /// In en, this message translates to:
  /// **'Seller order: {id}'**
  String orderReference(String id);

  /// No description provided for @benefitAmount.
  ///
  /// In en, this message translates to:
  /// **'Club benefit: ₹{amount}'**
  String benefitAmount(String amount);

  /// No description provided for @farmerPayable.
  ///
  /// In en, this message translates to:
  /// **'Farmer payable: ₹{amount}'**
  String farmerPayable(String amount);

  /// No description provided for @paymentStillRequired.
  ///
  /// In en, this message translates to:
  /// **'Payment is still required in the farmer app.'**
  String get paymentStillRequired;

  /// No description provided for @loadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load this Club information.'**
  String get loadFailed;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get tryAgain;

  /// No description provided for @fulfilmentAssignments.
  ///
  /// In en, this message translates to:
  /// **'Club fulfilment'**
  String get fulfilmentAssignments;

  /// No description provided for @fulfilmentHelp.
  ///
  /// In en, this message translates to:
  /// **'Coordination status is separate from the seller order and delivery status.'**
  String get fulfilmentHelp;

  /// No description provided for @fulfilmentStatusFilter.
  ///
  /// In en, this message translates to:
  /// **'Coordination status'**
  String get fulfilmentStatusFilter;

  /// No description provided for @allStatuses.
  ///
  /// In en, this message translates to:
  /// **'All statuses'**
  String get allStatuses;

  /// No description provided for @noFulfilmentAssignments.
  ///
  /// In en, this message translates to:
  /// **'No matching Club assignments.'**
  String get noFulfilmentAssignments;

  /// No description provided for @loadMore.
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get loadMore;

  /// No description provided for @orderNumber.
  ///
  /// In en, this message translates to:
  /// **'Order {number}'**
  String orderNumber(String number);

  /// No description provided for @sellerName.
  ///
  /// In en, this message translates to:
  /// **'Seller: {name}'**
  String sellerName(String name);

  /// No description provided for @sellerOrderStatus.
  ///
  /// In en, this message translates to:
  /// **'Seller order status: {status}'**
  String sellerOrderStatus(String status);

  /// No description provided for @coordinationStatus.
  ///
  /// In en, this message translates to:
  /// **'Coordination: {status}'**
  String coordinationStatus(String status);

  /// No description provided for @fulfilmentMode.
  ///
  /// In en, this message translates to:
  /// **'Mode: {mode}'**
  String fulfilmentMode(String mode);

  /// No description provided for @statusAssigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned'**
  String get statusAssigned;

  /// No description provided for @statusPromoterAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get statusPromoterAccepted;

  /// No description provided for @statusPromoterDeclined.
  ///
  /// In en, this message translates to:
  /// **'Declined'**
  String get statusPromoterDeclined;

  /// No description provided for @statusProductReady.
  ///
  /// In en, this message translates to:
  /// **'Product ready'**
  String get statusProductReady;

  /// No description provided for @statusFarmerContacted.
  ///
  /// In en, this message translates to:
  /// **'Farmer contacted'**
  String get statusFarmerContacted;

  /// No description provided for @statusReadyForPickup.
  ///
  /// In en, this message translates to:
  /// **'Ready for pickup'**
  String get statusReadyForPickup;

  /// No description provided for @statusOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Out for delivery'**
  String get statusOutForDelivery;

  /// No description provided for @statusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get statusCompleted;

  /// No description provided for @statusFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get statusFailed;

  /// No description provided for @statusReassigned.
  ///
  /// In en, this message translates to:
  /// **'Reassigned'**
  String get statusReassigned;

  /// No description provided for @statusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get statusCancelled;

  /// No description provided for @actionAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept assignment'**
  String get actionAccept;

  /// No description provided for @actionDecline.
  ///
  /// In en, this message translates to:
  /// **'Decline assignment'**
  String get actionDecline;

  /// No description provided for @actionProductReady.
  ///
  /// In en, this message translates to:
  /// **'Mark product ready'**
  String get actionProductReady;

  /// No description provided for @actionFarmerContacted.
  ///
  /// In en, this message translates to:
  /// **'Mark farmer contacted'**
  String get actionFarmerContacted;

  /// No description provided for @actionReadyForPickup.
  ///
  /// In en, this message translates to:
  /// **'Mark ready for pickup'**
  String get actionReadyForPickup;

  /// No description provided for @actionOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Mark out for delivery'**
  String get actionOutForDelivery;

  /// No description provided for @actionComplete.
  ///
  /// In en, this message translates to:
  /// **'Complete coordination'**
  String get actionComplete;

  /// No description provided for @actionFail.
  ///
  /// In en, this message translates to:
  /// **'Mark coordination failed'**
  String get actionFail;

  /// No description provided for @confirmAction.
  ///
  /// In en, this message translates to:
  /// **'Confirm action'**
  String get confirmAction;

  /// No description provided for @cancelAction.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelAction;

  /// No description provided for @reasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get reasonLabel;

  /// No description provided for @reasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter at least 3 characters.'**
  String get reasonRequired;

  /// No description provided for @statusHistory.
  ///
  /// In en, this message translates to:
  /// **'Coordination history'**
  String get statusHistory;

  /// No description provided for @historyItem.
  ///
  /// In en, this message translates to:
  /// **'{status} · {date}'**
  String historyItem(String status, String date);

  /// No description provided for @transitionFailed.
  ///
  /// In en, this message translates to:
  /// **'The coordination status could not be updated. Refresh and try again.'**
  String get transitionFailed;

  /// No description provided for @recordFarmSurvey.
  ///
  /// In en, this message translates to:
  /// **'Record farm survey'**
  String get recordFarmSurvey;

  /// No description provided for @farmDetails.
  ///
  /// In en, this message translates to:
  /// **'Farm details'**
  String get farmDetails;

  /// No description provided for @farmName.
  ///
  /// In en, this message translates to:
  /// **'Farm name'**
  String get farmName;

  /// No description provided for @village.
  ///
  /// In en, this message translates to:
  /// **'Village'**
  String get village;

  /// No description provided for @district.
  ///
  /// In en, this message translates to:
  /// **'District'**
  String get district;

  /// No description provided for @state.
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get state;

  /// No description provided for @pincode.
  ///
  /// In en, this message translates to:
  /// **'Pincode'**
  String get pincode;

  /// No description provided for @areaAcres.
  ///
  /// In en, this message translates to:
  /// **'Area (acres)'**
  String get areaAcres;

  /// No description provided for @ownershipType.
  ///
  /// In en, this message translates to:
  /// **'Ownership type'**
  String get ownershipType;

  /// No description provided for @irrigationSource.
  ///
  /// In en, this message translates to:
  /// **'Irrigation source'**
  String get irrigationSource;

  /// No description provided for @notSpecified.
  ///
  /// In en, this message translates to:
  /// **'Not specified'**
  String get notSpecified;

  /// No description provided for @soilTypeOptional.
  ///
  /// In en, this message translates to:
  /// **'Soil type (optional)'**
  String get soilTypeOptional;

  /// No description provided for @addCropCycle.
  ///
  /// In en, this message translates to:
  /// **'Add current crop cycle'**
  String get addCropCycle;

  /// No description provided for @crop.
  ///
  /// In en, this message translates to:
  /// **'Crop'**
  String get crop;

  /// No description provided for @varietyOptional.
  ///
  /// In en, this message translates to:
  /// **'Variety (optional)'**
  String get varietyOptional;

  /// No description provided for @cropAreaAcres.
  ///
  /// In en, this message translates to:
  /// **'Crop area (acres)'**
  String get cropAreaAcres;

  /// No description provided for @season.
  ///
  /// In en, this message translates to:
  /// **'Season code'**
  String get season;

  /// No description provided for @sowingDateOptional.
  ///
  /// In en, this message translates to:
  /// **'Sowing date (YYYY-MM-DD, optional)'**
  String get sowingDateOptional;

  /// No description provided for @harvestDateOptional.
  ///
  /// In en, this message translates to:
  /// **'Expected harvest (YYYY-MM-DD, optional)'**
  String get harvestDateOptional;

  /// No description provided for @locationNotCollected.
  ///
  /// In en, this message translates to:
  /// **'Precise location is not collected in this survey.'**
  String get locationNotCollected;

  /// No description provided for @submitFarmSurvey.
  ///
  /// In en, this message translates to:
  /// **'Save farm survey'**
  String get submitFarmSurvey;

  /// No description provided for @farmSurveyCreated.
  ///
  /// In en, this message translates to:
  /// **'Farm survey saved and added to the farmer\'s record.'**
  String get farmSurveyCreated;

  /// No description provided for @farmSurveyFailed.
  ///
  /// In en, this message translates to:
  /// **'The farm survey could not be saved. Check the details and try again.'**
  String get farmSurveyFailed;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @requiredField.
  ///
  /// In en, this message translates to:
  /// **'This field is required.'**
  String get requiredField;

  /// No description provided for @invalidPincode.
  ///
  /// In en, this message translates to:
  /// **'Enter a 6-digit pincode.'**
  String get invalidPincode;

  /// No description provided for @invalidArea.
  ///
  /// In en, this message translates to:
  /// **'Enter an area greater than zero.'**
  String get invalidArea;

  /// No description provided for @invalidSeason.
  ///
  /// In en, this message translates to:
  /// **'Use 2–40 letters, numbers, underscores or hyphens.'**
  String get invalidSeason;

  /// No description provided for @invalidDate.
  ///
  /// In en, this message translates to:
  /// **'Use a valid date in YYYY-MM-DD format.'**
  String get invalidDate;

  /// No description provided for @selectCropRequired.
  ///
  /// In en, this message translates to:
  /// **'Select a crop.'**
  String get selectCropRequired;

  /// No description provided for @cropAreaTooLarge.
  ///
  /// In en, this message translates to:
  /// **'Crop area cannot exceed farm area.'**
  String get cropAreaTooLarge;

  /// No description provided for @ownershipOwned.
  ///
  /// In en, this message translates to:
  /// **'Owned'**
  String get ownershipOwned;

  /// No description provided for @ownershipLeased.
  ///
  /// In en, this message translates to:
  /// **'Leased'**
  String get ownershipLeased;

  /// No description provided for @ownershipSharecropped.
  ///
  /// In en, this message translates to:
  /// **'Sharecropped'**
  String get ownershipSharecropped;

  /// No description provided for @optionOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get optionOther;

  /// No description provided for @irrigationTubeWell.
  ///
  /// In en, this message translates to:
  /// **'Tube well'**
  String get irrigationTubeWell;

  /// No description provided for @irrigationCanal.
  ///
  /// In en, this message translates to:
  /// **'Canal'**
  String get irrigationCanal;

  /// No description provided for @irrigationRainFed.
  ///
  /// In en, this message translates to:
  /// **'Rain-fed'**
  String get irrigationRainFed;

  /// No description provided for @irrigationPond.
  ///
  /// In en, this message translates to:
  /// **'Pond'**
  String get irrigationPond;

  /// No description provided for @irrigationDrip.
  ///
  /// In en, this message translates to:
  /// **'Drip'**
  String get irrigationDrip;

  /// No description provided for @irrigationSprinkler.
  ///
  /// In en, this message translates to:
  /// **'Sprinkler'**
  String get irrigationSprinkler;

  /// No description provided for @earningsStatement.
  ///
  /// In en, this message translates to:
  /// **'Earnings statement'**
  String get earningsStatement;

  /// No description provided for @earningsBackendNotice.
  ///
  /// In en, this message translates to:
  /// **'Amounts and statuses come from the Vardhnam financial ledger. Provisional earnings are not yet payable.'**
  String get earningsBackendNotice;

  /// No description provided for @payoutAccount.
  ///
  /// In en, this message translates to:
  /// **'Payout account'**
  String get payoutAccount;

  /// No description provided for @noPayoutAccount.
  ///
  /// In en, this message translates to:
  /// **'No payout account is configured. Account setup remains a separate verified workflow.'**
  String get noPayoutAccount;

  /// No description provided for @ifsc.
  ///
  /// In en, this message translates to:
  /// **'IFSC: {code}'**
  String ifsc(String code);

  /// No description provided for @payoutStatus.
  ///
  /// In en, this message translates to:
  /// **'Account status: {status}'**
  String payoutStatus(String status);

  /// No description provided for @payoutRejectionReason.
  ///
  /// In en, this message translates to:
  /// **'Review reason: {reason}'**
  String payoutRejectionReason(String reason);

  /// No description provided for @payoutPendingVerification.
  ///
  /// In en, this message translates to:
  /// **'Pending verification'**
  String get payoutPendingVerification;

  /// No description provided for @payoutVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get payoutVerified;

  /// No description provided for @payoutRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get payoutRejected;

  /// No description provided for @earningsProvisional.
  ///
  /// In en, this message translates to:
  /// **'Provisional'**
  String get earningsProvisional;

  /// No description provided for @earningsFinal.
  ///
  /// In en, this message translates to:
  /// **'Final'**
  String get earningsFinal;

  /// No description provided for @earningsReversed.
  ///
  /// In en, this message translates to:
  /// **'Reversed'**
  String get earningsReversed;

  /// No description provided for @promoterCommission.
  ///
  /// In en, this message translates to:
  /// **'Promoter commission'**
  String get promoterCommission;

  /// No description provided for @deliveryEarning.
  ///
  /// In en, this message translates to:
  /// **'Delivery earning'**
  String get deliveryEarning;

  /// No description provided for @earningsStatusFilter.
  ///
  /// In en, this message translates to:
  /// **'Earning status'**
  String get earningsStatusFilter;

  /// No description provided for @noEarnings.
  ///
  /// In en, this message translates to:
  /// **'No matching earnings entries.'**
  String get noEarnings;

  /// No description provided for @eligibleOn.
  ///
  /// In en, this message translates to:
  /// **'Eligible on {date}'**
  String eligibleOn(String date);

  /// No description provided for @earningsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Your earnings statement could not be loaded.'**
  String get earningsLoadFailed;

  /// No description provided for @payoutAccountLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Your payout account status could not be loaded. Pull to refresh.'**
  String get payoutAccountLoadFailed;

  /// No description provided for @addPayoutAccount.
  ///
  /// In en, this message translates to:
  /// **'Add payout account'**
  String get addPayoutAccount;

  /// No description provided for @editPayoutAccount.
  ///
  /// In en, this message translates to:
  /// **'Edit payout account'**
  String get editPayoutAccount;

  /// No description provided for @managePayoutAccount.
  ///
  /// In en, this message translates to:
  /// **'Manage payout account'**
  String get managePayoutAccount;

  /// No description provided for @payoutAccountPrivacyNotice.
  ///
  /// In en, this message translates to:
  /// **'Your full bank account number is sent securely to Vardhnam and is never shown again in the app.'**
  String get payoutAccountPrivacyNotice;

  /// No description provided for @payoutAccountResubmissionNotice.
  ///
  /// In en, this message translates to:
  /// **'Saving changes resets this account to pending verification. Enter the full account number again.'**
  String get payoutAccountResubmissionNotice;

  /// No description provided for @accountHolderName.
  ///
  /// In en, this message translates to:
  /// **'Account holder name'**
  String get accountHolderName;

  /// No description provided for @bankName.
  ///
  /// In en, this message translates to:
  /// **'Bank name'**
  String get bankName;

  /// No description provided for @accountNumber.
  ///
  /// In en, this message translates to:
  /// **'Account number'**
  String get accountNumber;

  /// No description provided for @reenterAccountNumber.
  ///
  /// In en, this message translates to:
  /// **'For security, re-enter the complete account number.'**
  String get reenterAccountNumber;

  /// No description provided for @ifscCode.
  ///
  /// In en, this message translates to:
  /// **'IFSC code'**
  String get ifscCode;

  /// No description provided for @upiIdOptional.
  ///
  /// In en, this message translates to:
  /// **'UPI ID (optional)'**
  String get upiIdOptional;

  /// No description provided for @invalidAccountNumber.
  ///
  /// In en, this message translates to:
  /// **'Enter a 6 to 20 digit account number.'**
  String get invalidAccountNumber;

  /// No description provided for @invalidIfscCode.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 11-character IFSC code.'**
  String get invalidIfscCode;

  /// No description provided for @fieldTooShort.
  ///
  /// In en, this message translates to:
  /// **'This value is too short.'**
  String get fieldTooShort;

  /// No description provided for @fieldTooLong.
  ///
  /// In en, this message translates to:
  /// **'This value is too long.'**
  String get fieldTooLong;

  /// No description provided for @submitForVerification.
  ///
  /// In en, this message translates to:
  /// **'Submit for verification'**
  String get submitForVerification;

  /// No description provided for @payoutAccountSaved.
  ///
  /// In en, this message translates to:
  /// **'Payout account submitted for verification.'**
  String get payoutAccountSaved;

  /// No description provided for @payoutAccountSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'The payout account could not be saved. Check the details and try again.'**
  String get payoutAccountSaveFailed;

  /// No description provided for @farmerLeads.
  ///
  /// In en, this message translates to:
  /// **'Farmer leads'**
  String get farmerLeads;

  /// No description provided for @captureLead.
  ///
  /// In en, this message translates to:
  /// **'Capture lead'**
  String get captureLead;

  /// No description provided for @captureFarmerLead.
  ///
  /// In en, this message translates to:
  /// **'Capture farmer lead'**
  String get captureFarmerLead;

  /// No description provided for @leadPipelineHelp.
  ///
  /// In en, this message translates to:
  /// **'Only leads assigned to your promoter account are shown. Farmer registration and conversion are separate verified steps.'**
  String get leadPipelineHelp;

  /// No description provided for @leadPrivacyNotice.
  ///
  /// In en, this message translates to:
  /// **'Collect contact details only with the farmer\'s knowledge and use them only for authorised Vardhnam follow-up.'**
  String get leadPrivacyNotice;

  /// No description provided for @leadStatus.
  ///
  /// In en, this message translates to:
  /// **'Lead status'**
  String get leadStatus;

  /// No description provided for @leadNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get leadNew;

  /// No description provided for @leadContacted.
  ///
  /// In en, this message translates to:
  /// **'Contacted'**
  String get leadContacted;

  /// No description provided for @leadConverted.
  ///
  /// In en, this message translates to:
  /// **'Converted'**
  String get leadConverted;

  /// No description provided for @leadLost.
  ///
  /// In en, this message translates to:
  /// **'Lost'**
  String get leadLost;

  /// No description provided for @leadSource.
  ///
  /// In en, this message translates to:
  /// **'Lead source'**
  String get leadSource;

  /// No description provided for @leadSourceFieldVisit.
  ///
  /// In en, this message translates to:
  /// **'Field visit'**
  String get leadSourceFieldVisit;

  /// No description provided for @leadSourceReferral.
  ///
  /// In en, this message translates to:
  /// **'Referral'**
  String get leadSourceReferral;

  /// No description provided for @leadSourceCampaign.
  ///
  /// In en, this message translates to:
  /// **'Campaign'**
  String get leadSourceCampaign;

  /// No description provided for @leadSourceInbound.
  ///
  /// In en, this message translates to:
  /// **'Inbound enquiry'**
  String get leadSourceInbound;

  /// No description provided for @leadOptionalDetails.
  ///
  /// In en, this message translates to:
  /// **'Optional location, crops and notes'**
  String get leadOptionalDetails;

  /// No description provided for @farmerName.
  ///
  /// In en, this message translates to:
  /// **'Farmer name'**
  String get farmerName;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get phoneNumber;

  /// No description provided for @invalidIndianPhone.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 10-digit Indian mobile number.'**
  String get invalidIndianPhone;

  /// No description provided for @pincodeOptional.
  ///
  /// In en, this message translates to:
  /// **'Pincode (optional)'**
  String get pincodeOptional;

  /// No description provided for @cropInterestsCommaSeparated.
  ///
  /// In en, this message translates to:
  /// **'Crop interests (comma separated)'**
  String get cropInterestsCommaSeparated;

  /// No description provided for @notesOptional.
  ///
  /// In en, this message translates to:
  /// **'Notes (optional)'**
  String get notesOptional;

  /// No description provided for @saveLead.
  ///
  /// In en, this message translates to:
  /// **'Save lead'**
  String get saveLead;

  /// No description provided for @noFarmerLeads.
  ///
  /// In en, this message translates to:
  /// **'No matching farmer leads.'**
  String get noFarmerLeads;

  /// No description provided for @leadsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Farmer leads could not be loaded. Pull to refresh.'**
  String get leadsLoadFailed;

  /// No description provided for @leadCreateFailed.
  ///
  /// In en, this message translates to:
  /// **'The lead could not be saved. Check for an existing open lead and try again.'**
  String get leadCreateFailed;

  /// No description provided for @markContacted.
  ///
  /// In en, this message translates to:
  /// **'Mark contacted'**
  String get markContacted;

  /// No description provided for @markLeadLost.
  ///
  /// In en, this message translates to:
  /// **'Mark lead lost'**
  String get markLeadLost;

  /// No description provided for @lossReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get lossReason;

  /// No description provided for @leadUpdated.
  ///
  /// In en, this message translates to:
  /// **'Lead status updated.'**
  String get leadUpdated;

  /// No description provided for @leadUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'The lead status could not be updated.'**
  String get leadUpdateFailed;

  /// No description provided for @convertFarmerLead.
  ///
  /// In en, this message translates to:
  /// **'Convert farmer'**
  String get convertFarmerLead;

  /// No description provided for @convertFarmerLeadHelp.
  ///
  /// In en, this message translates to:
  /// **'Ask the farmer to complete OTP registration in the farmer app first. Conversion links the verified farmer and assigns your promoter attribution.'**
  String get convertFarmerLeadHelp;

  /// No description provided for @confirmConversion.
  ///
  /// In en, this message translates to:
  /// **'Confirm conversion'**
  String get confirmConversion;

  /// No description provided for @leadConvertedSuccess.
  ///
  /// In en, this message translates to:
  /// **'The verified farmer was linked and the lead was converted.'**
  String get leadConvertedSuccess;

  /// No description provided for @leadConversionFailed.
  ///
  /// In en, this message translates to:
  /// **'Conversion failed. Confirm that the farmer registered with this phone number and try again.'**
  String get leadConversionFailed;

  /// No description provided for @promoterVisits.
  ///
  /// In en, this message translates to:
  /// **'Field visits'**
  String get promoterVisits;

  /// No description provided for @recordVisit.
  ///
  /// In en, this message translates to:
  /// **'Record visit'**
  String get recordVisit;

  /// No description provided for @visitPurpose.
  ///
  /// In en, this message translates to:
  /// **'Visit purpose'**
  String get visitPurpose;

  /// No description provided for @visitPurposeLeadFollowUp.
  ///
  /// In en, this message translates to:
  /// **'Lead follow-up'**
  String get visitPurposeLeadFollowUp;

  /// No description provided for @visitPurposeFarmerSupport.
  ///
  /// In en, this message translates to:
  /// **'Farmer support'**
  String get visitPurposeFarmerSupport;

  /// No description provided for @visitPurposeOrderAssistance.
  ///
  /// In en, this message translates to:
  /// **'Order assistance'**
  String get visitPurposeOrderAssistance;

  /// No description provided for @visitPurposeFarmSurvey.
  ///
  /// In en, this message translates to:
  /// **'Farm survey'**
  String get visitPurposeFarmSurvey;

  /// No description provided for @visitPurposeComplaintFollowUp.
  ///
  /// In en, this message translates to:
  /// **'Complaint follow-up'**
  String get visitPurposeComplaintFollowUp;

  /// No description provided for @visitNotes.
  ///
  /// In en, this message translates to:
  /// **'Visit notes (optional)'**
  String get visitNotes;

  /// No description provided for @includeVisitLocation.
  ///
  /// In en, this message translates to:
  /// **'Include current location'**
  String get includeVisitLocation;

  /// No description provided for @includeVisitLocationHelp.
  ///
  /// In en, this message translates to:
  /// **'Location is requested once when you save. It is never tracked in the background.'**
  String get includeVisitLocationHelp;

  /// No description provided for @saveVisit.
  ///
  /// In en, this message translates to:
  /// **'Save visit'**
  String get saveVisit;

  /// No description provided for @visitRecorded.
  ///
  /// In en, this message translates to:
  /// **'Visit recorded.'**
  String get visitRecorded;

  /// No description provided for @visitRecordFailed.
  ///
  /// In en, this message translates to:
  /// **'The visit could not be recorded.'**
  String get visitRecordFailed;

  /// No description provided for @visitsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Field visits could not be loaded.'**
  String get visitsLoadFailed;

  /// No description provided for @noPromoterVisits.
  ///
  /// In en, this message translates to:
  /// **'No field visits recorded yet.'**
  String get noPromoterVisits;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'hi':
      return AppLocalizationsHi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
