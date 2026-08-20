enum KisanClubMembershipStatus {
  pendingProfile,
  awaitingPromoter,
  active,
  suspended,
  inactive,
  closed;

  factory KisanClubMembershipStatus.fromApi(String value) => switch (value) {
    'PENDING_PROFILE' => pendingProfile,
    'AWAITING_PROMOTER' => awaitingPromoter,
    'ACTIVE' => active,
    'SUSPENDED' => suspended,
    'INACTIVE' => inactive,
    'CLOSED' => closed,
    _ => throw FormatException('Unknown Kisan Club membership status: $value'),
  };

  bool get canEdit => this != suspended && this != inactive && this != closed;
}

class KisanClubMembership {
  const KisanClubMembership({
    required this.id,
    required this.memberNumber,
    required this.status,
    required this.homePincode,
    required this.joinedAt,
    required this.termsVersion,
    required this.advisoryConsent,
    required this.marketingConsent,
    required this.preciseLocationConsent,
    this.homeVillage,
    this.homeDistrict,
    this.homeState,
    this.suspendedReason,
  });

  factory KisanClubMembership.fromJson(Map<String, Object?> json) =>
      KisanClubMembership(
        id: _requiredString(json, 'id'),
        memberNumber: _requiredString(json, 'memberNumber'),
        status: KisanClubMembershipStatus.fromApi(
          _requiredString(json, 'status'),
        ),
        homePincode: _requiredString(json, 'homePincode'),
        homeVillage: json['homeVillage'] as String?,
        homeDistrict: json['homeDistrict'] as String?,
        homeState: json['homeState'] as String?,
        joinedAt: DateTime.parse(_requiredString(json, 'joinedAt')).toUtc(),
        termsVersion: _requiredString(json, 'termsVersion'),
        advisoryConsent: json['advisoryConsent'] == true,
        marketingConsent: json['marketingConsent'] == true,
        preciseLocationConsent: json['preciseLocationConsent'] == true,
        suspendedReason: json['suspendedReason'] as String?,
      );

  final String id;
  final String memberNumber;
  final KisanClubMembershipStatus status;
  final String homePincode;
  final String? homeVillage;
  final String? homeDistrict;
  final String? homeState;
  final DateTime joinedAt;
  final String termsVersion;
  final bool advisoryConsent;
  final bool marketingConsent;
  final bool preciseLocationConsent;
  final String? suspendedReason;
}

class KisanClubMembershipInput {
  const KisanClubMembershipInput({
    required this.homePincode,
    required this.termsVersion,
    this.homeVillage,
    this.homeDistrict,
    this.homeState,
  });

  final String homePincode;
  final String? homeVillage;
  final String? homeDistrict;
  final String? homeState;
  final String termsVersion;

  Map<String, Object?> toJson() => {
    'homePincode': homePincode,
    'homeVillage': homeVillage,
    'homeDistrict': homeDistrict,
    'homeState': homeState,
    'termsVersion': termsVersion,
    'termsAccepted': true,
  };
}

class KisanClubConsentInput {
  const KisanClubConsentInput({
    this.advisoryConsent,
    this.marketingConsent,
    this.preciseLocationConsent,
  });

  final bool? advisoryConsent;
  final bool? marketingConsent;
  final bool? preciseLocationConsent;

  bool get hasSelection =>
      advisoryConsent != null ||
      marketingConsent != null ||
      preciseLocationConsent != null;

  Map<String, Object?> toJson() => {
    if (advisoryConsent != null) 'advisoryConsent': advisoryConsent,
    if (marketingConsent != null) 'marketingConsent': marketingConsent,
    if (preciseLocationConsent != null)
      'preciseLocationConsent': preciseLocationConsent,
  };
}

class KisanClubMembershipAvailability {
  const KisanClubMembershipAvailability.enabled(this.membership)
    : isEnabled = true;

  const KisanClubMembershipAvailability.disabled()
    : isEnabled = false,
      membership = null;

  final bool isEnabled;
  final KisanClubMembership? membership;
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Kisan Club membership is missing $key.');
  }
  return value;
}
