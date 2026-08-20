import '../delivery/delivery_location_proof.dart';

enum PromoterVisitPurpose {
  leadFollowUp('LEAD_FOLLOW_UP'),
  farmerSupport('FARMER_SUPPORT'),
  orderAssistance('ORDER_ASSISTANCE'),
  farmSurvey('FARM_SURVEY'),
  complaintFollowUp('COMPLAINT_FOLLOW_UP'),
  other('OTHER');

  const PromoterVisitPurpose(this.apiValue);
  final String apiValue;
}

class PromoterVisit {
  const PromoterVisit({
    required this.id,
    required this.purpose,
    required this.occurredAt,
    required this.locationStatus,
    required this.targetName,
    this.notes,
  });

  factory PromoterVisit.fromJson(Map<String, Object?> json) {
    final lead = json['farmerLead'] as Map?;
    final farmer = json['farmerProfile'] as Map?;
    return PromoterVisit(
      id: json['id']! as String,
      purpose: PromoterVisitPurpose.values.firstWhere(
        (value) => value.apiValue == json['purpose'],
      ),
      occurredAt: DateTime.parse(json['occurredAt']! as String).toUtc(),
      locationStatus: json['locationStatus']! as String,
      targetName:
          (lead?['fullName'] ?? farmer?['fullName'] ?? 'Unknown farmer')
              as String,
      notes: json['notes'] as String?,
    );
  }

  final String id;
  final PromoterVisitPurpose purpose;
  final DateTime occurredAt;
  final String locationStatus;
  final String targetName;
  final String? notes;
}

class PromoterVisitPage {
  const PromoterVisitPage({required this.items, required this.total});

  factory PromoterVisitPage.fromJson(Map<String, Object?> json) =>
      PromoterVisitPage(
        items: (json['items']! as List)
            .map(
              (item) =>
                  PromoterVisit.fromJson((item as Map).cast<String, Object?>()),
            )
            .toList(growable: false),
        total: json['total']! as int,
      );

  final List<PromoterVisit> items;
  final int total;
}

class CreatePromoterVisitInput {
  const CreatePromoterVisitInput({
    required this.purpose,
    required this.occurredAt,
    required this.locationProof,
    this.farmerLeadId,
    this.farmerProfileId,
    this.notes,
  });

  final String? farmerLeadId;
  final String? farmerProfileId;
  final PromoterVisitPurpose purpose;
  final String? notes;
  final DateTime occurredAt;
  final DeliveryLocationProof? locationProof;

  Map<String, Object?> toJson() => {
    if (farmerLeadId != null) 'farmerLeadId': farmerLeadId,
    if (farmerProfileId != null) 'farmerProfileId': farmerProfileId,
    'purpose': purpose.apiValue,
    if (notes?.trim().isNotEmpty ?? false) 'notes': notes!.trim(),
    'occurredAt': occurredAt.toUtc().toIso8601String(),
    'locationStatus': locationProof?.apiStatus ?? 'NOT_REQUESTED',
    if (locationProof?.status == DeliveryProofLocationStatus.granted) ...{
      'latitude': locationProof!.latitude,
      'longitude': locationProof!.longitude,
      'accuracyMetres': locationProof!.accuracyMetres,
      'locationCapturedAt': locationProof!.capturedAt!
          .toUtc()
          .toIso8601String(),
    },
  };
}
