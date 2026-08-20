import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'partner_earnings_models.dart';

final partnerEarningsRepositoryProvider = Provider<PartnerEarningsRepository>((
  ref,
) {
  return ApiPartnerEarningsRepository(ref.read(partnerApiClientProvider));
});

abstract interface class PartnerEarningsRepository {
  Future<PayoutAccountView?> getMyPayoutAccount();

  Future<PayoutAccountView> saveMyPayoutAccount(PayoutAccountInput input);

  Future<EarningsStatementPage> getMyStatement({
    EarningsStatus? status,
    int page = 1,
    int limit = 20,
  });
}

class ApiPartnerEarningsRepository implements PartnerEarningsRepository {
  ApiPartnerEarningsRepository(this._client);
  final PartnerApiClient _client;

  @override
  Future<PayoutAccountView?> getMyPayoutAccount() async {
    try {
      return PayoutAccountView.fromJson(
        await _client.get('/payouts/accounts/me'),
      );
    } on PartnerApiException catch (error) {
      if (error.statusCode == 404 || error.code == 'NOT_FOUND') return null;
      rethrow;
    }
  }

  @override
  Future<PayoutAccountView> saveMyPayoutAccount(
    PayoutAccountInput input,
  ) async => PayoutAccountView.fromJson(
    await _client.put('/payouts/accounts/me', input.toJson()),
  );

  @override
  Future<EarningsStatementPage> getMyStatement({
    EarningsStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    final uri = Uri(
      path: '/payouts/statements/me',
      queryParameters: {
        'page': '$page',
        'limit': '$limit',
        if (status != null) 'status': status.apiValue,
      },
    );
    return EarningsStatementPage.fromJson(await _client.get(uri.toString()));
  }
}
