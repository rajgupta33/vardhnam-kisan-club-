enum ClubFulfilmentStatus {
  assigned('ASSIGNED'),
  promoterAccepted('PROMOTER_ACCEPTED'),
  promoterDeclined('PROMOTER_DECLINED'),
  productReady('PRODUCT_READY'),
  farmerContacted('FARMER_CONTACTED'),
  readyForPickup('READY_FOR_PICKUP'),
  outForDelivery('OUT_FOR_DELIVERY'),
  completed('COMPLETED'),
  failed('FAILED'),
  reassigned('REASSIGNED'),
  cancelled('CANCELLED');

  const ClubFulfilmentStatus(this.apiValue);
  final String apiValue;

  static ClubFulfilmentStatus parse(Object? value) => values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => throw const FormatException('Unknown fulfilment status'),
  );
}

enum ClubFulfilmentAction {
  accept('accept', ClubFulfilmentStatus.promoterAccepted),
  decline(
    'decline',
    ClubFulfilmentStatus.promoterDeclined,
    reasonRequired: true,
  ),
  productReady('product-ready', ClubFulfilmentStatus.productReady),
  farmerContacted('farmer-contacted', ClubFulfilmentStatus.farmerContacted),
  readyForPickup('ready-for-pickup', ClubFulfilmentStatus.readyForPickup),
  outForDelivery('out-for-delivery', ClubFulfilmentStatus.outForDelivery),
  complete('complete', ClubFulfilmentStatus.completed),
  fail('fail', ClubFulfilmentStatus.failed, reasonRequired: true);

  const ClubFulfilmentAction(
    this.path,
    this.targetStatus, {
    this.reasonRequired = false,
  });

  final String path;
  final ClubFulfilmentStatus targetStatus;
  final bool reasonRequired;
}

List<ClubFulfilmentAction> promoterActionsFor(ClubFulfilmentStatus status) =>
    switch (status) {
      ClubFulfilmentStatus.assigned => const [
        ClubFulfilmentAction.accept,
        ClubFulfilmentAction.decline,
      ],
      ClubFulfilmentStatus.promoterAccepted => const [
        ClubFulfilmentAction.productReady,
        ClubFulfilmentAction.fail,
      ],
      ClubFulfilmentStatus.productReady => const [
        ClubFulfilmentAction.farmerContacted,
        ClubFulfilmentAction.readyForPickup,
        ClubFulfilmentAction.fail,
      ],
      ClubFulfilmentStatus.farmerContacted => const [
        ClubFulfilmentAction.readyForPickup,
        ClubFulfilmentAction.outForDelivery,
        ClubFulfilmentAction.complete,
        ClubFulfilmentAction.fail,
      ],
      ClubFulfilmentStatus.readyForPickup => const [
        ClubFulfilmentAction.outForDelivery,
        ClubFulfilmentAction.complete,
        ClubFulfilmentAction.fail,
      ],
      ClubFulfilmentStatus.outForDelivery => const [
        ClubFulfilmentAction.complete,
        ClubFulfilmentAction.fail,
      ],
      _ => const [],
    };

class ClubFulfilmentPage {
  const ClubFulfilmentPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory ClubFulfilmentPage.fromJson(Map<String, Object?> json) =>
      ClubFulfilmentPage(
        items: _list(json['items'])
            .map((item) => ClubFulfilmentAssignment.fromJson(_map(item)))
            .toList(growable: false),
        page: _int(json, 'page'),
        limit: _int(json, 'limit'),
        total: _int(json, 'total'),
      );

  final List<ClubFulfilmentAssignment> items;
  final int page;
  final int limit;
  final int total;
}

class ClubFulfilmentAssignment {
  const ClubFulfilmentAssignment({
    required this.id,
    required this.productOrderId,
    required this.mode,
    required this.status,
    required this.assignedAt,
    required this.memberNumber,
    required this.farmerName,
    required this.pincode,
    required this.orderNumber,
    required this.orderStatus,
    required this.sellerName,
    required this.farmerPayablePaise,
    required this.history,
    this.village,
    this.failureReason,
  });

  factory ClubFulfilmentAssignment.fromJson(Map<String, Object?> json) {
    final member = _map(json['member']);
    final order = _map(json['order']);
    return ClubFulfilmentAssignment(
      id: _string(json, 'id'),
      productOrderId: _string(json, 'productOrderId'),
      mode: _string(json, 'mode'),
      status: ClubFulfilmentStatus.parse(json['status']),
      assignedAt: _date(json, 'assignedAt'),
      memberNumber: _string(member, 'memberNumber'),
      farmerName: _string(member, 'fullName'),
      village: member['village'] as String?,
      pincode: _string(member, 'pincode'),
      orderNumber: _string(order, 'orderNumber'),
      orderStatus: _string(order, 'status'),
      sellerName: _string(order, 'sellerNameSnapshot'),
      farmerPayablePaise: _int(order, 'farmerPayablePaise'),
      failureReason: json['failureReason'] as String?,
      history: _list(json['statusHistory'])
          .map((item) => ClubFulfilmentHistory.fromJson(_map(item)))
          .toList(growable: false),
    );
  }

  final String id;
  final String productOrderId;
  final String mode;
  final ClubFulfilmentStatus status;
  final DateTime assignedAt;
  final String memberNumber;
  final String farmerName;
  final String? village;
  final String pincode;
  final String orderNumber;
  final String orderStatus;
  final String sellerName;
  final int farmerPayablePaise;
  final String? failureReason;
  final List<ClubFulfilmentHistory> history;
}

class ClubFulfilmentHistory {
  const ClubFulfilmentHistory({
    required this.status,
    required this.createdAt,
    this.reason,
  });

  factory ClubFulfilmentHistory.fromJson(Map<String, Object?> json) =>
      ClubFulfilmentHistory(
        status: ClubFulfilmentStatus.parse(json['toStatus']),
        createdAt: _date(json, 'createdAt'),
        reason: json['reason'] as String?,
      );

  final ClubFulfilmentStatus status;
  final DateTime createdAt;
  final String? reason;
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
