enum DeliveryPartnerAvailability {
  offline('OFFLINE'),
  online('ONLINE');

  const DeliveryPartnerAvailability(this.apiValue);
  final String apiValue;

  static DeliveryPartnerAvailability parse(Object? value) => values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => throw const FormatException('Unknown delivery availability'),
  );
}

class DeliveryPartnerProfile {
  const DeliveryPartnerProfile({
    required this.userId,
    required this.organisationId,
    required this.availability,
    this.id,
    this.availabilityChangedAt,
  });

  factory DeliveryPartnerProfile.fromJson(Map<String, Object?> json) =>
      DeliveryPartnerProfile(
        id: json['id'] as String?,
        userId: _requiredString(json, 'userId'),
        organisationId: _requiredString(json, 'organisationId'),
        availability: DeliveryPartnerAvailability.parse(
          json['availabilityStatus'],
        ),
        availabilityChangedAt: _optionalDate(json['availabilityChangedAt']),
      );

  final String? id;
  final String userId;
  final String organisationId;
  final DeliveryPartnerAvailability availability;
  final DateTime? availabilityChangedAt;
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) throw FormatException('Expected $key');
  return value;
}

DateTime? _optionalDate(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;
