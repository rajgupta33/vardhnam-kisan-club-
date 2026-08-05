class AppStrings {
  const AppStrings({
    required this.appTitle,
    required this.welcomeTitle,
    required this.phaseBoundary,
    required this.promoterRole,
    required this.promoterSummary,
    required this.serviceProviderRole,
    required this.serviceProviderSummary,
    required this.deliveryPartnerRole,
    required this.deliveryPartnerSummary,
  });

  final String appTitle;
  final String welcomeTitle;
  final String phaseBoundary;
  final String promoterRole;
  final String promoterSummary;
  final String serviceProviderRole;
  final String serviceProviderSummary;
  final String deliveryPartnerRole;
  final String deliveryPartnerSummary;

  static const en = AppStrings(
    appTitle: 'Vardhnam Partner',
    welcomeTitle: 'Partner workspace',
    phaseBoundary: 'Phase 0 sets up role-aware screens. Field workflows come later.',
    promoterRole: 'Promoter',
    promoterSummary: 'Farmer onboarding, assisted ordering and attribution boundaries.',
    serviceProviderRole: 'Service provider',
    serviceProviderSummary: 'Service catalogue, availability and booking foundation.',
    deliveryPartnerRole: 'Delivery partner',
    deliveryPartnerSummary: 'Assignments, pickup, delivery OTP and earnings boundary.',
  );

  static const hi = AppStrings(
    appTitle: 'वर्धनम पार्टनर',
    welcomeTitle: 'पार्टनर कार्यक्षेत्र',
    phaseBoundary: 'फेज 0 में role-aware screens बनेंगे. Field workflows बाद में आएंगे.',
    promoterRole: 'प्रमोटर',
    promoterSummary: 'किसान onboarding, assisted ordering और attribution boundaries.',
    serviceProviderRole: 'सेवा प्रदाता',
    serviceProviderSummary: 'सेवा catalogue, availability और booking foundation.',
    deliveryPartnerRole: 'डिलीवरी पार्टनर',
    deliveryPartnerSummary: 'Assignments, pickup, delivery OTP और earnings boundary.',
  );
}

