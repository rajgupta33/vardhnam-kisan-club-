import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';
import '../profile/farmer_profile.dart';

final farmerAddressRepositoryProvider = Provider<FarmerAddressRepository>(
  (ref) =>
      ApiFarmerAddressRepository(ref.watch(authenticatedApiClientProvider)),
);

abstract interface class FarmerAddressRepository {
  Future<List<FarmerAddress>> listAddresses();

  Future<FarmerAddress> createAddress(FarmerAddressInput input);

  Future<FarmerAddress> updateAddress(
    String addressId,
    FarmerAddressInput input,
  );

  Future<FarmerAddress> setDefaultAddress(String addressId);
}

class ApiFarmerAddressRepository implements FarmerAddressRepository {
  const ApiFarmerAddressRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<List<FarmerAddress>> listAddresses() async {
    final rawItems = await _client.getList('/farmers/me/addresses');
    return rawItems
        .map((item) {
          if (item is! Map) {
            throw const FormatException('Farmer address must be an object.');
          }
          return FarmerAddress.fromJson(item.cast<String, Object?>());
        })
        .toList(growable: false);
  }

  @override
  Future<FarmerAddress> createAddress(FarmerAddressInput input) async =>
      FarmerAddress.fromJson(
        await _client.post('/farmers/me/addresses', input.toJson()),
      );

  @override
  Future<FarmerAddress> updateAddress(
    String addressId,
    FarmerAddressInput input,
  ) async => FarmerAddress.fromJson(
    await _client.patch(
      '/farmers/me/addresses/${Uri.encodeComponent(addressId)}',
      input.toJson(),
    ),
  );

  @override
  Future<FarmerAddress> setDefaultAddress(String addressId) async =>
      FarmerAddress.fromJson(
        await _client.patch(
          '/farmers/me/addresses/${Uri.encodeComponent(addressId)}',
          const {'isDefault': true},
        ),
      );
}

class FarmerAddressInput {
  const FarmerAddressInput({
    required this.label,
    required this.recipientName,
    required this.phone,
    required this.addressLine1,
    required this.city,
    required this.state,
    required this.pincode,
    required this.isDefault,
    this.addressLine2,
    this.village,
    this.district,
    this.landmark,
  });

  final String label;
  final String recipientName;
  final String phone;
  final String addressLine1;
  final String? addressLine2;
  final String? village;
  final String city;
  final String? district;
  final String state;
  final String pincode;
  final String? landmark;
  final bool isDefault;

  Map<String, Object?> toJson() => {
    'label': label,
    'recipientName': recipientName,
    'phone': phone,
    'addressLine1': addressLine1,
    'addressLine2': addressLine2,
    'village': village,
    'city': city,
    'district': district,
    'state': state,
    'pincode': pincode,
    'landmark': landmark,
    'isDefault': isDefault,
  };
}
