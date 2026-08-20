enum EarningsStatus {
  provisional('PROVISIONAL'),
  finalised('FINAL'),
  reversed('REVERSED');

  const EarningsStatus(this.apiValue);
  final String apiValue;

  static EarningsStatus parse(Object? value) => values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => throw const FormatException('Unknown earnings status'),
  );
}

enum EarningsType {
  promoterCommission('PROMOTER_COMMISSION'),
  deliveryFee('DELIVERY_FEE');

  const EarningsType(this.apiValue);
  final String apiValue;

  static EarningsType parse(Object? value) => values.firstWhere(
    (type) => type.apiValue == value,
    orElse: () => throw const FormatException('Unknown recipient earning type'),
  );
}

class EarningsStatementPage {
  const EarningsStatementPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalsByStatus,
  });

  factory EarningsStatementPage.fromJson(Map<String, Object?> json) {
    final totals = <EarningsStatus, int>{};
    for (final item in _list(json['totalsByStatus'])) {
      final row = _map(item);
      totals[EarningsStatus.parse(row['status'])] = _int(row, 'amountPaise');
    }
    return EarningsStatementPage(
      items: _list(json['items'])
          .map((item) => EarningsEntry.fromJson(_map(item)))
          .toList(growable: false),
      page: _int(json, 'page'),
      limit: _int(json, 'limit'),
      total: _int(json, 'total'),
      totalsByStatus: Map.unmodifiable(totals),
    );
  }

  final List<EarningsEntry> items;
  final int page;
  final int limit;
  final int total;
  final Map<EarningsStatus, int> totalsByStatus;
}

class EarningsEntry {
  const EarningsEntry({
    required this.id,
    required this.productOrderId,
    required this.type,
    required this.amountPaise,
    required this.status,
    required this.eligibleAt,
    required this.createdAt,
    this.finalizedAt,
    this.settlementId,
    this.reversalReason,
  });

  factory EarningsEntry.fromJson(Map<String, Object?> json) => EarningsEntry(
    id: _string(json, 'id'),
    productOrderId: _string(json, 'productOrderId'),
    type: EarningsType.parse(json['entryType']),
    amountPaise: _int(json, 'amountPaise'),
    status: EarningsStatus.parse(json['status']),
    eligibleAt: _date(json, 'eligibleAt'),
    createdAt: _date(json, 'createdAt'),
    finalizedAt: _optionalDate(json['finalizedAt']),
    settlementId: json['settlementId'] as String?,
    reversalReason: json['reversalReason'] as String?,
  );

  final String id;
  final String productOrderId;
  final EarningsType type;
  final int amountPaise;
  final EarningsStatus status;
  final DateTime eligibleAt;
  final DateTime createdAt;
  final DateTime? finalizedAt;
  final String? settlementId;
  final String? reversalReason;
}

class PayoutAccountView {
  const PayoutAccountView({
    required this.id,
    required this.accountHolderName,
    required this.bankName,
    required this.maskedAccountNumber,
    required this.ifscCode,
    required this.status,
    this.upiId,
    this.rejectionReason,
  });

  factory PayoutAccountView.fromJson(Map<String, Object?> json) =>
      PayoutAccountView(
        id: _string(json, 'id'),
        accountHolderName: _string(json, 'accountHolderName'),
        bankName: _string(json, 'bankName'),
        maskedAccountNumber: _string(json, 'accountNumber'),
        ifscCode: _string(json, 'ifscCode'),
        upiId: json['upiId'] as String?,
        status: _string(json, 'status'),
        rejectionReason: json['rejectionReason'] as String?,
      );

  final String id;
  final String accountHolderName;
  final String bankName;
  final String maskedAccountNumber;
  final String ifscCode;
  final String? upiId;
  final String status;
  final String? rejectionReason;
}

class PayoutAccountInput {
  const PayoutAccountInput({
    required this.accountHolderName,
    required this.bankName,
    required this.accountNumber,
    required this.ifscCode,
    this.upiId,
  });

  final String accountHolderName;
  final String bankName;
  final String accountNumber;
  final String ifscCode;
  final String? upiId;

  Map<String, Object?> toJson() => {
    'accountHolderName': accountHolderName,
    'bankName': bankName,
    'accountNumber': accountNumber,
    'ifscCode': ifscCode,
    if (upiId != null) 'upiId': upiId,
  };
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
  final value = _optionalDate(json[key]);
  if (value == null) throw FormatException('Expected $key');
  return value;
}

DateTime? _optionalDate(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;
