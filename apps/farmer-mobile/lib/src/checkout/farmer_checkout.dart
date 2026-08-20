import '../profile/farmer_profile.dart';

class FarmerCheckout {
  const FarmerCheckout({
    required this.id,
    required this.deliveryAddress,
    required this.serviceablePincode,
    required this.status,
    required this.subtotalPaise,
    required this.itemCount,
    required this.childOrderCount,
    required this.orders,
    this.clubBenefitPaise = 0,
    this.farmerPayablePaise,
  });

  factory FarmerCheckout.fromJson(Map<String, Object?> json) => FarmerCheckout(
    id: _string(json, 'id'),
    deliveryAddress: json['deliveryAddress'] == null
        ? null
        : FarmerAddress.fromJson(_map(json, 'deliveryAddress')),
    serviceablePincode: _string(json, 'serviceablePincode'),
    status: _string(json, 'status'),
    subtotalPaise: _integer(json, 'subtotalPaise'),
    clubBenefitPaise: _optionalInteger(json, 'clubBenefitPaise'),
    farmerPayablePaise: _nullableInteger(json, 'farmerPayablePaise'),
    itemCount: _integer(json, 'itemCount'),
    childOrderCount: _integer(json, 'childOrderCount'),
    orders: _list(json, 'orders')
        .map((order) => FarmerChildOrder.fromJson(_object(order, 'order')))
        .toList(growable: false),
  );

  final String id;
  final FarmerAddress? deliveryAddress;
  final String serviceablePincode;
  final String status;
  final int subtotalPaise;
  final int clubBenefitPaise;
  final int? farmerPayablePaise;
  final int itemCount;
  final int childOrderCount;
  final List<FarmerChildOrder> orders;
}

class FarmerChildOrder {
  const FarmerChildOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.sellerNameSnapshot,
    required this.sellerGstinSnapshot,
    required this.subtotalPaise,
    required this.itemCount,
    required this.items,
    this.clubBenefitPaise = 0,
    this.farmerPayablePaise,
    this.isKisanClubOrder = false,
  });

  factory FarmerChildOrder.fromJson(Map<String, Object?> json) =>
      FarmerChildOrder(
        id: _string(json, 'id'),
        orderNumber: _string(json, 'orderNumber'),
        status: _string(json, 'status'),
        sellerNameSnapshot: _string(json, 'sellerNameSnapshot'),
        sellerGstinSnapshot: _nullableString(json, 'sellerGstinSnapshot'),
        subtotalPaise: _integer(json, 'subtotalPaise'),
        clubBenefitPaise: _optionalInteger(json, 'clubBenefitPaise'),
        farmerPayablePaise: _nullableInteger(json, 'farmerPayablePaise'),
        isKisanClubOrder: _optionalBoolean(json, 'isKisanClubOrder'),
        itemCount: _integer(json, 'itemCount'),
        items: _list(json, 'items')
            .map(
              (item) =>
                  FarmerCheckoutItem.fromJson(_object(item, 'order item')),
            )
            .toList(growable: false),
      );

  final String id;
  final String orderNumber;
  final String status;
  final String sellerNameSnapshot;
  final String? sellerGstinSnapshot;
  final int subtotalPaise;
  final int clubBenefitPaise;
  final int? farmerPayablePaise;
  final bool isKisanClubOrder;
  final int itemCount;
  final List<FarmerCheckoutItem> items;
}

class FarmerCheckoutItem {
  const FarmerCheckoutItem({
    required this.id,
    required this.quantity,
    required this.unitPricePaise,
    required this.lineTotalPaise,
    required this.productNameSnapshot,
    required this.variantNameSnapshot,
    required this.warehouseNameSnapshot,
    required this.fulfilmentModeSnapshot,
    required this.deliverySlaDaysSnapshot,
    required this.reservations,
    this.clubBenefitPaise = 0,
    this.farmerPayablePaise,
  });

  factory FarmerCheckoutItem.fromJson(Map<String, Object?> json) =>
      FarmerCheckoutItem(
        id: _string(json, 'id'),
        quantity: _integer(json, 'quantity'),
        unitPricePaise: _integer(json, 'unitPricePaise'),
        lineTotalPaise: _integer(json, 'lineTotalPaise'),
        clubBenefitPaise: _optionalInteger(json, 'clubBenefitPaise'),
        farmerPayablePaise: _nullableInteger(json, 'farmerPayablePaise'),
        productNameSnapshot: _string(json, 'productNameSnapshot'),
        variantNameSnapshot: _string(json, 'variantNameSnapshot'),
        warehouseNameSnapshot: _string(json, 'warehouseNameSnapshot'),
        fulfilmentModeSnapshot: _string(json, 'fulfilmentModeSnapshot'),
        deliverySlaDaysSnapshot: _nullableInteger(
          json,
          'deliverySlaDaysSnapshot',
        ),
        reservations: _list(json, 'reservations')
            .map(
              (reservation) => FarmerInventoryReservation.fromJson(
                _object(reservation, 'reservation'),
              ),
            )
            .toList(growable: false),
      );

  final String id;
  final int quantity;
  final int unitPricePaise;
  final int lineTotalPaise;
  final int clubBenefitPaise;
  final int? farmerPayablePaise;
  final String productNameSnapshot;
  final String variantNameSnapshot;
  final String warehouseNameSnapshot;
  final String fulfilmentModeSnapshot;
  final int? deliverySlaDaysSnapshot;
  final List<FarmerInventoryReservation> reservations;
}

class FarmerInventoryReservation {
  const FarmerInventoryReservation({
    required this.id,
    required this.batchId,
    required this.batchNumber,
    required this.quantity,
  });

  factory FarmerInventoryReservation.fromJson(Map<String, Object?> json) =>
      FarmerInventoryReservation(
        id: _string(json, 'id'),
        batchId: _string(json, 'batchId'),
        batchNumber: _string(json, 'batchNumber'),
        quantity: _integer(json, 'quantity'),
      );

  final String id;
  final String batchId;
  final String batchNumber;
  final int quantity;
}

Map<String, Object?> _map(Map<String, Object?> json, String key) =>
    _object(json[key], key);

Map<String, Object?> _object(Object? value, String label) {
  if (value is Map) return value.cast<String, Object?>();
  throw FormatException('Expected $label to be an object.');
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

int _optionalInteger(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) return 0;
  if (value is int) return value;
  throw FormatException('Expected $key to be an integer.');
}

bool _optionalBoolean(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) return false;
  if (value is bool) return value;
  throw FormatException('Expected $key to be a boolean.');
}
