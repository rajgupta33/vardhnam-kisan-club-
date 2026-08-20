class FarmerReturnPage {
  const FarmerReturnPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory FarmerReturnPage.fromJson(Map<String, Object?> json) =>
      FarmerReturnPage(
        items: _list(json['items'])
            .map((item) => FarmerReturnRequest.fromJson(_map(item)))
            .toList(growable: false),
        page: _int(json['page']),
        limit: _int(json['limit']),
        total: _int(json['total']),
      );

  final List<FarmerReturnRequest> items;
  final int page;
  final int limit;
  final int total;
}

class FarmerReturnEligibility {
  const FarmerReturnEligibility({
    required this.productOrderId,
    required this.orderNumber,
    required this.eligible,
    required this.items,
    this.reason,
    this.windowExpiresAt,
    this.existingReturnRequestId,
  });

  factory FarmerReturnEligibility.fromJson(Map<String, Object?> json) =>
      FarmerReturnEligibility(
        productOrderId: _string(json['productOrderId']),
        orderNumber: _string(json['orderNumber']),
        eligible: _bool(json['eligible']),
        reason: _nullableString(json['reason']),
        windowExpiresAt: _nullableDate(json['windowExpiresAt']),
        existingReturnRequestId: _nullableString(
          json['existingReturnRequestId'],
        ),
        items: _list(json['items'])
            .map((item) => FarmerReturnEligibleItem.fromJson(_map(item)))
            .toList(growable: false),
      );

  final String productOrderId;
  final String orderNumber;
  final bool eligible;
  final String? reason;
  final DateTime? windowExpiresAt;
  final String? existingReturnRequestId;
  final List<FarmerReturnEligibleItem> items;
}

class FarmerReturnEligibleItem {
  const FarmerReturnEligibleItem({
    required this.productOrderItemId,
    required this.productName,
    required this.variantName,
    required this.orderedQuantity,
    required this.unitPricePaise,
  });

  factory FarmerReturnEligibleItem.fromJson(Map<String, Object?> json) =>
      FarmerReturnEligibleItem(
        productOrderItemId: _string(json['productOrderItemId']),
        productName: _string(json['productName']),
        variantName: _string(json['variantName']),
        orderedQuantity: _int(json['orderedQuantity']),
        unitPricePaise: _int(json['unitPricePaise']),
      );

  final String productOrderItemId;
  final String productName;
  final String variantName;
  final int orderedQuantity;
  final int unitPricePaise;
}

class FarmerReturnRequest {
  const FarmerReturnRequest({
    required this.id,
    required this.productOrderId,
    required this.orderNumber,
    required this.sellerName,
    required this.status,
    required this.reasonCode,
    required this.requestedAt,
    required this.windowExpiresAt,
    required this.refundableAmountPaise,
    required this.items,
    required this.statusHistory,
    required this.createdAt,
    required this.updatedAt,
    this.reasonNote,
    this.approvedRefundAmountPaise,
    this.inspectedAt,
    this.inspectionNote,
    this.refunds = const [],
  });

  factory FarmerReturnRequest.fromJson(Map<String, Object?> json) =>
      FarmerReturnRequest(
        id: _string(json['id']),
        productOrderId: _string(json['productOrderId']),
        orderNumber: _string(json['orderNumber']),
        sellerName: _string(json['sellerName']),
        status: _string(json['status']),
        reasonCode: _string(json['reasonCode']),
        reasonNote: _nullableString(json['reasonNote']),
        requestedAt: _date(json['requestedAt']),
        windowExpiresAt: _date(json['windowExpiresAt']),
        refundableAmountPaise: _int(json['refundableAmountPaise']),
        approvedRefundAmountPaise: _nullableInt(
          json['approvedRefundAmountPaise'],
        ),
        inspectedAt: _nullableDate(json['inspectedAt']),
        inspectionNote: _nullableString(json['inspectionNote']),
        items: _list(json['items'])
            .map((item) => FarmerReturnItem.fromJson(_map(item)))
            .toList(growable: false),
        statusHistory: _list(json['statusHistory'])
            .map((item) => FarmerReturnStatusHistory.fromJson(_map(item)))
            .toList(growable: false),
        refunds: _list(json['refunds'] ?? const <Object?>[])
            .map((item) => FarmerRefundSummary.fromJson(_map(item)))
            .toList(growable: false),
        createdAt: _date(json['createdAt']),
        updatedAt: _date(json['updatedAt']),
      );

  final String id;
  final String productOrderId;
  final String orderNumber;
  final String sellerName;
  final String status;
  final String reasonCode;
  final String? reasonNote;
  final DateTime requestedAt;
  final DateTime windowExpiresAt;
  final int refundableAmountPaise;
  final int? approvedRefundAmountPaise;
  final DateTime? inspectedAt;
  final String? inspectionNote;
  final List<FarmerReturnItem> items;
  final List<FarmerReturnStatusHistory> statusHistory;
  final List<FarmerRefundSummary> refunds;
  final DateTime createdAt;
  final DateTime updatedAt;
}

class FarmerRefundSummary {
  const FarmerRefundSummary({
    required this.id,
    required this.amountPaise,
    required this.method,
    required this.status,
    required this.providerMode,
    required this.initiatedAt,
    this.providerRefundReference,
    this.failureReason,
    this.completedAt,
  });

  factory FarmerRefundSummary.fromJson(Map<String, Object?> json) =>
      FarmerRefundSummary(
        id: _string(json['id']),
        amountPaise: _int(json['amountPaise']),
        method: _string(json['method']),
        status: _string(json['status']),
        providerMode: _string(json['providerMode']),
        providerRefundReference: _nullableString(
          json['providerRefundReference'],
        ),
        failureReason: _nullableString(json['failureReason']),
        initiatedAt: _date(json['initiatedAt']),
        completedAt: _nullableDate(json['completedAt']),
      );

  final String id;
  final int amountPaise;
  final String method;
  final String status;
  final String providerMode;
  final String? providerRefundReference;
  final String? failureReason;
  final DateTime initiatedAt;
  final DateTime? completedAt;
}

class FarmerReturnItem {
  const FarmerReturnItem({
    required this.id,
    required this.productOrderItemId,
    required this.productName,
    required this.variantName,
    required this.quantity,
    required this.unitPricePaise,
    required this.lineRefundPaise,
  });

  factory FarmerReturnItem.fromJson(Map<String, Object?> json) =>
      FarmerReturnItem(
        id: _string(json['id']),
        productOrderItemId: _string(json['productOrderItemId']),
        productName: _string(json['productName']),
        variantName: _string(json['variantName']),
        quantity: _int(json['quantity']),
        unitPricePaise: _int(json['unitPricePaise']),
        lineRefundPaise: _int(json['lineRefundPaise']),
      );

  final String id;
  final String productOrderItemId;
  final String productName;
  final String variantName;
  final int quantity;
  final int unitPricePaise;
  final int lineRefundPaise;
}

class FarmerReturnStatusHistory {
  const FarmerReturnStatusHistory({
    required this.id,
    required this.toStatus,
    required this.createdAt,
    this.fromStatus,
    this.reason,
  });

  factory FarmerReturnStatusHistory.fromJson(Map<String, Object?> json) =>
      FarmerReturnStatusHistory(
        id: _string(json['id']),
        fromStatus: _nullableString(json['fromStatus']),
        toStatus: _string(json['toStatus']),
        reason: _nullableString(json['reason']),
        createdAt: _date(json['createdAt']),
      );

  final String id;
  final String? fromStatus;
  final String toStatus;
  final String? reason;
  final DateTime createdAt;
}

Map<String, Object?> _map(Object? value) {
  if (value is Map) return value.cast<String, Object?>();
  throw const FormatException('Expected an object.');
}

List<Object?> _list(Object? value) {
  if (value is List) return value.cast<Object?>();
  throw const FormatException('Expected a list.');
}

String _string(Object? value) {
  if (value is String) return value;
  throw const FormatException('Expected a string.');
}

String? _nullableString(Object? value) {
  if (value == null || value is String) return value as String?;
  throw const FormatException('Expected a nullable string.');
}

int _int(Object? value) {
  if (value is int) return value;
  throw const FormatException('Expected an integer.');
}

int? _nullableInt(Object? value) {
  if (value == null || value is int) return value as int?;
  throw const FormatException('Expected a nullable integer.');
}

bool _bool(Object? value) {
  if (value is bool) return value;
  throw const FormatException('Expected a boolean.');
}

DateTime _date(Object? value) => DateTime.parse(_string(value)).toUtc();

DateTime? _nullableDate(Object? value) =>
    value == null ? null : DateTime.parse(_string(value)).toUtc();
