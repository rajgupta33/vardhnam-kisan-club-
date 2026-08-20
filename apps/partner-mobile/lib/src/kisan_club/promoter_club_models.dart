class PromoterFarmerSummary {
  const PromoterFarmerSummary({
    required this.assignmentId,
    required this.membershipId,
    required this.memberNumber,
    required this.fullName,
    required this.village,
    required this.district,
    required this.pincode,
    required this.assignedAt,
    required this.farms,
  });

  factory PromoterFarmerSummary.fromJson(Map<String, Object?> json) {
    final membership = _map(json['membership']);
    final profile = _map(membership['farmerProfile']);
    return PromoterFarmerSummary(
      assignmentId: _string(json, 'id'),
      membershipId: _string(json, 'membershipId'),
      memberNumber: _string(membership, 'memberNumber'),
      fullName: _string(profile, 'fullName'),
      village: membership['homeVillage'] as String?,
      district: membership['homeDistrict'] as String?,
      pincode: _string(membership, 'homePincode'),
      assignedAt: _date(json, 'assignedAt'),
      farms: _list(membership['farms'])
          .map((item) => PromoterFarm.fromJson(_map(item)))
          .toList(growable: false),
    );
  }

  final String assignmentId;
  final String membershipId;
  final String memberNumber;
  final String fullName;
  final String? village;
  final String? district;
  final String pincode;
  final DateTime assignedAt;
  final List<PromoterFarm> farms;
}

class PromoterFarm {
  const PromoterFarm({
    required this.id,
    required this.name,
    required this.areaAcres,
    required this.isActive,
    required this.cropCycles,
  });

  factory PromoterFarm.fromJson(Map<String, Object?> json) => PromoterFarm(
    id: _string(json, 'id'),
    name: _string(json, 'name'),
    areaAcres: _decimalText(json['areaAcres']),
    isActive: json['isActive'] as bool? ?? true,
    cropCycles: _list(json['cropCycles'])
        .map((item) => PromoterCropCycle.fromJson(_map(item)))
        .toList(growable: false),
  );

  final String id;
  final String name;
  final String areaAcres;
  final bool isActive;
  final List<PromoterCropCycle> cropCycles;
}

class PromoterCropCycle {
  const PromoterCropCycle({
    required this.id,
    required this.crop,
    required this.areaAcres,
    required this.season,
    required this.status,
  });

  factory PromoterCropCycle.fromJson(Map<String, Object?> json) =>
      PromoterCropCycle(
        id: _string(json, 'id'),
        crop: _string(json, 'crop'),
        areaAcres: _decimalText(json['areaAcres']),
        season: json['season'] as String?,
        status: _string(json, 'status'),
      );

  final String id;
  final String crop;
  final String areaAcres;
  final String? season;
  final String status;
}

class AssistedCheckoutResult {
  const AssistedCheckoutResult({
    required this.checkoutId,
    required this.status,
    required this.clubBenefitPaise,
    required this.farmerPayablePaise,
    required this.productOrderId,
    required this.paymentRequiredInApp,
  });

  factory AssistedCheckoutResult.fromJson(Map<String, Object?> json) {
    final assisted = _map(json['assistedPurchase']);
    return AssistedCheckoutResult(
      checkoutId: _string(json, 'id'),
      status: _string(json, 'status'),
      clubBenefitPaise: _integer(json, 'clubBenefitPaise'),
      farmerPayablePaise: _integer(json, 'farmerPayablePaise'),
      productOrderId: _string(assisted, 'productOrderId'),
      paymentRequiredInApp: assisted['paymentRequiredInApp'] == true,
    );
  }

  final String checkoutId;
  final String status;
  final int clubBenefitPaise;
  final int farmerPayablePaise;
  final String productOrderId;
  final bool paymentRequiredInApp;
}

class CropReference {
  const CropReference({
    required this.id,
    required this.code,
    required this.nameEn,
    required this.nameHi,
  });

  factory CropReference.fromJson(Map<String, Object?> json) => CropReference(
    id: _string(json, 'id'),
    code: _string(json, 'code'),
    nameEn: _string(json, 'nameEn'),
    nameHi: _string(json, 'nameHi'),
  );

  final String id;
  final String code;
  final String nameEn;
  final String nameHi;
}

class FarmSurveyInput {
  const FarmSurveyInput({
    required this.membershipId,
    required this.farmName,
    required this.pincode,
    required this.areaAcres,
    required this.ownershipType,
    this.village,
    this.district,
    this.state,
    this.irrigationSource,
    this.soilType,
    this.cropCycle,
  });

  final String membershipId;
  final String farmName;
  final String? village;
  final String? district;
  final String? state;
  final String pincode;
  final double areaAcres;
  final String ownershipType;
  final String? irrigationSource;
  final String? soilType;
  final CropSurveyInput? cropCycle;

  Map<String, Object?> toJson() => {
    'membershipId': membershipId,
    'farm': {
      'name': farmName.trim(),
      if (_text(village) case final value?) 'village': value,
      if (_text(district) case final value?) 'district': value,
      if (_text(state) case final value?) 'state': value,
      'pincode': pincode.trim(),
      'areaAcres': areaAcres,
      'ownershipType': ownershipType,
      if (irrigationSource != null) 'irrigationSource': irrigationSource,
      if (_text(soilType) case final value?) 'soilType': value,
    },
    if (cropCycle != null) 'cropCycle': cropCycle!.toJson(),
  };
}

class CropSurveyInput {
  const CropSurveyInput({
    required this.cropId,
    required this.areaAcres,
    required this.season,
    this.varietyName,
    this.sowingDate,
    this.expectedHarvestDate,
    this.status = 'ACTIVE',
  });

  final String cropId;
  final String? varietyName;
  final double areaAcres;
  final String season;
  final String? sowingDate;
  final String? expectedHarvestDate;
  final String status;

  Map<String, Object?> toJson() => {
    'cropId': cropId,
    if (_text(varietyName) case final value?) 'varietyName': value,
    'areaAcres': areaAcres,
    'season': season.trim().toUpperCase(),
    if (_text(sowingDate) case final value?) 'sowingDate': value,
    if (_text(expectedHarvestDate) case final value?)
      'expectedHarvestDate': value,
    'status': status,
  };
}

String? _text(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}

Map<String, Object?> _map(Object? value) {
  if (value is! Map) throw const FormatException('Expected an object');
  return value.cast<String, Object?>();
}

List<Object?> _list(Object? value) {
  if (value is! List) throw const FormatException('Expected a list');
  return value.cast<Object?>();
}

String _string(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Expected $key');
  }
  return value;
}

int _integer(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int) throw FormatException('Expected $key');
  return value;
}

DateTime _date(Map<String, Object?> json, String key) {
  final value = DateTime.tryParse(_string(json, key));
  if (value == null) throw FormatException('Expected $key');
  return value;
}

String _decimalText(Object? value) {
  if (value is num || value is String) return value.toString();
  throw const FormatException('Expected a decimal value');
}
