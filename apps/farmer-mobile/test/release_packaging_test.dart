import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('release builds require the Play upload-key configuration', () {
    final buildScript = File('android/app/build.gradle.kts').readAsStringSync();

    expect(buildScript, contains('rootProject.file("key.properties")'));
    expect(buildScript, contains('signingConfigs.getByName("release")'));
    expect(buildScript, isNot(contains('signingConfigs.getByName("debug")')));
    expect(buildScript, contains('releaseTaskRequested'));
  });
}
