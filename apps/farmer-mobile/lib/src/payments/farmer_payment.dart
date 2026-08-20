class FarmerPaymentIntent {
  const FarmerPaymentIntent({
    required this.id,
    required this.checkoutId,
    required this.providerMode,
    required this.providerReference,
    required this.status,
    required this.amountPaise,
    required this.currency,
    required this.failureCode,
    required this.failureMessage,
    required this.checkoutStatus,
  });

  factory FarmerPaymentIntent.fromJson(Map<String, Object?> json) {
    final checkout = _object(json['checkout'], 'checkout');
    return FarmerPaymentIntent(
      id: _string(json, 'id'),
      checkoutId: _string(json, 'checkoutId'),
      providerMode: _string(json, 'providerMode'),
      providerReference: _string(json, 'providerReference'),
      status: _string(json, 'status'),
      amountPaise: _integer(json, 'amountPaise'),
      currency: _string(json, 'currency'),
      failureCode: _nullableString(json, 'failureCode'),
      failureMessage: _nullableString(json, 'failureMessage'),
      checkoutStatus: _string(checkout, 'status'),
    );
  }

  final String id;
  final String checkoutId;
  final String providerMode;
  final String providerReference;
  final String status;
  final int amountPaise;
  final String currency;
  final String? failureCode;
  final String? failureMessage;
  final String checkoutStatus;
}

Map<String, Object?> _object(Object? value, String label) {
  if (value is Map) return value.cast<String, Object?>();
  throw FormatException('Expected $label to be an object.');
}

String _string(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is String) return value;
  throw FormatException('Expected $key to be a string.');
}

String? _nullableString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null || value is String) return value as String?;
  throw FormatException('Expected $key to be a string or null.');
}

int _integer(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is int) return value;
  throw FormatException('Expected $key to be an integer.');
}
