import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/kisan_club/kisan_club_benefit_token_repository.dart';
import 'package:vardhnam_farmer_mobile/src/screens/kisan_club_benefits_screen.dart';

void main() {
  testWidgets('filters and loads benefit token history without duplicates', (
    tester,
  ) async {
    final repository = _BenefitTokenRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          kisanClubBenefitTokenRepositoryProvider.overrideWithValue(repository),
        ],
        child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: KisanClubBenefitsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('First token product'), findsOneWidget);
    expect(find.text('Second token product'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.text('Load more tokens'), findsOneWidget);

    await tester.tap(find.text('Load more tokens'));
    await tester.pumpAndSettle();

    expect(find.text('Second token product'), findsOneWidget);
    expect(find.text('Third token product'), findsOneWidget);
    expect(find.text('Load more tokens'), findsNothing);
    expect(repository.calls.map((call) => call.page), [1, 2]);

    await tester.tap(find.text('All token statuses'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Used').last);
    await tester.pumpAndSettle();

    expect(find.text('Redeemed token product'), findsOneWidget);
    expect(find.text('First token product'), findsNothing);
    expect(repository.calls.last.status, KisanClubBenefitTokenStatus.redeemed);
    expect(repository.calls.last.page, 1);
  });
}

class _BenefitTokenRepository implements KisanClubBenefitTokenRepository {
  final calls =
      <({KisanClubBenefitTokenStatus? status, int page, int limit})>[];

  @override
  Future<KisanClubBenefitToken> issue({
    required String offerId,
    required int quantity,
  }) => throw UnimplementedError();

  @override
  Future<KisanClubBenefitTokenPage> list({
    KisanClubBenefitTokenStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    calls.add((status: status, page: page, limit: limit));
    if (status == KisanClubBenefitTokenStatus.redeemed) {
      return KisanClubBenefitTokenPage(
        items: [_token('redeemed', 'Redeemed token product', status: status!)],
        page: 1,
        limit: limit,
        total: 1,
      );
    }
    if (page == 1) {
      return KisanClubBenefitTokenPage(
        items: [
          _token('first', 'First token product'),
          _token('second', 'Second token product'),
        ],
        page: 1,
        limit: limit,
        total: 3,
      );
    }
    return KisanClubBenefitTokenPage(
      items: [
        _token('second', 'Second token product'),
        _token('third', 'Third token product'),
      ],
      page: 2,
      limit: limit,
      total: 3,
    );
  }
}

KisanClubBenefitToken _token(
  String id,
  String productName, {
  KisanClubBenefitTokenStatus status = KisanClubBenefitTokenStatus.issued,
}) => KisanClubBenefitToken(
  id: id,
  tokenReference: id.toUpperCase(),
  quantity: 1,
  quotedUnitPricePaise: 10_000,
  quotedBenefitPaise: 1_000,
  quotedFarmerPayablePaise: 9_000,
  status: status,
  expiresAt: DateTime.utc(2026, 8, 31),
  productName: productName,
  variantName: '1 kg pack',
  sellerName: 'Etah Distributor',
  createdAt: DateTime.utc(2026, 8, 14),
);
