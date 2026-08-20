import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/app.dart';
import 'package:vardhnam_farmer_mobile/src/auth/auth_models.dart';
import 'package:vardhnam_farmer_mobile/src/support/farmer_support_repository.dart';
import 'package:vardhnam_farmer_mobile/src/support/farmer_support_ticket.dart';
import 'package:vardhnam_farmer_mobile/src/support/support_contact.dart';

void main() {
  test('builds phone and WhatsApp URIs from configured E.164 numbers', () {
    const configuration = SupportContactConfiguration(
      phone: '+911122334455',
      whatsApp: '+919988776655',
    );

    expect(configuration.phoneUri?.scheme, 'tel');
    expect(configuration.phoneUri?.path, '+911122334455');
    final whatsAppUri = configuration.whatsAppUri('Please help');
    expect(whatsAppUri?.host, 'wa.me');
    expect(whatsAppUri?.path, '/919988776655');
    expect(whatsAppUri?.queryParameters['text'], 'Please help');
  });

  testWidgets('launches configured phone and WhatsApp support actions', (
    tester,
  ) async {
    final launcher = _RecordingLauncher();
    await tester.pumpWidget(
      FarmerApp(
        initialSession: _session,
        initialLocation: '/support',
        farmerSupportRepository: const _EmptySupportRepository(),
        supportContactConfiguration: const SupportContactConfiguration(
          phone: '+911122334455',
          whatsApp: '+919988776655',
        ),
        externalSupportLauncher: launcher,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Call support'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('WhatsApp support'));
    await tester.pumpAndSettle();

    expect(launcher.uris.map((uri) => uri.scheme), ['tel', 'https']);
    expect(launcher.uris.last.host, 'wa.me');
  });

  testWidgets('keeps tickets available when contacts are unconfigured', (
    tester,
  ) async {
    await tester.pumpWidget(
      const FarmerApp(
        initialSession: _session,
        initialLocation: '/support',
        farmerSupportRepository: _EmptySupportRepository(),
        supportContactConfiguration: SupportContactConfiguration(),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.textContaining(
        'Phone and WhatsApp support details are not configured',
      ),
      findsOneWidget,
    );
    expect(find.text('New ticket'), findsOneWidget);
  });

  testWidgets(
    'shows a localized error when the operating system cannot launch',
    (tester) async {
      await tester.pumpWidget(
        FarmerApp(
          initialSession: _session,
          initialLocation: '/support',
          farmerSupportRepository: const _EmptySupportRepository(),
          supportContactConfiguration: const SupportContactConfiguration(
            phone: '+911122334455',
          ),
          externalSupportLauncher: _RecordingLauncher(result: false),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Call support'));
      await tester.pumpAndSettle();

      expect(
        find.text('Could not open the selected support app.'),
        findsOneWidget,
      );
    },
  );
}

class _RecordingLauncher implements ExternalSupportLauncher {
  _RecordingLauncher({this.result = true});

  final bool result;
  final uris = <Uri>[];

  @override
  Future<bool> launch(Uri uri) async {
    uris.add(uri);
    return result;
  }
}

class _EmptySupportRepository implements FarmerSupportRepository {
  const _EmptySupportRepository();

  @override
  Future<FarmerSupportTicketPage> listMyTickets({
    int page = 1,
    int limit = 20,
    String? status,
  }) async => FarmerSupportTicketPage(
    items: const [],
    page: page,
    limit: limit,
    total: 0,
  );

  @override
  Future<FarmerSupportTicket> createTicket(FarmerSupportTicketInput input) =>
      throw UnimplementedError();

  @override
  Future<FarmerSupportTicket> getTicket(String ticketId) =>
      throw UnimplementedError();

  @override
  Future<FarmerSupportTicket> reopenTicket(String ticketId, String reason) =>
      throw UnimplementedError();
}

const _session = AuthSession(
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  membershipId: 'membership-1',
  organisationId: 'organisation-1',
  role: 'FARMER',
  expiresIn: '15m',
);
