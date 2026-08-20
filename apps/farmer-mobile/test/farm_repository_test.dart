import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/farms/farm_repository.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test('lists owned farms and sends only validated create fields', () async {
    final client = _FarmApiClient();
    final repository = ApiFarmRepository(client);

    final farms = await repository.listMine();
    final crops = await repository.listReferenceCrops();
    final created = await repository.create(
      const CreateFarmInput(
        name: ' North field ',
        village: ' Rampura ',
        pincode: '302001',
        areaAcres: 2.5,
        ownershipType: FarmOwnershipType.owned,
      ),
    );
    final updated = await repository.update(
      'farm-1',
      const UpdateFarmInput(
        name: ' South field ',
        village: ' ',
        pincode: '302002',
        areaAcres: 3.5,
        ownershipType: FarmOwnershipType.leased,
        isActive: false,
      ),
    );
    final cycle = await repository.createCropCycle(
      'farm-1',
      const CreateCropCycleInput(
        cropId: 'crop-1',
        varietyName: ' HD 2967 ',
        areaAcres: 2,
        season: 'rabi_2026_27',
      ),
    );
    final editedCycle = await repository.updateCropCycle(
      'farm-1',
      'cycle-1',
      const UpdateCropCycleInput(
        cropId: 'crop-1',
        varietyName: ' DBW 187 ',
        areaAcres: 1.75,
        season: 'rabi_2027_28',
      ),
    );
    final activities = await repository.listActivities('cycle-1');
    final activity = await repository.createActivity(
      'cycle-1',
      CreateFarmActivityInput(
        activityType: FarmActivityType.irrigation,
        occurredOn: DateTime.utc(2026, 8, 12),
        notes: ' First irrigation ',
      ),
    );
    final harvested = await repository.harvestCropCycle(
      'farm-1',
      'cycle-1',
      HarvestCropCycleInput(
        actualHarvestDate: DateTime.utc(2027, 4, 5),
        yieldQuintals: 8.25,
      ),
    );

    expect(farms.single.cropCycles.single.cropNameHi, 'गेहूं');
    expect(farms.single.areaAcres, 2.5);
    expect(created.ownershipType, FarmOwnershipType.owned);
    expect(updated.name, 'South field');
    expect(updated.isActive, isFalse);
    expect(crops.single.nameEn, 'Wheat');
    expect(cycle.status, CropCycleStatus.active);
    expect(editedCycle.varietyName, 'DBW 187');
    expect(activities.single.activityType, FarmActivityType.sowing);
    expect(activity.recordedSource, 'FARMER');
    expect(harvested.status, CropCycleStatus.harvested);
    expect(client.postCalls.first.body, {
      'name': 'North field',
      'village': 'Rampura',
      'pincode': '302001',
      'areaAcres': 2.5,
      'ownershipType': 'OWNED',
    });
    expect(client.patchCalls.first.path, '/farms/farm-1');
    expect(client.patchCalls.first.body, {
      'name': 'South field',
      'village': '',
      'pincode': '302002',
      'areaAcres': 3.5,
      'ownershipType': 'LEASED',
      'isActive': false,
    });
    expect(client.patchCalls[1].path, '/farms/farm-1/crop-cycles/cycle-1');
    expect(client.patchCalls[1].body, {
      'cropId': 'crop-1',
      'varietyName': 'DBW 187',
      'areaAcres': 1.75,
      'season': 'RABI_2027_28',
    });
    expect(client.postCalls[1].path, '/farms/farm-1/crop-cycles');
    expect(client.postCalls[2].path, '/farms/crop-cycles/cycle-1/activities');
    expect(
      client.postCalls.last.path,
      '/farms/farm-1/crop-cycles/cycle-1/harvest',
    );
    expect(client.postCalls.last.body, {
      'actualHarvestDate': '2027-04-05',
      'yieldQuintals': 8.25,
    });
    expect(client.postCalls[2].body, {
      'activityType': 'IRRIGATION',
      'occurredOn': '2026-08-12',
      'notes': 'First irrigation',
    });
    expect(client.postCalls[1].body, {
      'cropId': 'crop-1',
      'varietyName': 'HD 2967',
      'areaAcres': 2.0,
      'season': 'RABI_2026_27',
      'status': 'ACTIVE',
    });
  });
}

class _FarmApiClient implements AuthenticatedApiClient {
  final postCalls = <({String path, Map<String, Object?> body})>[];
  final patchCalls = <({String path, Map<String, Object?> body})>[];

  @override
  Future<List<Object?>> getList(String path) async =>
      path == '/farms/reference/crops'
      ? [_cropJson]
      : path.endsWith('/activities')
      ? [_activityJson]
      : [_farmJson];

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postCalls.add((path: path, body: body));
    return path.endsWith('/harvest')
        ? {..._cycleJson, 'status': 'HARVESTED'}
        : path.endsWith('/activities')
        ? {
            ..._activityJson,
            'activityType': 'IRRIGATION',
            'notes': 'First irrigation',
          }
        : path.endsWith('/crop-cycles')
        ? _cycleJson
        : _farmJson;
  }

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> get(String path) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> patch(
    String path,
    Map<String, Object?> body,
  ) async {
    patchCalls.add((path: path, body: body));
    if (path.contains('/crop-cycles/')) {
      return {
        ..._cycleJson,
        'varietyName': 'DBW 187',
        'areaAcres': '1.750',
        'season': 'RABI_2027_28',
      };
    }
    return {
      ..._farmJson,
      'name': 'South field',
      'village': null,
      'pincode': '302002',
      'areaAcres': '3.500',
      'ownershipType': 'LEASED',
      'isActive': false,
    };
  }

  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _farmJson = <String, Object?>{
  'id': 'farm-1',
  'name': 'North field',
  'village': 'Rampura',
  'district': 'Jaipur',
  'state': 'Rajasthan',
  'pincode': '302001',
  'areaAcres': '2.500',
  'ownershipType': 'OWNED',
  'irrigationSource': null,
  'soilType': null,
  'latitude': null,
  'longitude': null,
  'isActive': true,
  'cropCycles': [
    {
      'id': 'cycle-1',
      'varietyName': 'HD 2967',
      'areaAcres': '2.000',
      'season': 'RABI_2026_27',
      'status': 'ACTIVE',
      'crop': {
        'id': 'crop-1',
        'code': 'WHEAT',
        'nameEn': 'Wheat',
        'nameHi': 'गेहूं',
      },
    },
  ],
};

const _cropJson = <String, Object?>{
  'id': 'crop-1',
  'code': 'WHEAT',
  'nameEn': 'Wheat',
  'nameHi': 'गेहूं',
};

const _cycleJson = <String, Object?>{
  'id': 'cycle-2',
  'varietyName': 'HD 2967',
  'areaAcres': '2.000',
  'season': 'RABI_2026_27',
  'status': 'ACTIVE',
  'crop': _cropJson,
};

const _activityJson = <String, Object?>{
  'id': 'activity-1',
  'cropCycleId': 'cycle-1',
  'activityType': 'SOWING',
  'occurredOn': '2026-08-01T00:00:00.000Z',
  'notes': 'Sowing completed',
  'productOrderId': null,
  'recordedSource': 'FARMER',
  'recordedByUserId': 'farmer-1',
  'createdAt': '2026-08-01T10:00:00.000Z',
};
