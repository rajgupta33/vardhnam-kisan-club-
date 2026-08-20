import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/authenticated_api_client.dart';
import 'farmer_support_ticket.dart';

final farmerSupportRepositoryProvider = Provider<FarmerSupportRepository>(
  (ref) =>
      ApiFarmerSupportRepository(ref.watch(authenticatedApiClientProvider)),
);

abstract interface class FarmerSupportRepository {
  Future<FarmerSupportTicketPage> listMyTickets({
    int page = 1,
    int limit = 20,
    String? status,
  });

  Future<FarmerSupportTicket> getTicket(String ticketId);

  Future<FarmerSupportTicket> createTicket(FarmerSupportTicketInput input);

  Future<FarmerSupportTicket> reopenTicket(String ticketId, String reason);
}

class ApiFarmerSupportRepository implements FarmerSupportRepository {
  const ApiFarmerSupportRepository(this._client);

  final AuthenticatedApiClient _client;

  @override
  Future<FarmerSupportTicketPage> listMyTickets({
    int page = 1,
    int limit = 20,
    String? status,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'limit': '$limit',
      if (status != null) 'status': status,
    };
    return FarmerSupportTicketPage.fromJson(
      await _client.get(
        Uri(path: '/support/tickets/me', queryParameters: query).toString(),
      ),
    );
  }

  @override
  Future<FarmerSupportTicket> getTicket(String ticketId) async =>
      FarmerSupportTicket.fromJson(
        await _client.get('/support/tickets/${Uri.encodeComponent(ticketId)}'),
      );

  @override
  Future<FarmerSupportTicket> createTicket(
    FarmerSupportTicketInput input,
  ) async => FarmerSupportTicket.fromJson(
    await _client.post('/support/tickets', {
      'category': input.category,
      'priority': input.priority,
      'subject': input.subject,
      'description': input.description,
      if (input.productOrderId != null) 'productOrderId': input.productOrderId,
    }),
  );

  @override
  Future<FarmerSupportTicket> reopenTicket(
    String ticketId,
    String reason,
  ) async => FarmerSupportTicket.fromJson(
    await _client.post(
      '/support/tickets/${Uri.encodeComponent(ticketId)}/reopen-own',
      {'reason': reason},
    ),
  );
}
