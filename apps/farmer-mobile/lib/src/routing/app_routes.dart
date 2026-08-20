abstract final class AppRoutes {
  static const dashboard = '/';
  static const language = '/language';
  static const login = '/login';
  static const browse = '/browse';
  static const productDetail = '/products/:productId';
  static const cart = '/cart';
  static const checkout = '/checkout';
  static const orders = '/orders';
  static const orderDetail = '/orders/:orderId';
  static const newReturnRequest = '/orders/:orderId/return';
  static const returns = '/returns';
  static const returnRequestDetail = '/returns/:returnRequestId';
  static const profile = '/profile';
  static const addresses = '/profile/addresses';
  static const support = '/support';
  static const newSupportTicket = '/support/new';
  static const supportTicketDetail = '/support/:ticketId';
  static const notifications = '/notifications';
  static const notificationDetail = '/notifications/:notificationId';
  static const kisanClub = '/kisan-club';
  static const kisanClubJoin = '/kisan-club/join';
  static const kisanClubCatalogue = '/kisan-club/products';
  static const kisanClubProductDetail = '/kisan-club/products/:productId';
  static const kisanClubBenefits = '/kisan-club/benefits';
  static const farms = '/kisan-club/farms';
  static const kisanClubProfileCompletion = '/kisan-club/profile-completion';
  static const myPromoter = '/kisan-club/promoter';
  static const cropActivity = '/kisan-club/crops/:cycleId/activities';
  static const advisories = '/kisan-club/advisory';
  static const advisoryDetail = '/kisan-club/advisory/:advisoryId';
  static const cropDoctor = '/kisan-club/crop-doctor';

  static String myFarms(String pincode) => '$farms?pincode=$pincode';

  static String completeKisanClubProfile(String pincode) =>
      '$kisanClubProfileCompletion?pincode=$pincode';

  static String cropDiary(
    String farmId,
    String cycleId,
    String cropName,
    String status,
  ) => Uri(
    path: '/kisan-club/crops/$cycleId/activities',
    queryParameters: {'farmId': farmId, 'cropName': cropName, 'status': status},
  ).toString();

  static String product(String productId, String pincode) =>
      '/products/$productId?pincode=$pincode';

  static String kisanClubProducts(String pincode) =>
      '$kisanClubCatalogue?pincode=$pincode';

  static String kisanClubProduct(String productId, String pincode) =>
      '/kisan-club/products/$productId?pincode=$pincode';

  static String order(String orderId) => '/orders/$orderId';

  static String returnForOrder(String orderId) => '/orders/$orderId/return';

  static String returnRequest(String returnRequestId) =>
      '/returns/$returnRequestId';

  static String newSupportTicketForOrder(String orderId) =>
      '$newSupportTicket?orderId=$orderId';

  static String supportTicket(String ticketId) => '/support/$ticketId';

  static String notification(String notificationId) =>
      '/notifications/$notificationId';

  static String advisory(String advisoryId) =>
      '/kisan-club/advisory/$advisoryId';
}
