import '../profile/farmer_profile.dart';

class FarmerCart {
  const FarmerCart({
    required this.id,
    required this.deliveryAddress,
    required this.serviceablePincode,
    required this.status,
    required this.itemCount,
    required this.subtotalPaise,
    required this.items,
    this.clubBenefitPaise = 0,
    this.farmerPayablePaise,
  });

  factory FarmerCart.fromJson(Map<String, Object?> json) => FarmerCart(
    id: _string(json, 'id'),
    deliveryAddress: json['deliveryAddress'] == null
        ? null
        : FarmerAddress.fromJson(_map(json, 'deliveryAddress')),
    serviceablePincode: _nullableString(json, 'serviceablePincode'),
    status: _string(json, 'status'),
    itemCount: _integer(json, 'itemCount'),
    subtotalPaise: _integer(json, 'subtotalPaise'),
    clubBenefitPaise: _optionalInteger(json, 'clubBenefitPaise'),
    farmerPayablePaise: _nullableInteger(json, 'farmerPayablePaise'),
    items: _list(json, 'items')
        .map((item) => FarmerCartItem.fromJson(_object(item, 'cart item')))
        .toList(growable: false),
  );

  final String id;
  final FarmerAddress? deliveryAddress;
  final String? serviceablePincode;
  final String status;
  final int itemCount;
  final int subtotalPaise;
  final int clubBenefitPaise;
  final int? farmerPayablePaise;
  final List<FarmerCartItem> items;

  List<FarmerCartSellerGroup> get sellerGroups {
    final groupedItems = <String, List<FarmerCartItem>>{};
    for (final item in items) {
      groupedItems
          .putIfAbsent(item.distributorOrganisationId, () => [])
          .add(item);
    }
    return groupedItems.entries
        .map(
          (entry) => FarmerCartSellerGroup(
            distributorOrganisationId: entry.key,
            sellerNameSnapshot: entry.value.first.sellerNameSnapshot,
            items: List.unmodifiable(entry.value),
          ),
        )
        .toList(growable: false);
  }
}

class FarmerCartSellerGroup {
  const FarmerCartSellerGroup({
    required this.distributorOrganisationId,
    required this.sellerNameSnapshot,
    required this.items,
  });

  final String distributorOrganisationId;
  final String sellerNameSnapshot;
  final List<FarmerCartItem> items;
}

class FarmerCartItem {
  const FarmerCartItem({
    required this.id,
    required this.offerId,
    required this.distributorOrganisationId,
    required this.quantity,
    required this.priceSnapshotPaise,
    required this.availableQuantitySnapshot,
    required this.minimumOrderQuantity,
    required this.maximumOrderQuantity,
    required this.serviceablePincodeSnapshot,
    required this.productNameSnapshot,
    required this.variantNameSnapshot,
    required this.sellerNameSnapshot,
    required this.warehouseNameSnapshot,
    required this.fulfilmentModeSnapshot,
    required this.deliverySlaDaysSnapshot,
    required this.lineTotalPaise,
    this.clubBenefitSnapshotPaise = 0,
    this.farmerPayablePaise,
  });

  factory FarmerCartItem.fromJson(Map<String, Object?> json) => FarmerCartItem(
    id: _string(json, 'id'),
    offerId: _string(json, 'offerId'),
    distributorOrganisationId: _string(json, 'distributorOrganisationId'),
    quantity: _integer(json, 'quantity'),
    priceSnapshotPaise: _integer(json, 'priceSnapshotPaise'),
    availableQuantitySnapshot: _integer(json, 'availableQuantitySnapshot'),
    minimumOrderQuantity: _integer(json, 'minimumOrderQuantity'),
    maximumOrderQuantity: _nullableInteger(json, 'maximumOrderQuantity'),
    serviceablePincodeSnapshot: _string(json, 'serviceablePincodeSnapshot'),
    productNameSnapshot: _string(json, 'productNameSnapshot'),
    variantNameSnapshot: _string(json, 'variantNameSnapshot'),
    sellerNameSnapshot: _string(json, 'sellerNameSnapshot'),
    warehouseNameSnapshot: _string(json, 'warehouseNameSnapshot'),
    fulfilmentModeSnapshot: _string(json, 'fulfilmentModeSnapshot'),
    deliverySlaDaysSnapshot: _nullableInteger(json, 'deliverySlaDaysSnapshot'),
    lineTotalPaise: _integer(json, 'lineTotalPaise'),
    clubBenefitSnapshotPaise: _optionalInteger(
      json,
      'clubBenefitSnapshotPaise',
    ),
    farmerPayablePaise: _nullableInteger(json, 'farmerPayablePaise'),
  );

  final String id;
  final String offerId;
  final String distributorOrganisationId;
  final int quantity;
  final int priceSnapshotPaise;
  final int availableQuantitySnapshot;
  final int minimumOrderQuantity;
  final int? maximumOrderQuantity;
  final String serviceablePincodeSnapshot;
  final String productNameSnapshot;
  final String variantNameSnapshot;
  final String sellerNameSnapshot;
  final String warehouseNameSnapshot;
  final String fulfilmentModeSnapshot;
  final int? deliverySlaDaysSnapshot;
  final int lineTotalPaise;
  final int clubBenefitSnapshotPaise;
  final int? farmerPayablePaise;

  int get maximumSelectableQuantity {
    final offerMaximum = maximumOrderQuantity;
    if (offerMaximum == null) return availableQuantitySnapshot;
    return offerMaximum < availableQuantitySnapshot
        ? offerMaximum
        : availableQuantitySnapshot;
  }

  int? get nextLowerQuantity {
    if (quantity <= minimumOrderQuantity) return null;
    final maximum = maximumSelectableQuantity;
    return quantity > maximum ? maximum : quantity - 1;
  }

  int? get nextHigherQuantity {
    final maximum = maximumSelectableQuantity;
    if (quantity >= maximum) return null;
    return quantity < minimumOrderQuantity
        ? minimumOrderQuantity
        : quantity + 1;
  }
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
