import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_models.dart';
import 'package:vardhnam_partner_mobile/src/kisan_club/promoter_club_repository.dart';
import 'package:vardhnam_partner_mobile/src/network/partner_api_client.dart';

void main() {
  test(
    'uses only scoped farmer reads and idempotent token redemption',
    () async {
      final adapter = _ClubAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final repository = ApiPromoterClubRepository(
        PartnerApiClient(
          () => _session,
          () async => _session,
          () async {},
          dio: dio,
        ),
      );

      final farmers = await repository.listAssignedFarmers();
      final farmer = await repository.getAssignedFarmer('membership-1');
      final checkout = await repository.redeemBenefitToken(
        membershipId: 'membership-1',
        code: 'vkc-a1b2c3d4-123456',
        idempotencyKey: 'stable-key',
      );

      expect(farmers.single.fullName, 'Asha Devi');
      expect(farmer.farms.single.cropCycles.single.crop, 'Wheat');
      expect(checkout.productOrderId, 'order-1');
      expect(adapter.paths, [
        '/kisan-club/promoter/farmers',
        '/kisan-club/promoter/farmers/membership-1',
        '/kisan-club/benefit-tokens/redeem',
      ]);
      expect(adapter.idempotencyKey, 'stable-key');
      expect(adapter.redemptionBody, {
        'membershipId': 'membership-1',
        'code': 'VKC-A1B2C3D4-123456',
      });
    },
  );

  test(
    'submits an assigned-farmer survey without precise coordinates',
    () async {
      final adapter = _ClubAdapter();
      final repository = ApiPromoterClubRepository(
        PartnerApiClient(
          () => _session,
          () async => _session,
          () async {},
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      final crops = await repository.listCropReferences();
      await repository.createFarmSurvey(
        const FarmSurveyInput(
          membershipId: 'membership-1',
          farmName: ' East field ',
          village: ' Aliganj ',
          district: 'Etah',
          state: 'UP',
          pincode: '207247',
          areaAcres: 3.5,
          ownershipType: 'OWNED',
          irrigationSource: 'CANAL',
          cropCycle: CropSurveyInput(
            cropId: 'crop-1',
            varietyName: 'HD 2967',
            areaAcres: 2.5,
            season: 'rabi_2026',
          ),
        ),
      );

      expect(crops.single.nameHi, 'गेहूँ');
      expect(adapter.surveyBody, {
        'membershipId': 'membership-1',
        'farm': {
          'name': 'East field',
          'village': 'Aliganj',
          'district': 'Etah',
          'state': 'UP',
          'pincode': '207247',
          'areaAcres': 3.5,
          'ownershipType': 'OWNED',
          'irrigationSource': 'CANAL',
        },
        'cropCycle': {
          'cropId': 'crop-1',
          'varietyName': 'HD 2967',
          'areaAcres': 2.5,
          'season': 'RABI_2026',
          'status': 'ACTIVE',
        },
      });
      final farm = adapter.surveyBody!['farm'] as Map;
      expect(farm.containsKey('latitude'), isFalse);
      expect(farm.containsKey('longitude'), isFalse);
    },
  );
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'partner-membership',
  organisationId: 'partner-organisation',
  role: PartnerRole.promoter,
  expiresIn: '15m',
);

class _ClubAdapter implements HttpClientAdapter {
  final paths = <String>[];
  String? idempotencyKey;
  Map<String, Object?>? redemptionBody;
  Map<String, Object?>? surveyBody;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.path);
    Object data;
    if (options.path.endsWith('/farms/reference/crops')) {
      data = [
        {'id': 'crop-1', 'code': 'WHEAT', 'nameEn': 'Wheat', 'nameHi': 'गेहूँ'},
      ];
    } else if (options.path.endsWith('/farms/surveys')) {
      surveyBody = (options.data as Map).cast<String, Object?>();
      data = {
        'farm': {'id': 'farm-2'},
        'cropCycle': {'id': 'cycle-2'},
      };
    } else if (options.path.endsWith('/benefit-tokens/redeem')) {
      idempotencyKey = options.headers['Idempotency-Key'] as String?;
      redemptionBody = (options.data as Map).cast<String, Object?>();
      data = {
        'id': 'checkout-1',
        'status': 'PENDING_PAYMENT',
        'clubBenefitPaise': 2500,
        'farmerPayablePaise': 7500,
        'assistedPurchase': {
          'productOrderId': 'order-1',
          'paymentRequiredInApp': true,
        },
      };
    } else if (options.path.endsWith('/farmers')) {
      data = [_farmerJson(includeHistory: false)];
    } else {
      data = _farmerJson(includeHistory: true);
    }
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

Map<String, Object?> _farmerJson({required bool includeHistory}) => {
  'id': 'assignment-1',
  'membershipId': 'membership-1',
  'assignedAt': '2026-08-14T00:00:00.000Z',
  'membership': {
    'memberNumber': 'VKC-000001',
    'homeVillage': 'Aliganj',
    'homeDistrict': 'Etah',
    'homePincode': '207247',
    'farmerProfile': {'fullName': 'Asha Devi'},
    'farms': [
      {
        'id': 'farm-1',
        'name': 'North farm',
        'areaAcres': '2.5',
        if (includeHistory) 'isActive': true,
        'cropCycles': [
          {
            'id': 'cycle-1',
            'crop': 'Wheat',
            'areaAcres': '2.0',
            'season': 'RABI',
            'status': 'ACTIVE',
          },
        ],
      },
    ],
  },
};
