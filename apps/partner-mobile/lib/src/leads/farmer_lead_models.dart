enum FarmerLeadStatus {
  newLead('NEW'),
  contacted('CONTACTED'),
  converted('CONVERTED'),
  lost('LOST');

  const FarmerLeadStatus(this.apiValue);
  final String apiValue;

  static FarmerLeadStatus parse(String value) => values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => throw const FormatException('Unknown farmer lead status'),
  );
}

enum FarmerLeadSource {
  fieldVisit('FIELD_VISIT'),
  referral('REFERRAL'),
  campaign('CAMPAIGN'),
  inbound('INBOUND'),
  other('OTHER');

  const FarmerLeadSource(this.apiValue);
  final String apiValue;
}

class FarmerLead {
  const FarmerLead({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.source,
    required this.status,
    required this.cropInterests,
    required this.createdAt,
    required this.updatedAt,
    this.village,
    this.district,
    this.state,
    this.pincode,
    this.notes,
    this.statusReason,
    this.convertedFarmerProfileId,
  });

  factory FarmerLead.fromJson(Map<String, Object?> json) => FarmerLead(
    id: _string(json, 'id'),
    fullName: _string(json, 'fullName'),
    phone: _string(json, 'phone'),
    source: FarmerLeadSource.values.firstWhere(
      (source) => source.apiValue == _string(json, 'source'),
      orElse: () => throw const FormatException('Unknown farmer lead source'),
    ),
    status: FarmerLeadStatus.parse(_string(json, 'status')),
    village: json['village'] as String?,
    district: json['district'] as String?,
    state: json['state'] as String?,
    pincode: json['pincode'] as String?,
    cropInterests: (json['cropInterests'] as List? ?? const []).cast<String>(),
    notes: json['notes'] as String?,
    statusReason: json['statusReason'] as String?,
    convertedFarmerProfileId: json['convertedFarmerProfileId'] as String?,
    createdAt: DateTime.parse(_string(json, 'createdAt')).toUtc(),
    updatedAt: DateTime.parse(_string(json, 'updatedAt')).toUtc(),
  );

  final String id;
  final String fullName;
  final String phone;
  final FarmerLeadSource source;
  final FarmerLeadStatus status;
  final String? village;
  final String? district;
  final String? state;
  final String? pincode;
  final List<String> cropInterests;
  final String? notes;
  final String? statusReason;
  final String? convertedFarmerProfileId;
  final DateTime createdAt;
  final DateTime updatedAt;
}

class FarmerLeadPage {
  const FarmerLeadPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory FarmerLeadPage.fromJson(Map<String, Object?> json) => FarmerLeadPage(
    items: (json['items'] as List)
        .map(
          (item) => FarmerLead.fromJson((item as Map).cast<String, Object?>()),
        )
        .toList(growable: false),
    page: json['page'] as int,
    limit: json['limit'] as int,
    total: json['total'] as int,
  );

  final List<FarmerLead> items;
  final int page;
  final int limit;
  final int total;
}

class AssistedFarmerOtpChallenge {
  const AssistedFarmerOtpChallenge({required this.expiresAt, this.mockOtpCode});

  factory AssistedFarmerOtpChallenge.fromJson(Map<String, Object?> json) =>
      AssistedFarmerOtpChallenge(
        expiresAt: DateTime.parse(_string(json, 'expiresAt')).toUtc(),
        mockOtpCode: json['mockOtpCode'] as String?,
      );

  final DateTime expiresAt;
  final String? mockOtpCode;
}

class CreateFarmerLeadInput {
  const CreateFarmerLeadInput({
    required this.fullName,
    required this.phone,
    required this.source,
    this.village,
    this.district,
    this.state,
    this.pincode,
    this.cropInterests = const [],
    this.notes,
  });

  final String fullName;
  final String phone;
  final FarmerLeadSource source;
  final String? village;
  final String? district;
  final String? state;
  final String? pincode;
  final List<String> cropInterests;
  final String? notes;

  Map<String, Object?> toJson() => {
    'fullName': fullName,
    'phone': phone,
    'source': source.apiValue,
    if (village != null) 'village': village,
    if (district != null) 'district': district,
    if (state != null) 'state': state,
    if (pincode != null) 'pincode': pincode,
    if (cropInterests.isNotEmpty) 'cropInterests': cropInterests,
    if (notes != null) 'notes': notes,
  };
}

String _string(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) throw FormatException('Expected $key');
  return value;
}
