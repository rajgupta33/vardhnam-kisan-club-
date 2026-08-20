enum PartnerRole {
  promoter('PROMOTER'),
  salesPartner('SALES_PARTNER'),
  serviceProvider('SERVICE_PROVIDER'),
  deliveryPartner('DELIVERY_PARTNER');

  const PartnerRole(this.apiValue);

  final String apiValue;

  static PartnerRole parse(Object? value) {
    return values.firstWhere(
      (role) => role.apiValue == value,
      orElse: () => throw const PartnerAuthException(
        code: 'INVALID_PARTNER_ROLE',
        message: 'The selected membership is not supported by the partner app.',
      ),
    );
  }
}

class PartnerSession {
  const PartnerSession({
    required this.accessToken,
    required this.refreshToken,
    required this.membershipId,
    required this.organisationId,
    required this.role,
    required this.expiresIn,
    this.organisationName,
  });

  factory PartnerSession.fromJson(Map<String, Object?> json) => PartnerSession(
    accessToken: requiredString(json, 'accessToken'),
    refreshToken: requiredString(json, 'refreshToken'),
    membershipId: requiredString(json, 'membershipId'),
    organisationId: requiredString(json, 'organisationId'),
    role: PartnerRole.parse(json['role']),
    expiresIn: requiredString(json, 'expiresIn'),
    organisationName: json['organisationName'] as String?,
  );

  final String accessToken;
  final String refreshToken;
  final String membershipId;
  final String organisationId;
  final PartnerRole role;
  final String expiresIn;
  final String? organisationName;

  PartnerSession withOrganisationName(String name) => PartnerSession(
    accessToken: accessToken,
    refreshToken: refreshToken,
    membershipId: membershipId,
    organisationId: organisationId,
    role: role,
    expiresIn: expiresIn,
    organisationName: name,
  );

  Map<String, String> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'membershipId': membershipId,
    'organisationId': organisationId,
    'role': role.apiValue,
    'expiresIn': expiresIn,
    if (organisationName != null) 'organisationName': organisationName!,
  };
}

class OtpChallenge {
  const OtpChallenge({required this.expiresAt, this.mockOtpCode});

  final DateTime expiresAt;
  final String? mockOtpCode;
}

sealed class PartnerVerificationResult {
  const PartnerVerificationResult();
}

class PartnerAuthenticated extends PartnerVerificationResult {
  const PartnerAuthenticated(this.session);

  final PartnerSession session;
}

class PartnerSelectionRequired extends PartnerVerificationResult {
  const PartnerSelectionRequired({
    required this.selectionToken,
    required this.candidates,
  });

  factory PartnerSelectionRequired.fromJson(Map<String, Object?> json) {
    final rawCandidates = json['candidates'];
    if (rawCandidates is! List) {
      throw const PartnerAuthException(
        code: 'INVALID_AUTH_RESPONSE',
        message: 'Partner membership candidates are missing.',
      );
    }
    final candidates = rawCandidates
        .whereType<Map>()
        .map((candidate) => candidate.cast<String, Object?>())
        .map(PartnerMembershipCandidate.tryFromJson)
        .whereType<PartnerMembershipCandidate>()
        .toList(growable: false);
    if (candidates.isEmpty) {
      throw const PartnerAuthException(
        code: 'INVALID_PARTNER_ROLE',
        message: 'No supported partner membership was returned.',
      );
    }
    return PartnerSelectionRequired(
      selectionToken: requiredString(json, 'selectionToken'),
      candidates: candidates,
    );
  }

  final String selectionToken;
  final List<PartnerMembershipCandidate> candidates;
}

class PartnerMembershipCandidate {
  const PartnerMembershipCandidate({
    required this.organisationId,
    required this.organisationName,
    required this.role,
  });

  static PartnerMembershipCandidate? tryFromJson(Map<String, Object?> json) {
    try {
      return PartnerMembershipCandidate(
        organisationId: requiredString(json, 'organisationId'),
        organisationName: requiredString(json, 'organisationName'),
        role: PartnerRole.parse(json['role']),
      );
    } on PartnerAuthException {
      return null;
    }
  }

  final String organisationId;
  final String organisationName;
  final PartnerRole role;
}

class PartnerAuthException implements Exception {
  const PartnerAuthException({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => 'PartnerAuthException($code)';
}

String requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw PartnerAuthException(
      code: 'INVALID_AUTH_RESPONSE',
      message: 'Authentication response is missing $key.',
    );
  }
  return value;
}
