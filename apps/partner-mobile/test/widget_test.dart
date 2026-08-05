import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_partner_mobile/src/app.dart';

void main() {
  testWidgets('shows partner dashboard title', (tester) async {
    await tester.pumpWidget(const PartnerApp());
    expect(find.text('Partner workspace'), findsOneWidget);
  });
}

