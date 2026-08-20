enum DeliveryAssignmentStatus {
  assigned('ASSIGNED'),
  accepted('ACCEPTED'),
  rejected('REJECTED'),
  outForDelivery('OUT_FOR_DELIVERY'),
  delivered('DELIVERED'),
  deliveryFailed('DELIVERY_FAILED'),
  cancelled('CANCELLED');

  const DeliveryAssignmentStatus(this.apiValue);
  final String apiValue;

  static DeliveryAssignmentStatus parse(Object? value) => values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () =>
        throw const FormatException('Unknown delivery assignment status'),
  );
}

enum DeliveryFailureReason {
  farmerUnavailable('FARMER_UNAVAILABLE'),
  farmerRefused('FARMER_REFUSED'),
  addressNotFound('ADDRESS_NOT_FOUND'),
  accessRestricted('ACCESS_RESTRICTED'),
  vehicleBreakdown('VEHICLE_BREAKDOWN'),
  weatherOrRouteBlocked('WEATHER_OR_ROUTE_BLOCKED'),
  packageDamaged('PACKAGE_DAMAGED'),
  other('OTHER');

  const DeliveryFailureReason(this.apiValue);
  final String apiValue;

  static DeliveryFailureReason? tryParse(Object? value) {
    for (final reason in values) {
      if (reason.apiValue == value) return reason;
    }
    return null;
  }
}

class DeliveryAssignmentPage {
  const DeliveryAssignmentPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory DeliveryAssignmentPage.fromJson(Map<String, Object?> json) =>
      DeliveryAssignmentPage(
        items: _list(json['items'])
            .map((item) => DeliveryOrder.fromJson(_map(item)))
            .toList(growable: false),
        page: _int(json, 'page'),
        limit: _int(json, 'limit'),
        total: _int(json, 'total'),
      );

  final List<DeliveryOrder> items;
  final int page;
  final int limit;
  final int total;
}

class DeliveryOrder {
  const DeliveryOrder({
    required this.id,
    required this.orderNumber,
    required this.orderStatus,
    required this.sellerName,
    required this.serviceablePincode,
    required this.itemCount,
    required this.address,
    required this.assignment,
    required this.items,
  });

  factory DeliveryOrder.fromJson(Map<String, Object?> json) {
    final assignmentJson = _map(json['deliveryAssignment']);
    return DeliveryOrder(
      id: _string(json, 'id'),
      orderNumber: _string(json, 'orderNumber'),
      orderStatus: _string(json, 'status'),
      sellerName: _string(json, 'sellerNameSnapshot'),
      serviceablePincode: _string(json, 'serviceablePincode'),
      itemCount: _int(json, 'itemCount'),
      address: DeliveryAddress.fromJson(_map(json['deliveryAddressSnapshot'])),
      assignment: DeliveryAssignment.fromJson(assignmentJson),
      items: _list(json['items'])
          .map((item) => DeliveryItem.fromJson(_map(item)))
          .toList(growable: false),
    );
  }

  final String id;
  final String orderNumber;
  final String orderStatus;
  final String sellerName;
  final String serviceablePincode;
  final int itemCount;
  final DeliveryAddress address;
  final DeliveryAssignment assignment;
  final List<DeliveryItem> items;
}

class DeliveryAssignment {
  const DeliveryAssignment({
    required this.id,
    required this.number,
    required this.status,
    required this.dispatchNumber,
    required this.invoiceNumber,
    required this.otpExpiresAt,
    required this.otpAttemptCount,
    required this.pickupVerificationAttemptCount,
    required this.assignedAt,
    this.startedAt,
    this.pickupVerifiedAt,
    this.completedAt,
    this.deliveryProofNote,
    this.proofLocationStatus,
    this.proofLatitude,
    this.proofLongitude,
    this.proofAccuracyMetres,
    this.proofLocationCapturedAt,
    this.failureAttemptCount = 0,
    this.lastFailureReason,
    this.lastFailureNote,
    this.lastFailedAt,
    this.retryScheduledAt,
  });

  factory DeliveryAssignment.fromJson(Map<String, Object?> json) =>
      DeliveryAssignment(
        id: _string(json, 'id'),
        number: _string(json, 'assignmentNumber'),
        status: DeliveryAssignmentStatus.parse(json['status']),
        dispatchNumber: _string(json, 'dispatchNumberSnapshot'),
        invoiceNumber: _string(json, 'invoiceNumberSnapshot'),
        otpExpiresAt: _date(json, 'otpExpiresAt'),
        otpAttemptCount: _int(json, 'otpAttemptCount'),
        pickupVerificationAttemptCount: _int(
          json,
          'pickupVerificationAttemptCount',
        ),
        assignedAt: _date(json, 'assignedAt'),
        startedAt: _optionalDate(json['startedAt']),
        pickupVerifiedAt: _optionalDate(json['pickupVerifiedAt']),
        completedAt: _optionalDate(json['completedAt']),
        deliveryProofNote: json['deliveryProofNote'] as String?,
        proofLocationStatus: json['proofLocationStatus'] as String?,
        proofLatitude: _optionalDouble(json['proofLatitude']),
        proofLongitude: _optionalDouble(json['proofLongitude']),
        proofAccuracyMetres: _optionalDouble(json['proofAccuracyMetres']),
        proofLocationCapturedAt: _optionalDate(json['proofLocationCapturedAt']),
        failureAttemptCount: json['failureAttemptCount'] is int
            ? json['failureAttemptCount'] as int
            : 0,
        lastFailureReason: DeliveryFailureReason.tryParse(
          json['lastFailureReasonCode'],
        ),
        lastFailureNote: json['lastFailureNote'] as String?,
        lastFailedAt: _optionalDate(json['lastFailedAt']),
        retryScheduledAt: _optionalDate(json['retryScheduledAt']),
      );

  final String id;
  final String number;
  final DeliveryAssignmentStatus status;
  final String dispatchNumber;
  final String invoiceNumber;
  final DateTime otpExpiresAt;
  final int otpAttemptCount;
  final int pickupVerificationAttemptCount;
  final DateTime assignedAt;
  final DateTime? startedAt;
  final DateTime? pickupVerifiedAt;
  final DateTime? completedAt;
  final String? deliveryProofNote;
  final String? proofLocationStatus;
  final double? proofLatitude;
  final double? proofLongitude;
  final double? proofAccuracyMetres;
  final DateTime? proofLocationCapturedAt;
  final int failureAttemptCount;
  final DeliveryFailureReason? lastFailureReason;
  final String? lastFailureNote;
  final DateTime? lastFailedAt;
  final DateTime? retryScheduledAt;
}

class DeliveryAddress {
  const DeliveryAddress({
    required this.recipientName,
    required this.phone,
    required this.addressLine1,
    required this.district,
    required this.state,
    required this.pincode,
    this.addressLine2,
    this.village,
    this.city,
    this.landmark,
  });

  factory DeliveryAddress.fromJson(Map<String, Object?> json) =>
      DeliveryAddress(
        recipientName: _string(json, 'recipientName'),
        phone: _string(json, 'phone'),
        addressLine1: _string(json, 'addressLine1'),
        addressLine2: json['addressLine2'] as String?,
        village: json['village'] as String?,
        city: json['city'] as String?,
        district: _string(json, 'district'),
        state: _string(json, 'state'),
        pincode: _string(json, 'pincode'),
        landmark: json['landmark'] as String?,
      );

  final String recipientName;
  final String phone;
  final String addressLine1;
  final String? addressLine2;
  final String? village;
  final String? city;
  final String district;
  final String state;
  final String pincode;
  final String? landmark;

  String get formatted => [
    addressLine1,
    addressLine2,
    village,
    city,
    district,
    state,
    pincode,
  ].whereType<String>().where((part) => part.trim().isNotEmpty).join(', ');
}

class DeliveryItem {
  const DeliveryItem({
    required this.productName,
    required this.variantName,
    required this.quantity,
  });

  factory DeliveryItem.fromJson(Map<String, Object?> json) => DeliveryItem(
    productName: _string(json, 'productNameSnapshot'),
    variantName: _string(json, 'variantNameSnapshot'),
    quantity: _int(json, 'quantity'),
  );

  final String productName;
  final String variantName;
  final int quantity;
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
  if (value is! String || value.isEmpty) throw FormatException('Expected $key');
  return value;
}

int _int(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int) throw FormatException('Expected $key');
  return value;
}

DateTime _date(Map<String, Object?> json, String key) {
  final value = DateTime.tryParse(_string(json, key));
  if (value == null) throw FormatException('Expected $key');
  return value;
}

DateTime? _optionalDate(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;

double? _optionalDouble(Object? value) =>
    value is num ? value.toDouble() : null;
