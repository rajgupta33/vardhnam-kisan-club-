import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/presentation/farmer_loading_state.dart';

void main() {
  testWidgets('list skeleton exposes one live loading announcement', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: FarmerListLoadingState(label: 'Loading your orders...'),
        ),
      ),
    );

    expect(find.bySemanticsLabel('Loading your orders...'), findsOneWidget);
    expect(find.byType(Card), findsNWidgets(3));
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('detail skeleton supports narrow screens and large text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: FarmerDetailLoadingState(label: 'Loading order details...'),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.bySemanticsLabel('Loading order details...'), findsOneWidget);
  });
}
