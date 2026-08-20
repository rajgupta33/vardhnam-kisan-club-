class FarmerOrderPage {
  const FarmerOrderPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory FarmerOrderPage.fromJson(Map<String, Object?> json) =>
      FarmerOrderPage(
        items: _list(json, 'items')
            .map((item) => FarmerOrder.fromJson(_object(item, 'order')))
            .toList(growable: false),
        page: _integer(json, 'page'),
        limit: _integer(json, 'limit'),
        total: _integer(json, 'total'),
      );

  final List<FarmerOrder> items;
  final int page;
  final int limit;
  final int total;
}

class FarmerOrder {
  const FarmerOrder({
    required this.id,
    required this.checkoutId,
    required this.orderNumber,
    required this.status,
    required this.serviceablePincode,
    required this.sellerNameSnapshot,
    required this.sellerGstinSnapshot,
    required this.deliveryAddress,
    required this.subtotalPaise,
    required this.itemCount,
    required this.items,
    required this.statusHistory,
    required this.invoice,
    required this.dispatchNumber,
    required this.deliveryAssignmentNumber,
    required this.deliveryAssignmentStatus,
    required this.createdAt,
    required this.updatedAt,
  });

  factory FarmerOrder.fromJson(Map<String, Object?> json) {
    final dispatch = _nullableObject(json['dispatch'], 'dispatch');
    final assignment = _nullableObject(
      json['deliveryAssignment'],
      'deliveryAssignment',
    );
    return FarmerOrder(
      id: _string(json, 'id'),
      checkoutId: _string(json, 'checkoutId'),
      orderNumber: _string(json, 'orderNumber'),
      status: _string(json, 'status'),
      serviceablePincode: _string(json, 'serviceablePincode'),
      sellerNameSnapshot: _string(json, 'sellerNameSnapshot'),
      sellerGstinSnapshot: _nullableString(json, 'sellerGstinSnapshot'),
      deliveryAddress: FarmerOrderAddress.fromJson(
        _map(json, 'deliveryAddressSnapshot'),
      ),
      subtotalPaise: _integer(json, 'subtotalPaise'),
      itemCount: _integer(json, 'itemCount'),
      items: _list(json, 'items')
          .map((item) => FarmerOrderItem.fromJson(_object(item, 'order item')))
          .toList(growable: false),
      statusHistory: _list(json, 'statusHistory')
          .map(
            (event) =>
                FarmerOrderStatusEvent.fromJson(_object(event, 'status event')),
          )
          .toList(growable: false),
      invoice: json['invoice'] == null
          ? null
          : FarmerOrderInvoice.fromJson(_map(json, 'invoice')),
      dispatchNumber: dispatch == null
          ? null
          : _nullableString(dispatch, 'dispatchNumber'),
      deliveryAssignmentNumber: assignment == null
          ? null
          : _nullableString(assignment, 'assignmentNumber'),
      deliveryAssignmentStatus: assignment == null
          ? null
          : _nullableString(assignment, 'status'),
      createdAt: _dateTime(json, 'createdAt'),
      updatedAt: _dateTime(json, 'updatedAt'),
    );
  }

  final String id;
  final String checkoutId;
  final String orderNumber;
  final String status;
  final String serviceablePincode;
  final String sellerNameSnapshot;
  final String? sellerGstinSnapshot;
  final FarmerOrderAddress deliveryAddress;
  final int subtotalPaise;
  final int itemCount;
  final List<FarmerOrderItem> items;
  final List<FarmerOrderStatusEvent> statusHistory;
  final FarmerOrderInvoice? invoice;
  final String? dispatchNumber;
  final String? deliveryAssignmentNumber;
  final String? deliveryAssignmentStatus;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get canCancel => const {
    'PENDING_PAYMENT',
    'INVENTORY_RESERVED',
    'PAYMENT_FAILED',
  }.contains(status);
}

class FarmerOrderAddress {
  const FarmerOrderAddress({
    required this.recipientName,
    required this.phone,
    required this.addressLine1,
    required this.addressLine2,
    required this.village,
    required this.city,
    required this.district,
    required this.state,
    required this.pincode,
    required this.landmark,
  });

  factory FarmerOrderAddress.fromJson(Map<String, Object?> json) =>
      FarmerOrderAddress(
        recipientName: _string(json, 'recipientName'),
        phone: _string(json, 'phone'),
        addressLine1: _string(json, 'addressLine1'),
        addressLine2: _nullableString(json, 'addressLine2'),
        village: _nullableString(json, 'village'),
        city: _string(json, 'city'),
        district: _nullableString(json, 'district'),
        state: _string(json, 'state'),
        pincode: _string(json, 'pincode'),
        landmark: _nullableString(json, 'landmark'),
      );

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
}

class FarmerOrderItem {
  const FarmerOrderItem({
    required this.id,
    required this.quantity,
    required this.unitPricePaise,
    required this.lineTotalPaise,
    required this.productNameSnapshot,
    required this.variantNameSnapshot,
    required this.warehouseNameSnapshot,
    required this.fulfilmentModeSnapshot,
    required this.deliverySlaDaysSnapshot,
    required this.batchNumbers,
  });

  factory FarmerOrderItem.fromJson(
    Map<String, Object?> json,
  ) => FarmerOrderItem(
    id: _string(json, 'id'),
    quantity: _integer(json, 'quantity'),
    unitPricePaise: _integer(json, 'unitPricePaise'),
    lineTotalPaise: _integer(json, 'lineTotalPaise'),
    productNameSnapshot: _string(json, 'productNameSnapshot'),
    variantNameSnapshot: _string(json, 'variantNameSnapshot'),
    warehouseNameSnapshot: _string(json, 'warehouseNameSnapshot'),
    fulfilmentModeSnapshot: _string(json, 'fulfilmentModeSnapshot'),
    deliverySlaDaysSnapshot: _nullableInteger(json, 'deliverySlaDaysSnapshot'),
    batchNumbers: _list(json, 'reservations')
        .map(
          (reservation) =>
              _string(_object(reservation, 'reservation'), 'batchNumber'),
        )
        .toList(growable: false),
  );

  final String id;
  final int quantity;
  final int unitPricePaise;
  final int lineTotalPaise;
  final String productNameSnapshot;
  final String variantNameSnapshot;
  final String warehouseNameSnapshot;
  final String fulfilmentModeSnapshot;
  final int? deliverySlaDaysSnapshot;
  final List<String> batchNumbers;
}

class FarmerOrderStatusEvent {
  const FarmerOrderStatusEvent({
    required this.fromStatus,
    required this.toStatus,
    required this.reason,
    required this.createdAt,
  });

  factory FarmerOrderStatusEvent.fromJson(Map<String, Object?> json) =>
      FarmerOrderStatusEvent(
        fromStatus: _nullableString(json, 'fromStatus'),
        toStatus: _string(json, 'toStatus'),
        reason: _nullableString(json, 'reason'),
        createdAt: _dateTime(json, 'createdAt'),
      );

  final String? fromStatus;
  final String toStatus;
  final String? reason;
  final DateTime createdAt;
}

class FarmerOrderInvoice {
  const FarmerOrderInvoice({
    required this.invoiceNumber,
    required this.status,
    required this.currency,
    required this.subtotalPaise,
    required this.taxPaise,
    required this.totalPaise,
    required this.sellerLegalNameSnapshot,
    required this.sellerDisplayNameSnapshot,
    required this.sellerGstinSnapshot,
    required this.farmerNameSnapshot,
    required this.generatedAt,
  });

  factory FarmerOrderInvoice.fromJson(Map<String, Object?> json) =>
      FarmerOrderInvoice(
        invoiceNumber: _string(json, 'invoiceNumber'),
        status: _string(json, 'status'),
        currency: _string(json, 'currency'),
        subtotalPaise: _integer(json, 'subtotalPaise'),
        taxPaise: _integer(json, 'taxPaise'),
        totalPaise: _integer(json, 'totalPaise'),
        sellerLegalNameSnapshot: _string(json, 'sellerLegalNameSnapshot'),
        sellerDisplayNameSnapshot: _string(json, 'sellerDisplayNameSnapshot'),
        sellerGstinSnapshot: _nullableString(json, 'sellerGstinSnapshot'),
        farmerNameSnapshot: _string(json, 'farmerNameSnapshot'),
        generatedAt: _dateTime(json, 'generatedAt'),
      );

  final String invoiceNumber;
  final String status;
  final String currency;
  final int subtotalPaise;
  final int taxPaise;
  final int totalPaise;
  final String sellerLegalNameSnapshot;
  final String sellerDisplayNameSnapshot;
  final String? sellerGstinSnapshot;
  final String farmerNameSnapshot;
  final DateTime generatedAt;
}

Map<String, Object?> _map(Map<String, Object?> json, String key) =>
    _object(json[key], key);

Map<String, Object?> _object(Object? value, String label) {
  if (value is Map) return value.cast<String, Object?>();
  throw FormatException('Expected $label to be an object.');
}

Map<String, Object?>? _nullableObject(Object? value, String label) {
  if (value == null) return null;
  return _object(value, label);
}

List<Object?> _list(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is List) return value.cast<Object?>();
  throw FormatException('Expected $key to be a list.');
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

int? _nullableInteger(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null || value is int) return value as int?;
  throw FormatException('Expected $key to be an integer or null.');
}

DateTime _dateTime(Map<String, Object?> json, String key) {
  final value = _string(json, key);
  return DateTime.parse(value).toUtc();
}
