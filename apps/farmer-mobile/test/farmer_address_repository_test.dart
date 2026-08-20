import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/addresses/farmer_address_repository.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test(
    'maps address list and uses farmer-owned create/update endpoints',
    () async {
      final client = _RecordingApiClient();
      final repository = ApiFarmerAddressRepository(client);

      final addresses = await repository.listAddresses();
      final created = await repository.createAddress(_input);
      final updated = await repository.updateAddress('address-1', _input);
      await repository.setDefaultAddress('address-1');

      expect(addresses.single.phone, '+919876543210');
      expect(created.id, 'address-1');
      expect(updated.label, 'Home');
      expect(client.getListPaths, ['/farmers/me/addresses']);
      expect(client.postPaths, ['/farmers/me/addresses']);
      expect(client.patchPaths, [
        '/farmers/me/addresses/address-1',
        '/farmers/me/addresses/address-1',
      ]);
      expect(client.postBodies.single['pincode'], '302001');
      expect(client.patchBodies.last, {'isDefault': true});
    },
  );

  test(
    'serializes nullable address fields explicitly for backend clearing',
    () {
      final json = _input.toJson();

      expect(json['addressLine2'], isNull);
      expect(json['village'], isNull);
      expect(json['district'], isNull);
      expect(json['landmark'], isNull);
      expect(json['isDefault'], isTrue);
    },
  );
}

class _RecordingApiClient implements AuthenticatedApiClient {
  final getListPaths = <String>[];
  final postPaths = <String>[];
  final postBodies = <Map<String, Object?>>[];
  final patchPaths = <String>[];
  final patchBodies = <Map<String, Object?>>[];

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> get(String path) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) =>
      throw UnimplementedError();

  @override
  Future<List<Object?>> getList(String path) async {
    getListPaths.add(path);
    return [_addressJson];
  }

  @override
  Future<Map<String, Object?>> patch(
    String path,
    Map<String, Object?> body,
  ) async {
    patchPaths.add(path);
    patchBodies.add(body);
    return {..._addressJson, ...body};
  }

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPaths.add(path);
    postBodies.add(body);
    return {..._addressJson, ...body};
  }

  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _input = FarmerAddressInput(
  label: 'Home',
  recipientName: 'Test Farmer',
  phone: '+919876543210',
  addressLine1: 'Farm road',
  city: 'Jaipur',
  state: 'Rajasthan',
  pincode: '302001',
  isDefault: true,
);

const _addressJson = <String, Object?>{
  'id': 'address-1',
  'label': 'Home',
  'recipientName': 'Test Farmer',
  'phone': '+919876543210',
  'addressLine1': 'Farm road',
  'addressLine2': null,
  'village': null,
  'city': 'Jaipur',
  'district': null,
  'state': 'Rajasthan',
  'pincode': '302001',
  'landmark': null,
  'isDefault': true,
};
