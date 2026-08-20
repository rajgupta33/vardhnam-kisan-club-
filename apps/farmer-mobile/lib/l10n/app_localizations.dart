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

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
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

  /// No description provided for @farmerContextSelectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose your farmer context'**
  String get farmerContextSelectionTitle;

  /// No description provided for @farmerContextSelectionMessage.
  ///
  /// In en, this message translates to:
  /// **'This mobile number has more than one active farmer context. Select the one you want to use.'**
  String get farmerContextSelectionMessage;

  /// No description provided for @firstLaunchLanguageTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose your language'**
  String get firstLaunchLanguageTitle;

  /// No description provided for @firstLaunchLanguageMessage.
  ///
  /// In en, this message translates to:
  /// **'Select the language you want to use. You can change it later from the app.'**
  String get firstLaunchLanguageMessage;

  /// No description provided for @cartQuantityRangeLabel.
  ///
  /// In en, this message translates to:
  /// **'Allowed quantity: {minimum}–{maximum}'**
  String cartQuantityRangeLabel(int minimum, int maximum);

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Vardhnam Farmer'**
  String get appTitle;

  /// No description provided for @homeNavLabel.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get homeNavLabel;

  /// No description provided for @shopNavLabel.
  ///
  /// In en, this message translates to:
  /// **'Product browsing'**
  String get shopNavLabel;

  /// No description provided for @ordersNavLabel.
  ///
  /// In en, this message translates to:
  /// **'My orders'**
  String get ordersNavLabel;

  /// No description provided for @accountNavLabel.
  ///
  /// In en, this message translates to:
  /// **'Farm profile'**
  String get accountNavLabel;

  /// No description provided for @homeLocationContext.
  ///
  /// In en, this message translates to:
  /// **'Your farm and delivery area'**
  String get homeLocationContext;

  /// No description provided for @homeGreeting.
  ///
  /// In en, this message translates to:
  /// **'Namaste, {farmerName}'**
  String homeGreeting(String farmerName);

  /// No description provided for @homeLocationWithPincode.
  ///
  /// In en, this message translates to:
  /// **'{location}, {pincode}'**
  String homeLocationWithPincode(String location, String pincode);

  /// No description provided for @homePincodeOnly.
  ///
  /// In en, this message translates to:
  /// **'Pincode {pincode}'**
  String homePincodeOnly(String pincode);

  /// No description provided for @homeWeatherTitle.
  ///
  /// In en, this message translates to:
  /// **'Today\'s farm conditions'**
  String get homeWeatherTitle;

  /// No description provided for @homeWeatherUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Live weather is not connected yet.'**
  String get homeWeatherUnavailable;

  /// No description provided for @homeQuickActionsTitle.
  ///
  /// In en, this message translates to:
  /// **'Quick help'**
  String get homeQuickActionsTitle;

  /// No description provided for @homeViewAllAction.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get homeViewAllAction;

  /// No description provided for @homeFarmCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Your farms and crops'**
  String get homeFarmCardTitle;

  /// No description provided for @homeShopSectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Products for your farm'**
  String get homeShopSectionTitle;

  /// No description provided for @kisanClubFreeBadge.
  ///
  /// In en, this message translates to:
  /// **'100% FREE'**
  String get kisanClubFreeBadge;

  /// No description provided for @kisanClubOpenAction.
  ///
  /// In en, this message translates to:
  /// **'Open Kisan Club'**
  String get kisanClubOpenAction;

  /// No description provided for @productPlaceholderLabel.
  ///
  /// In en, this message translates to:
  /// **'Product image placeholder'**
  String get productPlaceholderLabel;

  /// No description provided for @kisanClubPlaceholderLabel.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club image placeholder'**
  String get kisanClubPlaceholderLabel;

  /// No description provided for @kisanClubLandingDescription.
  ///
  /// In en, this message translates to:
  /// **'A free farmer-support programme from Vardhnam.'**
  String get kisanClubLandingDescription;

  /// No description provided for @kisanClubLandingAdvisoryBenefit.
  ///
  /// In en, this message translates to:
  /// **'Crop advisory'**
  String get kisanClubLandingAdvisoryBenefit;

  /// No description provided for @kisanClubLandingPromoterBenefit.
  ///
  /// In en, this message translates to:
  /// **'Local Vardhnam promoter support'**
  String get kisanClubLandingPromoterBenefit;

  /// No description provided for @kisanClubLandingProductBenefit.
  ///
  /// In en, this message translates to:
  /// **'Special Vardhnam product benefits'**
  String get kisanClubLandingProductBenefit;

  /// No description provided for @kisanClubLandingFarmBenefit.
  ///
  /// In en, this message translates to:
  /// **'Farm and crop assistance'**
  String get kisanClubLandingFarmBenefit;

  /// No description provided for @kisanClubNoMembershipFee.
  ///
  /// In en, this message translates to:
  /// **'No membership fee.'**
  String get kisanClubNoMembershipFee;

  /// No description provided for @kisanClubJoinProgress.
  ///
  /// In en, this message translates to:
  /// **'Step {current} of 4'**
  String kisanClubJoinProgress(int current);

  /// No description provided for @kisanClubBasicInformationTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm your location'**
  String get kisanClubBasicInformationTitle;

  /// No description provided for @kisanClubFarmInformationTitle.
  ///
  /// In en, this message translates to:
  /// **'Add your farm'**
  String get kisanClubFarmInformationTitle;

  /// No description provided for @kisanClubFarmInformationMessage.
  ///
  /// In en, this message translates to:
  /// **'Tell us about the farm you want Club support for.'**
  String get kisanClubFarmInformationMessage;

  /// No description provided for @kisanClubCropInformationTitle.
  ///
  /// In en, this message translates to:
  /// **'Add your current crop'**
  String get kisanClubCropInformationTitle;

  /// No description provided for @kisanClubCropInformationMessage.
  ///
  /// In en, this message translates to:
  /// **'Choose an approved crop and record the cultivated area and sowing date.'**
  String get kisanClubCropInformationMessage;

  /// No description provided for @kisanClubFarmerDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Farmer details'**
  String get kisanClubFarmerDetailsTitle;

  /// No description provided for @kisanClubPreferredLanguageLabel.
  ///
  /// In en, this message translates to:
  /// **'Preferred language: {language}'**
  String kisanClubPreferredLanguageLabel(String language);

  /// No description provided for @kisanClubSelectCropAction.
  ///
  /// In en, this message translates to:
  /// **'Choose crop'**
  String get kisanClubSelectCropAction;

  /// No description provided for @kisanClubChangeCropAction.
  ///
  /// In en, this message translates to:
  /// **'Change crop'**
  String get kisanClubChangeCropAction;

  /// No description provided for @kisanClubSearchCropLabel.
  ///
  /// In en, this message translates to:
  /// **'Search approved crops'**
  String get kisanClubSearchCropLabel;

  /// No description provided for @kisanClubSowingDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Sowing date'**
  String get kisanClubSowingDateLabel;

  /// No description provided for @kisanClubSelectSowingDateAction.
  ///
  /// In en, this message translates to:
  /// **'Choose sowing date'**
  String get kisanClubSelectSowingDateAction;

  /// No description provided for @kisanClubSowingDateRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose the crop sowing date.'**
  String get kisanClubSowingDateRequired;

  /// No description provided for @kisanClubFarmReviewTitle.
  ///
  /// In en, this message translates to:
  /// **'Farm'**
  String get kisanClubFarmReviewTitle;

  /// No description provided for @kisanClubCropReviewTitle.
  ///
  /// In en, this message translates to:
  /// **'Crop'**
  String get kisanClubCropReviewTitle;

  /// No description provided for @kisanClubProfileSetupPartial.
  ///
  /// In en, this message translates to:
  /// **'Your free membership was created, but the farm profile could not be completed. Continue from the saved step.'**
  String get kisanClubProfileSetupPartial;

  /// No description provided for @kisanClubJoinConsentWarning.
  ///
  /// In en, this message translates to:
  /// **'Membership and farm profile were saved, but optional permissions could not be updated. You can change them from Kisan Club.'**
  String get kisanClubJoinConsentWarning;

  /// No description provided for @kisanClubConfirmDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Review and join'**
  String get kisanClubConfirmDetailsTitle;

  /// No description provided for @continueActionLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueActionLabel;

  /// No description provided for @backActionLabel.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get backActionLabel;

  /// No description provided for @kisanClubMyCropSection.
  ///
  /// In en, this message translates to:
  /// **'My crop'**
  String get kisanClubMyCropSection;

  /// No description provided for @kisanClubTodaySection.
  ///
  /// In en, this message translates to:
  /// **'Today\'s advisory'**
  String get kisanClubTodaySection;

  /// No description provided for @kisanClubCropProblemTitle.
  ///
  /// In en, this message translates to:
  /// **'Crop problem?'**
  String get kisanClubCropProblemTitle;

  /// No description provided for @kisanClubCropProblemAction.
  ///
  /// In en, this message translates to:
  /// **'Ask Vardhnam for help'**
  String get kisanClubCropProblemAction;

  /// No description provided for @kisanClubCropProblemMessage.
  ///
  /// In en, this message translates to:
  /// **'Share what you observed with support. The app will not generate an automatic diagnosis.'**
  String get kisanClubCropProblemMessage;

  /// No description provided for @kisanClubSupportSection.
  ///
  /// In en, this message translates to:
  /// **'Your Vardhnam promoter'**
  String get kisanClubSupportSection;

  /// No description provided for @kisanClubProgrammeBenefitsTitle.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club benefits'**
  String get kisanClubProgrammeBenefitsTitle;

  /// No description provided for @kisanClubMembershipSettingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Membership permissions'**
  String get kisanClubMembershipSettingsTitle;

  /// No description provided for @myPromoterCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Your Vardhnam promoter'**
  String get myPromoterCardTitle;

  /// No description provided for @addFirstFarmTitle.
  ///
  /// In en, this message translates to:
  /// **'Add your first farm'**
  String get addFirstFarmTitle;

  /// No description provided for @viewFarmAction.
  ///
  /// In en, this message translates to:
  /// **'View farm'**
  String get viewFarmAction;

  /// No description provided for @currentCropsTitle.
  ///
  /// In en, this message translates to:
  /// **'Current crops'**
  String get currentCropsTitle;

  /// No description provided for @previousCropsTitle.
  ///
  /// In en, this message translates to:
  /// **'Previous crop cycles'**
  String get previousCropsTitle;

  /// No description provided for @noActiveCropTitle.
  ///
  /// In en, this message translates to:
  /// **'No active crop added'**
  String get noActiveCropTitle;

  /// No description provided for @farmStatusActive.
  ///
  /// In en, this message translates to:
  /// **'Active farm'**
  String get farmStatusActive;

  /// No description provided for @farmStatusInactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive farm'**
  String get farmStatusInactive;

  /// No description provided for @farmLocationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Farm location not recorded'**
  String get farmLocationUnavailable;

  /// No description provided for @cropImagePlaceholderLabel.
  ///
  /// In en, this message translates to:
  /// **'Image placeholder for {cropName}'**
  String cropImagePlaceholderLabel(String cropName);

  /// No description provided for @cropVarietyDisplayLabel.
  ///
  /// In en, this message translates to:
  /// **'Variety'**
  String get cropVarietyDisplayLabel;

  /// No description provided for @cropTodayTitle.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get cropTodayTitle;

  /// No description provided for @approvedGuidanceTitle.
  ///
  /// In en, this message translates to:
  /// **'Approved crop guidance'**
  String get approvedGuidanceTitle;

  /// No description provided for @approvedGuidanceMessage.
  ///
  /// In en, this message translates to:
  /// **'No crop-specific action is available here until approved advisory data is returned by the server.'**
  String get approvedGuidanceMessage;

  /// No description provided for @nextSevenDaysTitle.
  ///
  /// In en, this message translates to:
  /// **'Next 7 days'**
  String get nextSevenDaysTitle;

  /// No description provided for @cropPlanUnavailableMessage.
  ///
  /// In en, this message translates to:
  /// **'A seven-day crop plan will appear when approved scheduled guidance is available.'**
  String get cropPlanUnavailableMessage;

  /// No description provided for @openCropDiaryAction.
  ///
  /// In en, this message translates to:
  /// **'Open crop activity diary'**
  String get openCropDiaryAction;

  /// No description provided for @cropStatusPlanned.
  ///
  /// In en, this message translates to:
  /// **'Planned'**
  String get cropStatusPlanned;

  /// No description provided for @cropStatusActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get cropStatusActive;

  /// No description provided for @cropStatusHarvested.
  ///
  /// In en, this message translates to:
  /// **'Harvested'**
  String get cropStatusHarvested;

  /// No description provided for @cropStatusAbandoned.
  ///
  /// In en, this message translates to:
  /// **'Stopped'**
  String get cropStatusAbandoned;

  /// No description provided for @welcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Farmer workspace'**
  String get welcomeTitle;

  /// No description provided for @phaseBoundary.
  ///
  /// In en, this message translates to:
  /// **'Browse products, manage your cart and complete the development mock-payment journey.'**
  String get phaseBoundary;

  /// No description provided for @languageActionLabel.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageActionLabel;

  /// No description provided for @englishLanguageLabel.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get englishLanguageLabel;

  /// No description provided for @hindiLanguageLabel.
  ///
  /// In en, this message translates to:
  /// **'हिन्दी'**
  String get hindiLanguageLabel;

  /// No description provided for @languageSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not save the language choice. Please try again.'**
  String get languageSaveFailed;

  /// No description provided for @farmerLoginTitle.
  ///
  /// In en, this message translates to:
  /// **'Farmer login'**
  String get farmerLoginTitle;

  /// No description provided for @loginIntro.
  ///
  /// In en, this message translates to:
  /// **'Enter your name and mobile number. We will verify the number with a six-digit OTP.'**
  String get loginIntro;

  /// No description provided for @fullNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get fullNameLabel;

  /// No description provided for @mobileNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get mobileNumberLabel;

  /// No description provided for @mobileNumberHint.
  ///
  /// In en, this message translates to:
  /// **'10-digit Indian mobile number'**
  String get mobileNumberHint;

  /// No description provided for @requestOtpAction.
  ///
  /// In en, this message translates to:
  /// **'Send OTP'**
  String get requestOtpAction;

  /// No description provided for @otpCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Six-digit OTP'**
  String get otpCodeLabel;

  /// No description provided for @verifyOtpAction.
  ///
  /// In en, this message translates to:
  /// **'Verify and continue'**
  String get verifyOtpAction;

  /// No description provided for @resendOtpAction.
  ///
  /// In en, this message translates to:
  /// **'Resend OTP'**
  String get resendOtpAction;

  /// No description provided for @resendOtpCountdown.
  ///
  /// In en, this message translates to:
  /// **'Resend OTP in {seconds}s'**
  String resendOtpCountdown(int seconds);

  /// No description provided for @mockOtpLabel.
  ///
  /// In en, this message translates to:
  /// **'Development OTP (mock provider): {code}'**
  String mockOtpLabel(String code);

  /// No description provided for @otpSentMessage.
  ///
  /// In en, this message translates to:
  /// **'OTP sent. Enter the code to continue.'**
  String get otpSentMessage;

  /// No description provided for @invalidNameMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter your full name.'**
  String get invalidNameMessage;

  /// No description provided for @invalidPhoneMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 10-digit Indian mobile number.'**
  String get invalidPhoneMessage;

  /// No description provided for @invalidOtpMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter the six-digit OTP.'**
  String get invalidOtpMessage;

  /// No description provided for @invalidCredentialsMessage.
  ///
  /// In en, this message translates to:
  /// **'The OTP is incorrect, expired or has reached its attempt limit.'**
  String get invalidCredentialsMessage;

  /// No description provided for @rateLimitedMessage.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait before trying again.'**
  String get rateLimitedMessage;

  /// No description provided for @networkErrorMessage.
  ///
  /// In en, this message translates to:
  /// **'Could not connect. Check your internet connection and try again.'**
  String get networkErrorMessage;

  /// No description provided for @networkTimeoutMessage.
  ///
  /// In en, this message translates to:
  /// **'The request took too long. Check your connection and try again.'**
  String get networkTimeoutMessage;

  /// No description provided for @invalidServerResponseMessage.
  ///
  /// In en, this message translates to:
  /// **'The service returned an unexpected response. Please try again.'**
  String get invalidServerResponseMessage;

  /// No description provided for @unexpectedErrorMessage.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get unexpectedErrorMessage;

  /// No description provided for @cachedProductsNotice.
  ///
  /// In en, this message translates to:
  /// **'Saved results from {age}. Prices and stock may have changed; reconnect before adding to cart.'**
  String cachedProductsNotice(String age);

  /// No description provided for @cachedProductsJustNow.
  ///
  /// In en, this message translates to:
  /// **'just now'**
  String get cachedProductsJustNow;

  /// No description provided for @cachedProductsMinutesAgo.
  ///
  /// In en, this message translates to:
  /// **'{minutes} minute(s) ago'**
  String cachedProductsMinutesAgo(int minutes);

  /// No description provided for @cachedProductsHoursAgo.
  ///
  /// In en, this message translates to:
  /// **'{hours} hour(s) ago'**
  String cachedProductsHoursAgo(int hours);

  /// No description provided for @multipleMembershipsMessage.
  ///
  /// In en, this message translates to:
  /// **'This number has multiple farmer contexts. Selection support is not available yet.'**
  String get multipleMembershipsMessage;

  /// No description provided for @authenticationErrorMessage.
  ///
  /// In en, this message translates to:
  /// **'Could not complete login. Please try again.'**
  String get authenticationErrorMessage;

  /// No description provided for @browseWithoutLoginAction.
  ///
  /// In en, this message translates to:
  /// **'Browse products without login'**
  String get browseWithoutLoginAction;

  /// No description provided for @logoutAction.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logoutAction;

  /// No description provided for @otpLogin.
  ///
  /// In en, this message translates to:
  /// **'OTP login'**
  String get otpLogin;

  /// No description provided for @otpLoginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Secure OTP sign-in with a development SMS provider.'**
  String get otpLoginSubtitle;

  /// No description provided for @farmProfile.
  ///
  /// In en, this message translates to:
  /// **'Farm profile'**
  String get farmProfile;

  /// No description provided for @accountTitle.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get accountTitle;

  /// No description provided for @accountServicesTitle.
  ///
  /// In en, this message translates to:
  /// **'Your account'**
  String get accountServicesTitle;

  /// No description provided for @accountProfileDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile details'**
  String get accountProfileDetailsTitle;

  /// No description provided for @supportAccountLabel.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get supportAccountLabel;

  /// No description provided for @farmProfileSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Keep your location and crop interests up to date.'**
  String get farmProfileSubtitle;

  /// No description provided for @profileIntro.
  ///
  /// In en, this message translates to:
  /// **'These details help show products and delivery options relevant to your farm.'**
  String get profileIntro;

  /// No description provided for @loadingProfile.
  ///
  /// In en, this message translates to:
  /// **'Loading farmer profile...'**
  String get loadingProfile;

  /// No description provided for @profileLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your farmer profile.'**
  String get profileLoadFailed;

  /// No description provided for @profileSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not save your farmer profile. Please try again.'**
  String get profileSaveFailed;

  /// No description provided for @profileSavedMessage.
  ///
  /// In en, this message translates to:
  /// **'Farmer profile saved.'**
  String get profileSavedMessage;

  /// No description provided for @saveProfileAction.
  ///
  /// In en, this message translates to:
  /// **'Save profile'**
  String get saveProfileAction;

  /// No description provided for @alternatePhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Alternate phone (optional)'**
  String get alternatePhoneLabel;

  /// No description provided for @villageLabel.
  ///
  /// In en, this message translates to:
  /// **'Village'**
  String get villageLabel;

  /// No description provided for @districtLabel.
  ///
  /// In en, this message translates to:
  /// **'District'**
  String get districtLabel;

  /// No description provided for @stateLabel.
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get stateLabel;

  /// No description provided for @primaryPincodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Farm pincode'**
  String get primaryPincodeLabel;

  /// No description provided for @cropInterestsLabel.
  ///
  /// In en, this message translates to:
  /// **'Crop interests'**
  String get cropInterestsLabel;

  /// No description provided for @cropInterestsHelp.
  ///
  /// In en, this message translates to:
  /// **'Separate crops with commas, for example: Wheat, Mustard'**
  String get cropInterestsHelp;

  /// No description provided for @invalidCropsMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter no more than 20 crops, with short crop names.'**
  String get invalidCropsMessage;

  /// No description provided for @savedAddressesTitle.
  ///
  /// In en, this message translates to:
  /// **'Saved delivery addresses'**
  String get savedAddressesTitle;

  /// No description provided for @noSavedAddresses.
  ///
  /// In en, this message translates to:
  /// **'No delivery address has been saved yet.'**
  String get noSavedAddresses;

  /// No description provided for @defaultAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Default'**
  String get defaultAddressLabel;

  /// No description provided for @manageAddressesAction.
  ///
  /// In en, this message translates to:
  /// **'Manage addresses'**
  String get manageAddressesAction;

  /// No description provided for @addressesTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery addresses'**
  String get addressesTitle;

  /// No description provided for @loadingAddresses.
  ///
  /// In en, this message translates to:
  /// **'Loading delivery addresses...'**
  String get loadingAddresses;

  /// No description provided for @addressesLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your delivery addresses.'**
  String get addressesLoadFailed;

  /// No description provided for @addAddressAction.
  ///
  /// In en, this message translates to:
  /// **'Add address'**
  String get addAddressAction;

  /// No description provided for @editAddressAction.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get editAddressAction;

  /// No description provided for @setDefaultAddressAction.
  ///
  /// In en, this message translates to:
  /// **'Set as default'**
  String get setDefaultAddressAction;

  /// No description provided for @defaultAddressUpdatedMessage.
  ///
  /// In en, this message translates to:
  /// **'Default delivery address updated.'**
  String get defaultAddressUpdatedMessage;

  /// No description provided for @addressSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not save the delivery address. Please try again.'**
  String get addressSaveFailed;

  /// No description provided for @addAddressTitle.
  ///
  /// In en, this message translates to:
  /// **'Add delivery address'**
  String get addAddressTitle;

  /// No description provided for @editAddressTitle.
  ///
  /// In en, this message translates to:
  /// **'Edit delivery address'**
  String get editAddressTitle;

  /// No description provided for @addressLabelField.
  ///
  /// In en, this message translates to:
  /// **'Address label'**
  String get addressLabelField;

  /// No description provided for @recipientNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Recipient name'**
  String get recipientNameLabel;

  /// No description provided for @addressPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Recipient mobile number'**
  String get addressPhoneLabel;

  /// No description provided for @addressLine1Label.
  ///
  /// In en, this message translates to:
  /// **'Address line 1'**
  String get addressLine1Label;

  /// No description provided for @addressLine2Label.
  ///
  /// In en, this message translates to:
  /// **'Address line 2 (optional)'**
  String get addressLine2Label;

  /// No description provided for @cityLabel.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get cityLabel;

  /// No description provided for @landmarkLabel.
  ///
  /// In en, this message translates to:
  /// **'Landmark (optional)'**
  String get landmarkLabel;

  /// No description provided for @makeDefaultAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Use as default delivery address'**
  String get makeDefaultAddressLabel;

  /// No description provided for @defaultAddressCannotBeUnsetHelp.
  ///
  /// In en, this message translates to:
  /// **'Choose another address as default before replacing this one.'**
  String get defaultAddressCannotBeUnsetHelp;

  /// No description provided for @saveAddressAction.
  ///
  /// In en, this message translates to:
  /// **'Save address'**
  String get saveAddressAction;

  /// No description provided for @requiredFieldMessage.
  ///
  /// In en, this message translates to:
  /// **'This field is required.'**
  String get requiredFieldMessage;

  /// No description provided for @closeAction.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get closeAction;

  /// No description provided for @productBrowsing.
  ///
  /// In en, this message translates to:
  /// **'Product browsing'**
  String get productBrowsing;

  /// No description provided for @productBrowsingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Approved offers shown by pincode, seller and stock.'**
  String get productBrowsingSubtitle;

  /// No description provided for @cart.
  ///
  /// In en, this message translates to:
  /// **'Cart'**
  String get cart;

  /// No description provided for @cartSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Review selected products, seller and pincode.'**
  String get cartSubtitle;

  /// No description provided for @browseTitle.
  ///
  /// In en, this message translates to:
  /// **'Browse products'**
  String get browseTitle;

  /// No description provided for @deliveringToTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivering to'**
  String get deliveringToTitle;

  /// No description provided for @pincodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Pincode'**
  String get pincodeLabel;

  /// No description provided for @productSearchLabel.
  ///
  /// In en, this message translates to:
  /// **'Search crop, brand or product'**
  String get productSearchLabel;

  /// No description provided for @shopByCategoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Shop by category'**
  String get shopByCategoryTitle;

  /// No description provided for @shopByCropTitle.
  ///
  /// In en, this message translates to:
  /// **'Shop by crop'**
  String get shopByCropTitle;

  /// No description provided for @shopByBrandTitle.
  ///
  /// In en, this message translates to:
  /// **'Shop by brand'**
  String get shopByBrandTitle;

  /// No description provided for @allCategory.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get allCategory;

  /// No description provided for @brandFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'Brand'**
  String get brandFilterLabel;

  /// No description provided for @allBrandsFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'All brands'**
  String get allBrandsFilterLabel;

  /// No description provided for @cropFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'Crop'**
  String get cropFilterLabel;

  /// No description provided for @allCropsFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'All crops'**
  String get allCropsFilterLabel;

  /// No description provided for @seedsCategory.
  ///
  /// In en, this message translates to:
  /// **'Seeds'**
  String get seedsCategory;

  /// No description provided for @fertiliserCategory.
  ///
  /// In en, this message translates to:
  /// **'Fertiliser'**
  String get fertiliserCategory;

  /// No description provided for @cropCareCategory.
  ///
  /// In en, this message translates to:
  /// **'Crop care'**
  String get cropCareCategory;

  /// No description provided for @discoveryPreviewLabel.
  ///
  /// In en, this message translates to:
  /// **'All products'**
  String get discoveryPreviewLabel;

  /// No description provided for @loadingProducts.
  ///
  /// In en, this message translates to:
  /// **'Loading approved offers...'**
  String get loadingProducts;

  /// No description provided for @loadMoreProductsAction.
  ///
  /// In en, this message translates to:
  /// **'Load more products'**
  String get loadMoreProductsAction;

  /// No description provided for @loadingMoreProductsLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading more products...'**
  String get loadingMoreProductsLabel;

  /// No description provided for @enterValidPincode.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid six-digit pincode to see available products.'**
  String get enterValidPincode;

  /// No description provided for @productLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load products from the marketplace API.'**
  String get productLoadFailed;

  /// No description provided for @retryActionLabel.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retryActionLabel;

  /// No description provided for @startingPriceLabel.
  ///
  /// In en, this message translates to:
  /// **'Starting at'**
  String get startingPriceLabel;

  /// No description provided for @sellersLabel.
  ///
  /// In en, this message translates to:
  /// **'Sellers'**
  String get sellersLabel;

  /// No description provided for @offersLabel.
  ///
  /// In en, this message translates to:
  /// **'Offers'**
  String get offersLabel;

  /// No description provided for @distributorDeliveryLabel.
  ///
  /// In en, this message translates to:
  /// **'Distributor delivery'**
  String get distributorDeliveryLabel;

  /// No description provided for @vardhnamFulfilmentLabel.
  ///
  /// In en, this message translates to:
  /// **'Vardhnam fulfilment'**
  String get vardhnamFulfilmentLabel;

  /// No description provided for @pickupLabel.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get pickupLabel;

  /// No description provided for @fulfilmentPendingLabel.
  ///
  /// In en, this message translates to:
  /// **'Fulfilment pending'**
  String get fulfilmentPendingLabel;

  /// No description provided for @availableUnit.
  ///
  /// In en, this message translates to:
  /// **'available'**
  String get availableUnit;

  /// No description provided for @warehouseLabel.
  ///
  /// In en, this message translates to:
  /// **'Warehouse'**
  String get warehouseLabel;

  /// No description provided for @noProductsForPincode.
  ///
  /// In en, this message translates to:
  /// **'No approved offers found for this pincode.'**
  String get noProductsForPincode;

  /// No description provided for @viewProductDetailsAction.
  ///
  /// In en, this message translates to:
  /// **'View details'**
  String get viewProductDetailsAction;

  /// No description provided for @productImagePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Product image placeholder for {productName}'**
  String productImagePlaceholder(String productName);

  /// No description provided for @productDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Product details'**
  String get productDetailsTitle;

  /// No description provided for @loadingProductDetails.
  ///
  /// In en, this message translates to:
  /// **'Loading product and seller offers...'**
  String get loadingProductDetails;

  /// No description provided for @productDetailLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load this product.'**
  String get productDetailLoadFailed;

  /// No description provided for @brandOwnerLabel.
  ///
  /// In en, this message translates to:
  /// **'Brand owner'**
  String get brandOwnerLabel;

  /// No description provided for @suitableForCropsTitle.
  ///
  /// In en, this message translates to:
  /// **'Suitable for crops'**
  String get suitableForCropsTitle;

  /// No description provided for @deliveryToLabel.
  ///
  /// In en, this message translates to:
  /// **'Delivery to'**
  String get deliveryToLabel;

  /// No description provided for @chooseSellerOfferTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a seller offer'**
  String get chooseSellerOfferTitle;

  /// No description provided for @chooseSellerOfferSubtitle.
  ///
  /// In en, this message translates to:
  /// **'The selected distributor is the seller and will issue the product invoice.'**
  String get chooseSellerOfferSubtitle;

  /// No description provided for @sellerInvoiceTitle.
  ///
  /// In en, this message translates to:
  /// **'Seller and invoice'**
  String get sellerInvoiceTitle;

  /// No description provided for @sellerInvoiceMessage.
  ///
  /// In en, this message translates to:
  /// **'Your selected distributor is the legal seller and will issue the invoice. Vardhnam operates the marketplace.'**
  String get sellerInvoiceMessage;

  /// No description provided for @sellerOfRecordLabel.
  ///
  /// In en, this message translates to:
  /// **'Seller of record'**
  String get sellerOfRecordLabel;

  /// No description provided for @selectedOfferLabel.
  ///
  /// In en, this message translates to:
  /// **'Selected offer'**
  String get selectedOfferLabel;

  /// No description provided for @availableVariantsTitle.
  ///
  /// In en, this message translates to:
  /// **'Available pack variants'**
  String get availableVariantsTitle;

  /// No description provided for @productDocumentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Product documents'**
  String get productDocumentsTitle;

  /// No description provided for @mrpLabel.
  ///
  /// In en, this message translates to:
  /// **'MRP'**
  String get mrpLabel;

  /// No description provided for @minimumQuantityLabel.
  ///
  /// In en, this message translates to:
  /// **'Minimum qty'**
  String get minimumQuantityLabel;

  /// No description provided for @deliverySlaPendingLabel.
  ///
  /// In en, this message translates to:
  /// **'Delivery time pending'**
  String get deliverySlaPendingLabel;

  /// No description provided for @dayLabel.
  ///
  /// In en, this message translates to:
  /// **'day'**
  String get dayLabel;

  /// No description provided for @daysLabel.
  ///
  /// In en, this message translates to:
  /// **'days'**
  String get daysLabel;

  /// No description provided for @batchLabel.
  ///
  /// In en, this message translates to:
  /// **'Batch'**
  String get batchLabel;

  /// No description provided for @expiryLabel.
  ///
  /// In en, this message translates to:
  /// **'Expiry'**
  String get expiryLabel;

  /// No description provided for @germinationLabel.
  ///
  /// In en, this message translates to:
  /// **'Germination'**
  String get germinationLabel;

  /// No description provided for @addSelectedOfferToCartAction.
  ///
  /// In en, this message translates to:
  /// **'Add selected offer to cart'**
  String get addSelectedOfferToCartAction;

  /// No description provided for @addingToCartLabel.
  ///
  /// In en, this message translates to:
  /// **'Adding to cart...'**
  String get addingToCartLabel;

  /// No description provided for @addedToCartMessage.
  ///
  /// In en, this message translates to:
  /// **'Offer added to your cart.'**
  String get addedToCartMessage;

  /// No description provided for @offerNoLongerAvailableMessage.
  ///
  /// In en, this message translates to:
  /// **'This seller offer is no longer available. Choose another live offer.'**
  String get offerNoLongerAvailableMessage;

  /// No description provided for @offerInsufficientStockMessage.
  ///
  /// In en, this message translates to:
  /// **'This offer no longer has enough sellable stock for its minimum order. Choose another offer or refresh later.'**
  String get offerInsufficientStockMessage;

  /// No description provided for @priceChangedDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'Price updated'**
  String get priceChangedDialogTitle;

  /// No description provided for @priceChangedDialogMessage.
  ///
  /// In en, this message translates to:
  /// **'The seller changed this offer from {oldPrice} to {newPrice}. The item is in your cart at the new backend price. Review it before checkout.'**
  String priceChangedDialogMessage(String oldPrice, String newPrice);

  /// No description provided for @stayOnProductAction.
  ///
  /// In en, this message translates to:
  /// **'Stay here'**
  String get stayOnProductAction;

  /// No description provided for @reviewCartAction.
  ///
  /// In en, this message translates to:
  /// **'Review cart'**
  String get reviewCartAction;

  /// No description provided for @signInToAddCartMessage.
  ///
  /// In en, this message translates to:
  /// **'Sign in to add this offer to your cart.'**
  String get signInToAddCartMessage;

  /// No description provided for @cartTitle.
  ///
  /// In en, this message translates to:
  /// **'My cart'**
  String get cartTitle;

  /// No description provided for @loadingCartLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading your cart...'**
  String get loadingCartLabel;

  /// No description provided for @cartLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load your cart.'**
  String get cartLoadFailed;

  /// No description provided for @cartPincodeNotSelected.
  ///
  /// In en, this message translates to:
  /// **'Not selected'**
  String get cartPincodeNotSelected;

  /// No description provided for @cartAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Delivery pincode'**
  String get cartAddressLabel;

  /// No description provided for @cartSnapshotLabel.
  ///
  /// In en, this message translates to:
  /// **'Availability snapshot'**
  String get cartSnapshotLabel;

  /// No description provided for @cartSellerGroupTitle.
  ///
  /// In en, this message translates to:
  /// **'Sold by {seller}'**
  String cartSellerGroupTitle(String seller);

  /// No description provided for @cartSellerGroupItems.
  ///
  /// In en, this message translates to:
  /// **'{count} product(s) · separate seller order and invoice'**
  String cartSellerGroupItems(int count);

  /// No description provided for @cartSubtotalLabel.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get cartSubtotalLabel;

  /// No description provided for @cartAddMore.
  ///
  /// In en, this message translates to:
  /// **'Add more'**
  String get cartAddMore;

  /// No description provided for @cartClear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get cartClear;

  /// No description provided for @clearCartTitle.
  ///
  /// In en, this message translates to:
  /// **'Clear cart?'**
  String get clearCartTitle;

  /// No description provided for @clearCartConfirmation.
  ///
  /// In en, this message translates to:
  /// **'This removes every item from your cart.'**
  String get clearCartConfirmation;

  /// No description provided for @cancelAction.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelAction;

  /// No description provided for @emptyCartLabel.
  ///
  /// In en, this message translates to:
  /// **'Your cart is empty.'**
  String get emptyCartLabel;

  /// No description provided for @decreaseQuantityLabel.
  ///
  /// In en, this message translates to:
  /// **'Decrease quantity'**
  String get decreaseQuantityLabel;

  /// No description provided for @increaseQuantityLabel.
  ///
  /// In en, this message translates to:
  /// **'Increase quantity'**
  String get increaseQuantityLabel;

  /// No description provided for @removeItemLabel.
  ///
  /// In en, this message translates to:
  /// **'Remove item'**
  String get removeItemLabel;

  /// No description provided for @perUnitLabel.
  ///
  /// In en, this message translates to:
  /// **'per unit'**
  String get perUnitLabel;

  /// No description provided for @backendCalculatedTotalLabel.
  ///
  /// In en, this message translates to:
  /// **'Subtotal calculated and validated by the marketplace server.'**
  String get backendCalculatedTotalLabel;

  /// No description provided for @checkoutActionLabel.
  ///
  /// In en, this message translates to:
  /// **'Review checkout'**
  String get checkoutActionLabel;

  /// No description provided for @checkoutReviewTitle.
  ///
  /// In en, this message translates to:
  /// **'Checkout review'**
  String get checkoutReviewTitle;

  /// No description provided for @loadingCheckoutReview.
  ///
  /// In en, this message translates to:
  /// **'Loading cart and delivery addresses...'**
  String get loadingCheckoutReview;

  /// No description provided for @checkoutReviewLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not prepare checkout review.'**
  String get checkoutReviewLoadFailed;

  /// No description provided for @checkoutEmptyCartMessage.
  ///
  /// In en, this message translates to:
  /// **'Your cart is empty. Add a product before checkout.'**
  String get checkoutEmptyCartMessage;

  /// No description provided for @selectDeliveryAddressTitle.
  ///
  /// In en, this message translates to:
  /// **'Select delivery address'**
  String get selectDeliveryAddressTitle;

  /// No description provided for @noMatchingCheckoutAddress.
  ///
  /// In en, this message translates to:
  /// **'Add or edit an address with the same pincode as this cart before checkout.'**
  String get noMatchingCheckoutAddress;

  /// No description provided for @orderItemsTitle.
  ///
  /// In en, this message translates to:
  /// **'Order items'**
  String get orderItemsTitle;

  /// No description provided for @checkoutRevalidationNotice.
  ///
  /// In en, this message translates to:
  /// **'The server will revalidate offers, stock, batches, prices and delivery before creating orders.'**
  String get checkoutRevalidationNotice;

  /// No description provided for @creatingCheckoutLabel.
  ///
  /// In en, this message translates to:
  /// **'Creating secure checkout...'**
  String get creatingCheckoutLabel;

  /// No description provided for @confirmCheckoutAction.
  ///
  /// In en, this message translates to:
  /// **'Confirm and create checkout'**
  String get confirmCheckoutAction;

  /// No description provided for @checkoutCreatedMessage.
  ///
  /// In en, this message translates to:
  /// **'Checkout created and inventory reserved successfully.'**
  String get checkoutCreatedMessage;

  /// No description provided for @deliveryAddressTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery address'**
  String get deliveryAddressTitle;

  /// No description provided for @paymentNextStepMessage.
  ///
  /// In en, this message translates to:
  /// **'Your child orders are waiting for payment.'**
  String get paymentNextStepMessage;

  /// No description provided for @orderNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Order number'**
  String get orderNumberLabel;

  /// No description provided for @mockPaymentTitle.
  ///
  /// In en, this message translates to:
  /// **'Mock payment'**
  String get mockPaymentTitle;

  /// No description provided for @mockPaymentSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Server confirmation will move child orders from reserved to confirmed.'**
  String get mockPaymentSubtitle;

  /// No description provided for @mockPaymentActionLabel.
  ///
  /// In en, this message translates to:
  /// **'Confirm mock payment'**
  String get mockPaymentActionLabel;

  /// No description provided for @mockPaymentEnvironmentNotice.
  ///
  /// In en, this message translates to:
  /// **'Development mode only: this server-backed mock flow does not collect or transfer real money.'**
  String get mockPaymentEnvironmentNotice;

  /// No description provided for @mockPaymentSuccessAction.
  ///
  /// In en, this message translates to:
  /// **'Complete mock payment'**
  String get mockPaymentSuccessAction;

  /// No description provided for @mockPaymentFailureAction.
  ///
  /// In en, this message translates to:
  /// **'Simulate declined payment'**
  String get mockPaymentFailureAction;

  /// No description provided for @mockPaymentSucceededMessage.
  ///
  /// In en, this message translates to:
  /// **'The server confirmed payment and moved each child order to confirmed.'**
  String get mockPaymentSucceededMessage;

  /// No description provided for @checkoutCancelledMessage.
  ///
  /// In en, this message translates to:
  /// **'Checkout cancelled. The server released its reserved inventory.'**
  String get checkoutCancelledMessage;

  /// No description provided for @cancelCheckoutDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancel this checkout?'**
  String get cancelCheckoutDialogTitle;

  /// No description provided for @cancelCheckoutDialogMessage.
  ///
  /// In en, this message translates to:
  /// **'The server will cancel every eligible child order and release its inventory reservations.'**
  String get cancelCheckoutDialogMessage;

  /// No description provided for @keepCheckoutAction.
  ///
  /// In en, this message translates to:
  /// **'Keep checkout'**
  String get keepCheckoutAction;

  /// No description provided for @cancellationTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancellation'**
  String get cancellationTitle;

  /// No description provided for @cancellationSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Available before successful payment.'**
  String get cancellationSubtitle;

  /// No description provided for @cancellationActionLabel.
  ///
  /// In en, this message translates to:
  /// **'Cancel checkout'**
  String get cancellationActionLabel;

  /// No description provided for @cancellationStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Eligible'**
  String get cancellationStatusLabel;

  /// No description provided for @reservationReleaseLabel.
  ///
  /// In en, this message translates to:
  /// **'Reservation release'**
  String get reservationReleaseLabel;

  /// No description provided for @paymentStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Payment status'**
  String get paymentStatusLabel;

  /// No description provided for @paymentReferenceLabel.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get paymentReferenceLabel;

  /// No description provided for @paymentAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Payment amount'**
  String get paymentAmountLabel;

  /// No description provided for @childOrdersLabel.
  ///
  /// In en, this message translates to:
  /// **'Child orders'**
  String get childOrdersLabel;

  /// No description provided for @orderHistoryTitle.
  ///
  /// In en, this message translates to:
  /// **'My orders'**
  String get orderHistoryTitle;

  /// No description provided for @orderHistorySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track each seller order, delivery and invoice separately.'**
  String get orderHistorySubtitle;

  /// No description provided for @orderDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Order details'**
  String get orderDetailTitle;

  /// No description provided for @orderStatusFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'Filter by status'**
  String get orderStatusFilterLabel;

  /// No description provided for @allOrdersFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'All orders'**
  String get allOrdersFilterLabel;

  /// No description provided for @noOrdersMessage.
  ///
  /// In en, this message translates to:
  /// **'No product orders found for this filter.'**
  String get noOrdersMessage;

  /// No description provided for @noOrdersTitle.
  ///
  /// In en, this message translates to:
  /// **'No orders yet'**
  String get noOrdersTitle;

  /// No description provided for @noOrdersBrowseMessage.
  ///
  /// In en, this message translates to:
  /// **'Browse products available for delivery in your area.'**
  String get noOrdersBrowseMessage;

  /// No description provided for @goToShopAction.
  ///
  /// In en, this message translates to:
  /// **'Go to shop'**
  String get goToShopAction;

  /// No description provided for @orderSellerLabel.
  ///
  /// In en, this message translates to:
  /// **'Seller'**
  String get orderSellerLabel;

  /// No description provided for @trackOrderAction.
  ///
  /// In en, this message translates to:
  /// **'Track order'**
  String get trackOrderAction;

  /// No description provided for @orderLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load this order.'**
  String get orderLoadFailed;

  /// No description provided for @loadMoreOrdersAction.
  ///
  /// In en, this message translates to:
  /// **'Load more orders'**
  String get loadMoreOrdersAction;

  /// No description provided for @loadingMoreOrdersLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading more orders...'**
  String get loadingMoreOrdersLabel;

  /// No description provided for @loadingOrdersLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading your orders...'**
  String get loadingOrdersLabel;

  /// No description provided for @loadingOrderDetailLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading order details...'**
  String get loadingOrderDetailLabel;

  /// No description provided for @orderPlacedLabel.
  ///
  /// In en, this message translates to:
  /// **'Placed'**
  String get orderPlacedLabel;

  /// No description provided for @orderItemCountLabel.
  ///
  /// In en, this message translates to:
  /// **'{count} item(s)'**
  String orderItemCountLabel(int count);

  /// No description provided for @orderTimelineTitle.
  ///
  /// In en, this message translates to:
  /// **'Order timeline'**
  String get orderTimelineTitle;

  /// No description provided for @noOrderTimelineMessage.
  ///
  /// In en, this message translates to:
  /// **'No status history is available yet.'**
  String get noOrderTimelineMessage;

  /// No description provided for @fulfilmentTrackingTitle.
  ///
  /// In en, this message translates to:
  /// **'Fulfilment tracking'**
  String get fulfilmentTrackingTitle;

  /// No description provided for @dispatchNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Dispatch number'**
  String get dispatchNumberLabel;

  /// No description provided for @deliveryAssignmentLabel.
  ///
  /// In en, this message translates to:
  /// **'Delivery assignment'**
  String get deliveryAssignmentLabel;

  /// No description provided for @invoiceTitle.
  ///
  /// In en, this message translates to:
  /// **'Distributor invoice'**
  String get invoiceTitle;

  /// No description provided for @invoiceNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Invoice number'**
  String get invoiceNumberLabel;

  /// No description provided for @invoiceSellerLabel.
  ///
  /// In en, this message translates to:
  /// **'Seller'**
  String get invoiceSellerLabel;

  /// No description provided for @invoiceBuyerLabel.
  ///
  /// In en, this message translates to:
  /// **'Buyer'**
  String get invoiceBuyerLabel;

  /// No description provided for @invoiceGeneratedLabel.
  ///
  /// In en, this message translates to:
  /// **'Generated'**
  String get invoiceGeneratedLabel;

  /// No description provided for @invoiceTaxLabel.
  ///
  /// In en, this message translates to:
  /// **'Tax'**
  String get invoiceTaxLabel;

  /// No description provided for @invoiceTotalLabel.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get invoiceTotalLabel;

  /// No description provided for @invoiceNotGeneratedMessage.
  ///
  /// In en, this message translates to:
  /// **'The distributor invoice has not been generated yet.'**
  String get invoiceNotGeneratedMessage;

  /// No description provided for @invoicePdfPrepareAction.
  ///
  /// In en, this message translates to:
  /// **'Prepare invoice PDF'**
  String get invoicePdfPrepareAction;

  /// No description provided for @invoicePdfCheckStatusAction.
  ///
  /// In en, this message translates to:
  /// **'Check PDF status'**
  String get invoicePdfCheckStatusAction;

  /// No description provided for @invoicePdfDownloadAction.
  ///
  /// In en, this message translates to:
  /// **'Download invoice PDF'**
  String get invoicePdfDownloadAction;

  /// No description provided for @invoicePdfPreparingMessage.
  ///
  /// In en, this message translates to:
  /// **'Your invoice PDF is being prepared. Check again shortly.'**
  String get invoicePdfPreparingMessage;

  /// No description provided for @invoicePdfFailedMessage.
  ///
  /// In en, this message translates to:
  /// **'The invoice PDF could not be prepared. Try again.'**
  String get invoicePdfFailedMessage;

  /// No description provided for @invoicePdfOpenedMessage.
  ///
  /// In en, this message translates to:
  /// **'Invoice PDF opened in your browser.'**
  String get invoicePdfOpenedMessage;

  /// No description provided for @invoicePdfOpenFailedMessage.
  ///
  /// In en, this message translates to:
  /// **'Could not open the invoice PDF. Try again.'**
  String get invoicePdfOpenFailedMessage;

  /// No description provided for @cancelOrderAction.
  ///
  /// In en, this message translates to:
  /// **'Cancel this order'**
  String get cancelOrderAction;

  /// No description provided for @cancelOrderDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancel this seller order?'**
  String get cancelOrderDialogTitle;

  /// No description provided for @cancelOrderDialogMessage.
  ///
  /// In en, this message translates to:
  /// **'Only this child order will be cancelled. The server will release its inventory reservation. Other seller orders remain independent.'**
  String get cancelOrderDialogMessage;

  /// No description provided for @keepOrderAction.
  ///
  /// In en, this message translates to:
  /// **'Keep order'**
  String get keepOrderAction;

  /// No description provided for @orderStatusPendingPayment.
  ///
  /// In en, this message translates to:
  /// **'Pending payment'**
  String get orderStatusPendingPayment;

  /// No description provided for @orderStatusConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get orderStatusConfirmed;

  /// No description provided for @orderStatusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted by distributor'**
  String get orderStatusAccepted;

  /// No description provided for @orderStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected by distributor'**
  String get orderStatusRejected;

  /// No description provided for @orderStatusReadyToPack.
  ///
  /// In en, this message translates to:
  /// **'Ready to pack'**
  String get orderStatusReadyToPack;

  /// No description provided for @orderStatusPacked.
  ///
  /// In en, this message translates to:
  /// **'Packed'**
  String get orderStatusPacked;

  /// No description provided for @orderStatusReadyForPickup.
  ///
  /// In en, this message translates to:
  /// **'Ready for pickup'**
  String get orderStatusReadyForPickup;

  /// No description provided for @orderStatusOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Out for delivery'**
  String get orderStatusOutForDelivery;

  /// No description provided for @orderStatusDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get orderStatusDelivered;

  /// No description provided for @orderStatusReturnRequested.
  ///
  /// In en, this message translates to:
  /// **'Return requested'**
  String get orderStatusReturnRequested;

  /// No description provided for @orderStatusDeliveryFailed.
  ///
  /// In en, this message translates to:
  /// **'Delivery failed'**
  String get orderStatusDeliveryFailed;

  /// No description provided for @orderStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get orderStatusCancelled;

  /// No description provided for @orderStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get orderStatusClosed;

  /// No description provided for @orderStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get orderStatusLabel;

  /// No description provided for @reservedStockLabel.
  ///
  /// In en, this message translates to:
  /// **'Reserved stock'**
  String get reservedStockLabel;

  /// No description provided for @mockOnlyStatus.
  ///
  /// In en, this message translates to:
  /// **'Preview only'**
  String get mockOnlyStatus;

  /// No description provided for @paymentProcessingStatus.
  ///
  /// In en, this message translates to:
  /// **'Processing'**
  String get paymentProcessingStatus;

  /// No description provided for @paymentFailedStatus.
  ///
  /// In en, this message translates to:
  /// **'Payment failed'**
  String get paymentFailedStatus;

  /// No description provided for @readyStatus.
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get readyStatus;

  /// No description provided for @inventoryReservedStatus.
  ///
  /// In en, this message translates to:
  /// **'Inventory reserved'**
  String get inventoryReservedStatus;

  /// No description provided for @quantityLabel.
  ///
  /// In en, this message translates to:
  /// **'Qty'**
  String get quantityLabel;

  /// No description provided for @sellerLabel.
  ///
  /// In en, this message translates to:
  /// **'Seller'**
  String get sellerLabel;

  /// No description provided for @priceSnapshotLabel.
  ///
  /// In en, this message translates to:
  /// **'Price snapshot'**
  String get priceSnapshotLabel;

  /// No description provided for @supportAccess.
  ///
  /// In en, this message translates to:
  /// **'Support access'**
  String get supportAccess;

  /// No description provided for @supportAccessSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Create and track your support tickets.'**
  String get supportAccessSubtitle;

  /// No description provided for @supportTicketsTitle.
  ///
  /// In en, this message translates to:
  /// **'Support tickets'**
  String get supportTicketsTitle;

  /// No description provided for @createSupportTicketAction.
  ///
  /// In en, this message translates to:
  /// **'New ticket'**
  String get createSupportTicketAction;

  /// No description provided for @createSupportTicketTitle.
  ///
  /// In en, this message translates to:
  /// **'Create support ticket'**
  String get createSupportTicketTitle;

  /// No description provided for @supportTicketDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Support ticket'**
  String get supportTicketDetailTitle;

  /// No description provided for @supportTicketCreateIntro.
  ///
  /// In en, this message translates to:
  /// **'Describe the issue clearly. Support staff will manage the ticket through the marketplace.'**
  String get supportTicketCreateIntro;

  /// No description provided for @supportStatusFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'Filter by status'**
  String get supportStatusFilterLabel;

  /// No description provided for @allSupportTicketsFilter.
  ///
  /// In en, this message translates to:
  /// **'All tickets'**
  String get allSupportTicketsFilter;

  /// No description provided for @noSupportTicketsMessage.
  ///
  /// In en, this message translates to:
  /// **'You have not created any support tickets yet.'**
  String get noSupportTicketsMessage;

  /// No description provided for @supportTicketLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load this support ticket.'**
  String get supportTicketLoadFailed;

  /// No description provided for @loadMoreSupportTicketsAction.
  ///
  /// In en, this message translates to:
  /// **'Load more tickets'**
  String get loadMoreSupportTicketsAction;

  /// No description provided for @loadingMoreSupportTickets.
  ///
  /// In en, this message translates to:
  /// **'Loading more tickets...'**
  String get loadingMoreSupportTickets;

  /// No description provided for @loadingSupportTicketsLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading your support tickets...'**
  String get loadingSupportTicketsLabel;

  /// No description provided for @loadingSupportTicketDetailLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading support ticket details...'**
  String get loadingSupportTicketDetailLabel;

  /// No description provided for @supportCategoryLabel.
  ///
  /// In en, this message translates to:
  /// **'Issue category'**
  String get supportCategoryLabel;

  /// No description provided for @supportPriorityLabel.
  ///
  /// In en, this message translates to:
  /// **'Priority'**
  String get supportPriorityLabel;

  /// No description provided for @supportSubjectLabel.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get supportSubjectLabel;

  /// No description provided for @supportDescriptionLabel.
  ///
  /// In en, this message translates to:
  /// **'Describe the issue'**
  String get supportDescriptionLabel;

  /// No description provided for @supportMinimumLengthMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter at least 3 characters.'**
  String get supportMinimumLengthMessage;

  /// No description provided for @submitSupportTicketAction.
  ///
  /// In en, this message translates to:
  /// **'Submit ticket'**
  String get submitSupportTicketAction;

  /// No description provided for @linkedOrderLabel.
  ///
  /// In en, this message translates to:
  /// **'Linked seller order'**
  String get linkedOrderLabel;

  /// No description provided for @getHelpWithOrderAction.
  ///
  /// In en, this message translates to:
  /// **'Get help with this order'**
  String get getHelpWithOrderAction;

  /// No description provided for @supportCreatedLabel.
  ///
  /// In en, this message translates to:
  /// **'Created'**
  String get supportCreatedLabel;

  /// No description provided for @supportSlaDueLabel.
  ///
  /// In en, this message translates to:
  /// **'Response target'**
  String get supportSlaDueLabel;

  /// No description provided for @supportResolutionTitle.
  ///
  /// In en, this message translates to:
  /// **'Resolution note'**
  String get supportResolutionTitle;

  /// No description provided for @reopenSupportTicketAction.
  ///
  /// In en, this message translates to:
  /// **'Reopen ticket'**
  String get reopenSupportTicketAction;

  /// No description provided for @reopenSupportTicketTitle.
  ///
  /// In en, this message translates to:
  /// **'Reopen this ticket?'**
  String get reopenSupportTicketTitle;

  /// No description provided for @reopenReasonLabel.
  ///
  /// In en, this message translates to:
  /// **'What is still unresolved?'**
  String get reopenReasonLabel;

  /// No description provided for @supportEvidenceUnavailableMessage.
  ///
  /// In en, this message translates to:
  /// **'Attachments are unavailable until secure authorised file upload is implemented.'**
  String get supportEvidenceUnavailableMessage;

  /// No description provided for @supportConversationUnavailableMessage.
  ///
  /// In en, this message translates to:
  /// **'Ticket replies are not available yet. Pull down to refresh status and resolution updates.'**
  String get supportConversationUnavailableMessage;

  /// No description provided for @supportStatusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get supportStatusOpen;

  /// No description provided for @supportStatusAssigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned'**
  String get supportStatusAssigned;

  /// No description provided for @supportStatusWaitingForCustomer.
  ///
  /// In en, this message translates to:
  /// **'Waiting for you'**
  String get supportStatusWaitingForCustomer;

  /// No description provided for @supportStatusWaitingForSeller.
  ///
  /// In en, this message translates to:
  /// **'Waiting for seller'**
  String get supportStatusWaitingForSeller;

  /// No description provided for @supportStatusEscalated.
  ///
  /// In en, this message translates to:
  /// **'Escalated'**
  String get supportStatusEscalated;

  /// No description provided for @supportStatusResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved'**
  String get supportStatusResolved;

  /// No description provided for @supportStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get supportStatusClosed;

  /// No description provided for @supportStatusReopened.
  ///
  /// In en, this message translates to:
  /// **'Reopened'**
  String get supportStatusReopened;

  /// No description provided for @supportCategoryOrder.
  ///
  /// In en, this message translates to:
  /// **'Order issue'**
  String get supportCategoryOrder;

  /// No description provided for @supportCategoryPayment.
  ///
  /// In en, this message translates to:
  /// **'Payment issue'**
  String get supportCategoryPayment;

  /// No description provided for @supportCategoryDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery issue'**
  String get supportCategoryDelivery;

  /// No description provided for @supportCategoryProductQuality.
  ///
  /// In en, this message translates to:
  /// **'Product quality'**
  String get supportCategoryProductQuality;

  /// No description provided for @supportCategoryAccount.
  ///
  /// In en, this message translates to:
  /// **'Account issue'**
  String get supportCategoryAccount;

  /// No description provided for @supportCategoryOnboarding.
  ///
  /// In en, this message translates to:
  /// **'Onboarding issue'**
  String get supportCategoryOnboarding;

  /// No description provided for @supportCategoryOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get supportCategoryOther;

  /// No description provided for @supportPriorityLow.
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get supportPriorityLow;

  /// No description provided for @supportPriorityMedium.
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get supportPriorityMedium;

  /// No description provided for @supportPriorityHigh.
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get supportPriorityHigh;

  /// No description provided for @supportPriorityUrgent.
  ///
  /// In en, this message translates to:
  /// **'Urgent'**
  String get supportPriorityUrgent;

  /// No description provided for @notificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notificationsTitle;

  /// No description provided for @notificationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Read marketplace, order and support updates.'**
  String get notificationsSubtitle;

  /// No description provided for @notificationDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Notification'**
  String get notificationDetailTitle;

  /// No description provided for @unreadNotificationsOnlyLabel.
  ///
  /// In en, this message translates to:
  /// **'Show unread only'**
  String get unreadNotificationsOnlyLabel;

  /// No description provided for @noNotificationsMessage.
  ///
  /// In en, this message translates to:
  /// **'You do not have any in-app notifications yet.'**
  String get noNotificationsMessage;

  /// No description provided for @noUnreadNotificationsMessage.
  ///
  /// In en, this message translates to:
  /// **'You have read all your notifications.'**
  String get noUnreadNotificationsMessage;

  /// No description provided for @noNotificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet'**
  String get noNotificationsTitle;

  /// No description provided for @notificationOrdersCategory.
  ///
  /// In en, this message translates to:
  /// **'Orders'**
  String get notificationOrdersCategory;

  /// No description provided for @notificationKisanClubCategory.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club'**
  String get notificationKisanClubCategory;

  /// No description provided for @notificationAdvisoryCategory.
  ///
  /// In en, this message translates to:
  /// **'Advisory'**
  String get notificationAdvisoryCategory;

  /// No description provided for @notificationSupportCategory.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get notificationSupportCategory;

  /// No description provided for @notificationReturnsCategory.
  ///
  /// In en, this message translates to:
  /// **'Returns'**
  String get notificationReturnsCategory;

  /// No description provided for @notificationOtherCategory.
  ///
  /// In en, this message translates to:
  /// **'Updates'**
  String get notificationOtherCategory;

  /// No description provided for @notificationLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load this notification.'**
  String get notificationLoadFailed;

  /// No description provided for @loadMoreNotificationsAction.
  ///
  /// In en, this message translates to:
  /// **'Load more notifications'**
  String get loadMoreNotificationsAction;

  /// No description provided for @loadingMoreNotificationsLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading more notifications...'**
  String get loadingMoreNotificationsLabel;

  /// No description provided for @loadingNotificationsLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading your notifications...'**
  String get loadingNotificationsLabel;

  /// No description provided for @loadingNotificationDetailLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading notification details...'**
  String get loadingNotificationDetailLabel;

  /// No description provided for @openNotificationResourceAction.
  ///
  /// In en, this message translates to:
  /// **'Open related item'**
  String get openNotificationResourceAction;

  /// No description provided for @contactSupportTitle.
  ///
  /// In en, this message translates to:
  /// **'Contact support'**
  String get contactSupportTitle;

  /// No description provided for @contactSupportSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Call or message the configured Vardhnam support desk.'**
  String get contactSupportSubtitle;

  /// No description provided for @callSupportAction.
  ///
  /// In en, this message translates to:
  /// **'Call support'**
  String get callSupportAction;

  /// No description provided for @whatsAppSupportAction.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp support'**
  String get whatsAppSupportAction;

  /// No description provided for @whatsAppSupportMessage.
  ///
  /// In en, this message translates to:
  /// **'Hello Vardhnam Support, I need help with the farmer app.'**
  String get whatsAppSupportMessage;

  /// No description provided for @supportContactUnavailableMessage.
  ///
  /// In en, this message translates to:
  /// **'Phone and WhatsApp support details are not configured for this environment. You can still create a support ticket below.'**
  String get supportContactUnavailableMessage;

  /// No description provided for @supportContactLaunchFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not open the selected support app.'**
  String get supportContactLaunchFailed;

  /// No description provided for @requestReturnAction.
  ///
  /// In en, this message translates to:
  /// **'Request a return'**
  String get requestReturnAction;

  /// No description provided for @returnRequestTitle.
  ///
  /// In en, this message translates to:
  /// **'Return request'**
  String get returnRequestTitle;

  /// No description provided for @returnRequestIntro.
  ///
  /// In en, this message translates to:
  /// **'Choose the items and quantities to return from this seller order. Eligibility and amounts are checked by the marketplace server.'**
  String get returnRequestIntro;

  /// No description provided for @loadingReturnEligibilityLabel.
  ///
  /// In en, this message translates to:
  /// **'Checking return eligibility...'**
  String get loadingReturnEligibilityLabel;

  /// No description provided for @returnEligibilityLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not check return eligibility.'**
  String get returnEligibilityLoadFailed;

  /// No description provided for @returnNotEligibleMessage.
  ///
  /// In en, this message translates to:
  /// **'This order is not eligible for a return.'**
  String get returnNotEligibleMessage;

  /// No description provided for @returnWindowEndsLabel.
  ///
  /// In en, this message translates to:
  /// **'Return window ends on {date}'**
  String returnWindowEndsLabel(String date);

  /// No description provided for @returnItemsTitle.
  ///
  /// In en, this message translates to:
  /// **'Items to return'**
  String get returnItemsTitle;

  /// No description provided for @doNotReturnItemLabel.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get doNotReturnItemLabel;

  /// No description provided for @returnReasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Reason for return'**
  String get returnReasonLabel;

  /// No description provided for @returnReasonNoteLabel.
  ///
  /// In en, this message translates to:
  /// **'Additional details'**
  String get returnReasonNoteLabel;

  /// No description provided for @returnReasonNoteRequiredMessage.
  ///
  /// In en, this message translates to:
  /// **'Details are required when you select Other.'**
  String get returnReasonNoteRequiredMessage;

  /// No description provided for @returnInventorySafetyMessage.
  ///
  /// In en, this message translates to:
  /// **'Submitting a return does not put the goods back into sellable stock. The seller must inspect them first.'**
  String get returnInventorySafetyMessage;

  /// No description provided for @submitReturnRequestAction.
  ///
  /// In en, this message translates to:
  /// **'Submit return request'**
  String get submitReturnRequestAction;

  /// No description provided for @returnRequestSubmittedMessage.
  ///
  /// In en, this message translates to:
  /// **'Your return request was submitted.'**
  String get returnRequestSubmittedMessage;

  /// No description provided for @returnReasonDamaged.
  ///
  /// In en, this message translates to:
  /// **'Damaged in transit'**
  String get returnReasonDamaged;

  /// No description provided for @returnReasonWrongItem.
  ///
  /// In en, this message translates to:
  /// **'Wrong item'**
  String get returnReasonWrongItem;

  /// No description provided for @returnReasonExpiry.
  ///
  /// In en, this message translates to:
  /// **'Expired or near expiry'**
  String get returnReasonExpiry;

  /// No description provided for @returnReasonQuality.
  ///
  /// In en, this message translates to:
  /// **'Quality issue'**
  String get returnReasonQuality;

  /// No description provided for @returnReasonNotAsDescribed.
  ///
  /// In en, this message translates to:
  /// **'Not as described'**
  String get returnReasonNotAsDescribed;

  /// No description provided for @returnReasonMistake.
  ///
  /// In en, this message translates to:
  /// **'Ordered by mistake'**
  String get returnReasonMistake;

  /// No description provided for @returnReasonOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get returnReasonOther;

  /// No description provided for @myReturnsTitle.
  ///
  /// In en, this message translates to:
  /// **'My returns'**
  String get myReturnsTitle;

  /// No description provided for @myReturnsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track return requests for each seller order.'**
  String get myReturnsSubtitle;

  /// No description provided for @returnStatusFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'Return status'**
  String get returnStatusFilterLabel;

  /// No description provided for @allReturnsFilter.
  ///
  /// In en, this message translates to:
  /// **'All returns'**
  String get allReturnsFilter;

  /// No description provided for @loadingReturnsLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading your return requests...'**
  String get loadingReturnsLabel;

  /// No description provided for @loadingMoreReturnsLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading more returns...'**
  String get loadingMoreReturnsLabel;

  /// No description provided for @loadMoreReturnsAction.
  ///
  /// In en, this message translates to:
  /// **'Load more returns'**
  String get loadMoreReturnsAction;

  /// No description provided for @noReturnsMessage.
  ///
  /// In en, this message translates to:
  /// **'You have not requested a return yet.'**
  String get noReturnsMessage;

  /// No description provided for @returnDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Return details'**
  String get returnDetailTitle;

  /// No description provided for @loadingReturnDetailLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading return details...'**
  String get loadingReturnDetailLabel;

  /// No description provided for @returnDetailLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load this return request.'**
  String get returnDetailLoadFailed;

  /// No description provided for @returnRequestedOnLabel.
  ///
  /// In en, this message translates to:
  /// **'Requested on {date}'**
  String returnRequestedOnLabel(String date);

  /// No description provided for @returnExpectedAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Expected return amount: {amount}'**
  String returnExpectedAmountLabel(String amount);

  /// No description provided for @returnTimelineTitle.
  ///
  /// In en, this message translates to:
  /// **'Return timeline'**
  String get returnTimelineTitle;

  /// No description provided for @returnTimelineEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'No return status updates are available yet.'**
  String get returnTimelineEmptyMessage;

  /// No description provided for @openRelatedOrderAction.
  ///
  /// In en, this message translates to:
  /// **'Open seller order'**
  String get openRelatedOrderAction;

  /// No description provided for @returnStatusRequested.
  ///
  /// In en, this message translates to:
  /// **'Requested'**
  String get returnStatusRequested;

  /// No description provided for @returnStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get returnStatusApproved;

  /// No description provided for @returnStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get returnStatusRejected;

  /// No description provided for @returnStatusInTransit.
  ///
  /// In en, this message translates to:
  /// **'In transit'**
  String get returnStatusInTransit;

  /// No description provided for @returnStatusReceived.
  ///
  /// In en, this message translates to:
  /// **'Received by seller'**
  String get returnStatusReceived;

  /// No description provided for @returnStatusInspected.
  ///
  /// In en, this message translates to:
  /// **'Inspected'**
  String get returnStatusInspected;

  /// No description provided for @returnStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get returnStatusCompleted;

  /// No description provided for @returnStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get returnStatusCancelled;

  /// No description provided for @cancelReturnAction.
  ///
  /// In en, this message translates to:
  /// **'Cancel return'**
  String get cancelReturnAction;

  /// No description provided for @cancelReturnDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancel this return?'**
  String get cancelReturnDialogTitle;

  /// No description provided for @cancelReturnDialogMessage.
  ///
  /// In en, this message translates to:
  /// **'You can cancel before pickup. The seller order will return to Delivered status.'**
  String get cancelReturnDialogMessage;

  /// No description provided for @keepReturnAction.
  ///
  /// In en, this message translates to:
  /// **'Keep return'**
  String get keepReturnAction;

  /// No description provided for @returnCancelledMessage.
  ///
  /// In en, this message translates to:
  /// **'Your return request was cancelled.'**
  String get returnCancelledMessage;

  /// No description provided for @returnApprovedAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Approved refund amount: {amount}'**
  String returnApprovedAmountLabel(String amount);

  /// No description provided for @returnInspectionNoteLabel.
  ///
  /// In en, this message translates to:
  /// **'Inspection note'**
  String get returnInspectionNoteLabel;

  /// No description provided for @returnRefundStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Refund status: {status}'**
  String returnRefundStatusLabel(String status);

  /// No description provided for @returnRefundReferenceLabel.
  ///
  /// In en, this message translates to:
  /// **'Refund reference: {reference}'**
  String returnRefundReferenceLabel(String reference);

  /// No description provided for @creditNoteTitle.
  ///
  /// In en, this message translates to:
  /// **'Refund credit note'**
  String get creditNoteTitle;

  /// No description provided for @creditNoteViewAction.
  ///
  /// In en, this message translates to:
  /// **'View credit note'**
  String get creditNoteViewAction;

  /// No description provided for @creditNoteCheckStatusAction.
  ///
  /// In en, this message translates to:
  /// **'Check credit note status'**
  String get creditNoteCheckStatusAction;

  /// No description provided for @creditNoteDownloadAction.
  ///
  /// In en, this message translates to:
  /// **'Download credit note PDF'**
  String get creditNoteDownloadAction;

  /// No description provided for @creditNotePreparingMessage.
  ///
  /// In en, this message translates to:
  /// **'Your credit note PDF is being prepared. Check again shortly.'**
  String get creditNotePreparingMessage;

  /// No description provided for @creditNoteFailedMessage.
  ///
  /// In en, this message translates to:
  /// **'The credit note PDF could not be prepared. Check again later.'**
  String get creditNoteFailedMessage;

  /// No description provided for @creditNoteOpenedMessage.
  ///
  /// In en, this message translates to:
  /// **'Credit note PDF opened in your browser.'**
  String get creditNoteOpenedMessage;

  /// No description provided for @creditNoteOpenFailedMessage.
  ///
  /// In en, this message translates to:
  /// **'Could not open the credit note PDF. Try again.'**
  String get creditNoteOpenFailedMessage;

  /// No description provided for @creditNoteNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Credit note: {number}'**
  String creditNoteNumberLabel(String number);

  /// No description provided for @creditNoteOriginalInvoiceLabel.
  ///
  /// In en, this message translates to:
  /// **'Original invoice: {number}'**
  String creditNoteOriginalInvoiceLabel(String number);

  /// No description provided for @creditNoteRefundAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Refund amount: {amount}'**
  String creditNoteRefundAmountLabel(String amount);

  /// No description provided for @creditNoteTaxLabel.
  ///
  /// In en, this message translates to:
  /// **'Tax credited: {amount}'**
  String creditNoteTaxLabel(String amount);

  /// No description provided for @refundStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get refundStatusPending;

  /// No description provided for @refundStatusProcessing.
  ///
  /// In en, this message translates to:
  /// **'Processing'**
  String get refundStatusProcessing;

  /// No description provided for @refundStatusSucceeded.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get refundStatusSucceeded;

  /// No description provided for @refundStatusFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get refundStatusFailed;

  /// No description provided for @refundStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get refundStatusCancelled;

  /// No description provided for @kisanClubTitle.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club'**
  String get kisanClubTitle;

  /// No description provided for @kisanClubLoading.
  ///
  /// In en, this message translates to:
  /// **'Checking your Kisan Club membership...'**
  String get kisanClubLoading;

  /// No description provided for @kisanClubLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load Kisan Club right now.'**
  String get kisanClubLoadFailed;

  /// No description provided for @kisanClubUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club is not available in this environment.'**
  String get kisanClubUnavailable;

  /// No description provided for @kisanClubJoinTitle.
  ///
  /// In en, this message translates to:
  /// **'Join Kisan Club'**
  String get kisanClubJoinTitle;

  /// No description provided for @kisanClubJoinSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Free membership, local support and eligible product benefits.'**
  String get kisanClubJoinSubtitle;

  /// No description provided for @kisanClubFreeMembership.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club membership is free. Only your pincode and acceptance of the programme terms are required to join.'**
  String get kisanClubFreeMembership;

  /// No description provided for @kisanClubTermsSummary.
  ///
  /// In en, this message translates to:
  /// **'By joining, you agree to the current Kisan Club programme terms. Advisory, marketing and precise-location permissions are separate and optional.'**
  String get kisanClubTermsSummary;

  /// No description provided for @kisanClubAcceptTerms.
  ///
  /// In en, this message translates to:
  /// **'I accept the Kisan Club programme terms'**
  String get kisanClubAcceptTerms;

  /// No description provided for @kisanClubTermsRequired.
  ///
  /// In en, this message translates to:
  /// **'Accept the programme terms to join Kisan Club.'**
  String get kisanClubTermsRequired;

  /// No description provided for @kisanClubOptionalConsentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Optional permissions'**
  String get kisanClubOptionalConsentsTitle;

  /// No description provided for @kisanClubOptionalConsentsMessage.
  ///
  /// In en, this message translates to:
  /// **'You can decline or change these choices later without losing membership.'**
  String get kisanClubOptionalConsentsMessage;

  /// No description provided for @kisanClubAdvisoryConsent.
  ///
  /// In en, this message translates to:
  /// **'Crop and farm advisory messages'**
  String get kisanClubAdvisoryConsent;

  /// No description provided for @kisanClubMarketingConsent.
  ///
  /// In en, this message translates to:
  /// **'Offers and marketing messages'**
  String get kisanClubMarketingConsent;

  /// No description provided for @kisanClubLocationConsent.
  ///
  /// In en, this message translates to:
  /// **'Precise farm location'**
  String get kisanClubLocationConsent;

  /// No description provided for @kisanClubLocationConsentHelp.
  ///
  /// In en, this message translates to:
  /// **'Location is optional. Pincode-level service continues when it is off.'**
  String get kisanClubLocationConsentHelp;

  /// No description provided for @kisanClubJoinAction.
  ///
  /// In en, this message translates to:
  /// **'Join free'**
  String get kisanClubJoinAction;

  /// No description provided for @kisanClubJoinSuccess.
  ///
  /// In en, this message translates to:
  /// **'You joined Kisan Club.'**
  String get kisanClubJoinSuccess;

  /// No description provided for @kisanClubJoinFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not join Kisan Club. Please try again.'**
  String get kisanClubJoinFailed;

  /// No description provided for @kisanClubConsentSaved.
  ///
  /// In en, this message translates to:
  /// **'Your permission choices were saved.'**
  String get kisanClubConsentSaved;

  /// No description provided for @kisanClubConsentSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Membership was saved, but permission choices could not be updated. You can retry from Kisan Club.'**
  String get kisanClubConsentSaveFailed;

  /// No description provided for @kisanClubSaveConsentsAction.
  ///
  /// In en, this message translates to:
  /// **'Save choices'**
  String get kisanClubSaveConsentsAction;

  /// No description provided for @kisanClubHomeIntro.
  ///
  /// In en, this message translates to:
  /// **'Your Kisan Club membership and programme progress.'**
  String get kisanClubHomeIntro;

  /// No description provided for @kisanClubMemberNumber.
  ///
  /// In en, this message translates to:
  /// **'Member number: {memberNumber}'**
  String kisanClubMemberNumber(String memberNumber);

  /// No description provided for @kisanClubHomePincode.
  ///
  /// In en, this message translates to:
  /// **'Home pincode: {pincode}'**
  String kisanClubHomePincode(String pincode);

  /// No description provided for @kisanClubStatusPendingProfile.
  ///
  /// In en, this message translates to:
  /// **'Farm profile incomplete'**
  String get kisanClubStatusPendingProfile;

  /// No description provided for @kisanClubStatusAwaitingPromoter.
  ///
  /// In en, this message translates to:
  /// **'Waiting for local promoter'**
  String get kisanClubStatusAwaitingPromoter;

  /// No description provided for @kisanClubStatusActive.
  ///
  /// In en, this message translates to:
  /// **'Active member'**
  String get kisanClubStatusActive;

  /// No description provided for @kisanClubStatusSuspended.
  ///
  /// In en, this message translates to:
  /// **'Membership suspended'**
  String get kisanClubStatusSuspended;

  /// No description provided for @kisanClubStatusInactive.
  ///
  /// In en, this message translates to:
  /// **'Membership inactive'**
  String get kisanClubStatusInactive;

  /// No description provided for @kisanClubStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Membership closed'**
  String get kisanClubStatusClosed;

  /// No description provided for @kisanClubCompleteProfileMessage.
  ///
  /// In en, this message translates to:
  /// **'Complete your farm details to continue.'**
  String get kisanClubCompleteProfileMessage;

  /// No description provided for @kisanClubCompleteProfileAction.
  ///
  /// In en, this message translates to:
  /// **'Complete profile'**
  String get kisanClubCompleteProfileAction;

  /// No description provided for @kisanClubProfileCompletionTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete Club profile'**
  String get kisanClubProfileCompletionTitle;

  /// No description provided for @kisanClubProfileStepOneTitle.
  ///
  /// In en, this message translates to:
  /// **'Step 1 of 2: Add your first farm'**
  String get kisanClubProfileStepOneTitle;

  /// No description provided for @kisanClubProfileStepOneMessage.
  ///
  /// In en, this message translates to:
  /// **'Add the farm name, pincode, area and ownership details. Use the Add farm button below.'**
  String get kisanClubProfileStepOneMessage;

  /// No description provided for @kisanClubProfileStepTwoTitle.
  ///
  /// In en, this message translates to:
  /// **'Step 2 of 2: Add the crop you are growing'**
  String get kisanClubProfileStepTwoTitle;

  /// No description provided for @kisanClubProfileStepTwoMessage.
  ///
  /// In en, this message translates to:
  /// **'Use Add crop cycle on a farm and select the crop, cultivated area and season.'**
  String get kisanClubProfileStepTwoMessage;

  /// No description provided for @kisanClubProfileSavedProgressMessage.
  ///
  /// In en, this message translates to:
  /// **'Your progress is saved securely. You can leave and continue later.'**
  String get kisanClubProfileSavedProgressMessage;

  /// No description provided for @kisanClubProfileCompletedMessage.
  ///
  /// In en, this message translates to:
  /// **'Club farm profile completed.'**
  String get kisanClubProfileCompletedMessage;

  /// No description provided for @kisanClubFindingPromoterMessage.
  ///
  /// In en, this message translates to:
  /// **'We are finding your local Kisan Club partner.'**
  String get kisanClubFindingPromoterMessage;

  /// No description provided for @kisanClubActiveMessage.
  ///
  /// In en, this message translates to:
  /// **'Your Kisan Club membership is active.'**
  String get kisanClubActiveMessage;

  /// No description provided for @kisanClubSuspendedMessage.
  ///
  /// In en, this message translates to:
  /// **'Your membership is read-only. Contact support for help.'**
  String get kisanClubSuspendedMessage;

  /// No description provided for @kisanClubInactiveMessage.
  ///
  /// In en, this message translates to:
  /// **'This membership is not active. Contact support for help.'**
  String get kisanClubInactiveMessage;

  /// No description provided for @kisanClubOpenSupportAction.
  ///
  /// In en, this message translates to:
  /// **'Open support'**
  String get kisanClubOpenSupportAction;

  /// No description provided for @kisanClubCatalogueTitle.
  ///
  /// In en, this message translates to:
  /// **'Club products'**
  String get kisanClubCatalogueTitle;

  /// No description provided for @kisanClubCatalogueSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Browse products selected for your Kisan Club area.'**
  String get kisanClubCatalogueSubtitle;

  /// No description provided for @kisanClubEligibleProductsLabel.
  ///
  /// In en, this message translates to:
  /// **'Eligible Club products'**
  String get kisanClubEligibleProductsLabel;

  /// No description provided for @kisanClubEligibleBadge.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club Benefit'**
  String get kisanClubEligibleBadge;

  /// No description provided for @kisanClubBenefitCalculatedInCart.
  ///
  /// In en, this message translates to:
  /// **'Choose a seller offer. Any available Club benefit is calculated securely when it is added to your cart.'**
  String get kisanClubBenefitCalculatedInCart;

  /// No description provided for @kisanClubBenefitAddedMessage.
  ///
  /// In en, this message translates to:
  /// **'Added to cart with an estimated Club benefit of {amount}.'**
  String kisanClubBenefitAddedMessage(String amount);

  /// No description provided for @kisanClubBenefitLabel.
  ///
  /// In en, this message translates to:
  /// **'Kisan Club benefit'**
  String get kisanClubBenefitLabel;

  /// No description provided for @kisanClubFarmerPayableLabel.
  ///
  /// In en, this message translates to:
  /// **'You pay'**
  String get kisanClubFarmerPayableLabel;

  /// No description provided for @kisanClubLineBenefitLabel.
  ///
  /// In en, this message translates to:
  /// **'Club benefit: {amount}'**
  String kisanClubLineBenefitLabel(String amount);

  /// No description provided for @kisanClubBenefitsTitle.
  ///
  /// In en, this message translates to:
  /// **'Benefit tokens'**
  String get kisanClubBenefitsTitle;

  /// No description provided for @kisanClubBenefitsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'View codes created for promoter-assisted purchases.'**
  String get kisanClubBenefitsSubtitle;

  /// No description provided for @kisanClubBenefitsLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading your benefit tokens...'**
  String get kisanClubBenefitsLoading;

  /// No description provided for @kisanClubBenefitsLoadingMore.
  ///
  /// In en, this message translates to:
  /// **'Loading more tokens...'**
  String get kisanClubBenefitsLoadingMore;

  /// No description provided for @kisanClubBenefitsLoadMore.
  ///
  /// In en, this message translates to:
  /// **'Load more tokens'**
  String get kisanClubBenefitsLoadMore;

  /// No description provided for @kisanClubBenefitsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No benefit tokens yet. Choose an eligible Club product to create one.'**
  String get kisanClubBenefitsEmpty;

  /// No description provided for @kisanClubTokenStatusFilterLabel.
  ///
  /// In en, this message translates to:
  /// **'Token status'**
  String get kisanClubTokenStatusFilterLabel;

  /// No description provided for @kisanClubTokenStatusAll.
  ///
  /// In en, this message translates to:
  /// **'All token statuses'**
  String get kisanClubTokenStatusAll;

  /// No description provided for @kisanClubTokenCreateAction.
  ///
  /// In en, this message translates to:
  /// **'Create promoter token'**
  String get kisanClubTokenCreateAction;

  /// No description provided for @kisanClubTokenCreating.
  ///
  /// In en, this message translates to:
  /// **'Creating secure token...'**
  String get kisanClubTokenCreating;

  /// No description provided for @kisanClubTokenCreatedTitle.
  ///
  /// In en, this message translates to:
  /// **'Benefit token created'**
  String get kisanClubTokenCreatedTitle;

  /// No description provided for @kisanClubTokenCreatedMessage.
  ///
  /// In en, this message translates to:
  /// **'Share this code only with your assigned Kisan Club promoter. It is shown only once.'**
  String get kisanClubTokenCreatedMessage;

  /// No description provided for @kisanClubTokenSecurityWarning.
  ///
  /// In en, this message translates to:
  /// **'The code authorises an assisted order. The current price and benefit will be checked again before the order is created. You will still pay in the app.'**
  String get kisanClubTokenSecurityWarning;

  /// No description provided for @kisanClubTokenSavedAction.
  ///
  /// In en, this message translates to:
  /// **'I saved the code'**
  String get kisanClubTokenSavedAction;

  /// No description provided for @kisanClubTokenCodeNotRecoverable.
  ///
  /// In en, this message translates to:
  /// **'For security, the complete code cannot be shown again. Create a new token if you did not save it.'**
  String get kisanClubTokenCodeNotRecoverable;

  /// No description provided for @kisanClubTokenStatusIssued.
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get kisanClubTokenStatusIssued;

  /// No description provided for @kisanClubTokenStatusRedeemed.
  ///
  /// In en, this message translates to:
  /// **'Used'**
  String get kisanClubTokenStatusRedeemed;

  /// No description provided for @kisanClubTokenStatusExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get kisanClubTokenStatusExpired;

  /// No description provided for @kisanClubTokenStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get kisanClubTokenStatusCancelled;

  /// No description provided for @kisanClubTokenReference.
  ///
  /// In en, this message translates to:
  /// **'Reference: {reference}'**
  String kisanClubTokenReference(String reference);

  /// No description provided for @kisanClubTokenSeller.
  ///
  /// In en, this message translates to:
  /// **'Seller: {seller}'**
  String kisanClubTokenSeller(String seller);

  /// No description provided for @kisanClubTokenQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity: {quantity}'**
  String kisanClubTokenQuantity(int quantity);

  /// No description provided for @kisanClubTokenBenefit.
  ///
  /// In en, this message translates to:
  /// **'Quoted Club benefit: {amount}'**
  String kisanClubTokenBenefit(String amount);

  /// No description provided for @kisanClubTokenPayable.
  ///
  /// In en, this message translates to:
  /// **'Quoted amount to pay: {amount}'**
  String kisanClubTokenPayable(String amount);

  /// No description provided for @kisanClubTokenExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires: {date}'**
  String kisanClubTokenExpires(String date);

  /// No description provided for @myFarmsTitle.
  ///
  /// In en, this message translates to:
  /// **'My farms'**
  String get myFarmsTitle;

  /// No description provided for @myFarmsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Record farm area and crops for Kisan Club support.'**
  String get myFarmsSubtitle;

  /// No description provided for @myFarmsLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading your farms...'**
  String get myFarmsLoading;

  /// No description provided for @myFarmsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No farms have been added yet. Add your first farm to continue your Club profile.'**
  String get myFarmsEmpty;

  /// No description provided for @addFarmAction.
  ///
  /// In en, this message translates to:
  /// **'Add farm'**
  String get addFarmAction;

  /// No description provided for @addFarmTitle.
  ///
  /// In en, this message translates to:
  /// **'Add a farm'**
  String get addFarmTitle;

  /// No description provided for @editFarmAction.
  ///
  /// In en, this message translates to:
  /// **'Edit farm'**
  String get editFarmAction;

  /// No description provided for @editFarmTitle.
  ///
  /// In en, this message translates to:
  /// **'Edit farm details'**
  String get editFarmTitle;

  /// No description provided for @farmActiveLabel.
  ///
  /// In en, this message translates to:
  /// **'Farm is active'**
  String get farmActiveLabel;

  /// No description provided for @saveFarmChangesAction.
  ///
  /// In en, this message translates to:
  /// **'Save changes'**
  String get saveFarmChangesAction;

  /// No description provided for @savingFarmChangesLabel.
  ///
  /// In en, this message translates to:
  /// **'Saving changes...'**
  String get savingFarmChangesLabel;

  /// No description provided for @farmNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Farm name'**
  String get farmNameLabel;

  /// No description provided for @farmVillageLabel.
  ///
  /// In en, this message translates to:
  /// **'Village (optional)'**
  String get farmVillageLabel;

  /// No description provided for @farmAreaLabel.
  ///
  /// In en, this message translates to:
  /// **'Area in acres'**
  String get farmAreaLabel;

  /// No description provided for @farmOwnershipLabel.
  ///
  /// In en, this message translates to:
  /// **'Ownership'**
  String get farmOwnershipLabel;

  /// No description provided for @farmOwnershipOwned.
  ///
  /// In en, this message translates to:
  /// **'Owned'**
  String get farmOwnershipOwned;

  /// No description provided for @farmOwnershipLeased.
  ///
  /// In en, this message translates to:
  /// **'Leased'**
  String get farmOwnershipLeased;

  /// No description provided for @farmOwnershipSharecropped.
  ///
  /// In en, this message translates to:
  /// **'Sharecropped'**
  String get farmOwnershipSharecropped;

  /// No description provided for @farmOwnershipOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get farmOwnershipOther;

  /// No description provided for @invalidFarmAreaMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter a farm area greater than zero.'**
  String get invalidFarmAreaMessage;

  /// No description provided for @saveFarmAction.
  ///
  /// In en, this message translates to:
  /// **'Save farm'**
  String get saveFarmAction;

  /// No description provided for @savingFarmLabel.
  ///
  /// In en, this message translates to:
  /// **'Saving farm...'**
  String get savingFarmLabel;

  /// No description provided for @farmAreaAndPincode.
  ///
  /// In en, this message translates to:
  /// **'{area} acres · {pincode}'**
  String farmAreaAndPincode(String area, String pincode);

  /// No description provided for @cropCyclesCount.
  ///
  /// In en, this message translates to:
  /// **'Crop cycles: {count}'**
  String cropCyclesCount(int count);

  /// No description provided for @noCropCyclesYet.
  ///
  /// In en, this message translates to:
  /// **'No crop cycle added yet.'**
  String get noCropCyclesYet;

  /// No description provided for @acresUnit.
  ///
  /// In en, this message translates to:
  /// **'acres'**
  String get acresUnit;

  /// No description provided for @addCropCycleAction.
  ///
  /// In en, this message translates to:
  /// **'Add crop cycle'**
  String get addCropCycleAction;

  /// No description provided for @addCropCycleTitle.
  ///
  /// In en, this message translates to:
  /// **'Add crop to {farmName}'**
  String addCropCycleTitle(String farmName);

  /// No description provided for @referenceCropsLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading crop list...'**
  String get referenceCropsLoading;

  /// No description provided for @referenceCropsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No approved crop references are available. Please contact support.'**
  String get referenceCropsEmpty;

  /// No description provided for @cropReferenceLabel.
  ///
  /// In en, this message translates to:
  /// **'Crop'**
  String get cropReferenceLabel;

  /// No description provided for @cropReferenceRequired.
  ///
  /// In en, this message translates to:
  /// **'Select a crop from the approved list.'**
  String get cropReferenceRequired;

  /// No description provided for @cropVarietyLabel.
  ///
  /// In en, this message translates to:
  /// **'Variety name (optional)'**
  String get cropVarietyLabel;

  /// No description provided for @cropAreaLabel.
  ///
  /// In en, this message translates to:
  /// **'Crop area in acres'**
  String get cropAreaLabel;

  /// No description provided for @cropAreaLimit.
  ///
  /// In en, this message translates to:
  /// **'Cannot exceed this farm\'s {area} acres.'**
  String cropAreaLimit(String area);

  /// No description provided for @invalidCropAreaMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter a crop area greater than zero and within the farm area.'**
  String get invalidCropAreaMessage;

  /// No description provided for @cropSeasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Season code'**
  String get cropSeasonLabel;

  /// No description provided for @cropSeasonHint.
  ///
  /// In en, this message translates to:
  /// **'Example: RABI_2026_27'**
  String get cropSeasonHint;

  /// No description provided for @invalidCropSeasonMessage.
  ///
  /// In en, this message translates to:
  /// **'Use 2–40 letters, numbers, hyphens or underscores.'**
  String get invalidCropSeasonMessage;

  /// No description provided for @saveCropCycleAction.
  ///
  /// In en, this message translates to:
  /// **'Save crop cycle'**
  String get saveCropCycleAction;

  /// No description provided for @savingCropCycleLabel.
  ///
  /// In en, this message translates to:
  /// **'Saving crop cycle...'**
  String get savingCropCycleLabel;

  /// No description provided for @editCropCycleAction.
  ///
  /// In en, this message translates to:
  /// **'Edit crop cycle'**
  String get editCropCycleAction;

  /// No description provided for @editCropCycleTitle.
  ///
  /// In en, this message translates to:
  /// **'Edit crop cycle'**
  String get editCropCycleTitle;

  /// No description provided for @saveCropCycleChangesAction.
  ///
  /// In en, this message translates to:
  /// **'Save changes'**
  String get saveCropCycleChangesAction;

  /// No description provided for @savingCropCycleChangesLabel.
  ///
  /// In en, this message translates to:
  /// **'Saving changes...'**
  String get savingCropCycleChangesLabel;

  /// No description provided for @myPromoterTitle.
  ///
  /// In en, this message translates to:
  /// **'My Kisan Club promoter'**
  String get myPromoterTitle;

  /// No description provided for @myPromoterSubtitle.
  ///
  /// In en, this message translates to:
  /// **'View your assigned local Club partner.'**
  String get myPromoterSubtitle;

  /// No description provided for @myPromoterAwaitingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'We are still finding your local Club partner.'**
  String get myPromoterAwaitingSubtitle;

  /// No description provided for @myPromoterLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading your promoter assignment...'**
  String get myPromoterLoading;

  /// No description provided for @myPromoterAwaitingMessage.
  ///
  /// In en, this message translates to:
  /// **'No promoter is assigned yet. Kisan Club operations are finding an eligible local partner for you.'**
  String get myPromoterAwaitingMessage;

  /// No description provided for @myPromoterNameUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Assigned Kisan Club promoter'**
  String get myPromoterNameUnavailable;

  /// No description provided for @myPromoterAssignedOn.
  ///
  /// In en, this message translates to:
  /// **'Assigned on {date}'**
  String myPromoterAssignedOn(String date);

  /// No description provided for @myPromoterTerritory.
  ///
  /// In en, this message translates to:
  /// **'Area: {territory}'**
  String myPromoterTerritory(String territory);

  /// No description provided for @myPromoterPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone: {phone}'**
  String myPromoterPhone(String phone);

  /// No description provided for @myPromoterCopyPhoneAction.
  ///
  /// In en, this message translates to:
  /// **'Copy phone number'**
  String get myPromoterCopyPhoneAction;

  /// No description provided for @myPromoterPhoneCopied.
  ///
  /// In en, this message translates to:
  /// **'Promoter phone number copied.'**
  String get myPromoterPhoneCopied;

  /// No description provided for @myPromoterPrivacyTitle.
  ///
  /// In en, this message translates to:
  /// **'Your information stays scoped'**
  String get myPromoterPrivacyTitle;

  /// No description provided for @myPromoterPrivacyMessage.
  ///
  /// In en, this message translates to:
  /// **'Your assigned promoter can access only the Club farm and crop information needed to support you. Payment details and unrelated seller orders are not shared.'**
  String get myPromoterPrivacyMessage;

  /// No description provided for @cropDiaryTitle.
  ///
  /// In en, this message translates to:
  /// **'Crop activity diary'**
  String get cropDiaryTitle;

  /// No description provided for @cropDiaryFor.
  ///
  /// In en, this message translates to:
  /// **'{cropName} activity diary'**
  String cropDiaryFor(String cropName);

  /// No description provided for @cropDiaryLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading crop activities...'**
  String get cropDiaryLoading;

  /// No description provided for @cropDiaryEmpty.
  ///
  /// In en, this message translates to:
  /// **'No crop activities have been recorded yet.'**
  String get cropDiaryEmpty;

  /// No description provided for @addCropActivityAction.
  ///
  /// In en, this message translates to:
  /// **'Add activity'**
  String get addCropActivityAction;

  /// No description provided for @addCropActivityTitle.
  ///
  /// In en, this message translates to:
  /// **'Record crop activity'**
  String get addCropActivityTitle;

  /// No description provided for @cropActivityTypeLabel.
  ///
  /// In en, this message translates to:
  /// **'Activity type'**
  String get cropActivityTypeLabel;

  /// No description provided for @cropActivityDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Date of activity'**
  String get cropActivityDateLabel;

  /// No description provided for @cropActivityNotesLabel.
  ///
  /// In en, this message translates to:
  /// **'What happened? (optional)'**
  String get cropActivityNotesLabel;

  /// No description provided for @cropActivityFactualHelp.
  ///
  /// In en, this message translates to:
  /// **'Record what you observed or did. This diary does not provide pesticide or treatment recommendations.'**
  String get cropActivityFactualHelp;

  /// No description provided for @saveCropActivity.
  ///
  /// In en, this message translates to:
  /// **'Save activity'**
  String get saveCropActivity;

  /// No description provided for @savingCropActivity.
  ///
  /// In en, this message translates to:
  /// **'Saving activity...'**
  String get savingCropActivity;

  /// No description provided for @activitySowing.
  ///
  /// In en, this message translates to:
  /// **'Sowing'**
  String get activitySowing;

  /// No description provided for @activityIrrigation.
  ///
  /// In en, this message translates to:
  /// **'Irrigation'**
  String get activityIrrigation;

  /// No description provided for @activityFertilizerApplied.
  ///
  /// In en, this message translates to:
  /// **'Fertilizer applied'**
  String get activityFertilizerApplied;

  /// No description provided for @activityCropProtectionApplied.
  ///
  /// In en, this message translates to:
  /// **'Crop-protection product applied'**
  String get activityCropProtectionApplied;

  /// No description provided for @activityPestObserved.
  ///
  /// In en, this message translates to:
  /// **'Pest observed'**
  String get activityPestObserved;

  /// No description provided for @activityDiseaseObserved.
  ///
  /// In en, this message translates to:
  /// **'Disease observed'**
  String get activityDiseaseObserved;

  /// No description provided for @activityWeeding.
  ///
  /// In en, this message translates to:
  /// **'Weeding'**
  String get activityWeeding;

  /// No description provided for @activityCropDamage.
  ///
  /// In en, this message translates to:
  /// **'Crop damage'**
  String get activityCropDamage;

  /// No description provided for @activityHarvest.
  ///
  /// In en, this message translates to:
  /// **'Harvest'**
  String get activityHarvest;

  /// No description provided for @activityOther.
  ///
  /// In en, this message translates to:
  /// **'Other activity'**
  String get activityOther;

  /// No description provided for @activitySourceFarmer.
  ///
  /// In en, this message translates to:
  /// **'Recorded by you'**
  String get activitySourceFarmer;

  /// No description provided for @activitySourcePromoter.
  ///
  /// In en, this message translates to:
  /// **'Recorded by your assigned promoter'**
  String get activitySourcePromoter;

  /// No description provided for @activitySourceSystem.
  ///
  /// In en, this message translates to:
  /// **'Recorded by the system'**
  String get activitySourceSystem;

  /// No description provided for @harvestCropAction.
  ///
  /// In en, this message translates to:
  /// **'Record harvest'**
  String get harvestCropAction;

  /// No description provided for @harvestCropTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete this crop cycle'**
  String get harvestCropTitle;

  /// No description provided for @actualHarvestDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Actual harvest date'**
  String get actualHarvestDateLabel;

  /// No description provided for @harvestYieldLabel.
  ///
  /// In en, this message translates to:
  /// **'Yield in quintals (optional)'**
  String get harvestYieldLabel;

  /// No description provided for @harvestYieldOptionalHelp.
  ///
  /// In en, this message translates to:
  /// **'Enter the measured harvest yield when available.'**
  String get harvestYieldOptionalHelp;

  /// No description provided for @invalidHarvestYieldMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter zero or a positive yield.'**
  String get invalidHarvestYieldMessage;

  /// No description provided for @confirmHarvestAction.
  ///
  /// In en, this message translates to:
  /// **'Confirm harvest'**
  String get confirmHarvestAction;

  /// No description provided for @savingHarvestLabel.
  ///
  /// In en, this message translates to:
  /// **'Recording harvest...'**
  String get savingHarvestLabel;

  /// No description provided for @advisoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Crop advisories'**
  String get advisoryTitle;

  /// No description provided for @advisorySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Read approved guidance matched to your active crops.'**
  String get advisorySubtitle;

  /// No description provided for @advisoryLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading your crop advisories...'**
  String get advisoryLoading;

  /// No description provided for @advisoryEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'You are up to date'**
  String get advisoryEmptyTitle;

  /// No description provided for @advisoryEmpty.
  ///
  /// In en, this message translates to:
  /// **'No advisories are due for your active crops right now.'**
  String get advisoryEmpty;

  /// No description provided for @advisoryDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Crop advisory'**
  String get advisoryDetailTitle;

  /// No description provided for @advisoryCropLabel.
  ///
  /// In en, this message translates to:
  /// **'Crop: {cropName}'**
  String advisoryCropLabel(String cropName);

  /// No description provided for @advisoryDueLabel.
  ///
  /// In en, this message translates to:
  /// **'Due on: {date}'**
  String advisoryDueLabel(String date);

  /// No description provided for @advisorySourceLabel.
  ///
  /// In en, this message translates to:
  /// **'Source: {source}'**
  String advisorySourceLabel(String source);

  /// No description provided for @advisoryHumanApprovedTitle.
  ///
  /// In en, this message translates to:
  /// **'Human-authored and approved'**
  String get advisoryHumanApprovedTitle;

  /// No description provided for @advisoryDisclaimer.
  ///
  /// In en, this message translates to:
  /// **'Use this as general crop guidance. Field conditions vary; speak with your assigned promoter or a qualified agronomist before taking treatment decisions.'**
  String get advisoryDisclaimer;

  /// No description provided for @advisoryImportantToday.
  ///
  /// In en, this message translates to:
  /// **'Important today'**
  String get advisoryImportantToday;

  /// No description provided for @advisoryApprovedLabel.
  ///
  /// In en, this message translates to:
  /// **'Approved guidance'**
  String get advisoryApprovedLabel;

  /// No description provided for @advisoryUnreadLabel.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get advisoryUnreadLabel;

  /// No description provided for @advisoryReadAction.
  ///
  /// In en, this message translates to:
  /// **'Read guidance'**
  String get advisoryReadAction;

  /// No description provided for @advisoryWhatToDoTitle.
  ///
  /// In en, this message translates to:
  /// **'What you should do'**
  String get advisoryWhatToDoTitle;

  /// No description provided for @advisoryWhenToActTitle.
  ///
  /// In en, this message translates to:
  /// **'When to act'**
  String get advisoryWhenToActTitle;

  /// No description provided for @advisoryTechnicalDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Source and technical details'**
  String get advisoryTechnicalDetailsTitle;

  /// No description provided for @advisoryContactPromoterAction.
  ///
  /// In en, this message translates to:
  /// **'Contact promoter or expert'**
  String get advisoryContactPromoterAction;

  /// No description provided for @advisoryDismissAction.
  ///
  /// In en, this message translates to:
  /// **'Dismiss advisory'**
  String get advisoryDismissAction;

  /// No description provided for @cropDoctorTitle.
  ///
  /// In en, this message translates to:
  /// **'Crop Doctor'**
  String get cropDoctorTitle;

  /// No description provided for @cropDoctorProblemTitle.
  ///
  /// In en, this message translates to:
  /// **'Problem in your crop?'**
  String get cropDoctorProblemTitle;

  /// No description provided for @cropDoctorIntro.
  ///
  /// In en, this message translates to:
  /// **'Take clear photos of the affected crop so a support expert can understand what you observed.'**
  String get cropDoctorIntro;

  /// No description provided for @cropDoctorPhotoGuideTitle.
  ///
  /// In en, this message translates to:
  /// **'How to take a useful photo'**
  String get cropDoctorPhotoGuideTitle;

  /// No description provided for @cropDoctorGuideAffectedLeaf.
  ///
  /// In en, this message translates to:
  /// **'Keep the affected leaf or plant clearly visible.'**
  String get cropDoctorGuideAffectedLeaf;

  /// No description provided for @cropDoctorGuideDaylight.
  ///
  /// In en, this message translates to:
  /// **'Use good daylight and avoid heavy shadows.'**
  String get cropDoctorGuideDaylight;

  /// No description provided for @cropDoctorGuideClosePhoto.
  ///
  /// In en, this message translates to:
  /// **'Move close enough to show the damage clearly.'**
  String get cropDoctorGuideClosePhoto;

  /// No description provided for @cropDoctorCaptureUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'Photo diagnosis is coming later'**
  String get cropDoctorCaptureUnavailableTitle;

  /// No description provided for @cropDoctorCaptureUnavailableMessage.
  ///
  /// In en, this message translates to:
  /// **'Secure photo upload and a diagnosis provider are not connected. Photo controls remain disabled until an approved backend is available.'**
  String get cropDoctorCaptureUnavailableMessage;

  /// No description provided for @cropDoctorTakePhotoAction.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get cropDoctorTakePhotoAction;

  /// No description provided for @cropDoctorChoosePhotoAction.
  ///
  /// In en, this message translates to:
  /// **'Choose photo'**
  String get cropDoctorChoosePhotoAction;

  /// No description provided for @cropDoctorHumanHelpAction.
  ///
  /// In en, this message translates to:
  /// **'Describe the problem to support'**
  String get cropDoctorHumanHelpAction;

  /// No description provided for @cropDoctorNoDiagnosisMessage.
  ///
  /// In en, this message translates to:
  /// **'This screen does not diagnose crops or recommend treatment automatically.'**
  String get cropDoctorNoDiagnosisMessage;

  /// No description provided for @cropDoctorOpenAction.
  ///
  /// In en, this message translates to:
  /// **'Open photo guide'**
  String get cropDoctorOpenAction;

  /// No description provided for @shopTabLabel.
  ///
  /// In en, this message translates to:
  /// **'Shop'**
  String get shopTabLabel;

  /// No description provided for @ordersTabLabel.
  ///
  /// In en, this message translates to:
  /// **'Orders'**
  String get ordersTabLabel;

  /// No description provided for @accountTabLabel.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get accountTabLabel;

  /// No description provided for @homeActiveCropTitle.
  ///
  /// In en, this message translates to:
  /// **'Your crop'**
  String get homeActiveCropTitle;

  /// No description provided for @homeActiveCropDay.
  ///
  /// In en, this message translates to:
  /// **'Day {days}'**
  String homeActiveCropDay(int days);

  /// No description provided for @homeActiveCropViewAction.
  ///
  /// In en, this message translates to:
  /// **'View crop'**
  String get homeActiveCropViewAction;

  /// No description provided for @homeActiveCropEmpty.
  ///
  /// In en, this message translates to:
  /// **'Add your farm and crop to see crop guidance here.'**
  String get homeActiveCropEmpty;

  /// No description provided for @homeActiveCropMore.
  ///
  /// In en, this message translates to:
  /// **'View all crops'**
  String get homeActiveCropMore;

  /// No description provided for @homeActiveOrderTitle.
  ///
  /// In en, this message translates to:
  /// **'Your order'**
  String get homeActiveOrderTitle;

  /// No description provided for @homeActiveOrderTrackAction.
  ///
  /// In en, this message translates to:
  /// **'Track'**
  String get homeActiveOrderTrackAction;

  /// No description provided for @homeRecommendedTitle.
  ///
  /// In en, this message translates to:
  /// **'For your farm'**
  String get homeRecommendedTitle;

  /// No description provided for @homeRecommendedViewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get homeRecommendedViewAll;

  /// No description provided for @homeSectionUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Could not load. Pull down to retry.'**
  String get homeSectionUnavailable;
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
