import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';
import 'package:vardhnam_farmer_mobile/src/notifications/farmer_notification_repository.dart';

void main() {
  test('uses the owned in-app inbox with backend unread filtering', () async {
    final client = _RecordingApiClient();
    final repository = ApiFarmerNotificationRepository(client);

    final page = await repository.listMyNotifications(
      page: 2,
      limit: 10,
      unreadOnly: true,
    );

    expect(client.getPaths, [
      '/notifications/me?page=2&limit=10&channel=IN_APP&unreadOnly=true',
    ]);
    expect(page.items.single.title, 'Delivery update');
  });

  test('gets and marks only the selected notification resource', () async {
    final client = _RecordingApiClient();
    final repository = ApiFarmerNotificationRepository(client);

    await repository.getNotification('notification 1');
    final notification = await repository.markRead('notification 1');

    expect(client.getPaths, ['/notifications/notification%201']);
    expect(client.postPaths, ['/notifications/notification%201/read']);
    expect(client.postBodies, [<String, Object?>{}]);
    expect(notification.isUnread, isFalse);
  });
}

class _RecordingApiClient implements AuthenticatedApiClient {
  final getPaths = <String>[];
  final postPaths = <String>[];
  final postBodies = <Map<String, Object?>>[];

  @override
  Future<Map<String, Object?>> get(String path) async {
    getPaths.add(path);
    return path.startsWith('/notifications/me')
        ? _notificationPageJson
        : _notificationJson;
  }

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPaths.add(path);
    postBodies.add(body);
    return {..._notificationJson, 'readAt': '2026-08-08T10:05:00.000Z'};
  }

  @override
  Future<Map<String, Object?>> delete(String path) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>?> getOptionalMap(String path) =>
      throw UnimplementedError();

  @override
  Future<List<Object?>> getList(String path) => throw UnimplementedError();

  @override
  Future<Map<String, Object?>> patch(String path, Map<String, Object?> body) =>
      throw UnimplementedError();

  @override
  Future<Map<String, Object?>> put(String path, Map<String, Object?> body) =>
      throw UnimplementedError();
}

const _notificationPageJson = <String, Object?>{
  'items': [_notificationJson],
  'page': 2,
  'limit': 10,
  'total': 11,
};

const _notificationJson = <String, Object?>{
  'id': 'notification-1',
  'category': 'ORDER_UPDATE',
  'title': 'Delivery update',
  'body': 'Your seller order is packed.',
  'status': 'SENT',
  'readAt': null,
  'relatedResourceType': 'ProductOrder',
  'relatedResourceId': 'order-1',
  'createdAt': '2026-08-08T10:00:00.000Z',
};
