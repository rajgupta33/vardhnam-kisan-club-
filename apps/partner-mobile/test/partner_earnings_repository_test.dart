import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/earnings/partner_earnings_models.dart';
import 'package:vardhnam_partner_mobile/src/earnings/partner_earnings_repository.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';

void main() {
  test(
    'reads only the own masked account and exact statement status',
    () async {
      final adapter = _EarningsAdapter();
      final repository = ApiPartnerEarningsRepository(
        PartnerApiClient(
          () => _session,
          () async => _session,
          () async {},
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      final account = await repository.getMyPayoutAccount();
      final statement = await repository.getMyStatement(
        status: EarningsStatus.finalised,
        page: 2,
        limit: 5,
      );

      expect(account?.maskedAccountNumber, '********6789');
      expect(statement.items.single.amountPaise, 12550);
      expect(statement.items.single.type, EarningsType.promoterCommission);
      expect(statement.totalsByStatus[EarningsStatus.finalised], 12550);
      expect(adapter.paths, [
        '/payouts/accounts/me',
        '/payouts/statements/me?page=2&limit=5&status=FINAL',
      ]);
    },
  );

  test('maps a missing own payout account to an unconfigured state', () async {
    final adapter = _EarningsAdapter(accountMissing: true);
    final repository = ApiPartnerEarningsRepository(
      PartnerApiClient(
        () => _session,
        () async => _session,
        () async {},
        dio: Dio()..httpClientAdapter = adapter,
      ),
    );

    expect(await repository.getMyPayoutAccount(), isNull);
  });

  test('submits full account details only to the own payout route', () async {
    final adapter = _EarningsAdapter();
    final repository = ApiPartnerEarningsRepository(
      PartnerApiClient(
        () => _session,
        () async => _session,
        () async {},
        dio: Dio()..httpClientAdapter = adapter,
      ),
    );

    final saved = await repository.saveMyPayoutAccount(
      const PayoutAccountInput(
        accountHolderName: 'Asha Promoter',
        bankName: 'State Bank of India',
        accountNumber: '000123456789',
        ifscCode: 'SBIN0001234',
        upiId: 'asha@upi',
      ),
    );

    expect(saved.status, 'PENDING_VERIFICATION');
    expect(adapter.paths, ['/payouts/accounts/me']);
    expect(adapter.lastMethod, 'PUT');
    expect(adapter.lastBody, {
      'accountHolderName': 'Asha Promoter',
      'bankName': 'State Bank of India',
      'accountNumber': '000123456789',
      'ifscCode': 'SBIN0001234',
      'upiId': 'asha@upi',
    });
  });
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  role: PartnerRole.promoter,
  expiresIn: '15m',
);

class _EarningsAdapter implements HttpClientAdapter {
  _EarningsAdapter({this.accountMissing = false});

  final bool accountMissing;
  final paths = <String>[];
  String? lastMethod;
  Map<String, Object?>? lastBody;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.uri.toString());
    lastMethod = options.method;
    if (options.data is Map) {
      lastBody = (options.data as Map).cast<String, Object?>();
    }
    if (options.path.endsWith('/accounts/me')) {
      if (accountMissing) {
        return _response({
          'error': {'code': 'NOT_FOUND', 'message': 'Not found'},
        }, 404);
      }
      return _response({
        'data': options.method == 'PUT'
            ? {
                ..._accountJson,
                'status': 'PENDING_VERIFICATION',
                'upiId': 'asha@upi',
              }
            : _accountJson,
      }, 200);
    }
    return _response({'data': statementJson}, 200);
  }

  ResponseBody _response(Map<String, Object?> body, int status) =>
      ResponseBody.fromString(
        jsonEncode(body),
        status,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

  @override
  void close({bool force = false}) {}
}

const _accountJson = <String, Object?>{
  'id': 'account-1',
  'accountHolderName': 'Asha Promoter',
  'bankName': 'State Bank of India',
  'accountNumber': '********6789',
  'ifscCode': 'SBIN0001234',
  'upiId': null,
  'status': 'VERIFIED',
  'rejectionReason': null,
};

const statementJson = <String, Object?>{
  'items': [
    {
      'id': 'earning-1',
      'productOrderId': 'order-1',
      'entryType': 'PROMOTER_COMMISSION',
      'amountPaise': 12550,
      'status': 'FINAL',
      'eligibleAt': '2026-08-14T00:00:00.000Z',
      'createdAt': '2026-08-01T00:00:00.000Z',
      'finalizedAt': '2026-08-14T00:00:00.000Z',
      'settlementId': 'settlement-1',
      'reversalReason': null,
    },
  ],
  'page': 2,
  'limit': 5,
  'total': 6,
  'totalsByStatus': [
    {'status': 'PROVISIONAL', 'amountPaise': 5000},
    {'status': 'FINAL', 'amountPaise': 12550},
    {'status': 'REVERSED', 'amountPaise': 0},
  ],
};
