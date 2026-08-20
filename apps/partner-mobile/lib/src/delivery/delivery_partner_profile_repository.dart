import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/partner_api_client.dart';
import 'delivery_partner_profile.dart';

final deliveryPartnerProfileRepositoryProvider =
    Provider<DeliveryPartnerProfileRepository>((ref) {
      return ApiDeliveryPartnerProfileRepository(
        ref.read(partnerApiClientProvider),
      );
    });

abstract interface class DeliveryPartnerProfileRepository {
  Future<DeliveryPartnerProfile> getMyProfile();
  Future<DeliveryPartnerProfile> updateAvailability(
    DeliveryPartnerAvailability availability,
  );
}

class ApiDeliveryPartnerProfileRepository
    implements DeliveryPartnerProfileRepository {
  ApiDeliveryPartnerProfileRepository(this._client);
  final PartnerApiClient _client;

  @override
  Future<DeliveryPartnerProfile> getMyProfile() async =>
      DeliveryPartnerProfile.fromJson(
        await _client.get('/delivery-partners/me'),
      );

  @override
  Future<DeliveryPartnerProfile> updateAvailability(
    DeliveryPartnerAvailability availability,
  ) async => DeliveryPartnerProfile.fromJson(
    await _client.put('/delivery-partners/me/availability', {
      'availabilityStatus': availability.apiValue,
    }),
  );
}
