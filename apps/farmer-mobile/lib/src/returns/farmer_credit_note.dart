import '../orders/farmer_invoice_document.dart';

class FarmerCreditNote {
  const FarmerCreditNote({
    required this.id,
    required this.refundId,
    required this.creditNoteNumber,
    required this.grossCreditPaise,
    required this.farmerRefundPaise,
    required this.subsidyReversalPaise,
    required this.taxableAmountPaise,
    required this.taxPaise,
    required this.originalInvoiceNumber,
    required this.originalInvoiceDate,
    required this.reason,
    required this.issuedAt,
    this.document,
  });

  factory FarmerCreditNote.fromJson(Map<String, Object?> json) =>
      FarmerCreditNote(
        id: _requiredString(json, 'id'),
        refundId: _requiredString(json, 'refundId'),
        creditNoteNumber: _requiredString(json, 'creditNoteNumber'),
        grossCreditPaise: _requiredInteger(json, 'grossCreditPaise'),
        farmerRefundPaise: _requiredInteger(json, 'farmerRefundPaise'),
        subsidyReversalPaise: _requiredInteger(json, 'subsidyReversalPaise'),
        taxableAmountPaise: _requiredInteger(json, 'taxableAmountPaise'),
        taxPaise: _requiredInteger(json, 'taxPaise'),
        originalInvoiceNumber: _requiredString(json, 'originalInvoiceNumber'),
        originalInvoiceDate: _requiredDateTime(json, 'originalInvoiceDate'),
        reason: _requiredString(json, 'reasonSnapshot'),
        issuedAt: _requiredDateTime(json, 'issuedAt'),
        document: json['document'] == null
            ? null
            : FarmerCreditNoteDocument.fromJson(
                _requiredMap(json['document'], 'document'),
              ),
      );

  final String id;
  final String refundId;
  final String creditNoteNumber;
  final int grossCreditPaise;
  final int farmerRefundPaise;
  final int subsidyReversalPaise;
  final int taxableAmountPaise;
  final int taxPaise;
  final String originalInvoiceNumber;
  final DateTime originalInvoiceDate;
  final String reason;
  final DateTime issuedAt;
  final FarmerCreditNoteDocument? document;
}

class FarmerCreditNoteDocument {
  const FarmerCreditNoteDocument({
    required this.id,
    required this.status,
    required this.attemptCount,
    this.fileId,
    this.checksumSha256,
    this.lastError,
    this.generatedAt,
  });

  factory FarmerCreditNoteDocument.fromJson(Map<String, Object?> json) =>
      FarmerCreditNoteDocument(
        id: _requiredString(json, 'id'),
        status: _requiredString(json, 'status'),
        fileId: _nullableString(json, 'fileId'),
        checksumSha256: _nullableString(json, 'checksumSha256'),
        attemptCount: _requiredInteger(json, 'attemptCount'),
        lastError: _nullableString(json, 'lastError'),
        generatedAt: _nullableDateTime(json, 'generatedAt'),
      );

  final String id;
  final String status;
  final String? fileId;
  final String? checksumSha256;
  final int attemptCount;
  final String? lastError;
  final DateTime? generatedAt;

  bool get isAvailable => status == 'AVAILABLE' && fileId != null;
}

typedef FarmerCreditNoteDownload = FarmerInvoiceDownload;

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

Map<String, Object?> _requiredMap(Object? value, String label) {
  if (value is Map) return value.cast<String, Object?>();
  throw FormatException('Expected $label to be an object.');
}
