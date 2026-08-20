import 'package:dio/dio.dart';

import 'partner_auth_models.dart';

const partnerApiBaseUrl = String.fromEnvironment(
  'MARKETPLACE_API_BASE_URL',
  defaultValue: 'http://127.0.0.1:3001',
);

abstract interface class PartnerAuthRepository {
  Future<OtpChallenge> requestOtp(String phone);

  Future<PartnerVerificationResult> verifyOtp({
    required String phone,
    required String code,
  });

  Future<PartnerSession> selectMembership({
    required String selectionToken,
    required PartnerMembershipCandidate candidate,
  });

  Future<PartnerSession> refresh(String refreshToken);

  Future<void> logout(String refreshToken);
}

class DioPartnerAuthRepository implements PartnerAuthRepository {
  DioPartnerAuthRepository({String baseUrl = partnerApiBaseUrl, Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: '${baseUrl.replaceFirst(RegExp(r'/+$'), '')}/api/v1',
              connectTimeout: const Duration(seconds: 10),
              sendTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 20),
              headers: {Headers.acceptHeader: Headers.jsonContentType},
            ),
          );

  final Dio _dio;

  @override
  Future<OtpChallenge> requestOtp(String phone) async {
    final data = await _post('/auth/otp/request', {'phone': phone});
    final expiresAt = DateTime.tryParse(requiredString(data, 'expiresAt'));
    if (expiresAt == null) {
      throw const PartnerAuthException(
        code: 'INVALID_AUTH_RESPONSE',
        message: 'OTP expiry is invalid.',
      );
    }
    return OtpChallenge(
      expiresAt: expiresAt,
      mockOtpCode: data['mockOtpCode'] as String?,
    );
  }

  @override
  Future<PartnerVerificationResult> verifyOtp({
    required String phone,
    required String code,
  }) async {
    final data = await _post('/auth/otp/verify', {
      'phone': phone,
      'code': code,
    });
    if (data['membershipSelectionRequired'] == true) {
      return PartnerSelectionRequired.fromJson(data);
    }
    return PartnerAuthenticated(PartnerSession.fromJson(data));
  }

  @override
  Future<PartnerSession> selectMembership({
    required String selectionToken,
    required PartnerMembershipCandidate candidate,
  }) async {
    final session = PartnerSession.fromJson(
      await _post('/auth/select-organisation', {
        'selectionToken': selectionToken,
        'organisationId': candidate.organisationId,
      }),
    );
    if (session.organisationId != candidate.organisationId ||
        session.role != candidate.role) {
      throw const PartnerAuthException(
        code: 'INVALID_AUTH_RESPONSE',
        message: 'The selected partner context did not match the session.',
      );
    }
    return session.withOrganisationName(candidate.organisationName);
  }

  @override
  Future<PartnerSession> refresh(String refreshToken) async =>
      PartnerSession.fromJson(
        await _post('/auth/refresh', {
          'refreshToken': refreshToken,
        }, bearerToken: refreshToken),
      );

  @override
  Future<void> logout(String refreshToken) async {
    await _post('/auth/logout', {
      'refreshToken': refreshToken,
    }, bearerToken: refreshToken);
  }

  Future<Map<String, Object?>> _post(
    String path,
    Map<String, Object?> body, {
    String? bearerToken,
  }) async {
    try {
      final response = await _dio.post<Object?>(
        path,
        data: body,
        options: bearerToken == null
            ? null
            : Options(headers: {'Authorization': 'Bearer $bearerToken'}),
      );
      final envelope = _asMap(response.data);
      return _asMap(envelope['data']);
    } on DioException catch (error) {
      final payload = error.response?.data is Map
          ? (error.response!.data as Map).cast<String, Object?>()
          : const <String, Object?>{};
      final errorPayload = payload['error'] is Map
          ? (payload['error'] as Map).cast<String, Object?>()
          : payload;
      throw PartnerAuthException(
        code: error.response?.statusCode == 429
            ? 'RATE_LIMITED'
            : (errorPayload['code'] as String? ?? 'NETWORK_ERROR'),
        message:
            errorPayload['message'] as String? ??
            'Could not reach the authentication service.',
      );
    }
  }
}

Map<String, Object?> _asMap(Object? value) {
  if (value is! Map) {
    throw const PartnerAuthException(
      code: 'INVALID_AUTH_RESPONSE',
      message: 'Authentication response is invalid.',
    );
  }
  return value.cast<String, Object?>();
}
