class PromoterTerritoryAssignment {
  const PromoterTerritoryAssignment({
    required this.assigned,
    required this.promoterUserId,
    required this.promoterOrganisationId,
    this.territory,
  });

  factory PromoterTerritoryAssignment.fromJson(Map<String, Object?> json) {
    final territoryJson = json['territory'];
    return PromoterTerritoryAssignment(
      assigned: json['assigned'] as bool,
      promoterUserId: json['promoterUserId'] as String,
      promoterOrganisationId: json['promoterOrganisationId'] as String,
      territory: territoryJson is Map
          ? PromoterTerritory.fromJson(territoryJson.cast<String, Object?>())
          : null,
    );
  }

  final bool assigned;
  final String promoterUserId;
  final String promoterOrganisationId;
  final PromoterTerritory? territory;
}

class PromoterTerritory {
  const PromoterTerritory({
    required this.id,
    required this.name,
    required this.state,
    required this.district,
    required this.blocks,
    required this.pincodes,
    required this.villages,
    required this.status,
  });

  factory PromoterTerritory.fromJson(Map<String, Object?> json) =>
      PromoterTerritory(
        id: json['id'] as String,
        name: json['name'] as String,
        state: json['state'] as String,
        district: json['district'] as String,
        blocks: (json['blocks'] as List).cast<String>(),
        pincodes: (json['pincodes'] as List).cast<String>(),
        villages: (json['villages'] as List).cast<String>(),
        status: json['status'] as String,
      );

  final String id;
  final String name;
  final String state;
  final String district;
  final List<String> blocks;
  final List<String> pincodes;
  final List<String> villages;
  final String status;
}
