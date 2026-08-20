import 'package:dio/dio.dart';

import '../marketplace/marketplace_api.dart';
import 'auth_models.dart';

abstract interface class FarmerAuthRepository {
  Future<OtpChallengeResult> requestOtp(String phone);

  Future<FarmerOtpVerificationResult> verifyOtp({
    required String phone,
    required String code,
    required String fullName,
    required String preferredLocale,
  });

  Future<AuthSession> selectFarmerMembership({
    required String selectionToken,
    required String organisationId,
  });

  Future<AuthSession> refresh(String refreshToken);

  Future<void> logout(String refreshToken);
}

class DioFarmerAuthRepository implements FarmerAuthRepository {
  DioFarmerAuthRepository({String baseUrl = marketplaceApiBaseUrl, Dio? dio})
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
  Future<OtpChallengeResult> requestOtp(String phone) async {
    final data = await _post('/auth/farmer/otp/request', {'phone': phone});
    final expiresAt = DateTime.tryParse(_requiredString(data, 'expiresAt'));
    if (expiresAt == null) {
      throw const FarmerAuthException(
        code: 'INVALID_AUTH_RESPONSE',
        message: 'Authentication response contains an invalid OTP expiry.',
      );
    }
    return OtpChallengeResult(
      expiresAt: expiresAt,
      mockOtpCode: data['mockOtpCode'] as String?,
    );
  }

  @override
  Future<FarmerOtpVerificationResult> verifyOtp({
    required String phone,
    required String code,
    required String fullName,
    required String preferredLocale,
  }) async {
    final data = await _post('/auth/farmer/otp/verify', {
      'phone': phone,
      'code': code,
      'fullName': fullName,
      'preferredLocale': preferredLocale,
    });
    if (data['membershipSelectionRequired'] == true) {
      return FarmerMembershipSelectionRequired.fromJson(data);
    }
    return FarmerOtpAuthenticated(AuthSession.fromJson(data));
  }

  @override
  Future<AuthSession> selectFarmerMembership({
    required String selectionToken,
    required String organisationId,
  }) async {
    final session = AuthSession.fromJson(
      await _post('/auth/select-organisation', {
        'selectionToken': selectionToken,
        'organisationId': organisationId,
      }),
    );
    if (session.organisationId != organisationId) {
      throw const FarmerAuthException(
        code: 'INVALID_AUTH_RESPONSE',
        message: 'The selected farmer context did not match the session.',
      );
    }
    return session;
  }

  @override
  Future<AuthSession> refresh(String refreshToken) async {
    return AuthSession.fromJson(
      await _post('/auth/refresh', {
        'refreshToken': refreshToken,
      }, bearerToken: refreshToken),
    );
  }

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
      final envelope = _asMap(response.data, 'response envelope');
      return _asMap(envelope['data'], 'response data');
    } on DioException catch (error) {
      final responseData = error.response?.data;
      final payload = responseData is Map
          ? responseData.cast<String, Object?>()
          : const <String, Object?>{};
      final errorPayload = payload['error'] is Map
          ? (payload['error'] as Map).cast<String, Object?>()
          : payload;
      final statusCode = error.response?.statusCode;
      throw FarmerAuthException(
        code: statusCode == 429
            ? 'RATE_LIMITED'
            : (errorPayload['code'] as String? ?? 'NETWORK_ERROR'),
        message:
            errorPayload['message'] as String? ??
            'Could not reach the authentication service.',
      );
    }
  }
}

Map<String, Object?> _asMap(Object? value, String label) {
  if (value is! Map) {
    throw FarmerAuthException(
      code: 'INVALID_AUTH_RESPONSE',
      message: 'Expected $label to be an object.',
    );
  }
  return value.cast<String, Object?>();
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
