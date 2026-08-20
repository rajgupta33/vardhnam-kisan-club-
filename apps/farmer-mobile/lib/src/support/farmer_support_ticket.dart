class FarmerSupportTicketPage {
  const FarmerSupportTicketPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory FarmerSupportTicketPage.fromJson(Map<String, Object?> json) =>
      FarmerSupportTicketPage(
        items: _list(json, 'items')
            .map(
              (item) => FarmerSupportTicket.fromJson(_object(item, 'ticket')),
            )
            .toList(growable: false),
        page: _integer(json, 'page'),
        limit: _integer(json, 'limit'),
        total: _integer(json, 'total'),
      );

  final List<FarmerSupportTicket> items;
  final int page;
  final int limit;
  final int total;
}

class FarmerSupportTicket {
  const FarmerSupportTicket({
    required this.id,
    required this.productOrderId,
    required this.category,
    required this.priority,
    required this.subject,
    required this.description,
    required this.status,
    required this.slaDueAt,
    required this.resolutionNote,
    required this.resolvedAt,
    required this.closedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory FarmerSupportTicket.fromJson(Map<String, Object?> json) =>
      FarmerSupportTicket(
        id: _string(json, 'id'),
        productOrderId: _nullableString(json, 'productOrderId'),
        category: _string(json, 'category'),
        priority: _string(json, 'priority'),
        subject: _string(json, 'subject'),
        description: _string(json, 'description'),
        status: _string(json, 'status'),
        slaDueAt: _dateTime(json, 'slaDueAt'),
        resolutionNote: _nullableString(json, 'resolutionNote'),
        resolvedAt: _nullableDateTime(json, 'resolvedAt'),
        closedAt: _nullableDateTime(json, 'closedAt'),
        createdAt: _dateTime(json, 'createdAt'),
        updatedAt: _dateTime(json, 'updatedAt'),
      );

  final String id;
  final String? productOrderId;
  final String category;
  final String priority;
  final String subject;
  final String description;
  final String status;
  final DateTime slaDueAt;
  final String? resolutionNote;
  final DateTime? resolvedAt;
  final DateTime? closedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get canReopen => status == 'RESOLVED' || status == 'CLOSED';
}

class FarmerSupportTicketInput {
  const FarmerSupportTicketInput({
    required this.category,
    required this.priority,
    required this.subject,
    required this.description,
    this.productOrderId,
  });

  final String category;
  final String priority;
  final String subject;
  final String description;
  final String? productOrderId;
}

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

DateTime _dateTime(Map<String, Object?> json, String key) =>
    DateTime.parse(_string(json, key)).toUtc();

DateTime? _nullableDateTime(Map<String, Object?> json, String key) {
  final value = _nullableString(json, key);
  return value == null ? null : DateTime.parse(value).toUtc();
}
