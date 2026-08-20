class FarmerNotificationPage {
  const FarmerNotificationPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory FarmerNotificationPage.fromJson(Map<String, Object?> json) =>
      FarmerNotificationPage(
        items: _list(json, 'items')
            .map((item) => FarmerNotification.fromJson(_object(item)))
            .toList(growable: false),
        page: _integer(json, 'page'),
        limit: _integer(json, 'limit'),
        total: _integer(json, 'total'),
      );

  final List<FarmerNotification> items;
  final int page;
  final int limit;
  final int total;
}

class FarmerNotification {
  const FarmerNotification({
    required this.id,
    required this.category,
    required this.title,
    required this.body,
    required this.status,
    required this.readAt,
    required this.relatedResourceType,
    required this.relatedResourceId,
    required this.createdAt,
  });

  factory FarmerNotification.fromJson(Map<String, Object?> json) =>
      FarmerNotification(
        id: _string(json, 'id'),
        category: _string(json, 'category'),
        title: _string(json, 'title'),
        body: _string(json, 'body'),
        status: _string(json, 'status'),
        readAt: _nullableDateTime(json, 'readAt'),
        relatedResourceType: _nullableString(json, 'relatedResourceType'),
        relatedResourceId: _nullableString(json, 'relatedResourceId'),
        createdAt: _dateTime(json, 'createdAt'),
      );

  final String id;
  final String category;
  final String title;
  final String body;
  final String status;
  final DateTime? readAt;
  final String? relatedResourceType;
  final String? relatedResourceId;
  final DateTime createdAt;

  bool get isUnread => readAt == null;

  FarmerNotification markRead(DateTime value) => FarmerNotification(
    id: id,
    category: category,
    title: title,
    body: body,
    status: status,
    readAt: value,
    relatedResourceType: relatedResourceType,
    relatedResourceId: relatedResourceId,
    createdAt: createdAt,
  );
}

Map<String, Object?> _object(Object? value) {
  if (value is Map) return value.cast<String, Object?>();
  throw const FormatException('Expected notification to be an object.');
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
