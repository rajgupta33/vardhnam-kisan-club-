import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';

final farmRepositoryProvider = Provider<FarmRepository>(
  (ref) => ApiFarmRepository(ref.watch(authenticatedApiClientProvider)),
);

enum FarmOwnershipType {
  owned('OWNED'),
  leased('LEASED'),
  sharecropped('SHARECROPPED'),
  other('OTHER');

  const FarmOwnershipType(this.apiValue);
  final String apiValue;

  factory FarmOwnershipType.fromApi(String value) => values.firstWhere(
    (item) => item.apiValue == value,
    orElse: () => throw FormatException('Unknown farm ownership type: $value'),
  );
}

enum CropCycleStatus {
  planned,
  active,
  harvested,
  abandoned;

  factory CropCycleStatus.fromApi(String value) => switch (value) {
    'PLANNED' => planned,
    'ACTIVE' => active,
    'HARVESTED' => harvested,
    'ABANDONED' => abandoned,
    _ => throw FormatException('Unknown crop cycle status: $value'),
  };
}

enum FarmActivityType {
  sowing('SOWING'),
  irrigation('IRRIGATION'),
  fertilizerApplied('FERTILIZER_APPLIED'),
  cropProtectionApplied('CROP_PROTECTION_APPLIED'),
  pestObserved('PEST_OBSERVED'),
  diseaseObserved('DISEASE_OBSERVED'),
  weeding('WEEDING'),
  cropDamage('CROP_DAMAGE'),
  harvest('HARVEST'),
  other('OTHER');

  const FarmActivityType(this.apiValue);
  final String apiValue;

  factory FarmActivityType.fromApi(String value) => values.firstWhere(
    (item) => item.apiValue == value,
    orElse: () => throw FormatException('Unknown farm activity type: $value'),
  );

  bool get canFarmerAppend => this != harvest;
}

class FarmActivity {
  const FarmActivity({
    required this.id,
    required this.activityType,
    required this.occurredOn,
    required this.recordedSource,
    required this.createdAt,
    this.notes,
    this.productOrderId,
  });

  factory FarmActivity.fromJson(Map<String, Object?> json) => FarmActivity(
    id: _requiredString(json, 'id'),
    activityType: FarmActivityType.fromApi(
      _requiredString(json, 'activityType'),
    ),
    occurredOn: DateTime.parse(_requiredString(json, 'occurredOn')).toUtc(),
    notes: json['notes'] as String?,
    productOrderId: json['productOrderId'] as String?,
    recordedSource: _requiredString(json, 'recordedSource'),
    createdAt: DateTime.parse(_requiredString(json, 'createdAt')).toUtc(),
  );

  final String id;
  final FarmActivityType activityType;
  final DateTime occurredOn;
  final String? notes;
  final String? productOrderId;
  final String recordedSource;
  final DateTime createdAt;
}

class CropReference {
  const CropReference({
    required this.id,
    required this.code,
    required this.nameEn,
    required this.nameHi,
  });

  factory CropReference.fromJson(Map<String, Object?> json) => CropReference(
    id: _requiredString(json, 'id'),
    code: _requiredString(json, 'code'),
    nameEn: _requiredString(json, 'nameEn'),
    nameHi: _requiredString(json, 'nameHi'),
  );

  final String id;
  final String code;
  final String nameEn;
  final String nameHi;
}

class FarmCropCycleSummary {
  const FarmCropCycleSummary({
    required this.id,
    required this.cropId,
    required this.cropNameEn,
    required this.cropNameHi,
    required this.areaAcres,
    required this.season,
    required this.status,
    this.varietyName,
    this.sowingDate,
  });

  factory FarmCropCycleSummary.fromJson(Map<String, Object?> json) {
    final crop = _requiredMap(json, 'crop');
    final rawSowingDate = json['sowingDate'];
    return FarmCropCycleSummary(
      id: _requiredString(json, 'id'),
      cropId: _requiredString(crop, 'id'),
      cropNameEn: _requiredString(crop, 'nameEn'),
      cropNameHi: _requiredString(crop, 'nameHi'),
      areaAcres: _requiredDouble(json, 'areaAcres'),
      season: _requiredString(json, 'season'),
      status: CropCycleStatus.fromApi(_requiredString(json, 'status')),
      varietyName: json['varietyName'] as String?,
      // Optional: a planned cycle may not have been sown yet.
      sowingDate: rawSowingDate is String
          ? DateTime.tryParse(rawSowingDate)
          : null,
    );
  }

  /// Whole days since sowing, or null when the crop has not been sown.
  ///
  /// Advisory rules are keyed on days after sowing, so this is the number a
  /// farmer is used to seeing against their crop.
  int? get daysAfterSowing {
    final sown = sowingDate;
    if (sown == null) return null;
    final days = DateTime.now().difference(sown).inDays;
    return days < 0 ? null : days;
  }

  final String id;
  final String cropId;
  final String cropNameEn;
  final String cropNameHi;
  final double areaAcres;
  final String season;
  final CropCycleStatus status;
  final String? varietyName;
  final DateTime? sowingDate;
}

class HarvestCropCycleInput {
  const HarvestCropCycleInput({
    required this.actualHarvestDate,
    this.yieldQuintals,
  });

  final DateTime actualHarvestDate;
  final double? yieldQuintals;

  Map<String, Object?> toJson() => {
    'actualHarvestDate': _dateValue(actualHarvestDate),
    if (yieldQuintals != null) 'yieldQuintals': yieldQuintals,
  };
}

class FarmerFarm {
  const FarmerFarm({
    required this.id,
    required this.name,
    required this.pincode,
    required this.areaAcres,
    required this.ownershipType,
    required this.isActive,
    required this.cropCycles,
    this.village,
    this.district,
    this.state,
  });

  factory FarmerFarm.fromJson(Map<String, Object?> json) {
    final rawCycles = json['cropCycles'];
    if (rawCycles is! List<Object?>) {
      throw const FormatException('Farm response is missing crop cycles.');
    }
    return FarmerFarm(
      id: _requiredString(json, 'id'),
      name: _requiredString(json, 'name'),
      village: json['village'] as String?,
      district: json['district'] as String?,
      state: json['state'] as String?,
      pincode: _requiredString(json, 'pincode'),
      areaAcres: _requiredDouble(json, 'areaAcres'),
      ownershipType: FarmOwnershipType.fromApi(
        _requiredString(json, 'ownershipType'),
      ),
      isActive: json['isActive'] == true,
      cropCycles: rawCycles
          .map(
            (item) =>
                FarmCropCycleSummary.fromJson(item! as Map<String, Object?>),
          )
          .toList(growable: false),
    );
  }

  final String id;
  final String name;
  final String? village;
  final String? district;
  final String? state;
  final String pincode;
  final double areaAcres;
  final FarmOwnershipType ownershipType;
  final bool isActive;
  final List<FarmCropCycleSummary> cropCycles;
}

class CreateFarmInput {
  const CreateFarmInput({
    required this.name,
    required this.pincode,
    required this.areaAcres,
    required this.ownershipType,
    this.village,
  });

  final String name;
  final String? village;
  final String pincode;
  final double areaAcres;
  final FarmOwnershipType ownershipType;

  Map<String, Object?> toJson() => {
    'name': name.trim(),
    if (village?.trim().isNotEmpty ?? false) 'village': village!.trim(),
    'pincode': pincode,
    'areaAcres': areaAcres,
    'ownershipType': ownershipType.apiValue,
  };
}

class UpdateFarmInput {
  const UpdateFarmInput({
    required this.name,
    required this.pincode,
    required this.areaAcres,
    required this.ownershipType,
    required this.isActive,
    this.village,
  });

  final String name;
  final String? village;
  final String pincode;
  final double areaAcres;
  final FarmOwnershipType ownershipType;
  final bool isActive;

  Map<String, Object?> toJson() => {
    'name': name.trim(),
    'village': village?.trim() ?? '',
    'pincode': pincode,
    'areaAcres': areaAcres,
    'ownershipType': ownershipType.apiValue,
    'isActive': isActive,
  };
}

class CreateCropCycleInput {
  const CreateCropCycleInput({
    required this.cropId,
    required this.areaAcres,
    required this.season,
    this.varietyName,
    this.sowingDate,
    this.expectedHarvestDate,
  });

  final String cropId;
  final String? varietyName;
  final double areaAcres;
  final String season;
  final DateTime? sowingDate;
  final DateTime? expectedHarvestDate;

  Map<String, Object?> toJson() => {
    'cropId': cropId,
    if (varietyName?.trim().isNotEmpty ?? false)
      'varietyName': varietyName!.trim(),
    'areaAcres': areaAcres,
    'season': season.trim().toUpperCase(),
    if (sowingDate != null) 'sowingDate': _dateValue(sowingDate!),
    if (expectedHarvestDate != null)
      'expectedHarvestDate': _dateValue(expectedHarvestDate!),
    'status': 'ACTIVE',
  };
}

class UpdateCropCycleInput {
  const UpdateCropCycleInput({
    required this.cropId,
    required this.areaAcres,
    required this.season,
    this.varietyName,
  });

  final String cropId;
  final String? varietyName;
  final double areaAcres;
  final String season;

  Map<String, Object?> toJson() => {
    'cropId': cropId,
    'varietyName': varietyName?.trim() ?? '',
    'areaAcres': areaAcres,
    'season': season.trim().toUpperCase(),
  };
}

class CreateFarmActivityInput {
  const CreateFarmActivityInput({
    required this.activityType,
    required this.occurredOn,
    this.notes,
  });

  final FarmActivityType activityType;
  final DateTime occurredOn;
  final String? notes;

  Map<String, Object?> toJson() => {
    'activityType': activityType.apiValue,
    'occurredOn': _dateValue(occurredOn),
    if (notes?.trim().isNotEmpty ?? false) 'notes': notes!.trim(),
  };
}

abstract interface class FarmRepository {
  Future<List<FarmerFarm>> listMine();
  Future<FarmerFarm> create(CreateFarmInput input);
  Future<FarmerFarm> update(String farmId, UpdateFarmInput input);
  Future<List<CropReference>> listReferenceCrops();
  Future<FarmCropCycleSummary> createCropCycle(
    String farmId,
    CreateCropCycleInput input,
  );
  Future<FarmCropCycleSummary> updateCropCycle(
    String farmId,
    String cycleId,
    UpdateCropCycleInput input,
  );
  Future<List<FarmActivity>> listActivities(String cycleId);
  Future<FarmActivity> createActivity(
    String cycleId,
    CreateFarmActivityInput input,
  );
  Future<FarmCropCycleSummary> harvestCropCycle(
    String farmId,
    String cycleId,
    HarvestCropCycleInput input,
  );
}

class ApiFarmRepository implements FarmRepository {
  const ApiFarmRepository(this._client);
  final AuthenticatedApiClient _client;

  @override
  Future<List<FarmerFarm>> listMine() async => (await _client.getList('/farms'))
      .map((item) => FarmerFarm.fromJson(item! as Map<String, Object?>))
      .toList(growable: false);

  @override
  Future<FarmerFarm> create(CreateFarmInput input) async =>
      FarmerFarm.fromJson(await _client.post('/farms', input.toJson()));

  @override
  Future<FarmerFarm> update(String farmId, UpdateFarmInput input) async =>
      FarmerFarm.fromJson(
        await _client.patch('/farms/$farmId', input.toJson()),
      );

  @override
  Future<List<CropReference>> listReferenceCrops() async =>
      (await _client.getList('/farms/reference/crops'))
          .map((item) => CropReference.fromJson(item! as Map<String, Object?>))
          .toList(growable: false);

  @override
  Future<FarmCropCycleSummary> createCropCycle(
    String farmId,
    CreateCropCycleInput input,
  ) async => FarmCropCycleSummary.fromJson(
    await _client.post('/farms/$farmId/crop-cycles', input.toJson()),
  );

  @override
  Future<FarmCropCycleSummary> updateCropCycle(
    String farmId,
    String cycleId,
    UpdateCropCycleInput input,
  ) async => FarmCropCycleSummary.fromJson(
    await _client.patch('/farms/$farmId/crop-cycles/$cycleId', input.toJson()),
  );

  @override
  Future<List<FarmActivity>> listActivities(String cycleId) async =>
      (await _client.getList('/farms/crop-cycles/$cycleId/activities'))
          .map((item) => FarmActivity.fromJson(item! as Map<String, Object?>))
          .toList(growable: false);

  @override
  Future<FarmActivity> createActivity(
    String cycleId,
    CreateFarmActivityInput input,
  ) async => FarmActivity.fromJson(
    await _client.post(
      '/farms/crop-cycles/$cycleId/activities',
      input.toJson(),
    ),
  );

  @override
  Future<FarmCropCycleSummary> harvestCropCycle(
    String farmId,
    String cycleId,
    HarvestCropCycleInput input,
  ) async => FarmCropCycleSummary.fromJson(
    await _client.post(
      '/farms/$farmId/crop-cycles/$cycleId/harvest',
      input.toJson(),
    ),
  );
}

String _dateValue(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-'
    '${value.month.toString().padLeft(2, '0')}-'
    '${value.day.toString().padLeft(2, '0')}';

Map<String, Object?> _requiredMap(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! Map<String, Object?>) {
    throw FormatException('Farm response is missing $key.');
  }
  return value;
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Farm response is missing $key.');
  }
  return value;
}

double _requiredDouble(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is num) return value.toDouble();
  if (value is String) {
    final parsed = double.tryParse(value);
    if (parsed != null) return parsed;
  }
  throw FormatException('Farm response is missing $key.');
}
