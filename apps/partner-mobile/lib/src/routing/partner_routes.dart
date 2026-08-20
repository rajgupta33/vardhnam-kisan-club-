import '../auth/partner_auth_models.dart';

abstract final class PartnerRoutes {
  static const login = '/login';
  static const promoter = '/promoter';
  static const salesPartner = '/sales-partner';
  static const serviceProvider = '/service-provider';
  static const deliveryPartner = '/delivery-partner';
  static const deliveryAssignments = '/delivery-partner/assignments';
  static const deliveryAssignmentDetail =
      '/delivery-partner/assignments/:orderId';
  static const returnPickups = '/delivery-partner/return-pickups';
  static const returnPickupDetail =
      '/delivery-partner/return-pickups/:assignmentId';
  static const kisanClub = '/kisan-club';
  static const kisanClubFarmer = '/kisan-club/farmers/:membershipId';
  static const kisanClubRedeem = '/kisan-club/farmers/:membershipId/redeem';
  static const kisanClubSurvey = '/kisan-club/farmers/:membershipId/survey';
  static const kisanClubFulfilment = '/kisan-club/fulfilment';
  static const kisanClubEarnings = '/kisan-club/earnings';
  static const earnings = '/earnings';
  static const payoutAccount = '/payout-account';
  static const farmerLeads = '/promoter/leads';
  static const createFarmerLead = '/promoter/leads/new';
  static const promoterTerritory = '/promoter/territory';
  static const promoterSurvey = '/promoter/survey';
  static const promoterVisits = '/promoter/visits';
  static const recordPromoterVisit = '/promoter/visits/new';
  static const kisanClubFulfilmentDetail =
      '/kisan-club/fulfilment/:assignmentId';

  static String forRole(PartnerRole role) => switch (role) {
    PartnerRole.promoter => promoter,
    PartnerRole.salesPartner => salesPartner,
    PartnerRole.serviceProvider => serviceProvider,
    PartnerRole.deliveryPartner => deliveryPartner,
  };

  static String farmer(String membershipId) =>
      '/kisan-club/farmers/$membershipId';

  static String redeemForFarmer(String membershipId) =>
      '/kisan-club/farmers/$membershipId/redeem';

  static String surveyForFarmer(String membershipId) =>
      '/kisan-club/farmers/$membershipId/survey';

  static String fulfilment(String assignmentId) =>
      '/kisan-club/fulfilment/$assignmentId';

  static String delivery(String orderId) =>
      '/delivery-partner/assignments/$orderId';

  static String returnPickup(String assignmentId) =>
      '/delivery-partner/return-pickups/$assignmentId';
}
