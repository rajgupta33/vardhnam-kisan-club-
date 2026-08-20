class FarmerProfile {
  const FarmerProfile({
    required this.id,
    required this.fullName,
    required this.preferredLocale,
    required this.cropInterests,
    required this.addresses,
    this.alternatePhone,
    this.village,
    this.district,
    this.state,
    this.primaryPincode,
  });

  factory FarmerProfile.fromJson(Map<String, Object?> json) {
    final rawAddresses = json['addresses'];
    if (rawAddresses is! List) {
      throw const FormatException('Farmer profile addresses must be a list.');
    }
    final rawCrops = json['cropInterests'];
    if (rawCrops is! List || rawCrops.any((crop) => crop is! String)) {
      throw const FormatException('Farmer crop interests must be a list.');
    }
    return FarmerProfile(
      id: _requiredString(json, 'id'),
      fullName: _requiredString(json, 'fullName'),
      alternatePhone: json['alternatePhone'] as String?,
      preferredLocale: _requiredString(json, 'preferredLocale'),
      village: json['village'] as String?,
      district: json['district'] as String?,
      state: json['state'] as String?,
      primaryPincode: json['primaryPincode'] as String?,
      cropInterests: rawCrops.cast<String>(),
      addresses: rawAddresses
          .map((address) => FarmerAddress.fromJson(_asMap(address)))
          .toList(growable: false),
    );
  }

  final String id;
  final String fullName;
  final String? alternatePhone;
  final String preferredLocale;
  final String? village;
  final String? district;
  final String? state;
  final String? primaryPincode;
  final List<String> cropInterests;
  final List<FarmerAddress> addresses;
}

class FarmerAddress {
  const FarmerAddress({
    required this.id,
    required this.label,
    required this.recipientName,
    required this.phone,
    required this.addressLine1,
    required this.city,
    required this.state,
    required this.pincode,
    required this.isDefault,
    this.addressLine2,
    this.village,
    this.district,
    this.landmark,
  });

  factory FarmerAddress.fromJson(Map<String, Object?> json) => FarmerAddress(
    id: _requiredString(json, 'id'),
    label: _requiredString(json, 'label'),
    recipientName: _requiredString(json, 'recipientName'),
    phone: _requiredString(json, 'phone'),
    addressLine1: _requiredString(json, 'addressLine1'),
    addressLine2: json['addressLine2'] as String?,
    village: json['village'] as String?,
    city: _requiredString(json, 'city'),
    district: json['district'] as String?,
    state: _requiredString(json, 'state'),
    pincode: _requiredString(json, 'pincode'),
    landmark: json['landmark'] as String?,
    isDefault: json['isDefault'] == true,
  );

  final String id;
  final String label;
  final String recipientName;
  final String phone;
  final String addressLine1;
  final String? addressLine2;
  final String? village;
  final String city;
  final String? district;
  final String state;
  final String pincode;
  final String? landmark;
  final bool isDefault;
}

class FarmerProfileInput {
  const FarmerProfileInput({
    required this.fullName,
    required this.preferredLocale,
    required this.cropInterests,
    this.alternatePhone,
    this.village,
    this.district,
    this.state,
    this.primaryPincode,
  });

  final String fullName;
  final String? alternatePhone;
  final String preferredLocale;
  final String? village;
  final String? district;
  final String? state;
  final String? primaryPincode;
  final List<String> cropInterests;

  Map<String, Object?> toJson() => {
    'fullName': fullName,
    'alternatePhone': alternatePhone,
    'preferredLocale': preferredLocale,
    'village': village,
    'district': district,
    'state': state,
    'primaryPincode': primaryPincode,
    'cropInterests': cropInterests,
  };
}

Map<String, Object?> _asMap(Object? value) {
  if (value is! Map) {
    throw const FormatException('Expected an object.');
  }
  return value.cast<String, Object?>();
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Farmer profile is missing $key.');
  }
  return value;
}
