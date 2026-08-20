import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

enum DeliveryProofLocationStatus { granted, denied, unavailable }

class DeliveryLocationProof {
  const DeliveryLocationProof._({
    required this.status,
    this.latitude,
    this.longitude,
    this.accuracyMetres,
    this.capturedAt,
  });
  const DeliveryLocationProof.denied()
    : this._(status: DeliveryProofLocationStatus.denied);
  const DeliveryLocationProof.unavailable()
    : this._(status: DeliveryProofLocationStatus.unavailable);
  const DeliveryLocationProof.granted({
    required double latitude,
    required double longitude,
    required double accuracyMetres,
    required DateTime capturedAt,
  }) : this._(
         status: DeliveryProofLocationStatus.granted,
         latitude: latitude,
         longitude: longitude,
         accuracyMetres: accuracyMetres,
         capturedAt: capturedAt,
       );

  final DeliveryProofLocationStatus status;
  final double? latitude;
  final double? longitude;
  final double? accuracyMetres;
  final DateTime? capturedAt;
  String get apiStatus => status.name.toUpperCase();
}

final deliveryLocationProofCollectorProvider =
    Provider<DeliveryLocationProofCollector>(
      (ref) => const GeolocatorDeliveryLocationProofCollector(),
    );

abstract interface class DeliveryLocationProofCollector {
  Future<DeliveryLocationProof> collect();
}

class GeolocatorDeliveryLocationProofCollector
    implements DeliveryLocationProofCollector {
  const GeolocatorDeliveryLocationProofCollector();

  @override
  Future<DeliveryLocationProof> collect() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return const DeliveryLocationProof.unavailable();
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return const DeliveryLocationProof.denied();
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      return DeliveryLocationProof.granted(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMetres: position.accuracy,
        capturedAt: position.timestamp,
      );
    } catch (_) {
      return const DeliveryLocationProof.unavailable();
    }
  }
}
