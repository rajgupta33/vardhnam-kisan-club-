import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';
import 'farmer_notification.dart';

final farmerNotificationRepositoryProvider =
    Provider<FarmerNotificationRepository>(
      (ref) => ApiFarmerNotificationRepository(
        ref.watch(authenticatedApiClientProvider),
      ),
    );

abstract interface class FarmerNotificationRepository {
  Future<FarmerNotificationPage> listMyNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  });

  Future<FarmerNotification> getNotification(String notificationId);

  Future<FarmerNotification> markRead(String notificationId);
}

class ApiFarmerNotificationRepository implements FarmerNotificationRepository {
  const ApiFarmerNotificationRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<FarmerNotificationPage> listMyNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async => FarmerNotificationPage.fromJson(
    await _client.get(
      Uri(
        path: '/notifications/me',
        queryParameters: {
          'page': '$page',
          'limit': '$limit',
          'channel': 'IN_APP',
          if (unreadOnly) 'unreadOnly': 'true',
        },
      ).toString(),
    ),
  );

  @override
  Future<FarmerNotification> getNotification(String notificationId) async =>
      FarmerNotification.fromJson(
        await _client.get(
          '/notifications/${Uri.encodeComponent(notificationId)}',
        ),
      );

  @override
  Future<FarmerNotification> markRead(String notificationId) async =>
      FarmerNotification.fromJson(
        await _client.post(
          '/notifications/${Uri.encodeComponent(notificationId)}/read',
          const {},
        ),
      );
}
