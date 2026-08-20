class FarmerInvoiceDocument {
  const FarmerInvoiceDocument({
    required this.id,
    required this.productInvoiceId,
    required this.status,
    required this.attemptCount,
    required this.createdAt,
    required this.updatedAt,
    this.fileId,
    this.checksumSha256,
    this.lastError,
    this.generatedAt,
  });

  factory FarmerInvoiceDocument.fromJson(Map<String, Object?> json) =>
      FarmerInvoiceDocument(
        id: _requiredString(json, 'id'),
        productInvoiceId: _requiredString(json, 'productInvoiceId'),
        status: _requiredString(json, 'status'),
        fileId: _nullableString(json, 'fileId'),
        checksumSha256: _nullableString(json, 'checksumSha256'),
        attemptCount: _requiredInteger(json, 'attemptCount'),
        lastError: _nullableString(json, 'lastError'),
        generatedAt: _nullableDateTime(json, 'generatedAt'),
        createdAt: _requiredDateTime(json, 'createdAt'),
        updatedAt: _requiredDateTime(json, 'updatedAt'),
      );

  final String id;
  final String productInvoiceId;
  final String status;
  final String? fileId;
  final String? checksumSha256;
  final int attemptCount;
  final String? lastError;
  final DateTime? generatedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isAvailable => status == 'AVAILABLE' && fileId != null;
}

class FarmerInvoiceDownload {
  const FarmerInvoiceDownload({
    required this.downloadUri,
    required this.expiresAt,
  });

  factory FarmerInvoiceDownload.fromJson(Map<String, Object?> json) {
    final uri = Uri.tryParse(_requiredString(json, 'downloadUrl'));
    if (uri == null ||
        !uri.hasAuthority ||
        (uri.scheme != 'http' && uri.scheme != 'https')) {
      throw const FormatException('Expected downloadUrl to be an HTTP(S) URL.');
    }
    return FarmerInvoiceDownload(
      downloadUri: uri,
      expiresAt: _requiredDateTime(json, 'expiresAt'),
    );
  }

  final Uri downloadUri;
  final DateTime expiresAt;
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is String && value.isNotEmpty) return value;
  throw FormatException('Expected $key to be a non-empty string.');
}

String? _nullableString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is String) return value;
  throw FormatException('Expected $key to be a string or null.');
}

int _requiredInteger(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is int) return value;
  throw FormatException('Expected $key to be an integer.');
}

DateTime _requiredDateTime(Map<String, Object?> json, String key) {
  final value = DateTime.tryParse(_requiredString(json, key));
  if (value != null) return value.toUtc();
  throw FormatException('Expected $key to be an ISO-8601 timestamp.');
}

DateTime? _nullableDateTime(Map<String, Object?> json, String key) {
  if (json[key] == null) return null;
  return _requiredDateTime(json, key);
}
