// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get farmerContextSelectionTitle => 'अपना किसान संदर्भ चुनें';

  @override
  String get farmerContextSelectionMessage =>
      'इस मोबाइल नंबर के एक से अधिक सक्रिय किसान संदर्भ हैं। वह संदर्भ चुनें जिसका आप उपयोग करना चाहते हैं।';

  @override
  String get firstLaunchLanguageTitle => 'अपनी भाषा चुनें';

  @override
  String get firstLaunchLanguageMessage =>
      'ऐप के लिए अपनी भाषा चुनें। आप इसे बाद में भी बदल सकते हैं।';

  @override
  String cartQuantityRangeLabel(int minimum, int maximum) {
    return 'मान्य मात्रा: $minimum–$maximum';
  }

  @override
  String get appTitle => 'वर्धनम किसान';

  @override
  String get homeNavLabel => 'होम';

  @override
  String get shopNavLabel => 'उत्पाद देखें';

  @override
  String get ordersNavLabel => 'मेरे ऑर्डर';

  @override
  String get accountNavLabel => 'खेत प्रोफ़ाइल';

  @override
  String get homeLocationContext => 'आपका खेत और डिलीवरी क्षेत्र';

  @override
  String homeGreeting(String farmerName) {
    return 'नमस्ते, $farmerName';
  }

  @override
  String homeLocationWithPincode(String location, String pincode) {
    return '$location, $pincode';
  }

  @override
  String homePincodeOnly(String pincode) {
    return 'पिनकोड $pincode';
  }

  @override
  String get homeWeatherTitle => 'आज खेत की स्थिति';

  @override
  String get homeWeatherUnavailable => 'लाइव मौसम सेवा अभी जुड़ी नहीं है।';

  @override
  String get homeQuickActionsTitle => 'तुरंत सहायता';

  @override
  String get homeViewAllAction => 'सभी देखें';

  @override
  String get homeFarmCardTitle => 'आपके खेत और फसलें';

  @override
  String get homeShopSectionTitle => 'आपके खेत के लिए उत्पाद';

  @override
  String get kisanClubFreeBadge => '100% मुफ़्त';

  @override
  String get kisanClubOpenAction => 'किसान क्लब खोलें';

  @override
  String get productPlaceholderLabel => 'उत्पाद चित्र का स्थान';

  @override
  String get kisanClubPlaceholderLabel => 'किसान क्लब चित्र का स्थान';

  @override
  String get kisanClubLandingDescription =>
      'वर्धनम का एक मुफ़्त किसान सहायता कार्यक्रम।';

  @override
  String get kisanClubLandingAdvisoryBenefit => 'फसल सलाह';

  @override
  String get kisanClubLandingPromoterBenefit => 'स्थानीय वर्धनम प्रमोटर सहायता';

  @override
  String get kisanClubLandingProductBenefit => 'विशेष वर्धनम उत्पाद लाभ';

  @override
  String get kisanClubLandingFarmBenefit => 'खेत और फसल सहायता';

  @override
  String get kisanClubNoMembershipFee => 'कोई सदस्यता शुल्क नहीं।';

  @override
  String kisanClubJoinProgress(int current) {
    return '4 में से चरण $current';
  }

  @override
  String get kisanClubBasicInformationTitle => 'अपना स्थान पक्का करें';

  @override
  String get kisanClubFarmInformationTitle => 'अपना खेत जोड़ें';

  @override
  String get kisanClubFarmInformationMessage =>
      'जिस खेत के लिए क्लब सहायता चाहिए उसकी जानकारी दें।';

  @override
  String get kisanClubCropInformationTitle => 'अपनी मौजूदा फसल जोड़ें';

  @override
  String get kisanClubCropInformationMessage =>
      'स्वीकृत फसल चुनें और खेती का क्षेत्र व बुवाई की तारीख दर्ज करें।';

  @override
  String get kisanClubFarmerDetailsTitle => 'किसान की जानकारी';

  @override
  String kisanClubPreferredLanguageLabel(String language) {
    return 'पसंदीदा भाषा: $language';
  }

  @override
  String get kisanClubSelectCropAction => 'फसल चुनें';

  @override
  String get kisanClubChangeCropAction => 'फसल बदलें';

  @override
  String get kisanClubSearchCropLabel => 'स्वीकृत फसल खोजें';

  @override
  String get kisanClubSowingDateLabel => 'बुवाई की तारीख';

  @override
  String get kisanClubSelectSowingDateAction => 'बुवाई की तारीख चुनें';

  @override
  String get kisanClubSowingDateRequired => 'फसल की बुवाई की तारीख चुनें।';

  @override
  String get kisanClubFarmReviewTitle => 'खेत';

  @override
  String get kisanClubCropReviewTitle => 'फसल';

  @override
  String get kisanClubProfileSetupPartial =>
      'आपकी मुफ़्त सदस्यता बन गई है, लेकिन खेत प्रोफ़ाइल पूरी नहीं हो सकी। सहेजे गए चरण से आगे बढ़ें।';

  @override
  String get kisanClubJoinConsentWarning =>
      'सदस्यता और खेत प्रोफ़ाइल सहेज दी गई, लेकिन वैकल्पिक अनुमतियाँ अपडेट नहीं हो सकीं। इन्हें किसान क्लब से बदला जा सकता है।';

  @override
  String get kisanClubConfirmDetailsTitle => 'जाँचें और जुड़ें';

  @override
  String get continueActionLabel => 'आगे बढ़ें';

  @override
  String get backActionLabel => 'पीछे';

  @override
  String get kisanClubMyCropSection => 'मेरी फसल';

  @override
  String get kisanClubTodaySection => 'आज की सलाह';

  @override
  String get kisanClubCropProblemTitle => 'फसल में समस्या?';

  @override
  String get kisanClubCropProblemAction => 'वर्धनम से मदद माँगें';

  @override
  String get kisanClubCropProblemMessage =>
      'आपने जो देखा उसे सहायता टीम के साथ साझा करें। ऐप अपने आप रोग की पहचान नहीं करेगा।';

  @override
  String get kisanClubSupportSection => 'आपका वर्धनम प्रमोटर';

  @override
  String get kisanClubProgrammeBenefitsTitle => 'किसान क्लब लाभ';

  @override
  String get kisanClubMembershipSettingsTitle => 'सदस्यता अनुमतियाँ';

  @override
  String get myPromoterCardTitle => 'आपका वर्धनम प्रमोटर';

  @override
  String get addFirstFarmTitle => 'अपना पहला खेत जोड़ें';

  @override
  String get viewFarmAction => 'खेत देखें';

  @override
  String get currentCropsTitle => 'वर्तमान फसलें';

  @override
  String get previousCropsTitle => 'पिछले फसल चक्र';

  @override
  String get noActiveCropTitle => 'कोई सक्रिय फसल नहीं जोड़ी गई';

  @override
  String get farmStatusActive => 'सक्रिय खेत';

  @override
  String get farmStatusInactive => 'निष्क्रिय खेत';

  @override
  String get farmLocationUnavailable => 'खेत का स्थान दर्ज नहीं है';

  @override
  String cropImagePlaceholderLabel(String cropName) {
    return '$cropName के चित्र का स्थान';
  }

  @override
  String get cropVarietyDisplayLabel => 'किस्म';

  @override
  String get cropTodayTitle => 'आज';

  @override
  String get approvedGuidanceTitle => 'स्वीकृत फसल मार्गदर्शन';

  @override
  String get approvedGuidanceMessage =>
      'सर्वर से स्वीकृत सलाह मिलने तक यहाँ फसल-विशिष्ट कार्रवाई नहीं दिखाई जाएगी।';

  @override
  String get nextSevenDaysTitle => 'अगले 7 दिन';

  @override
  String get cropPlanUnavailableMessage =>
      'स्वीकृत समयबद्ध मार्गदर्शन उपलब्ध होने पर सात-दिन की फसल योजना यहाँ दिखाई देगी।';

  @override
  String get openCropDiaryAction => 'फसल गतिविधि डायरी खोलें';

  @override
  String get cropStatusPlanned => 'योजनाबद्ध';

  @override
  String get cropStatusActive => 'सक्रिय';

  @override
  String get cropStatusHarvested => 'कटाई पूरी';

  @override
  String get cropStatusAbandoned => 'बंद';

  @override
  String get welcomeTitle => 'किसान कार्यक्षेत्र';

  @override
  String get phaseBoundary =>
      'उत्पाद देखें, कार्ट संभालें और डेवलपमेंट मॉक भुगतान यात्रा पूरी करें।';

  @override
  String get languageActionLabel => 'भाषा';

  @override
  String get englishLanguageLabel => 'English';

  @override
  String get hindiLanguageLabel => 'हिन्दी';

  @override
  String get languageSaveFailed =>
      'भाषा का चयन सहेजा नहीं जा सका। कृपया फिर प्रयास करें।';

  @override
  String get farmerLoginTitle => 'किसान लॉगिन';

  @override
  String get loginIntro =>
      'अपना नाम और मोबाइल नंबर दर्ज करें। छह अंकों के ओटीपी से नंबर सत्यापित किया जाएगा।';

  @override
  String get fullNameLabel => 'पूरा नाम';

  @override
  String get mobileNumberLabel => 'मोबाइल नंबर';

  @override
  String get mobileNumberHint => '10 अंकों का भारतीय मोबाइल नंबर';

  @override
  String get requestOtpAction => 'ओटीपी भेजें';

  @override
  String get otpCodeLabel => 'छह अंकों का ओटीपी';

  @override
  String get verifyOtpAction => 'सत्यापित करें और आगे बढ़ें';

  @override
  String get resendOtpAction => 'ओटीपी फिर भेजें';

  @override
  String resendOtpCountdown(int seconds) {
    return '$seconds सेकंड में ओटीपी फिर भेजें';
  }

  @override
  String mockOtpLabel(String code) {
    return 'डेवलपमेंट ओटीपी (परीक्षण प्रदाता): $code';
  }

  @override
  String get otpSentMessage =>
      'ओटीपी भेज दिया गया है। आगे बढ़ने के लिए कोड दर्ज करें।';

  @override
  String get invalidNameMessage => 'अपना पूरा नाम दर्ज करें।';

  @override
  String get invalidPhoneMessage =>
      '10 अंकों का सही भारतीय मोबाइल नंबर दर्ज करें।';

  @override
  String get invalidOtpMessage => 'छह अंकों का ओटीपी दर्ज करें।';

  @override
  String get invalidCredentialsMessage =>
      'ओटीपी गलत है, समाप्त हो गया है या प्रयास सीमा पूरी हो गई है।';

  @override
  String get rateLimitedMessage =>
      'बहुत अधिक प्रयास हुए हैं। फिर प्रयास करने से पहले प्रतीक्षा करें।';

  @override
  String get networkErrorMessage =>
      'कनेक्ट नहीं हो सका। इंटरनेट जाँचें और फिर प्रयास करें।';

  @override
  String get networkTimeoutMessage =>
      'अनुरोध में बहुत समय लग रहा है। इंटरनेट जाँचें और फिर प्रयास करें।';

  @override
  String get invalidServerResponseMessage =>
      'सेवा से अनपेक्षित उत्तर मिला। कृपया फिर प्रयास करें।';

  @override
  String get unexpectedErrorMessage => 'कुछ गड़बड़ हुई। कृपया फिर प्रयास करें।';

  @override
  String cachedProductsNotice(String age) {
    return '$age के सहेजे हुए परिणाम दिखाए जा रहे हैं। कीमत और स्टॉक बदल सकते हैं; कार्ट में जोड़ने से पहले दोबारा कनेक्ट करें।';
  }

  @override
  String get cachedProductsJustNow => 'अभी-अभी';

  @override
  String cachedProductsMinutesAgo(int minutes) {
    return '$minutes मिनट पहले';
  }

  @override
  String cachedProductsHoursAgo(int hours) {
    return '$hours घंटे पहले';
  }

  @override
  String get multipleMembershipsMessage =>
      'इस नंबर से एक से अधिक किसान संदर्भ जुड़े हैं। चयन सुविधा अभी उपलब्ध नहीं है।';

  @override
  String get authenticationErrorMessage =>
      'लॉगिन पूरा नहीं हो सका। कृपया फिर प्रयास करें।';

  @override
  String get browseWithoutLoginAction => 'लॉगिन के बिना उत्पाद देखें';

  @override
  String get logoutAction => 'लॉग आउट';

  @override
  String get otpLogin => 'ओटीपी लॉगिन';

  @override
  String get otpLoginSubtitle =>
      'डेवलपमेंट एसएमएस प्रदाता के साथ सुरक्षित ओटीपी लॉगिन।';

  @override
  String get farmProfile => 'खेत की जानकारी';

  @override
  String get accountTitle => 'खाता';

  @override
  String get accountServicesTitle => 'आपका खाता';

  @override
  String get accountProfileDetailsTitle => 'प्रोफ़ाइल विवरण';

  @override
  String get supportAccountLabel => 'सहायता';

  @override
  String get farmProfileSubtitle => 'अपने स्थान और फसल की जानकारी अद्यतन रखें।';

  @override
  String get profileIntro =>
      'ये जानकारियाँ आपके खेत के लिए उपयुक्त उत्पाद और डिलीवरी विकल्प दिखाने में मदद करती हैं।';

  @override
  String get loadingProfile => 'किसान प्रोफ़ाइल लोड हो रही है...';

  @override
  String get profileLoadFailed => 'आपकी किसान प्रोफ़ाइल लोड नहीं हो सकी।';

  @override
  String get profileSaveFailed =>
      'आपकी किसान प्रोफ़ाइल सहेजी नहीं जा सकी। कृपया फिर प्रयास करें।';

  @override
  String get profileSavedMessage => 'किसान प्रोफ़ाइल सहेजी गई।';

  @override
  String get saveProfileAction => 'प्रोफ़ाइल सहेजें';

  @override
  String get alternatePhoneLabel => 'वैकल्पिक फ़ोन (वैकल्पिक)';

  @override
  String get villageLabel => 'गाँव';

  @override
  String get districtLabel => 'ज़िला';

  @override
  String get stateLabel => 'राज्य';

  @override
  String get primaryPincodeLabel => 'खेत का पिनकोड';

  @override
  String get cropInterestsLabel => 'रुचि की फसलें';

  @override
  String get cropInterestsHelp =>
      'फसलों को अल्पविराम से अलग करें, जैसे: गेहूँ, सरसों';

  @override
  String get invalidCropsMessage =>
      'अधिकतम 20 फसलें दर्ज करें और फसल के नाम छोटे रखें।';

  @override
  String get savedAddressesTitle => 'सहेजे गए डिलीवरी पते';

  @override
  String get noSavedAddresses => 'अभी कोई डिलीवरी पता सहेजा नहीं गया है।';

  @override
  String get defaultAddressLabel => 'डिफ़ॉल्ट';

  @override
  String get manageAddressesAction => 'पते प्रबंधित करें';

  @override
  String get addressesTitle => 'डिलीवरी पते';

  @override
  String get loadingAddresses => 'डिलीवरी पते लोड हो रहे हैं...';

  @override
  String get addressesLoadFailed => 'आपके डिलीवरी पते लोड नहीं हो सके।';

  @override
  String get addAddressAction => 'पता जोड़ें';

  @override
  String get editAddressAction => 'संपादित करें';

  @override
  String get setDefaultAddressAction => 'डिफ़ॉल्ट बनाएँ';

  @override
  String get defaultAddressUpdatedMessage =>
      'डिफ़ॉल्ट डिलीवरी पता अद्यतन किया गया।';

  @override
  String get addressSaveFailed =>
      'डिलीवरी पता सहेजा नहीं जा सका। कृपया फिर प्रयास करें।';

  @override
  String get addAddressTitle => 'डिलीवरी पता जोड़ें';

  @override
  String get editAddressTitle => 'डिलीवरी पता संपादित करें';

  @override
  String get addressLabelField => 'पते का नाम';

  @override
  String get recipientNameLabel => 'प्राप्तकर्ता का नाम';

  @override
  String get addressPhoneLabel => 'प्राप्तकर्ता का मोबाइल नंबर';

  @override
  String get addressLine1Label => 'पता पंक्ति 1';

  @override
  String get addressLine2Label => 'पता पंक्ति 2 (वैकल्पिक)';

  @override
  String get cityLabel => 'शहर';

  @override
  String get landmarkLabel => 'पहचान चिह्न (वैकल्पिक)';

  @override
  String get makeDefaultAddressLabel => 'डिफ़ॉल्ट डिलीवरी पता बनाएँ';

  @override
  String get defaultAddressCannotBeUnsetHelp =>
      'इसे बदलने से पहले किसी दूसरे पते को डिफ़ॉल्ट बनाएँ।';

  @override
  String get saveAddressAction => 'पता सहेजें';

  @override
  String get requiredFieldMessage => 'यह जानकारी आवश्यक है।';

  @override
  String get closeAction => 'बंद करें';

  @override
  String get productBrowsing => 'उत्पाद देखें';

  @override
  String get productBrowsingSubtitle =>
      'पिनकोड, विक्रेता और स्टॉक के अनुसार स्वीकृत ऑफर देखें।';

  @override
  String get cart => 'कार्ट';

  @override
  String get cartSubtitle =>
      'चुने हुए उत्पाद, विक्रेता और पिनकोड की समीक्षा करें।';

  @override
  String get browseTitle => 'उत्पाद देखें';

  @override
  String get deliveringToTitle => 'यहाँ डिलीवरी';

  @override
  String get pincodeLabel => 'पिनकोड';

  @override
  String get productSearchLabel => 'फसल, ब्रांड या उत्पाद खोजें';

  @override
  String get shopByCategoryTitle => 'श्रेणी के अनुसार खरीदें';

  @override
  String get shopByCropTitle => 'फसल के अनुसार खरीदें';

  @override
  String get shopByBrandTitle => 'ब्रांड के अनुसार खरीदें';

  @override
  String get allCategory => 'सभी';

  @override
  String get brandFilterLabel => 'ब्रांड';

  @override
  String get allBrandsFilterLabel => 'सभी ब्रांड';

  @override
  String get cropFilterLabel => 'फसल';

  @override
  String get allCropsFilterLabel => 'सभी फसलें';

  @override
  String get seedsCategory => 'बीज';

  @override
  String get fertiliserCategory => 'उर्वरक';

  @override
  String get cropCareCategory => 'फसल सुरक्षा';

  @override
  String get discoveryPreviewLabel => 'सभी उत्पाद';

  @override
  String get loadingProducts => 'स्वीकृत ऑफर लोड हो रहे हैं...';

  @override
  String get loadMoreProductsAction => 'और उत्पाद लोड करें';

  @override
  String get loadingMoreProductsLabel => 'और उत्पाद लोड हो रहे हैं...';

  @override
  String get enterValidPincode =>
      'उपलब्ध उत्पाद देखने के लिए छह अंकों का सही पिनकोड दर्ज करें।';

  @override
  String get productLoadFailed => 'मार्केटप्लेस से उत्पाद लोड नहीं हो सके।';

  @override
  String get retryActionLabel => 'फिर प्रयास करें';

  @override
  String get startingPriceLabel => 'शुरुआती कीमत';

  @override
  String get sellersLabel => 'विक्रेता';

  @override
  String get offersLabel => 'ऑफर';

  @override
  String get distributorDeliveryLabel => 'वितरक द्वारा डिलीवरी';

  @override
  String get vardhnamFulfilmentLabel => 'वर्धनम द्वारा पूर्ति';

  @override
  String get pickupLabel => 'स्वयं प्राप्त करें';

  @override
  String get fulfilmentPendingLabel => 'पूर्ति की जानकारी बाकी है';

  @override
  String get availableUnit => 'उपलब्ध';

  @override
  String get warehouseLabel => 'गोदाम';

  @override
  String get noProductsForPincode =>
      'इस पिनकोड के लिए कोई स्वीकृत ऑफर नहीं मिला।';

  @override
  String get viewProductDetailsAction => 'विवरण देखें';

  @override
  String productImagePlaceholder(String productName) {
    return '$productName के उत्पाद चित्र का स्थान';
  }

  @override
  String get productDetailsTitle => 'उत्पाद विवरण';

  @override
  String get loadingProductDetails =>
      'उत्पाद और विक्रेता ऑफर लोड हो रहे हैं...';

  @override
  String get productDetailLoadFailed => 'यह उत्पाद लोड नहीं हो सका।';

  @override
  String get brandOwnerLabel => 'ब्रांड मालिक';

  @override
  String get suitableForCropsTitle => 'इन फसलों के लिए उपयुक्त';

  @override
  String get deliveryToLabel => 'डिलीवरी पिनकोड';

  @override
  String get chooseSellerOfferTitle => 'विक्रेता ऑफर चुनें';

  @override
  String get chooseSellerOfferSubtitle =>
      'चुना गया वितरक विक्रेता होगा और उत्पाद का बिल जारी करेगा।';

  @override
  String get sellerInvoiceTitle => 'विक्रेता और बिल';

  @override
  String get sellerInvoiceMessage =>
      'आपका चुना हुआ वितरक कानूनी विक्रेता है और वही बिल जारी करेगा। वर्धनम मार्केटप्लेस संचालित करता है।';

  @override
  String get sellerOfRecordLabel => 'रिकॉर्ड पर विक्रेता';

  @override
  String get selectedOfferLabel => 'चुना हुआ ऑफर';

  @override
  String get availableVariantsTitle => 'उपलब्ध पैक विकल्प';

  @override
  String get productDocumentsTitle => 'उत्पाद दस्तावेज़';

  @override
  String get mrpLabel => 'एमआरपी';

  @override
  String get minimumQuantityLabel => 'न्यूनतम मात्रा';

  @override
  String get deliverySlaPendingLabel => 'डिलीवरी समय बाकी है';

  @override
  String get dayLabel => 'दिन';

  @override
  String get daysLabel => 'दिन';

  @override
  String get batchLabel => 'बैच';

  @override
  String get expiryLabel => 'समाप्ति';

  @override
  String get germinationLabel => 'अंकुरण';

  @override
  String get addSelectedOfferToCartAction => 'चुना हुआ ऑफर कार्ट में जोड़ें';

  @override
  String get addingToCartLabel => 'कार्ट में जोड़ा जा रहा है...';

  @override
  String get addedToCartMessage => 'ऑफर आपके कार्ट में जोड़ दिया गया।';

  @override
  String get offerNoLongerAvailableMessage =>
      'यह विक्रेता ऑफर अब उपलब्ध नहीं है। कोई दूसरा लाइव ऑफर चुनें।';

  @override
  String get offerInsufficientStockMessage =>
      'इस ऑफर में न्यूनतम ऑर्डर के लिए पर्याप्त बिक्री योग्य स्टॉक नहीं है। दूसरा ऑफर चुनें या बाद में रीफ़्रेश करें।';

  @override
  String get priceChangedDialogTitle => 'कीमत बदली है';

  @override
  String priceChangedDialogMessage(String oldPrice, String newPrice) {
    return 'विक्रेता ने इस ऑफर की कीमत $oldPrice से $newPrice कर दी है। आइटम नई बैकएंड कीमत पर आपके कार्ट में है। चेकआउट से पहले इसकी समीक्षा करें।';
  }

  @override
  String get stayOnProductAction => 'यहीं रहें';

  @override
  String get reviewCartAction => 'कार्ट देखें';

  @override
  String get signInToAddCartMessage =>
      'इस ऑफर को कार्ट में जोड़ने के लिए लॉगिन करें।';

  @override
  String get cartTitle => 'मेरा कार्ट';

  @override
  String get loadingCartLabel => 'आपका कार्ट लोड हो रहा है...';

  @override
  String get cartLoadFailed => 'आपका कार्ट लोड नहीं हो सका।';

  @override
  String get cartPincodeNotSelected => 'चुना नहीं गया';

  @override
  String get cartAddressLabel => 'डिलीवरी पिनकोड';

  @override
  String get cartSnapshotLabel => 'उपलब्धता का विवरण';

  @override
  String cartSellerGroupTitle(String seller) {
    return 'विक्रेता: $seller';
  }

  @override
  String cartSellerGroupItems(int count) {
    return '$count उत्पाद · अलग विक्रेता ऑर्डर और चालान';
  }

  @override
  String get cartSubtotalLabel => 'उप-योग';

  @override
  String get cartAddMore => 'और जोड़ें';

  @override
  String get cartClear => 'खाली करें';

  @override
  String get clearCartTitle => 'कार्ट खाली करें?';

  @override
  String get clearCartConfirmation =>
      'इससे आपके कार्ट के सभी उत्पाद हट जाएंगे।';

  @override
  String get cancelAction => 'रद्द करें';

  @override
  String get emptyCartLabel => 'आपका कार्ट खाली है।';

  @override
  String get decreaseQuantityLabel => 'मात्रा घटाएं';

  @override
  String get increaseQuantityLabel => 'मात्रा बढ़ाएं';

  @override
  String get removeItemLabel => 'उत्पाद हटाएं';

  @override
  String get perUnitLabel => 'प्रति इकाई';

  @override
  String get backendCalculatedTotalLabel =>
      'उप-योग की गणना और पुष्टि मार्केटप्लेस सर्वर ने की है।';

  @override
  String get checkoutActionLabel => 'चेकआउट की समीक्षा करें';

  @override
  String get checkoutReviewTitle => 'चेकआउट समीक्षा';

  @override
  String get loadingCheckoutReview => 'कार्ट और डिलीवरी पते लोड हो रहे हैं...';

  @override
  String get checkoutReviewLoadFailed => 'चेकआउट समीक्षा तैयार नहीं हो सकी।';

  @override
  String get checkoutEmptyCartMessage =>
      'आपका कार्ट खाली है। चेकआउट से पहले उत्पाद जोड़ें।';

  @override
  String get selectDeliveryAddressTitle => 'डिलीवरी पता चुनें';

  @override
  String get noMatchingCheckoutAddress =>
      'चेकआउट से पहले इस कार्ट के पिनकोड वाला पता जोड़ें या संपादित करें।';

  @override
  String get orderItemsTitle => 'ऑर्डर के उत्पाद';

  @override
  String get checkoutRevalidationNotice =>
      'ऑर्डर बनाने से पहले सर्वर ऑफर, स्टॉक, बैच, कीमत और डिलीवरी की दोबारा पुष्टि करेगा।';

  @override
  String get creatingCheckoutLabel => 'सुरक्षित चेकआउट बनाया जा रहा है...';

  @override
  String get confirmCheckoutAction => 'पुष्टि करके चेकआउट बनाएं';

  @override
  String get checkoutCreatedMessage =>
      'चेकआउट बन गया और स्टॉक सफलतापूर्वक आरक्षित हो गया।';

  @override
  String get deliveryAddressTitle => 'डिलीवरी पता';

  @override
  String get paymentNextStepMessage =>
      'आपके उप-ऑर्डर भुगतान की प्रतीक्षा में हैं।';

  @override
  String get orderNumberLabel => 'ऑर्डर नंबर';

  @override
  String get mockPaymentTitle => 'परीक्षण भुगतान';

  @override
  String get mockPaymentSubtitle =>
      'सर्वर की पुष्टि के बाद आरक्षित उप-ऑर्डर पुष्ट हो जाएंगे।';

  @override
  String get mockPaymentActionLabel => 'परीक्षण भुगतान की पुष्टि करें';

  @override
  String get mockPaymentEnvironmentNotice =>
      'केवल डेवलपमेंट मोड: यह सर्वर-आधारित मॉक प्रक्रिया असली पैसे का भुगतान या हस्तांतरण नहीं करती।';

  @override
  String get mockPaymentSuccessAction => 'मॉक भुगतान पूरा करें';

  @override
  String get mockPaymentFailureAction => 'भुगतान अस्वीकृति का परीक्षण करें';

  @override
  String get mockPaymentSucceededMessage =>
      'सर्वर ने भुगतान की पुष्टि करके हर उप-ऑर्डर को कन्फर्म कर दिया।';

  @override
  String get checkoutCancelledMessage =>
      'चेकआउट रद्द हुआ। सर्वर ने आरक्षित स्टॉक जारी कर दिया।';

  @override
  String get cancelCheckoutDialogTitle => 'यह चेकआउट रद्द करें?';

  @override
  String get cancelCheckoutDialogMessage =>
      'सर्वर सभी योग्य उप-ऑर्डर रद्द करके उनका आरक्षित स्टॉक जारी करेगा।';

  @override
  String get keepCheckoutAction => 'चेकआउट रखें';

  @override
  String get cancellationTitle => 'रद्दीकरण';

  @override
  String get cancellationSubtitle => 'सफल भुगतान से पहले उपलब्ध है।';

  @override
  String get cancellationActionLabel => 'चेकआउट रद्द करें';

  @override
  String get cancellationStatusLabel => 'योग्य';

  @override
  String get reservationReleaseLabel => 'आरक्षण मुक्त करना';

  @override
  String get paymentStatusLabel => 'भुगतान स्थिति';

  @override
  String get paymentReferenceLabel => 'संदर्भ';

  @override
  String get paymentAmountLabel => 'भुगतान राशि';

  @override
  String get childOrdersLabel => 'उप-ऑर्डर';

  @override
  String get orderHistoryTitle => 'मेरे ऑर्डर';

  @override
  String get orderHistorySubtitle =>
      'हर विक्रेता के ऑर्डर, डिलीवरी और इनवॉइस को अलग-अलग ट्रैक करें।';

  @override
  String get orderDetailTitle => 'ऑर्डर विवरण';

  @override
  String get orderStatusFilterLabel => 'स्थिति के अनुसार फ़िल्टर करें';

  @override
  String get allOrdersFilterLabel => 'सभी ऑर्डर';

  @override
  String get noOrdersMessage => 'इस फ़िल्टर के लिए कोई उत्पाद ऑर्डर नहीं मिला।';

  @override
  String get noOrdersTitle => 'अभी कोई ऑर्डर नहीं';

  @override
  String get noOrdersBrowseMessage =>
      'अपने क्षेत्र में डिलीवरी के लिए उपलब्ध उत्पाद देखें।';

  @override
  String get goToShopAction => 'दुकान पर जाएँ';

  @override
  String get orderSellerLabel => 'विक्रेता';

  @override
  String get trackOrderAction => 'ऑर्डर ट्रैक करें';

  @override
  String get orderLoadFailed => 'यह ऑर्डर लोड नहीं हो सका।';

  @override
  String get loadMoreOrdersAction => 'और ऑर्डर लोड करें';

  @override
  String get loadingMoreOrdersLabel => 'और ऑर्डर लोड हो रहे हैं...';

  @override
  String get loadingOrdersLabel => 'आपके ऑर्डर लोड हो रहे हैं...';

  @override
  String get loadingOrderDetailLabel => 'ऑर्डर की जानकारी लोड हो रही है...';

  @override
  String get orderPlacedLabel => 'ऑर्डर समय';

  @override
  String orderItemCountLabel(int count) {
    return '$count आइटम';
  }

  @override
  String get orderTimelineTitle => 'ऑर्डर समयरेखा';

  @override
  String get noOrderTimelineMessage => 'अभी कोई स्थिति इतिहास उपलब्ध नहीं है।';

  @override
  String get fulfilmentTrackingTitle => 'पूर्ति ट्रैकिंग';

  @override
  String get dispatchNumberLabel => 'डिस्पैच नंबर';

  @override
  String get deliveryAssignmentLabel => 'डिलीवरी असाइनमेंट';

  @override
  String get invoiceTitle => 'वितरक इनवॉइस';

  @override
  String get invoiceNumberLabel => 'इनवॉइस नंबर';

  @override
  String get invoiceSellerLabel => 'विक्रेता';

  @override
  String get invoiceBuyerLabel => 'खरीदार';

  @override
  String get invoiceGeneratedLabel => 'बनाया गया';

  @override
  String get invoiceTaxLabel => 'कर';

  @override
  String get invoiceTotalLabel => 'कुल';

  @override
  String get invoiceNotGeneratedMessage => 'वितरक इनवॉइस अभी नहीं बना है।';

  @override
  String get invoicePdfPrepareAction => 'इनवॉइस पीडीएफ तैयार करें';

  @override
  String get invoicePdfCheckStatusAction => 'पीडीएफ की स्थिति देखें';

  @override
  String get invoicePdfDownloadAction => 'इनवॉइस पीडीएफ डाउनलोड करें';

  @override
  String get invoicePdfPreparingMessage =>
      'आपका इनवॉइस पीडीएफ तैयार हो रहा है। थोड़ी देर बाद फिर देखें।';

  @override
  String get invoicePdfFailedMessage =>
      'इनवॉइस पीडीएफ तैयार नहीं हो सका। फिर प्रयास करें।';

  @override
  String get invoicePdfOpenedMessage => 'इनवॉइस पीडीएफ ब्राउज़र में खोला गया।';

  @override
  String get invoicePdfOpenFailedMessage =>
      'इनवॉइस पीडीएफ नहीं खुल सका। फिर प्रयास करें।';

  @override
  String get cancelOrderAction => 'यह ऑर्डर रद्द करें';

  @override
  String get cancelOrderDialogTitle => 'यह विक्रेता ऑर्डर रद्द करें?';

  @override
  String get cancelOrderDialogMessage =>
      'केवल यह उप-ऑर्डर रद्द होगा। सर्वर इसका आरक्षित स्टॉक जारी करेगा। अन्य विक्रेता ऑर्डर अलग रहेंगे।';

  @override
  String get keepOrderAction => 'ऑर्डर रखें';

  @override
  String get orderStatusPendingPayment => 'भुगतान बाकी';

  @override
  String get orderStatusConfirmed => 'पुष्टि हुई';

  @override
  String get orderStatusAccepted => 'वितरक ने स्वीकार किया';

  @override
  String get orderStatusRejected => 'वितरक ने अस्वीकार किया';

  @override
  String get orderStatusReadyToPack => 'पैकिंग के लिए तैयार';

  @override
  String get orderStatusPacked => 'पैक किया गया';

  @override
  String get orderStatusReadyForPickup => 'पिकअप के लिए तैयार';

  @override
  String get orderStatusOutForDelivery => 'डिलीवरी के लिए निकला';

  @override
  String get orderStatusDelivered => 'डिलीवर हुआ';

  @override
  String get orderStatusReturnRequested => 'वापसी का अनुरोध किया गया';

  @override
  String get orderStatusDeliveryFailed => 'डिलीवरी विफल';

  @override
  String get orderStatusCancelled => 'रद्द किया गया';

  @override
  String get orderStatusClosed => 'बंद';

  @override
  String get orderStatusLabel => 'स्थिति';

  @override
  String get reservedStockLabel => 'आरक्षित स्टॉक';

  @override
  String get mockOnlyStatus => 'केवल पूर्वावलोकन';

  @override
  String get paymentProcessingStatus => 'प्रक्रिया जारी है';

  @override
  String get paymentFailedStatus => 'भुगतान विफल';

  @override
  String get readyStatus => 'तैयार';

  @override
  String get inventoryReservedStatus => 'स्टॉक आरक्षित';

  @override
  String get quantityLabel => 'मात्रा';

  @override
  String get sellerLabel => 'विक्रेता';

  @override
  String get priceSnapshotLabel => 'कीमत का विवरण';

  @override
  String get supportAccess => 'सहायता';

  @override
  String get supportAccessSubtitle => 'अपने सहायता टिकट बनाएं और ट्रैक करें।';

  @override
  String get supportTicketsTitle => 'सहायता टिकट';

  @override
  String get createSupportTicketAction => 'नया टिकट';

  @override
  String get createSupportTicketTitle => 'सहायता टिकट बनाएं';

  @override
  String get supportTicketDetailTitle => 'सहायता टिकट';

  @override
  String get supportTicketCreateIntro =>
      'समस्या स्पष्ट रूप से बताएं। सहायता टीम मार्केटप्लेस में टिकट संभालेगी।';

  @override
  String get supportStatusFilterLabel => 'स्थिति के अनुसार फ़िल्टर करें';

  @override
  String get allSupportTicketsFilter => 'सभी टिकट';

  @override
  String get noSupportTicketsMessage =>
      'आपने अभी कोई सहायता टिकट नहीं बनाया है।';

  @override
  String get supportTicketLoadFailed => 'यह सहायता टिकट लोड नहीं हो सका।';

  @override
  String get loadMoreSupportTicketsAction => 'और टिकट लोड करें';

  @override
  String get loadingMoreSupportTickets => 'और टिकट लोड हो रहे हैं...';

  @override
  String get loadingSupportTicketsLabel => 'आपके सहायता टिकट लोड हो रहे हैं...';

  @override
  String get loadingSupportTicketDetailLabel =>
      'सहायता टिकट की जानकारी लोड हो रही है...';

  @override
  String get supportCategoryLabel => 'समस्या श्रेणी';

  @override
  String get supportPriorityLabel => 'प्राथमिकता';

  @override
  String get supportSubjectLabel => 'विषय';

  @override
  String get supportDescriptionLabel => 'समस्या बताएं';

  @override
  String get supportMinimumLengthMessage => 'कम से कम 3 अक्षर दर्ज करें।';

  @override
  String get submitSupportTicketAction => 'टिकट जमा करें';

  @override
  String get linkedOrderLabel => 'जुड़ा हुआ विक्रेता ऑर्डर';

  @override
  String get getHelpWithOrderAction => 'इस ऑर्डर के लिए सहायता लें';

  @override
  String get supportCreatedLabel => 'बनाया गया';

  @override
  String get supportSlaDueLabel => 'उत्तर लक्ष्य';

  @override
  String get supportResolutionTitle => 'समाधान टिप्पणी';

  @override
  String get reopenSupportTicketAction => 'टिकट फिर खोलें';

  @override
  String get reopenSupportTicketTitle => 'यह टिकट फिर खोलें?';

  @override
  String get reopenReasonLabel => 'क्या अभी भी हल नहीं हुआ?';

  @override
  String get supportEvidenceUnavailableMessage =>
      'सुरक्षित अधिकृत फ़ाइल अपलोड लागू होने तक अटैचमेंट उपलब्ध नहीं हैं।';

  @override
  String get supportConversationUnavailableMessage =>
      'टिकट उत्तर अभी उपलब्ध नहीं हैं। स्थिति और समाधान अपडेट के लिए नीचे खींचकर रीफ्रेश करें।';

  @override
  String get supportStatusOpen => 'खुला';

  @override
  String get supportStatusAssigned => 'सौंपा गया';

  @override
  String get supportStatusWaitingForCustomer => 'आपके उत्तर की प्रतीक्षा';

  @override
  String get supportStatusWaitingForSeller => 'विक्रेता की प्रतीक्षा';

  @override
  String get supportStatusEscalated => 'उच्च स्तर पर भेजा गया';

  @override
  String get supportStatusResolved => 'समाधान हुआ';

  @override
  String get supportStatusClosed => 'बंद';

  @override
  String get supportStatusReopened => 'फिर खोला गया';

  @override
  String get supportCategoryOrder => 'ऑर्डर समस्या';

  @override
  String get supportCategoryPayment => 'भुगतान समस्या';

  @override
  String get supportCategoryDelivery => 'डिलीवरी समस्या';

  @override
  String get supportCategoryProductQuality => 'उत्पाद गुणवत्ता';

  @override
  String get supportCategoryAccount => 'खाता समस्या';

  @override
  String get supportCategoryOnboarding => 'पंजीकरण समस्या';

  @override
  String get supportCategoryOther => 'अन्य';

  @override
  String get supportPriorityLow => 'कम';

  @override
  String get supportPriorityMedium => 'मध्यम';

  @override
  String get supportPriorityHigh => 'उच्च';

  @override
  String get supportPriorityUrgent => 'अति आवश्यक';

  @override
  String get notificationsTitle => 'सूचनाएँ';

  @override
  String get notificationsSubtitle =>
      'मार्केटप्लेस, ऑर्डर और सहायता से जुड़े अपडेट पढ़ें।';

  @override
  String get notificationDetailTitle => 'सूचना';

  @override
  String get unreadNotificationsOnlyLabel => 'केवल बिना पढ़ी सूचनाएँ दिखाएँ';

  @override
  String get noNotificationsMessage => 'अभी कोई इन-ऐप सूचना नहीं है।';

  @override
  String get noUnreadNotificationsMessage => 'आपने सभी सूचनाएँ पढ़ ली हैं।';

  @override
  String get noNotificationsTitle => 'अभी कोई सूचना नहीं';

  @override
  String get notificationOrdersCategory => 'ऑर्डर';

  @override
  String get notificationKisanClubCategory => 'किसान क्लब';

  @override
  String get notificationAdvisoryCategory => 'सलाह';

  @override
  String get notificationSupportCategory => 'सहायता';

  @override
  String get notificationReturnsCategory => 'वापसी';

  @override
  String get notificationOtherCategory => 'अपडेट';

  @override
  String get notificationLoadFailed => 'यह सूचना लोड नहीं हो सकी।';

  @override
  String get loadMoreNotificationsAction => 'और सूचनाएँ लोड करें';

  @override
  String get loadingMoreNotificationsLabel => 'और सूचनाएँ लोड हो रही हैं...';

  @override
  String get loadingNotificationsLabel => 'आपकी सूचनाएँ लोड हो रही हैं...';

  @override
  String get loadingNotificationDetailLabel =>
      'सूचना की जानकारी लोड हो रही है...';

  @override
  String get openNotificationResourceAction => 'संबंधित विवरण खोलें';

  @override
  String get contactSupportTitle => 'सहायता से संपर्क करें';

  @override
  String get contactSupportSubtitle =>
      'कॉन्फ़िगर किए गए वर्धनम सहायता केंद्र को कॉल या संदेश करें।';

  @override
  String get callSupportAction => 'सहायता को कॉल करें';

  @override
  String get whatsAppSupportAction => 'व्हाट्सऐप सहायता';

  @override
  String get whatsAppSupportMessage =>
      'नमस्ते वर्धनम सहायता, मुझे किसान ऐप में मदद चाहिए।';

  @override
  String get supportContactUnavailableMessage =>
      'इस परिवेश के लिए फ़ोन और व्हाट्सऐप सहायता विवरण कॉन्फ़िगर नहीं हैं। आप नीचे सहायता टिकट बना सकते हैं।';

  @override
  String get supportContactLaunchFailed => 'चुना गया सहायता ऐप नहीं खुल सका।';

  @override
  String get requestReturnAction => 'वापसी का अनुरोध करें';

  @override
  String get returnRequestTitle => 'वापसी अनुरोध';

  @override
  String get returnRequestIntro =>
      'इस विक्रेता ऑर्डर से लौटाने वाली वस्तुएँ और मात्रा चुनें। पात्रता और राशि की जाँच मार्केटप्लेस सर्वर करता है।';

  @override
  String get loadingReturnEligibilityLabel =>
      'वापसी पात्रता जाँची जा रही है...';

  @override
  String get returnEligibilityLoadFailed =>
      'वापसी पात्रता की जाँच नहीं हो सकी।';

  @override
  String get returnNotEligibleMessage => 'यह ऑर्डर वापसी के लिए पात्र नहीं है।';

  @override
  String returnWindowEndsLabel(String date) {
    return 'वापसी की अवधि $date को समाप्त होगी';
  }

  @override
  String get returnItemsTitle => 'लौटाई जाने वाली वस्तुएँ';

  @override
  String get doNotReturnItemLabel => 'नहीं';

  @override
  String get returnReasonLabel => 'वापसी का कारण';

  @override
  String get returnReasonNoteLabel => 'अतिरिक्त जानकारी';

  @override
  String get returnReasonNoteRequiredMessage =>
      'अन्य चुनने पर जानकारी देना आवश्यक है।';

  @override
  String get returnInventorySafetyMessage =>
      'वापसी अनुरोध भेजने से सामान बिक्री योग्य स्टॉक में वापस नहीं जाता। विक्रेता पहले उसका निरीक्षण करेगा।';

  @override
  String get submitReturnRequestAction => 'वापसी अनुरोध भेजें';

  @override
  String get returnRequestSubmittedMessage =>
      'आपका वापसी अनुरोध भेज दिया गया है।';

  @override
  String get returnReasonDamaged => 'परिवहन में क्षतिग्रस्त';

  @override
  String get returnReasonWrongItem => 'गलत वस्तु';

  @override
  String get returnReasonExpiry => 'समाप्त या समाप्ति के करीब';

  @override
  String get returnReasonQuality => 'गुणवत्ता की समस्या';

  @override
  String get returnReasonNotAsDescribed => 'विवरण के अनुसार नहीं';

  @override
  String get returnReasonMistake => 'गलती से ऑर्डर किया';

  @override
  String get returnReasonOther => 'अन्य';

  @override
  String get myReturnsTitle => 'मेरी वापसी';

  @override
  String get myReturnsSubtitle => 'हर विक्रेता ऑर्डर की वापसी की स्थिति देखें।';

  @override
  String get returnStatusFilterLabel => 'वापसी की स्थिति';

  @override
  String get allReturnsFilter => 'सभी वापसी';

  @override
  String get loadingReturnsLabel => 'आपके वापसी अनुरोध लोड हो रहे हैं...';

  @override
  String get loadingMoreReturnsLabel => 'और वापसी लोड हो रही हैं...';

  @override
  String get loadMoreReturnsAction => 'और वापसी दिखाएँ';

  @override
  String get noReturnsMessage => 'आपने अभी तक कोई वापसी अनुरोध नहीं किया है।';

  @override
  String get returnDetailTitle => 'वापसी का विवरण';

  @override
  String get loadingReturnDetailLabel => 'वापसी का विवरण लोड हो रहा है...';

  @override
  String get returnDetailLoadFailed => 'यह वापसी अनुरोध लोड नहीं हो सका।';

  @override
  String returnRequestedOnLabel(String date) {
    return '$date को अनुरोध किया गया';
  }

  @override
  String returnExpectedAmountLabel(String amount) {
    return 'अनुमानित वापसी राशि: $amount';
  }

  @override
  String get returnTimelineTitle => 'वापसी की समयरेखा';

  @override
  String get returnTimelineEmptyMessage =>
      'अभी वापसी की स्थिति का कोई अपडेट उपलब्ध नहीं है।';

  @override
  String get openRelatedOrderAction => 'विक्रेता ऑर्डर खोलें';

  @override
  String get returnStatusRequested => 'अनुरोध किया गया';

  @override
  String get returnStatusApproved => 'स्वीकृत';

  @override
  String get returnStatusRejected => 'अस्वीकृत';

  @override
  String get returnStatusInTransit => 'परिवहन में';

  @override
  String get returnStatusReceived => 'विक्रेता को प्राप्त';

  @override
  String get returnStatusInspected => 'निरीक्षण पूरा';

  @override
  String get returnStatusCompleted => 'पूर्ण';

  @override
  String get returnStatusCancelled => 'रद्द';

  @override
  String get cancelReturnAction => 'वापसी रद्द करें';

  @override
  String get cancelReturnDialogTitle => 'क्या यह वापसी रद्द करें?';

  @override
  String get cancelReturnDialogMessage =>
      'आप पिकअप से पहले वापसी रद्द कर सकते हैं। विक्रेता ऑर्डर फिर से डिलीवर की स्थिति में आ जाएगा।';

  @override
  String get keepReturnAction => 'वापसी जारी रखें';

  @override
  String get returnCancelledMessage => 'आपका वापसी अनुरोध रद्द कर दिया गया है।';

  @override
  String returnApprovedAmountLabel(String amount) {
    return 'स्वीकृत रिफंड राशि: $amount';
  }

  @override
  String get returnInspectionNoteLabel => 'निरीक्षण टिप्पणी';

  @override
  String returnRefundStatusLabel(String status) {
    return 'रिफंड स्थिति: $status';
  }

  @override
  String returnRefundReferenceLabel(String reference) {
    return 'रिफंड संदर्भ: $reference';
  }

  @override
  String get creditNoteTitle => 'रिफंड क्रेडिट नोट';

  @override
  String get creditNoteViewAction => 'क्रेडिट नोट देखें';

  @override
  String get creditNoteCheckStatusAction => 'क्रेडिट नोट की स्थिति देखें';

  @override
  String get creditNoteDownloadAction => 'क्रेडिट नोट पीडीएफ डाउनलोड करें';

  @override
  String get creditNotePreparingMessage =>
      'आपका क्रेडिट नोट पीडीएफ तैयार हो रहा है। थोड़ी देर बाद फिर देखें।';

  @override
  String get creditNoteFailedMessage =>
      'क्रेडिट नोट पीडीएफ तैयार नहीं हो सका। बाद में फिर देखें।';

  @override
  String get creditNoteOpenedMessage =>
      'क्रेडिट नोट पीडीएफ ब्राउज़र में खोला गया।';

  @override
  String get creditNoteOpenFailedMessage =>
      'क्रेडिट नोट पीडीएफ नहीं खुल सका। फिर प्रयास करें।';

  @override
  String creditNoteNumberLabel(String number) {
    return 'क्रेडिट नोट: $number';
  }

  @override
  String creditNoteOriginalInvoiceLabel(String number) {
    return 'मूल इनवॉइस: $number';
  }

  @override
  String creditNoteRefundAmountLabel(String amount) {
    return 'रिफंड राशि: $amount';
  }

  @override
  String creditNoteTaxLabel(String amount) {
    return 'वापस किया गया कर: $amount';
  }

  @override
  String get refundStatusPending => 'लंबित';

  @override
  String get refundStatusProcessing => 'प्रक्रिया में';

  @override
  String get refundStatusSucceeded => 'पूर्ण';

  @override
  String get refundStatusFailed => 'विफल';

  @override
  String get refundStatusCancelled => 'रद्द';

  @override
  String get kisanClubTitle => 'किसान क्लब';

  @override
  String get kisanClubLoading => 'आपकी किसान क्लब सदस्यता जाँची जा रही है...';

  @override
  String get kisanClubLoadFailed => 'अभी किसान क्लब लोड नहीं हो सका।';

  @override
  String get kisanClubUnavailable => 'इस परिवेश में किसान क्लब उपलब्ध नहीं है।';

  @override
  String get kisanClubJoinTitle => 'किसान क्लब से जुड़ें';

  @override
  String get kisanClubJoinSubtitle =>
      'निःशुल्क सदस्यता, स्थानीय सहायता और पात्र उत्पाद लाभ।';

  @override
  String get kisanClubFreeMembership =>
      'किसान क्लब की सदस्यता निःशुल्क है। जुड़ने के लिए केवल पिनकोड और कार्यक्रम की शर्तों की स्वीकृति आवश्यक है।';

  @override
  String get kisanClubTermsSummary =>
      'जुड़कर आप किसान क्लब की वर्तमान कार्यक्रम शर्तें स्वीकार करते हैं। सलाह, विपणन और सटीक स्थान की अनुमति अलग और वैकल्पिक हैं।';

  @override
  String get kisanClubAcceptTerms =>
      'मैं किसान क्लब कार्यक्रम की शर्तें स्वीकार करता/करती हूँ';

  @override
  String get kisanClubTermsRequired =>
      'किसान क्लब से जुड़ने के लिए कार्यक्रम की शर्तें स्वीकार करें।';

  @override
  String get kisanClubOptionalConsentsTitle => 'वैकल्पिक अनुमतियाँ';

  @override
  String get kisanClubOptionalConsentsMessage =>
      'सदस्यता खोए बिना आप इन विकल्पों को बाद में बदल या अस्वीकार कर सकते हैं।';

  @override
  String get kisanClubAdvisoryConsent => 'फसल और खेत संबंधी सलाह संदेश';

  @override
  String get kisanClubMarketingConsent => 'ऑफर और विपणन संदेश';

  @override
  String get kisanClubLocationConsent => 'खेत का सटीक स्थान';

  @override
  String get kisanClubLocationConsentHelp =>
      'स्थान वैकल्पिक है। इसे बंद रखने पर भी पिनकोड स्तर की सेवा जारी रहेगी।';

  @override
  String get kisanClubJoinAction => 'निःशुल्क जुड़ें';

  @override
  String get kisanClubJoinSuccess => 'आप किसान क्लब से जुड़ गए हैं।';

  @override
  String get kisanClubJoinFailed =>
      'किसान क्लब से नहीं जुड़ सके। कृपया फिर प्रयास करें।';

  @override
  String get kisanClubConsentSaved => 'आपकी अनुमति के विकल्प सहेज दिए गए हैं।';

  @override
  String get kisanClubConsentSaveFailed =>
      'सदस्यता सहेजी गई, लेकिन अनुमति के विकल्प अपडेट नहीं हो सके। किसान क्लब से फिर प्रयास करें।';

  @override
  String get kisanClubSaveConsentsAction => 'विकल्प सहेजें';

  @override
  String get kisanClubHomeIntro =>
      'आपकी किसान क्लब सदस्यता और कार्यक्रम की प्रगति।';

  @override
  String kisanClubMemberNumber(String memberNumber) {
    return 'सदस्य संख्या: $memberNumber';
  }

  @override
  String kisanClubHomePincode(String pincode) {
    return 'घर का पिनकोड: $pincode';
  }

  @override
  String get kisanClubStatusPendingProfile => 'खेत प्रोफ़ाइल अधूरी है';

  @override
  String get kisanClubStatusAwaitingPromoter =>
      'स्थानीय प्रमोटर की प्रतीक्षा है';

  @override
  String get kisanClubStatusActive => 'सक्रिय सदस्य';

  @override
  String get kisanClubStatusSuspended => 'सदस्यता निलंबित है';

  @override
  String get kisanClubStatusInactive => 'सदस्यता निष्क्रिय है';

  @override
  String get kisanClubStatusClosed => 'सदस्यता बंद है';

  @override
  String get kisanClubCompleteProfileMessage =>
      'आगे बढ़ने के लिए अपने खेत का विवरण पूरा करें।';

  @override
  String get kisanClubCompleteProfileAction => 'प्रोफ़ाइल पूरी करें';

  @override
  String get kisanClubProfileCompletionTitle => 'क्लब प्रोफ़ाइल पूरी करें';

  @override
  String get kisanClubProfileStepOneTitle => 'चरण 1/2: अपना पहला खेत जोड़ें';

  @override
  String get kisanClubProfileStepOneMessage =>
      'खेत का नाम, पिनकोड, क्षेत्रफल और मालिकाना विवरण जोड़ें। नीचे खेत जोड़ें बटन का उपयोग करें।';

  @override
  String get kisanClubProfileStepTwoTitle => 'चरण 2/2: उगाई जा रही फसल जोड़ें';

  @override
  String get kisanClubProfileStepTwoMessage =>
      'किसी खेत में फसल चक्र जोड़ें चुनें और फसल, खेती का क्षेत्रफल और सीजन दर्ज करें।';

  @override
  String get kisanClubProfileSavedProgressMessage =>
      'आपकी प्रगति सुरक्षित है। आप बाद में यहीं से जारी रख सकते हैं।';

  @override
  String get kisanClubProfileCompletedMessage =>
      'क्लब खेत प्रोफ़ाइल पूरी हो गई।';

  @override
  String get kisanClubFindingPromoterMessage =>
      'हम आपके स्थानीय किसान क्लब साथी को खोज रहे हैं।';

  @override
  String get kisanClubActiveMessage => 'आपकी किसान क्लब सदस्यता सक्रिय है।';

  @override
  String get kisanClubSuspendedMessage =>
      'आपकी सदस्यता केवल पढ़ने के लिए है। सहायता के लिए संपर्क करें।';

  @override
  String get kisanClubInactiveMessage =>
      'यह सदस्यता सक्रिय नहीं है। सहायता के लिए संपर्क करें।';

  @override
  String get kisanClubOpenSupportAction => 'सहायता खोलें';

  @override
  String get kisanClubCatalogueTitle => 'क्लब उत्पाद';

  @override
  String get kisanClubCatalogueSubtitle =>
      'अपने किसान क्लब क्षेत्र के लिए चुने गए उत्पाद देखें।';

  @override
  String get kisanClubEligibleProductsLabel => 'पात्र क्लब उत्पाद';

  @override
  String get kisanClubEligibleBadge => 'किसान क्लब लाभ';

  @override
  String get kisanClubBenefitCalculatedInCart =>
      'विक्रेता का ऑफर चुनें। उपलब्ध क्लब लाभ को कार्ट में जोड़ते समय सुरक्षित रूप से गणना की जाती है।';

  @override
  String kisanClubBenefitAddedMessage(String amount) {
    return '$amount के अनुमानित क्लब लाभ के साथ कार्ट में जोड़ा गया।';
  }

  @override
  String get kisanClubBenefitLabel => 'किसान क्लब लाभ';

  @override
  String get kisanClubFarmerPayableLabel => 'आपका भुगतान';

  @override
  String kisanClubLineBenefitLabel(String amount) {
    return 'क्लब लाभ: $amount';
  }

  @override
  String get kisanClubBenefitsTitle => 'लाभ टोकन';

  @override
  String get kisanClubBenefitsSubtitle =>
      'प्रमोटर की सहायता से खरीद के लिए बनाए गए कोड देखें।';

  @override
  String get kisanClubBenefitsLoading => 'आपके लाभ टोकन लोड हो रहे हैं...';

  @override
  String get kisanClubBenefitsLoadingMore => 'और टोकन लोड हो रहे हैं...';

  @override
  String get kisanClubBenefitsLoadMore => 'और टोकन लोड करें';

  @override
  String get kisanClubBenefitsEmpty =>
      'अभी कोई लाभ टोकन नहीं है। टोकन बनाने के लिए पात्र क्लब उत्पाद चुनें।';

  @override
  String get kisanClubTokenStatusFilterLabel => 'टोकन स्थिति';

  @override
  String get kisanClubTokenStatusAll => 'सभी टोकन स्थितियाँ';

  @override
  String get kisanClubTokenCreateAction => 'प्रमोटर टोकन बनाएं';

  @override
  String get kisanClubTokenCreating => 'सुरक्षित टोकन बन रहा है...';

  @override
  String get kisanClubTokenCreatedTitle => 'लाभ टोकन बन गया';

  @override
  String get kisanClubTokenCreatedMessage =>
      'यह कोड केवल अपने नियुक्त किसान क्लब प्रमोटर को दें। यह केवल एक बार दिखाया जाता है।';

  @override
  String get kisanClubTokenSecurityWarning =>
      'यह कोड सहायता से ऑर्डर बनाने की अनुमति देता है। ऑर्डर बनने से पहले मौजूदा कीमत और लाभ दोबारा जांचे जाएंगे। भुगतान आपको ऐप में ही करना होगा।';

  @override
  String get kisanClubTokenSavedAction => 'मैंने कोड सुरक्षित कर लिया';

  @override
  String get kisanClubTokenCodeNotRecoverable =>
      'सुरक्षा के लिए पूरा कोड दोबारा नहीं दिखाया जा सकता। यदि आपने इसे सुरक्षित नहीं किया तो नया टोकन बनाएं।';

  @override
  String get kisanClubTokenStatusIssued => 'तैयार';

  @override
  String get kisanClubTokenStatusRedeemed => 'उपयोग किया गया';

  @override
  String get kisanClubTokenStatusExpired => 'समाप्त';

  @override
  String get kisanClubTokenStatusCancelled => 'रद्द';

  @override
  String kisanClubTokenReference(String reference) {
    return 'संदर्भ: $reference';
  }

  @override
  String kisanClubTokenSeller(String seller) {
    return 'विक्रेता: $seller';
  }

  @override
  String kisanClubTokenQuantity(int quantity) {
    return 'मात्रा: $quantity';
  }

  @override
  String kisanClubTokenBenefit(String amount) {
    return 'अनुमानित क्लब लाभ: $amount';
  }

  @override
  String kisanClubTokenPayable(String amount) {
    return 'अनुमानित भुगतान: $amount';
  }

  @override
  String kisanClubTokenExpires(String date) {
    return 'समाप्ति: $date';
  }

  @override
  String get myFarmsTitle => 'मेरे खेत';

  @override
  String get myFarmsSubtitle =>
      'किसान क्लब सहायता के लिए खेत का क्षेत्रफल और फसलें दर्ज करें।';

  @override
  String get myFarmsLoading => 'आपके खेत लोड हो रहे हैं...';

  @override
  String get myFarmsEmpty =>
      'अभी कोई खेत नहीं जोड़ा गया है। क्लब प्रोफाइल आगे बढ़ाने के लिए पहला खेत जोड़ें।';

  @override
  String get addFarmAction => 'खेत जोड़ें';

  @override
  String get addFarmTitle => 'खेत जोड़ें';

  @override
  String get editFarmAction => 'खेत संपादित करें';

  @override
  String get editFarmTitle => 'खेत का विवरण संपादित करें';

  @override
  String get farmActiveLabel => 'खेत सक्रिय है';

  @override
  String get saveFarmChangesAction => 'बदलाव सहेजें';

  @override
  String get savingFarmChangesLabel => 'बदलाव सहेजे जा रहे हैं...';

  @override
  String get farmNameLabel => 'खेत का नाम';

  @override
  String get farmVillageLabel => 'गांव (वैकल्पिक)';

  @override
  String get farmAreaLabel => 'क्षेत्रफल एकड़ में';

  @override
  String get farmOwnershipLabel => 'स्वामित्व';

  @override
  String get farmOwnershipOwned => 'स्वयं का';

  @override
  String get farmOwnershipLeased => 'पट्टे पर';

  @override
  String get farmOwnershipSharecropped => 'बटाई पर';

  @override
  String get farmOwnershipOther => 'अन्य';

  @override
  String get invalidFarmAreaMessage =>
      'शून्य से अधिक खेत का क्षेत्रफल दर्ज करें।';

  @override
  String get saveFarmAction => 'खेत सुरक्षित करें';

  @override
  String get savingFarmLabel => 'खेत सुरक्षित हो रहा है...';

  @override
  String farmAreaAndPincode(String area, String pincode) {
    return '$area एकड़ · $pincode';
  }

  @override
  String cropCyclesCount(int count) {
    return 'फसल चक्र: $count';
  }

  @override
  String get noCropCyclesYet => 'अभी कोई फसल चक्र नहीं जोड़ा गया है।';

  @override
  String get acresUnit => 'एकड़';

  @override
  String get addCropCycleAction => 'फसल चक्र जोड़ें';

  @override
  String addCropCycleTitle(String farmName) {
    return '$farmName में फसल जोड़ें';
  }

  @override
  String get referenceCropsLoading => 'फसल सूची लोड हो रही है...';

  @override
  String get referenceCropsEmpty =>
      'कोई स्वीकृत फसल संदर्भ उपलब्ध नहीं है। कृपया सहायता से संपर्क करें।';

  @override
  String get cropReferenceLabel => 'फसल';

  @override
  String get cropReferenceRequired => 'स्वीकृत सूची से फसल चुनें।';

  @override
  String get cropVarietyLabel => 'किस्म का नाम (वैकल्पिक)';

  @override
  String get cropAreaLabel => 'फसल क्षेत्रफल एकड़ में';

  @override
  String cropAreaLimit(String area) {
    return 'इस खेत के $area एकड़ से अधिक नहीं हो सकता।';
  }

  @override
  String get invalidCropAreaMessage =>
      'शून्य से अधिक और खेत के क्षेत्रफल के भीतर फसल क्षेत्र दर्ज करें।';

  @override
  String get cropSeasonLabel => 'सीजन कोड';

  @override
  String get cropSeasonHint => 'उदाहरण: RABI_2026_27';

  @override
  String get invalidCropSeasonMessage =>
      '2–40 अक्षर, अंक, हाइफ़न या अंडरस्कोर का उपयोग करें।';

  @override
  String get saveCropCycleAction => 'फसल चक्र सुरक्षित करें';

  @override
  String get savingCropCycleLabel => 'फसल चक्र सुरक्षित हो रहा है...';

  @override
  String get editCropCycleAction => 'फसल चक्र बदलें';

  @override
  String get editCropCycleTitle => 'फसल चक्र बदलें';

  @override
  String get saveCropCycleChangesAction => 'बदलाव सुरक्षित करें';

  @override
  String get savingCropCycleChangesLabel => 'बदलाव सुरक्षित हो रहे हैं...';

  @override
  String get myPromoterTitle => 'मेरा किसान क्लब प्रमोटर';

  @override
  String get myPromoterSubtitle => 'अपने नियुक्त स्थानीय क्लब साथी को देखें।';

  @override
  String get myPromoterAwaitingSubtitle =>
      'हम अभी आपका स्थानीय क्लब साथी खोज रहे हैं।';

  @override
  String get myPromoterLoading => 'आपके प्रमोटर की जानकारी लोड हो रही है...';

  @override
  String get myPromoterAwaitingMessage =>
      'अभी कोई प्रमोटर नियुक्त नहीं है। किसान क्लब संचालन आपके लिए पात्र स्थानीय साथी खोज रहा है।';

  @override
  String get myPromoterNameUnavailable => 'नियुक्त किसान क्लब प्रमोटर';

  @override
  String myPromoterAssignedOn(String date) {
    return 'नियुक्ति की तारीख: $date';
  }

  @override
  String myPromoterTerritory(String territory) {
    return 'क्षेत्र: $territory';
  }

  @override
  String myPromoterPhone(String phone) {
    return 'फोन: $phone';
  }

  @override
  String get myPromoterCopyPhoneAction => 'फोन नंबर कॉपी करें';

  @override
  String get myPromoterPhoneCopied => 'प्रमोटर का फोन नंबर कॉपी हो गया।';

  @override
  String get myPromoterPrivacyTitle => 'आपकी जानकारी सीमित रहती है';

  @override
  String get myPromoterPrivacyMessage =>
      'आपका नियुक्त प्रमोटर केवल सहायता के लिए जरूरी क्लब खेत और फसल जानकारी देख सकता है। भुगतान जानकारी और अन्य विक्रेताओं के असंबंधित ऑर्डर साझा नहीं किए जाते।';

  @override
  String get cropDiaryTitle => 'फसल गतिविधि डायरी';

  @override
  String cropDiaryFor(String cropName) {
    return '$cropName गतिविधि डायरी';
  }

  @override
  String get cropDiaryLoading => 'फसल गतिविधियां लोड हो रही हैं...';

  @override
  String get cropDiaryEmpty => 'अभी कोई फसल गतिविधि दर्ज नहीं की गई है।';

  @override
  String get addCropActivityAction => 'गतिविधि जोड़ें';

  @override
  String get addCropActivityTitle => 'फसल गतिविधि दर्ज करें';

  @override
  String get cropActivityTypeLabel => 'गतिविधि का प्रकार';

  @override
  String get cropActivityDateLabel => 'गतिविधि की तारीख';

  @override
  String get cropActivityNotesLabel => 'क्या हुआ? (वैकल्पिक)';

  @override
  String get cropActivityFactualHelp =>
      'आपने जो देखा या किया वही दर्ज करें। यह डायरी कीटनाशक या उपचार की सलाह नहीं देती।';

  @override
  String get saveCropActivity => 'गतिविधि सुरक्षित करें';

  @override
  String get savingCropActivity => 'गतिविधि सुरक्षित हो रही है...';

  @override
  String get activitySowing => 'बुवाई';

  @override
  String get activityIrrigation => 'सिंचाई';

  @override
  String get activityFertilizerApplied => 'उर्वरक डाला गया';

  @override
  String get activityCropProtectionApplied => 'फसल सुरक्षा उत्पाद लगाया गया';

  @override
  String get activityPestObserved => 'कीट देखा गया';

  @override
  String get activityDiseaseObserved => 'रोग देखा गया';

  @override
  String get activityWeeding => 'निराई';

  @override
  String get activityCropDamage => 'फसल नुकसान';

  @override
  String get activityHarvest => 'कटाई';

  @override
  String get activityOther => 'अन्य गतिविधि';

  @override
  String get activitySourceFarmer => 'आपके द्वारा दर्ज';

  @override
  String get activitySourcePromoter => 'आपके नियुक्त प्रमोटर द्वारा दर्ज';

  @override
  String get activitySourceSystem => 'सिस्टम द्वारा दर्ज';

  @override
  String get harvestCropAction => 'कटाई दर्ज करें';

  @override
  String get harvestCropTitle => 'यह फसल चक्र पूरा करें';

  @override
  String get actualHarvestDateLabel => 'वास्तविक कटाई की तारीख';

  @override
  String get harvestYieldLabel => 'उपज क्विंटल में (वैकल्पिक)';

  @override
  String get harvestYieldOptionalHelp =>
      'मापी गई कटाई उपज उपलब्ध होने पर दर्ज करें।';

  @override
  String get invalidHarvestYieldMessage => 'शून्य या सकारात्मक उपज दर्ज करें।';

  @override
  String get confirmHarvestAction => 'कटाई की पुष्टि करें';

  @override
  String get savingHarvestLabel => 'कटाई दर्ज हो रही है...';

  @override
  String get advisoryTitle => 'फसल सलाह';

  @override
  String get advisorySubtitle =>
      'अपनी सक्रिय फसलों के लिए स्वीकृत मार्गदर्शन पढ़ें।';

  @override
  String get advisoryLoading => 'आपकी फसल सलाह लोड हो रही है...';

  @override
  String get advisoryEmptyTitle => 'आपकी सभी सलाह पूरी है';

  @override
  String get advisoryEmpty => 'अभी आपकी सक्रिय फसलों के लिए कोई सलाह नहीं है।';

  @override
  String get advisoryDetailTitle => 'फसल सलाह';

  @override
  String advisoryCropLabel(String cropName) {
    return 'फसल: $cropName';
  }

  @override
  String advisoryDueLabel(String date) {
    return 'निर्धारित तिथि: $date';
  }

  @override
  String advisorySourceLabel(String source) {
    return 'स्रोत: $source';
  }

  @override
  String get advisoryHumanApprovedTitle => 'मानव द्वारा लिखी और स्वीकृत';

  @override
  String get advisoryDisclaimer =>
      'इसे सामान्य फसल मार्गदर्शन मानें। खेत की परिस्थितियाँ अलग होती हैं; उपचार का निर्णय लेने से पहले अपने प्रमोटर या योग्य कृषि विशेषज्ञ से बात करें।';

  @override
  String get advisoryImportantToday => 'आज महत्वपूर्ण';

  @override
  String get advisoryApprovedLabel => 'स्वीकृत मार्गदर्शन';

  @override
  String get advisoryUnreadLabel => 'नई';

  @override
  String get advisoryReadAction => 'सलाह पढ़ें';

  @override
  String get advisoryWhatToDoTitle => 'आपको क्या करना चाहिए';

  @override
  String get advisoryWhenToActTitle => 'कब कार्रवाई करें';

  @override
  String get advisoryTechnicalDetailsTitle => 'स्रोत और तकनीकी विवरण';

  @override
  String get advisoryContactPromoterAction =>
      'प्रमोटर या विशेषज्ञ से संपर्क करें';

  @override
  String get advisoryDismissAction => 'सलाह हटाएँ';

  @override
  String get cropDoctorTitle => 'क्रॉप डॉक्टर';

  @override
  String get cropDoctorProblemTitle => 'फसल में समस्या है?';

  @override
  String get cropDoctorIntro =>
      'प्रभावित फसल की साफ तस्वीरें लें ताकि सहायता विशेषज्ञ आपकी देखी हुई समस्या समझ सके।';

  @override
  String get cropDoctorPhotoGuideTitle => 'उपयोगी तस्वीर कैसे लें';

  @override
  String get cropDoctorGuideAffectedLeaf =>
      'प्रभावित पत्ती या पौधा साफ दिखाई देना चाहिए।';

  @override
  String get cropDoctorGuideDaylight =>
      'अच्छी दिन की रोशनी में तस्वीर लें और गहरी छाया से बचें।';

  @override
  String get cropDoctorGuideClosePhoto =>
      'नुकसान साफ दिखाने के लिए पास से तस्वीर लें।';

  @override
  String get cropDoctorCaptureUnavailableTitle =>
      'फोटो जाँच बाद में उपलब्ध होगी';

  @override
  String get cropDoctorCaptureUnavailableMessage =>
      'सुरक्षित फोटो अपलोड और जाँच प्रदाता अभी जुड़े नहीं हैं। स्वीकृत बैकएंड उपलब्ध होने तक फोटो नियंत्रण बंद रहेंगे।';

  @override
  String get cropDoctorTakePhotoAction => 'फोटो लें';

  @override
  String get cropDoctorChoosePhotoAction => 'फोटो चुनें';

  @override
  String get cropDoctorHumanHelpAction => 'सहायता टीम को समस्या बताएं';

  @override
  String get cropDoctorNoDiagnosisMessage =>
      'यह स्क्रीन अपने आप फसल की जाँच या उपचार की सलाह नहीं देती।';

  @override
  String get cropDoctorOpenAction => 'फोटो मार्गदर्शिका खोलें';

  @override
  String get shopTabLabel => 'दुकान';

  @override
  String get ordersTabLabel => 'ऑर्डर';

  @override
  String get accountTabLabel => 'खाता';

  @override
  String get homeActiveCropTitle => 'आपकी फसल';

  @override
  String homeActiveCropDay(int days) {
    return 'दिन $days';
  }

  @override
  String get homeActiveCropViewAction => 'फसल देखें';

  @override
  String get homeActiveCropEmpty =>
      'फसल सलाह देखने के लिए अपना खेत और फसल जोड़ें।';

  @override
  String get homeActiveCropMore => 'सभी फसलें देखें';

  @override
  String get homeActiveOrderTitle => 'आपका ऑर्डर';

  @override
  String get homeActiveOrderTrackAction => 'ट्रैक करें';

  @override
  String get homeRecommendedTitle => 'आपके खेत के लिए';

  @override
  String get homeRecommendedViewAll => 'सभी देखें';

  @override
  String get homeSectionUnavailable =>
      'लोड नहीं हो सका। पुनः प्रयास के लिए नीचे खींचें।';
}
