import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';
import 'package:vardhnam_farmer_mobile/src/support/farmer_support_repository.dart';
import 'package:vardhnam_farmer_mobile/src/support/farmer_support_ticket.dart';

void main() {
  test('lists only the authenticated farmer ticket endpoint', () async {
    final client = _RecordingApiClient();
    final repository = ApiFarmerSupportRepository(client);

    final page = await repository.listMyTickets(
      page: 2,
      limit: 10,
      status: 'OPEN',
    );

    expect(client.getPaths, [
      '/support/tickets/me?page=2&limit=10&status=OPEN',
    ]);
    expect(page.items.single.subject, 'Order delayed');
    expect(page.items.single.productOrderId, 'order-1');
  });

  test(
    'creates an order-linked ticket and reopens through own endpoint',
    () async {
      final client = _RecordingApiClient();
      final repository = ApiFarmerSupportRepository(client);

      await repository.createTicket(
        const FarmerSupportTicketInput(
          category: 'DELIVERY_ISSUE',
          priority: 'HIGH',
          subject: 'Order delayed',
          description: 'The delivery has not arrived.',
          productOrderId: 'order-1',
        ),
      );
      await repository.reopenTicket(
        'ticket-1',
        'The issue is still happening.',
      );

      expect(client.postPaths, [
        '/support/tickets',
        '/support/tickets/ticket-1/reopen-own',
      ]);
      expect(client.postBodies.first['productOrderId'], 'order-1');
      expect(client.postBodies.last['reason'], 'The issue is still happening.');
    },
  );
}

class _RecordingApiClient implements AuthenticatedApiClient {
  final getPaths = <String>[];
  final postPaths = <String>[];
  final postBodies = <Map<String, Object?>>[];

  @override
  Future<Map<String, Object?>> get(String path) async {
    getPaths.add(path);
    return path.startsWith('/support/tickets/me')
        ? _ticketPageJson
        : _ticketJson;
  }

  @override
  Future<Map<String, Object?>> post(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) async {
    postPaths.add(path);
    postBodies.add(body);
    return path.endsWith('/reopen-own')
        ? {..._ticketJson, 'status': 'REOPENED'}
        : _ticketJson;
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

const _ticketPageJson = <String, Object?>{
  'items': [_ticketJson],
  'page': 1,
  'limit': 20,
  'total': 1,
};

const _ticketJson = <String, Object?>{
  'id': 'ticket-1',
  'raisedByUserId': 'farmer-user-1',
  'raisedByRole': 'FARMER',
  'raiserOrganisationId': 'farmer-context-1',
  'productOrderId': 'order-1',
  'category': 'DELIVERY_ISSUE',
  'priority': 'HIGH',
  'subject': 'Order delayed',
  'description': 'The delivery has not arrived.',
  'status': 'OPEN',
  'assignedToUserId': null,
  'assignedAt': null,
  'slaDueAt': '2026-08-10T08:00:00.000Z',
  'resolutionNote': null,
  'resolvedAt': null,
  'closedAt': null,
  'createdAt': '2026-08-08T08:00:00.000Z',
  'updatedAt': '2026-08-08T08:00:00.000Z',
};
