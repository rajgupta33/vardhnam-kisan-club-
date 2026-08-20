import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations.dart';
import 'package:vardhnam_farmer_mobile/src/advisory/advisory_repository.dart';
import 'package:vardhnam_farmer_mobile/src/screens/advisory_detail_screen.dart';
import 'package:vardhnam_farmer_mobile/src/screens/advisory_list_screen.dart';
import 'package:vardhnam_farmer_mobile/src/screens/crop_doctor_screen.dart';

void main() {
  testWidgets('advisory list presents approved concise guidance', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          advisoryRepositoryProvider.overrideWithValue(
            _AdvisoryRepository(_advisory()),
          ),
        ],
        child: const _TestApp(home: AdvisoryListScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Human-authored and approved'), findsOneWidget);
    expect(find.text('Important today'), findsOneWidget);
    expect(find.text('New'), findsOneWidget);
    expect(find.text('Check soil moisture'), findsOneWidget);
    expect(find.text('Read guidance'), findsOneWidget);
  });

  testWidgets('advisory detail uses action-first approved content', (
    tester,
  ) async {
    final repository = _AdvisoryRepository(_advisory());
    await tester.pumpWidget(
      ProviderScope(
        overrides: [advisoryRepositoryProvider.overrideWithValue(repository)],
        child: const _TestApp(
          home: AdvisoryDetailScreen(advisoryId: 'advisory-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('What you should do'), findsOneWidget);
    expect(find.text('When to act'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('Contact promoter or expert'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    expect(find.text('Contact promoter or expert'), findsOneWidget);
    expect(find.textContaining('general crop guidance'), findsOneWidget);
    expect(repository.markedRead, ['advisory-1']);
  });

  testWidgets('Crop Doctor shell is explicit and non-diagnostic', (
    tester,
  ) async {
    await tester.pumpWidget(const _TestApp(home: CropDoctorScreen()));

    expect(find.text('Problem in your crop?'), findsOneWidget);
    expect(find.text('How to take a useful photo'), findsOneWidget);
    expect(find.text('Photo diagnosis is coming later'), findsOneWidget);
    expect(find.text('Take photo'), findsOneWidget);
    expect(find.text('Choose photo'), findsOneWidget);
    await tester.dragUntilVisible(
      find.textContaining('does not diagnose crops'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    expect(find.textContaining('does not diagnose crops'), findsOneWidget);

    final takePhoto = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Take photo'),
    );
    final choosePhoto = tester.widget<OutlinedButton>(
      find.widgetWithText(OutlinedButton, 'Choose photo'),
    );
    expect(takePhoto.onPressed, isNull);
    expect(choosePhoto.onPressed, isNull);
  });

  testWidgets('Crop Doctor guide survives narrow Hindi at 200% text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      const _TestApp(locale: Locale('hi'), home: CropDoctorScreen()),
    );

    expect(find.text('क्रॉप डॉक्टर'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.home, this.locale = const Locale('en')});

  final Widget home;
  final Locale locale;

  @override
  Widget build(BuildContext context) => MaterialApp(
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: home,
  );
}

class _AdvisoryRepository implements AdvisoryRepository {
  _AdvisoryRepository(this.item);

  final FarmerAdvisory item;
  final markedRead = <String>[];

  @override
  Future<FarmerAdvisoryPage> list({int page = 1, int limit = 20}) async =>
      FarmerAdvisoryPage(items: [item], page: page, limit: limit, total: 1);

  @override
  Future<FarmerAdvisory> get(String id) async => item;

  @override
  Future<void> markRead(String id) async => markedRead.add(id);

  @override
  Future<void> dismiss(String id) async {}
}

FarmerAdvisory _advisory() => FarmerAdvisory(
  id: 'advisory-1',
  status: AdvisoryStatus.delivered,
  dueOn: DateTime.now(),
  category: 'IRRIGATION',
  title: 'Check soil moisture',
  body: 'Inspect the field before following the approved irrigation plan.',
  sourceReference: 'Approved agronomy bulletin',
  ruleVersion: 1,
  cropCycleId: 'cycle-1',
  cropName: 'Wheat',
  varietyName: 'HD-2967',
);
