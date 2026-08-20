class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.membershipId,
    required this.organisationId,
    required this.role,
    required this.expiresIn,
  });

  factory AuthSession.fromJson(Map<String, Object?> json) {
    final role = _requiredString(json, 'role');
    if (role != 'FARMER') {
      throw const FarmerAuthException(
        code: 'INVALID_FARMER_ROLE',
        message: 'The authenticated membership is not a farmer membership.',
      );
    }

    return AuthSession(
      accessToken: _requiredString(json, 'accessToken'),
      refreshToken: _requiredString(json, 'refreshToken'),
      membershipId: _requiredString(json, 'membershipId'),
      organisationId: _requiredString(json, 'organisationId'),
      role: role,
      expiresIn: _requiredString(json, 'expiresIn'),
    );
  }

  final String accessToken;
  final String refreshToken;
  final String membershipId;
  final String organisationId;
  final String role;
  final String expiresIn;

  Map<String, String> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'membershipId': membershipId,
    'organisationId': organisationId,
    'role': role,
    'expiresIn': expiresIn,
  };
}

class OtpChallengeResult {
  const OtpChallengeResult({required this.expiresAt, this.mockOtpCode});

  final DateTime expiresAt;
  final String? mockOtpCode;
}

sealed class FarmerOtpVerificationResult {
  const FarmerOtpVerificationResult();
}

class FarmerOtpAuthenticated extends FarmerOtpVerificationResult {
  const FarmerOtpAuthenticated(this.session);

  final AuthSession session;
}

class FarmerMembershipSelectionRequired extends FarmerOtpVerificationResult {
  const FarmerMembershipSelectionRequired({
    required this.selectionToken,
    required this.candidates,
  });

  factory FarmerMembershipSelectionRequired.fromJson(
    Map<String, Object?> json,
  ) {
    final candidatesValue = json['candidates'];
    if (candidatesValue is! List) {
      throw const FarmerAuthException(
        code: 'INVALID_AUTH_RESPONSE',
        message: 'Membership selection candidates are missing.',
      );
    }
    final candidates = candidatesValue
        .whereType<Map>()
        .map((value) => value.cast<String, Object?>())
        .where((value) => value['role'] == 'FARMER')
        .map(FarmerMembershipCandidate.fromJson)
        .toList(growable: false);
    if (candidates.length < 2) {
      throw const FarmerAuthException(
        code: 'INVALID_AUTH_RESPONSE',
        message: 'Multiple eligible farmer memberships were not returned.',
      );
    }
    return FarmerMembershipSelectionRequired(
      selectionToken: _requiredString(json, 'selectionToken'),
      candidates: candidates,
    );
  }

  final String selectionToken;
  final List<FarmerMembershipCandidate> candidates;
}

class FarmerMembershipCandidate {
  const FarmerMembershipCandidate({
    required this.organisationId,
    required this.organisationName,
  });

  factory FarmerMembershipCandidate.fromJson(Map<String, Object?> json) =>
      FarmerMembershipCandidate(
        organisationId: _requiredString(json, 'organisationId'),
        organisationName: _requiredString(json, 'organisationName'),
      );

  final String organisationId;
  final String organisationName;
}

class FarmerAuthException implements Exception {
  const FarmerAuthException({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => 'FarmerAuthException($code)';
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FarmerAuthException(
      code: 'INVALID_AUTH_RESPONSE',
      message: 'Authentication response is missing $key.',
    );
  }
  return value;
}
