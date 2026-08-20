import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_models.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';
import 'package:vardhnam_partner_mobile/src/surveys/promoter_survey_repository.dart';

void main() {
  test(
    'uses general promoter survey endpoints and farmer profile identity',
    () async {
      final adapter = _SurveyAdapter();
      final repository = ApiPromoterSurveyRepository(
        PartnerApiClient(
          () => _session,
          () async => _session,
          () async {},
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      final crops = await repository.listCropReferences();
      await repository.createSurvey(
        farmerProfileId: 'farmer-profile',
        survey: const FarmSurveyInput(
          membershipId: '',
          farmName: 'North field',
          pincode: '207001',
          areaAcres: 2,
          ownershipType: 'OWNED',
        ),
      );

      expect(crops.single.nameEn, 'Wheat');
      expect(
        adapter.requests[0].uri.path,
        '/promoters/surveys/reference/crops',
      );
      expect(adapter.requests[1].uri.path, '/promoters/surveys');
      expect(
        adapter.requests[1].data,
        containsPair('farmerProfileId', 'farmer-profile'),
      );
      expect(adapter.requests[1].data, isNot(contains('membershipId')));
      expect(adapter.requests[1].data, isNot(contains('latitude')));
    },
  );
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'organisation',
  role: PartnerRole.promoter,
  expiresIn: '15m',
);

class _SurveyAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final data = options.method == 'GET'
        ? [
            {
              'id': 'crop',
              'code': 'WHEAT',
              'nameEn': 'Wheat',
              'nameHi': 'गेहूँ',
            },
          ]
        : {'farm': {}, 'cropCycle': null};
    return ResponseBody.fromString(
      jsonEncode({'data': data}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
