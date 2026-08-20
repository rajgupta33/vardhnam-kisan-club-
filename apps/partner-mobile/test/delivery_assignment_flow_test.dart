import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';
import 'package:vardhnam_partner_mobile/src/auth/partner_auth_models.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_assignment_models.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_assignment_repository.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_location_proof.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_partner_profile.dart';
import 'package:vardhnam_partner_mobile/src/delivery/delivery_partner_profile_repository.dart';

void main() {
  testWidgets(
    'delivery partner accepts, verifies pickup, starts and OTP-completes assignment',
    (tester) async {
      final repository = _FakeDeliveryRepository();
      final profileRepository = _FakeDeliveryProfileRepository();
      await tester.pumpWidget(
        PartnerApp(
          initialSession: _session,
          deliveryAssignmentRepository: repository,
          deliveryPartnerProfileRepository: profileRepository,
          deliveryLocationProofCollector: _FakeLocationProofCollector(),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(
        profileRepository.availability,
        DeliveryPartnerAvailability.online,
      );

      await tester.tap(find.text('My deliveries'));
      await tester.pumpAndSettle();
      expect(find.text('Order PO-1001'), findsOneWidget);

      await tester.tap(find.text('Order PO-1001'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Asha Devi'), findsOneWidget);
      expect(find.textContaining('Farm road'), findsOneWidget);

      await tester.tap(find.text('Accept assignment'));
      await tester.pumpAndSettle();
      expect(repository.accepted, isTrue);

      final manualEntry = find
          .byKey(const Key('manual-package-code-button'))
          .first;
      await tester.drag(find.byType(ListView).last, const Offset(0, -400));
      await tester.pumpAndSettle();
      await tester.tap(manualEntry);
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField),
        'VARDHNAM-PICKUP:dispatch-1:token',
      );
      await tester.tap(find.text('Verify pickup'));
      await tester.pumpAndSettle();
      expect(repository.pickupCode, 'VARDHNAM-PICKUP:dispatch-1:token');

      final startDelivery = find
          .byKey(const Key('start-delivery-button'))
          .first;
      await tester.drag(find.byType(ListView).last, const Offset(0, -250));
      await tester.pumpAndSettle();
      await tester.tap(startDelivery);
      await tester.pumpAndSettle();
      expect(repository.started, isTrue);

      await tester.tap(find.text('Verify OTP and complete'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, '123456');
      await tester.pump();
      await tester.tap(find.text('Confirm action'));
      await tester.pumpAndSettle();

      expect(repository.completedOtp, '123456');
      expect(
        repository.completedLocationStatus,
        DeliveryProofLocationStatus.unavailable,
      );
      await tester.drag(find.byType(ListView).last, const Offset(0, -400));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Device location was unavailable. OTP completion was not blocked.',
        ),
        findsOneWidget,
      );
    },
  );
}

class _FakeDeliveryProfileRepository
    implements DeliveryPartnerProfileRepository {
  var availability = DeliveryPartnerAvailability.offline;

  @override
  Future<DeliveryPartnerProfile> getMyProfile() async =>
      const DeliveryPartnerProfile(
        userId: 'delivery-user',
        organisationId: 'delivery-organisation',
        availability: DeliveryPartnerAvailability.offline,
      );

  @override
  Future<DeliveryPartnerProfile> updateAvailability(
    DeliveryPartnerAvailability availability,
  ) async {
    this.availability = availability;
    return DeliveryPartnerProfile(
      userId: 'delivery-user',
      organisationId: 'delivery-organisation',
      availability: availability,
    );
  }
}

const _session = PartnerSession(
  accessToken: 'access',
  refreshToken: 'refresh',
  membershipId: 'membership',
  organisationId: 'delivery-organisation',
  role: PartnerRole.deliveryPartner,
  expiresIn: '15m',
);

class _FakeDeliveryRepository implements DeliveryAssignmentRepository {
  var status = DeliveryAssignmentStatus.assigned;
  var accepted = false;
  String? pickupCode;
  var started = false;
  String? completedOtp;
  DeliveryProofLocationStatus? completedLocationStatus;
  DeliveryFailureReason? failedReason;
  DateTime? failedRetryAt;
  var retried = false;

  @override
  Future<DeliveryAssignmentPage> list({int page = 1, int limit = 20}) async =>
      DeliveryAssignmentPage(
        items: [_order(status)],
        page: page,
        limit: limit,
        total: 1,
      );

  @override
  Future<DeliveryOrder> get(String orderId) async => _order(status);

  @override
  Future<DeliveryOrder> accept(String orderId) async {
    accepted = true;
    status = DeliveryAssignmentStatus.accepted;
    return _order(status);
  }

  @override
  Future<DeliveryOrder> reject({
    required String orderId,
    required String reason,
  }) async {
    status = DeliveryAssignmentStatus.rejected;
    return _order(status);
  }

  @override
  Future<DeliveryOrder> verifyPickup({
    required String orderId,
    required String packageQrCode,
  }) async {
    pickupCode = packageQrCode;
    return _order(status, pickupVerified: true);
  }

  @override
  Future<DeliveryOrder> start(String orderId) async {
    started = true;
    status = DeliveryAssignmentStatus.outForDelivery;
    return _order(status);
  }

  @override
  Future<DeliveryOrder> reportFailure({
    required String orderId,
    required DeliveryFailureReason reason,
    required DateTime retryAt,
    String? note,
  }) async {
    failedReason = reason;
    failedRetryAt = retryAt;
    status = DeliveryAssignmentStatus.deliveryFailed;
    return _order(status, retryScheduledAt: retryAt, failureReason: reason);
  }

  @override
  Future<DeliveryOrder> retry(String orderId) async {
    retried = true;
    status = DeliveryAssignmentStatus.outForDelivery;
    return _order(status);
  }

  @override
  Future<DeliveryOrder> complete({
    required String orderId,
    required String otpCode,
    required DeliveryLocationProof locationProof,
    String? proofNote,
  }) async {
    completedOtp = otpCode;
    completedLocationStatus = locationProof.status;
    status = DeliveryAssignmentStatus.delivered;
    return _order(status, proofLocationStatus: locationProof.apiStatus);
  }
}

class _FakeLocationProofCollector implements DeliveryLocationProofCollector {
  @override
  Future<DeliveryLocationProof> collect() async =>
      const DeliveryLocationProof.unavailable();
}

DeliveryOrder _order(
  DeliveryAssignmentStatus status, {
  bool pickupVerified = false,
  String? proofLocationStatus,
  DateTime? retryScheduledAt,
  DeliveryFailureReason? failureReason,
}) => DeliveryOrder(
  id: 'order-1',
  orderNumber: 'PO-1001',
  orderStatus: status == DeliveryAssignmentStatus.delivered
      ? 'DELIVERED'
      : 'READY_FOR_PICKUP',
  sellerName: 'Etah Distributor',
  serviceablePincode: '207247',
  itemCount: 1,
  address: const DeliveryAddress(
    recipientName: 'Asha Devi',
    phone: '9876543210',
    addressLine1: 'Farm road',
    village: 'Aliganj',
    district: 'Etah',
    state: 'Uttar Pradesh',
    pincode: '207247',
  ),
  assignment: DeliveryAssignment(
    id: 'assignment-1',
    number: 'DA-1001',
    status: status,
    dispatchNumber: 'DSP-1001',
    invoiceNumber: 'INV-1001',
    otpExpiresAt: DateTime.utc(2026, 8, 15),
    otpAttemptCount: 0,
    pickupVerificationAttemptCount: 0,
    assignedAt: DateTime.utc(2026, 8, 14),
    pickupVerifiedAt: pickupVerified ? DateTime.utc(2026, 8, 14, 0, 30) : null,
    proofLocationStatus: proofLocationStatus,
    failureAttemptCount: failureReason == null ? 0 : 1,
    lastFailureReason: failureReason,
    retryScheduledAt: retryScheduledAt,
  ),
  items: const [
    DeliveryItem(productName: 'Wheat seed', variantName: '10 kg', quantity: 2),
  ],
);
