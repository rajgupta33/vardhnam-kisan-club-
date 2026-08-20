// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get myTerritory => 'मेरा क्षेत्र';

  @override
  String get territoryLoadFailed =>
      'आपका क्षेत्र लोड नहीं हो सका। फिर कोशिश करें।';

  @override
  String get noTerritoryAssigned =>
      'इस संगठन संदर्भ में कोई क्षेत्र निर्धारित नहीं है। यदि क्षेत्र अपेक्षित है तो संचालन टीम से संपर्क करें।';

  @override
  String territoryDistrict(String district) {
    return 'ज़िला: $district';
  }

  @override
  String territoryState(String state) {
    return 'राज्य: $state';
  }

  @override
  String get territoryBlocks => 'ब्लॉक';

  @override
  String get territoryPincodes => 'सेवा पिनकोड';

  @override
  String get territoryVillages => 'गाँव';

  @override
  String get territoryReadOnlyNotice =>
      'क्षेत्र निर्धारण केवल अधिकृत वर्धनम संचालन कर्मचारी प्रबंधित करते हैं।';

  @override
  String get registerFarmerWithOtp => 'किसान OTP से पंजीकरण';

  @override
  String get assistedOtpConsentNotice =>
      'OTP तभी पूछें जब किसान सामने हो और पंजीकरण के लिए सहमत हो। प्रमोटर को किसान का लॉगिन सत्र नहीं मिलता।';

  @override
  String get farmerOtpCode => 'किसान OTP कोड';

  @override
  String get verifyAndRegister => 'सत्यापित करें और पंजीकरण करें';

  @override
  String mockOtpCode(String code) {
    return 'मॉक OTP: $code';
  }

  @override
  String get assistedOtpRequestFailed =>
      'पंजीकरण OTP नहीं मंगाया जा सका। लीड स्थिति जाँचें और फिर कोशिश करें।';

  @override
  String get assistedOtpVerificationFailed =>
      'OTP सत्यापित नहीं हो सका। कोड जाँचें और फिर कोशिश करें।';

  @override
  String get assistedRegistrationSuccess =>
      'किसान OTP से सत्यापित, पंजीकृत और आपकी लीड से लिंक हो गया।';

  @override
  String get deliveryLocationProofHelp =>
      'पुष्टि के बाद ऐप डिलीवरी स्थान दर्ज करने के लिए लोकेशन अनुमति मांगेगा। अनुमति या लोकेशन उपलब्ध न होने पर भी OTP से डिलीवरी पूरी की जा सकती है।';

  @override
  String get deliveryAssignments => 'मेरी डिलीवरी';

  @override
  String get deliveryAvailability => 'नई डिलीवरी के लिए उपलब्ध';

  @override
  String get deliveryOnlineExplanation =>
      'आप ऑनलाइन हैं। ऑपरेशन टीम आपको नई डिलीवरी दे सकती है।';

  @override
  String get deliveryOfflineExplanation =>
      'आप ऑफलाइन हैं। ऑपरेशन टीम आपको नई डिलीवरी नहीं दे सकती।';

  @override
  String get deliveryNowOnline => 'अब आप डिलीवरी असाइनमेंट के लिए उपलब्ध हैं।';

  @override
  String get deliveryNowOffline => 'अब आप नई डिलीवरी के लिए ऑफलाइन हैं।';

  @override
  String get deliveryAvailabilityLoadFailed => 'उपलब्धता लोड नहीं हो सकी।';

  @override
  String get deliveryAvailabilityUpdateFailed =>
      'उपलब्धता अपडेट नहीं हो सकी। फिर प्रयास करें।';

  @override
  String get deliveryAssignmentsLoadFailed =>
      'आपकी डिलीवरी असाइनमेंट लोड नहीं हो सकीं।';

  @override
  String get noDeliveryAssignments =>
      'अभी आपको कोई डिलीवरी असाइन नहीं की गई है।';

  @override
  String get deliveryAssignmentDetail => 'डिलीवरी विवरण';

  @override
  String deliveryAssignmentNumber(String number) {
    return 'असाइनमेंट: $number';
  }

  @override
  String deliveryAssignmentStatus(String status) {
    return 'डिलीवरी स्थिति: $status';
  }

  @override
  String get deliveryStatusAssigned => 'असाइन की गई';

  @override
  String get deliveryStatusAccepted => 'स्वीकार की गई';

  @override
  String get deliveryStatusRejected => 'अस्वीकार की गई';

  @override
  String get deliveryStatusDelivered => 'डिलीवर की गई';

  @override
  String get deliveryStatusFailed => 'डिलीवरी विफल';

  @override
  String dispatchNumber(String number) {
    return 'डिस्पैच: $number';
  }

  @override
  String invoiceNumber(String number) {
    return 'इनवॉइस: $number';
  }

  @override
  String get deliveryAddress => 'डिलीवरी का पता';

  @override
  String farmerPhone(String phone) {
    return 'किसान का फ़ोन: $phone';
  }

  @override
  String get packageItems => 'पैकेज की वस्तुएँ';

  @override
  String itemQuantity(int quantity) {
    return 'मात्रा $quantity';
  }

  @override
  String get startDelivery => 'पैकेज लिया — डिलीवरी शुरू करें';

  @override
  String get acceptDeliveryAssignment => 'असाइनमेंट स्वीकार करें';

  @override
  String get rejectDeliveryAssignment => 'असाइनमेंट अस्वीकार करें';

  @override
  String get deliveryAssignmentAccepted =>
      'डिलीवरी असाइनमेंट स्वीकार कर लिया गया है।';

  @override
  String get deliveryAssignmentRejected =>
      'डिलीवरी असाइनमेंट अस्वीकार कर दिया गया है। ऑपरेशन टीम अब इसे दोबारा असाइन कर सकती है।';

  @override
  String get scanPackageQr => 'पैकेज QR स्कैन करें';

  @override
  String get scanPackageQrHelp =>
      'विक्रेता द्वारा लगाए गए QR लेबल को स्कैन करें। कैमरा केवल इस स्क्रीन के खुले रहने तक उपयोग होता है।';

  @override
  String get enterPackageCodeManually => 'पैकेज कोड हाथ से दर्ज करें';

  @override
  String get packageCode => 'पैकेज कोड';

  @override
  String get packageCodeRequired => 'पूरा पैकेज कोड दर्ज करें।';

  @override
  String get verifyPackagePickup => 'पिकअप सत्यापित करें';

  @override
  String get packagePickupVerified => 'पैकेज पिकअप सत्यापित हो गया है।';

  @override
  String get packagePickupVerificationFailed =>
      'पैकेज कोड मेल नहीं खाता। लेबल जाँचकर फिर प्रयास करें।';

  @override
  String get openNavigation => 'रास्ता खोलें';

  @override
  String get callFarmer => 'किसान को कॉल करें';

  @override
  String get externalAppOpenFailed =>
      'इस कार्रवाई के लिए कोई समर्थित ऐप नहीं मिला।';

  @override
  String get deliveryRejectionReason => 'अस्वीकार करने का कारण';

  @override
  String get deliveryRejectionReasonRequired =>
      'कारण दर्ज करें ताकि ऑपरेशन टीम यह डिलीवरी दोबारा असाइन कर सके।';

  @override
  String get deliveryStarted =>
      'ऑर्डर को डिलीवरी के लिए निकला हुआ दर्ज किया गया।';

  @override
  String get completeDelivery => 'OTP सत्यापित कर डिलीवरी पूरी करें';

  @override
  String get deliveryOtp => '6 अंकों का डिलीवरी OTP';

  @override
  String get deliveryOtpInvalid => '6 अंकों का OTP दर्ज करें।';

  @override
  String get deliveryOtpHelp =>
      'किसान से डिलीवरी OTP पूछें। बैकएंड सत्यापन के बाद ही डिलीवरी पूरी दर्ज होगी।';

  @override
  String get deliveryProofNoteOptional => 'डिलीवरी नोट (वैकल्पिक)';

  @override
  String get deliveryCompleted => 'डिलीवरी पूरी हुई और सत्यापित की गई।';

  @override
  String get deliveryCompletedWithLocation =>
      'डिलीवरी पूरी हुई। OTP और डिलीवरी स्थान दर्ज किए गए।';

  @override
  String get deliveryCompletedLocationDenied =>
      'OTP से डिलीवरी पूरी हुई। स्थान अनुमति अस्वीकार होने का परिणाम दर्ज किया गया।';

  @override
  String get deliveryCompletedLocationUnavailable =>
      'OTP से डिलीवरी पूरी हुई। डिवाइस स्थान उपलब्ध न होने का परिणाम दर्ज किया गया।';

  @override
  String get deliveryUpdateFailed =>
      'डिलीवरी अपडेट नहीं हो सकी। रीफ़्रेश करके फिर प्रयास करें।';

  @override
  String get deliveryOtpFailed =>
      'OTP सत्यापित नहीं हो सका। किसान से जाँचकर फिर प्रयास करें।';

  @override
  String get deliveryOtpExpiryNotice =>
      'OTP की समय-सीमा और प्रयास सीमा बैकएंड नियंत्रित करता है।';

  @override
  String get deliveryLocationProof => 'डिलीवरी स्थान प्रमाण';

  @override
  String deliveryLocationRecorded(String accuracy) {
    return 'स्थान दर्ज हुआ (डिवाइस सटीकता: $accuracy मीटर)।';
  }

  @override
  String get deliveryLocationPermissionDenied =>
      'स्थान अनुमति अस्वीकार की गई। OTP से डिलीवरी पूरी करने में बाधा नहीं आई।';

  @override
  String get deliveryLocationUnavailable =>
      'डिवाइस स्थान उपलब्ध नहीं था। OTP से डिलीवरी पूरी करने में बाधा नहीं आई।';

  @override
  String get deliveryLocationNotRecorded =>
      'इस पुराने डिलीवरी रिकॉर्ड में स्थान का परिणाम उपलब्ध नहीं है।';

  @override
  String get deliveryPhotoProofDeferred =>
      'अधिकृत निजी प्रमाण स्टोरेज उपलब्ध होने तक फ़ोटो प्रमाण उपलब्ध नहीं है।';

  @override
  String get markDeliveryFailed => 'डिलीवरी नहीं हो सकी';

  @override
  String get deliveryFailureTitle => 'विफल डिलीवरी दर्ज करें';

  @override
  String get deliveryFailureReason => 'विफलता का कारण';

  @override
  String get deliveryFailureNoteOptional => 'विवरण (वैकल्पिक)';

  @override
  String deliveryRetryAt(String date) {
    return '$date को फिर प्रयास';
  }

  @override
  String get chooseRetryDate => 'दोबारा प्रयास की तारीख चुनें';

  @override
  String get chooseRetryTime => 'दोबारा प्रयास का समय चुनें';

  @override
  String get deliveryRetryFutureRequired =>
      'भविष्य का दोबारा प्रयास समय चुनें।';

  @override
  String get deliveryFailureRecorded =>
      'विफल प्रयास दर्ज हुआ। दोबारा प्रयास निर्धारित है।';

  @override
  String get retryDeliveryNow => 'निर्धारित प्रयास शुरू करें';

  @override
  String get retryNotDue =>
      'निर्धारित समय पर दोबारा प्रयास शुरू किया जा सकता है।';

  @override
  String get deliveryRetryStarted =>
      'नए OTP के साथ डिलीवरी का दोबारा प्रयास शुरू हुआ।';

  @override
  String deliveryFailureAttemptCount(int count) {
    return 'विफल प्रयास: $count';
  }

  @override
  String get deliveryFailureFarmerUnavailable => 'किसान उपलब्ध नहीं';

  @override
  String get deliveryFailureFarmerRefused =>
      'किसान ने डिलीवरी लेने से मना किया';

  @override
  String get deliveryFailureAddressNotFound => 'पता नहीं मिला';

  @override
  String get deliveryFailureAccessRestricted => 'प्रवेश बाधित';

  @override
  String get deliveryFailureVehicleBreakdown => 'वाहन खराब';

  @override
  String get deliveryFailureWeatherRoute => 'मौसम या रास्ता बाधित';

  @override
  String get deliveryFailurePackageDamaged => 'पैकेज क्षतिग्रस्त';

  @override
  String get deliveryFailureOther => 'अन्य';

  @override
  String get returnPickups => 'रिटर्न पिकअप';

  @override
  String get returnPickupsLoadFailed =>
      'आपके रिटर्न पिकअप असाइनमेंट लोड नहीं हो सके।';

  @override
  String get noReturnPickups => 'आपको कोई रिटर्न पिकअप नहीं सौंपा गया है।';

  @override
  String get returnPickupDetail => 'रिटर्न पिकअप विवरण';

  @override
  String get returnPickupCollected => 'एकत्र किया गया';

  @override
  String get returnPickupAccepted => 'रिटर्न पिकअप स्वीकार किया गया।';

  @override
  String get returnPickupRejected => 'रिटर्न पिकअप अस्वीकार किया गया।';

  @override
  String get acceptReturnPickup => 'रिटर्न पिकअप स्वीकार करें';

  @override
  String get rejectReturnPickup => 'रिटर्न पिकअप अस्वीकार करें';

  @override
  String get collectReturnPickup => 'एकत्र करने की पुष्टि करें';

  @override
  String get returnPickupNoteOptional => 'एकत्रीकरण नोट (वैकल्पिक)';

  @override
  String get returnPickupCollectedMessage =>
      'रिटर्न एकत्र किया गया और जाँच के लिए विक्रेता को भेजा गया।';

  @override
  String get returnPickupUpdateFailed =>
      'रिटर्न पिकअप अपडेट नहीं हो सका। रीफ़्रेश करके फिर प्रयास करें।';

  @override
  String get returnReason => 'रिटर्न का कारण';

  @override
  String get pickupAddress => 'पिकअप पता';

  @override
  String get appTitle => 'वर्धनम पार्टनर';

  @override
  String get loginTitle => 'पार्टनर लॉग इन';

  @override
  String get phoneLabel => 'मोबाइल नंबर';

  @override
  String get phoneHint => '+91 98765 43210';

  @override
  String get requestOtp => 'ओटीपी मंगाएँ';

  @override
  String get otpLabel => '6 अंकों का ओटीपी';

  @override
  String get verifyOtp => 'सत्यापित करके आगे बढ़ें';

  @override
  String get changePhone => 'मोबाइल नंबर बदलें';

  @override
  String mockOtpNotice(String code) {
    return 'डेवलपमेंट ओटीपी: $code';
  }

  @override
  String get invalidPhone => 'सही भारतीय मोबाइल नंबर दर्ज करें।';

  @override
  String get invalidOtp => '6 अंकों का ओटीपी दर्ज करें।';

  @override
  String get authFailed => 'लॉग इन पूरा नहीं हो सका। फिर से कोशिश करें।';

  @override
  String get rateLimited => 'बहुत अधिक प्रयास हुए। थोड़ी देर बाद कोशिश करें।';

  @override
  String get selectWorkspace => 'कार्यस्थान चुनें';

  @override
  String get selectWorkspaceHelp =>
      'अभी उपयोग करने के लिए संगठन और भूमिका चुनें।';

  @override
  String get promoterRole => 'प्रमोटर';

  @override
  String get salesPartnerRole => 'सेल्स पार्टनर';

  @override
  String get serviceProviderRole => 'सेवा प्रदाता';

  @override
  String get deliveryPartnerRole => 'डिलीवरी पार्टनर';

  @override
  String welcomeRole(String role) {
    return '$role कार्यस्थान';
  }

  @override
  String get promoterBoundary =>
      'किसान और किसान क्लब के फील्ड काम यहाँ उपलब्ध होंगे।';

  @override
  String get salesPartnerBoundary =>
      'सेल्स एट्रिब्यूशन और सहायक ऑर्डर के काम यहाँ उपलब्ध होंगे।';

  @override
  String get serviceProviderBoundary =>
      'सेवा उपलब्धता और बुकिंग के काम यहाँ उपलब्ध होंगे।';

  @override
  String get deliveryPartnerBoundary =>
      'डिलीवरी असाइनमेंट और प्रमाण के काम यहाँ उपलब्ध होंगे।';

  @override
  String signedInOrganisation(String name) {
    return 'संगठन: $name';
  }

  @override
  String get language => 'भाषा';

  @override
  String get english => 'English';

  @override
  String get hindi => 'हिन्दी';

  @override
  String get logout => 'लॉग आउट';

  @override
  String get kisanClub => 'किसान क्लब';

  @override
  String get assignedFarmers => 'सौंपे गए किसान';

  @override
  String get assignedFarmersHelp =>
      'केवल आपके क्लब प्रोफाइल को सक्रिय रूप से सौंपे गए किसान दिखाए गए हैं।';

  @override
  String get noAssignedFarmers => 'कोई सक्रिय किसान असाइनमेंट नहीं है।';

  @override
  String memberNumber(String number) {
    return 'सदस्य $number';
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
      other: '$count खेत',
      one: '1 खेत',
      zero: 'कोई खेत नहीं',
    );
    return '$_temp0';
  }

  @override
  String farmArea(String area) {
    return '$area एकड़';
  }

  @override
  String cropSummary(String crop, String area, String status) {
    return '$crop · $area एकड़ · $status';
  }

  @override
  String get inactiveFarm => 'निष्क्रिय खेत';

  @override
  String get redeemBenefitToken => 'लाभ टोकन रिडीम करें';

  @override
  String get benefitTokenCode => 'लाभ टोकन कोड';

  @override
  String get benefitTokenHint => 'VKC-A1B2C3D4-123456';

  @override
  String get invalidBenefitToken =>
      'किसान द्वारा दिखाया गया पूरा लाभ टोकन दर्ज करें।';

  @override
  String get confirmRedemption => 'सहायक चेकआउट बनाएँ';

  @override
  String get redemptionWarning =>
      'बैकएंड कीमत, स्टॉक, सेवा क्षेत्र और लाभ की दोबारा जाँच करेगा। किसान को किसान ऐप में भुगतान पूरा करना होगा।';

  @override
  String get redemptionSuccess => 'सहायक चेकआउट बन गया';

  @override
  String checkoutReference(String id) {
    return 'चेकआउट: $id';
  }

  @override
  String orderReference(String id) {
    return 'विक्रेता ऑर्डर: $id';
  }

  @override
  String benefitAmount(String amount) {
    return 'क्लब लाभ: ₹$amount';
  }

  @override
  String farmerPayable(String amount) {
    return 'किसान देय: ₹$amount';
  }

  @override
  String get paymentStillRequired => 'किसान ऐप में भुगतान अभी भी आवश्यक है।';

  @override
  String get loadFailed => 'क्लब की जानकारी लोड नहीं हो सकी।';

  @override
  String get tryAgain => 'फिर कोशिश करें';

  @override
  String get fulfilmentAssignments => 'क्लब पूर्ति';

  @override
  String get fulfilmentHelp =>
      'समन्वय स्थिति विक्रेता ऑर्डर और डिलीवरी स्थिति से अलग है।';

  @override
  String get fulfilmentStatusFilter => 'समन्वय स्थिति';

  @override
  String get allStatuses => 'सभी स्थितियाँ';

  @override
  String get noFulfilmentAssignments => 'कोई मेल खाता क्लब असाइनमेंट नहीं है।';

  @override
  String get loadMore => 'और लोड करें';

  @override
  String orderNumber(String number) {
    return 'ऑर्डर $number';
  }

  @override
  String sellerName(String name) {
    return 'विक्रेता: $name';
  }

  @override
  String sellerOrderStatus(String status) {
    return 'विक्रेता ऑर्डर स्थिति: $status';
  }

  @override
  String coordinationStatus(String status) {
    return 'समन्वय: $status';
  }

  @override
  String fulfilmentMode(String mode) {
    return 'तरीका: $mode';
  }

  @override
  String get statusAssigned => 'सौंपा गया';

  @override
  String get statusPromoterAccepted => 'स्वीकार किया';

  @override
  String get statusPromoterDeclined => 'अस्वीकार किया';

  @override
  String get statusProductReady => 'उत्पाद तैयार';

  @override
  String get statusFarmerContacted => 'किसान से संपर्क हुआ';

  @override
  String get statusReadyForPickup => 'पिकअप के लिए तैयार';

  @override
  String get statusOutForDelivery => 'डिलीवरी के लिए निकला';

  @override
  String get statusCompleted => 'पूरा हुआ';

  @override
  String get statusFailed => 'विफल';

  @override
  String get statusReassigned => 'फिर से सौंपा गया';

  @override
  String get statusCancelled => 'रद्द';

  @override
  String get actionAccept => 'असाइनमेंट स्वीकार करें';

  @override
  String get actionDecline => 'असाइनमेंट अस्वीकार करें';

  @override
  String get actionProductReady => 'उत्पाद तैयार दर्ज करें';

  @override
  String get actionFarmerContacted => 'किसान से संपर्क दर्ज करें';

  @override
  String get actionReadyForPickup => 'पिकअप के लिए तैयार दर्ज करें';

  @override
  String get actionOutForDelivery => 'डिलीवरी के लिए निकला दर्ज करें';

  @override
  String get actionComplete => 'समन्वय पूरा करें';

  @override
  String get actionFail => 'समन्वय विफल दर्ज करें';

  @override
  String get confirmAction => 'कार्रवाई की पुष्टि करें';

  @override
  String get cancelAction => 'रद्द करें';

  @override
  String get reasonLabel => 'कारण';

  @override
  String get reasonRequired => 'कम से कम 3 अक्षर दर्ज करें।';

  @override
  String get statusHistory => 'समन्वय इतिहास';

  @override
  String historyItem(String status, String date) {
    return '$status · $date';
  }

  @override
  String get transitionFailed =>
      'समन्वय स्थिति अपडेट नहीं हो सकी। रीफ्रेश करके फिर कोशिश करें।';

  @override
  String get recordFarmSurvey => 'खेत सर्वे दर्ज करें';

  @override
  String get farmDetails => 'खेत का विवरण';

  @override
  String get farmName => 'खेत का नाम';

  @override
  String get village => 'गाँव';

  @override
  String get district => 'ज़िला';

  @override
  String get state => 'राज्य';

  @override
  String get pincode => 'पिनकोड';

  @override
  String get areaAcres => 'क्षेत्रफल (एकड़)';

  @override
  String get ownershipType => 'स्वामित्व का प्रकार';

  @override
  String get irrigationSource => 'सिंचाई का स्रोत';

  @override
  String get notSpecified => 'दर्ज नहीं';

  @override
  String get soilTypeOptional => 'मिट्टी का प्रकार (वैकल्पिक)';

  @override
  String get addCropCycle => 'वर्तमान फसल जोड़ें';

  @override
  String get crop => 'फसल';

  @override
  String get varietyOptional => 'किस्म (वैकल्पिक)';

  @override
  String get cropAreaAcres => 'फसल क्षेत्र (एकड़)';

  @override
  String get season => 'मौसम कोड';

  @override
  String get sowingDateOptional => 'बुवाई की तारीख (YYYY-MM-DD, वैकल्पिक)';

  @override
  String get harvestDateOptional => 'अनुमानित कटाई (YYYY-MM-DD, वैकल्पिक)';

  @override
  String get locationNotCollected =>
      'इस सर्वे में सटीक स्थान एकत्र नहीं किया जाता है।';

  @override
  String get submitFarmSurvey => 'खेत सर्वे सहेजें';

  @override
  String get farmSurveyCreated =>
      'खेत सर्वे किसान के रिकॉर्ड में जोड़ दिया गया है।';

  @override
  String get farmSurveyFailed =>
      'खेत सर्वे सहेजा नहीं जा सका। विवरण जाँचकर फिर कोशिश करें।';

  @override
  String get done => 'पूर्ण';

  @override
  String get requiredField => 'यह जानकारी आवश्यक है।';

  @override
  String get invalidPincode => '6 अंकों का पिनकोड दर्ज करें।';

  @override
  String get invalidArea => 'शून्य से अधिक क्षेत्रफल दर्ज करें।';

  @override
  String get invalidSeason =>
      '2–40 अक्षर, अंक, अंडरस्कोर या हाइफ़न उपयोग करें।';

  @override
  String get invalidDate => 'YYYY-MM-DD प्रारूप में सही तारीख दर्ज करें।';

  @override
  String get selectCropRequired => 'फसल चुनें।';

  @override
  String get cropAreaTooLarge =>
      'फसल क्षेत्र खेत के क्षेत्र से अधिक नहीं हो सकता।';

  @override
  String get ownershipOwned => 'स्वयं का';

  @override
  String get ownershipLeased => 'पट्टे पर';

  @override
  String get ownershipSharecropped => 'बटाई पर';

  @override
  String get optionOther => 'अन्य';

  @override
  String get irrigationTubeWell => 'ट्यूबवेल';

  @override
  String get irrigationCanal => 'नहर';

  @override
  String get irrigationRainFed => 'वर्षा आधारित';

  @override
  String get irrigationPond => 'तालाब';

  @override
  String get irrigationDrip => 'ड्रिप';

  @override
  String get irrigationSprinkler => 'स्प्रिंकलर';

  @override
  String get earningsStatement => 'कमाई का विवरण';

  @override
  String get earningsBackendNotice =>
      'राशि और स्थिति वर्धनम वित्तीय लेजर से आती हैं। अनंतिम कमाई अभी भुगतान योग्य नहीं है।';

  @override
  String get payoutAccount => 'भुगतान खाता';

  @override
  String get noPayoutAccount =>
      'कोई भुगतान खाता दर्ज नहीं है। खाता जोड़ना एक अलग सत्यापित प्रक्रिया है।';

  @override
  String ifsc(String code) {
    return 'आईएफएससी: $code';
  }

  @override
  String payoutStatus(String status) {
    return 'खाता स्थिति: $status';
  }

  @override
  String payoutRejectionReason(String reason) {
    return 'समीक्षा कारण: $reason';
  }

  @override
  String get payoutPendingVerification => 'सत्यापन लंबित';

  @override
  String get payoutVerified => 'सत्यापित';

  @override
  String get payoutRejected => 'अस्वीकृत';

  @override
  String get earningsProvisional => 'अनंतिम';

  @override
  String get earningsFinal => 'अंतिम';

  @override
  String get earningsReversed => 'वापस लिया गया';

  @override
  String get promoterCommission => 'प्रमोटर कमीशन';

  @override
  String get deliveryEarning => 'डिलीवरी कमाई';

  @override
  String get earningsStatusFilter => 'कमाई की स्थिति';

  @override
  String get noEarnings => 'कोई मिलती हुई कमाई प्रविष्टि नहीं है।';

  @override
  String eligibleOn(String date) {
    return '$date को योग्य';
  }

  @override
  String get earningsLoadFailed => 'आपकी कमाई का विवरण लोड नहीं हो सका।';

  @override
  String get payoutAccountLoadFailed =>
      'आपके भुगतान खाते की स्थिति लोड नहीं हो सकी। रीफ्रेश करने के लिए नीचे खींचें।';

  @override
  String get addPayoutAccount => 'भुगतान खाता जोड़ें';

  @override
  String get editPayoutAccount => 'भुगतान खाता बदलें';

  @override
  String get managePayoutAccount => 'भुगतान खाता प्रबंधित करें';

  @override
  String get payoutAccountPrivacyNotice =>
      'आपका पूरा बैंक खाता नंबर सुरक्षित रूप से वर्धनम को भेजा जाता है और ऐप में दोबारा कभी नहीं दिखाया जाता।';

  @override
  String get payoutAccountResubmissionNotice =>
      'बदलाव सहेजने पर खाते की स्थिति फिर से सत्यापन लंबित हो जाएगी। पूरा खाता नंबर दोबारा दर्ज करें।';

  @override
  String get accountHolderName => 'खाताधारक का नाम';

  @override
  String get bankName => 'बैंक का नाम';

  @override
  String get accountNumber => 'खाता नंबर';

  @override
  String get reenterAccountNumber =>
      'सुरक्षा के लिए पूरा खाता नंबर दोबारा दर्ज करें।';

  @override
  String get ifscCode => 'आईएफएससी कोड';

  @override
  String get upiIdOptional => 'यूपीआई आईडी (वैकल्पिक)';

  @override
  String get invalidAccountNumber => '6 से 20 अंकों का खाता नंबर दर्ज करें।';

  @override
  String get invalidIfscCode => 'मान्य 11-अक्षर का आईएफएससी कोड दर्ज करें।';

  @override
  String get fieldTooShort => 'यह जानकारी बहुत छोटी है।';

  @override
  String get fieldTooLong => 'यह जानकारी बहुत लंबी है।';

  @override
  String get submitForVerification => 'सत्यापन के लिए भेजें';

  @override
  String get payoutAccountSaved =>
      'भुगतान खाता सत्यापन के लिए भेज दिया गया है।';

  @override
  String get payoutAccountSaveFailed =>
      'भुगतान खाता सहेजा नहीं जा सका। जानकारी जाँचें और फिर कोशिश करें।';

  @override
  String get farmerLeads => 'किसान लीड';

  @override
  String get captureLead => 'लीड दर्ज करें';

  @override
  String get captureFarmerLead => 'किसान लीड दर्ज करें';

  @override
  String get leadPipelineHelp =>
      'केवल आपके प्रमोटर खाते को सौंपी गई लीड दिखाई जाती हैं। किसान पंजीकरण और परिवर्तन अलग सत्यापित चरण हैं।';

  @override
  String get leadPrivacyNotice =>
      'संपर्क जानकारी किसान की जानकारी में ही लें और उसका उपयोग केवल अधिकृत वर्धनम फॉलो-अप के लिए करें।';

  @override
  String get leadStatus => 'लीड की स्थिति';

  @override
  String get leadNew => 'नई';

  @override
  String get leadContacted => 'संपर्क किया';

  @override
  String get leadConverted => 'परिवर्तित';

  @override
  String get leadLost => 'बंद';

  @override
  String get leadSource => 'लीड का स्रोत';

  @override
  String get leadSourceFieldVisit => 'खेत का दौरा';

  @override
  String get leadSourceReferral => 'रेफरल';

  @override
  String get leadSourceCampaign => 'अभियान';

  @override
  String get leadSourceInbound => 'प्राप्त पूछताछ';

  @override
  String get leadOptionalDetails => 'वैकल्पिक स्थान, फसल और टिप्पणियाँ';

  @override
  String get farmerName => 'किसान का नाम';

  @override
  String get phoneNumber => 'फोन नंबर';

  @override
  String get invalidIndianPhone =>
      'मान्य 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।';

  @override
  String get pincodeOptional => 'पिनकोड (वैकल्पिक)';

  @override
  String get cropInterestsCommaSeparated => 'फसल रुचियाँ (कॉमा से अलग)';

  @override
  String get notesOptional => 'टिप्पणियाँ (वैकल्पिक)';

  @override
  String get saveLead => 'लीड सहेजें';

  @override
  String get noFarmerLeads => 'कोई मिलती किसान लीड नहीं है।';

  @override
  String get leadsLoadFailed =>
      'किसान लीड लोड नहीं हो सकीं। रीफ्रेश करने के लिए नीचे खींचें।';

  @override
  String get leadCreateFailed =>
      'लीड सहेजी नहीं जा सकी। पहले से खुली लीड जाँचें और फिर कोशिश करें।';

  @override
  String get markContacted => 'संपर्क किया चिह्नित करें';

  @override
  String get markLeadLost => 'लीड बंद करें';

  @override
  String get lossReason => 'कारण';

  @override
  String get leadUpdated => 'लीड की स्थिति अपडेट हो गई।';

  @override
  String get leadUpdateFailed => 'लीड की स्थिति अपडेट नहीं हो सकी।';

  @override
  String get convertFarmerLead => 'किसान में बदलें';

  @override
  String get convertFarmerLeadHelp =>
      'पहले किसान से किसान ऐप में OTP पंजीकरण पूरा करवाएँ। परिवर्तन सत्यापित किसान को जोड़ता है और आपका प्रमोटर एट्रिब्यूशन निर्धारित करता है।';

  @override
  String get confirmConversion => 'परिवर्तन की पुष्टि करें';

  @override
  String get leadConvertedSuccess =>
      'सत्यापित किसान जुड़ गया और लीड परिवर्तित हो गई।';

  @override
  String get leadConversionFailed =>
      'परिवर्तन नहीं हो सका। जाँचें कि किसान ने इसी फोन नंबर से पंजीकरण किया है और फिर प्रयास करें।';

  @override
  String get promoterVisits => 'क्षेत्रीय मुलाकातें';

  @override
  String get recordVisit => 'मुलाकात दर्ज करें';

  @override
  String get visitPurpose => 'मुलाकात का उद्देश्य';

  @override
  String get visitPurposeLeadFollowUp => 'लीड फॉलो-अप';

  @override
  String get visitPurposeFarmerSupport => 'किसान सहायता';

  @override
  String get visitPurposeOrderAssistance => 'ऑर्डर सहायता';

  @override
  String get visitPurposeFarmSurvey => 'खेत सर्वेक्षण';

  @override
  String get visitPurposeComplaintFollowUp => 'शिकायत फॉलो-अप';

  @override
  String get visitNotes => 'मुलाकात के नोट (वैकल्पिक)';

  @override
  String get includeVisitLocation => 'वर्तमान स्थान शामिल करें';

  @override
  String get includeVisitLocationHelp =>
      'स्थान केवल सेव करते समय एक बार मांगा जाता है। पृष्ठभूमि में कभी ट्रैक नहीं किया जाता।';

  @override
  String get saveVisit => 'मुलाकात सेव करें';

  @override
  String get visitRecorded => 'मुलाकात दर्ज हो गई।';

  @override
  String get visitRecordFailed => 'मुलाकात दर्ज नहीं हो सकी।';

  @override
  String get visitsLoadFailed => 'क्षेत्रीय मुलाकातें लोड नहीं हो सकीं।';

  @override
  String get noPromoterVisits => 'अभी कोई क्षेत्रीय मुलाकात दर्ज नहीं है।';
}
