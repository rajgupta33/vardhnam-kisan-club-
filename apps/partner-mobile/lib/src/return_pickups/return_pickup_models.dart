import '../delivery/delivery_assignment_models.dart';

enum ReturnPickupStatus {
  assigned('ASSIGNED'),
  accepted('ACCEPTED'),
  rejected('REJECTED'),
  collected('COLLECTED'),
  cancelled('CANCELLED');

  const ReturnPickupStatus(this.apiValue);
  final String apiValue;

  static ReturnPickupStatus parse(Object? value) => values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => throw const FormatException('Unknown return pickup status'),
  );
}

class ReturnPickupPage {
  const ReturnPickupPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });
  factory ReturnPickupPage.fromJson(Map<String, Object?> json) =>
      ReturnPickupPage(
        items: _list(json['items'])
            .map((item) => ReturnPickup.fromJson(_map(item)))
            .toList(growable: false),
        page: _int(json, 'page'),
        limit: _int(json, 'limit'),
        total: _int(json, 'total'),
      );
  final List<ReturnPickup> items;
  final int page;
  final int limit;
  final int total;
}

class ReturnPickup {
  const ReturnPickup({
    required this.id,
    required this.returnRequestId,
    required this.productOrderId,
    required this.assignmentNumber,
    required this.status,
    required this.orderNumber,
    required this.sellerName,
    required this.pickupAddress,
    required this.items,
    required this.returnReasonCode,
    required this.returnStatus,
    required this.assignedAt,
    this.returnReasonNote,
    this.respondedAt,
    this.rejectionReason,
    this.collectedAt,
    this.collectionNote,
  });

  factory ReturnPickup.fromJson(Map<String, Object?> json) => ReturnPickup(
    id: _string(json, 'id'),
    returnRequestId: _string(json, 'returnRequestId'),
    productOrderId: _string(json, 'productOrderId'),
    assignmentNumber: _string(json, 'assignmentNumber'),
    status: ReturnPickupStatus.parse(json['status']),
    orderNumber: _string(json, 'orderNumber'),
    sellerName: _string(json, 'sellerName'),
    pickupAddress: DeliveryAddress.fromJson(_map(json['pickupAddress'])),
    items: _list(json['items'])
        .map((item) => ReturnPickupItem.fromJson(_map(item)))
        .toList(growable: false),
    returnReasonCode: _string(json, 'returnReasonCode'),
    returnReasonNote: json['returnReasonNote'] as String?,
    returnStatus: _string(json, 'returnStatus'),
    assignedAt: _date(json, 'assignedAt'),
    respondedAt: _optionalDate(json['respondedAt']),
    rejectionReason: json['rejectionReason'] as String?,
    collectedAt: _optionalDate(json['collectedAt']),
    collectionNote: json['collectionNote'] as String?,
  );

  final String id;
  final String returnRequestId;
  final String productOrderId;
  final String assignmentNumber;
  final ReturnPickupStatus status;
  final String orderNumber;
  final String sellerName;
  final DeliveryAddress pickupAddress;
  final List<ReturnPickupItem> items;
  final String returnReasonCode;
  final String? returnReasonNote;
  final String returnStatus;
  final DateTime assignedAt;
  final DateTime? respondedAt;
  final String? rejectionReason;
  final DateTime? collectedAt;
  final String? collectionNote;
}

class ReturnPickupItem {
  const ReturnPickupItem({
    required this.productName,
    required this.variantName,
    required this.quantity,
  });
  factory ReturnPickupItem.fromJson(Map<String, Object?> json) =>
      ReturnPickupItem(
        productName: _string(json, 'productName'),
        variantName: _string(json, 'variantName'),
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
