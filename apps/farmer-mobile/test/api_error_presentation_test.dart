import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations_en.dart';
import 'package:vardhnam_farmer_mobile/l10n/app_localizations_hi.dart';
import 'package:vardhnam_farmer_mobile/src/network/api_error_presentation.dart';
import 'package:vardhnam_farmer_mobile/src/network/authenticated_api_client.dart';

void main() {
  test('presents offline failures in the selected language', () {
    const error = AuthenticatedApiException(
      code: 'NETWORK_OFFLINE',
      message: 'Could not reach the marketplace service.',
    );

    expect(
      apiErrorMessage(AppLocalizationsEn(), error),
      'Could not connect. Check your internet connection and try again.',
    );
    expect(
      apiErrorMessage(AppLocalizationsHi(), error),
      'कनेक्ट नहीं हो सका। इंटरनेट जाँचें और फिर प्रयास करें।',
    );
  });

  test('distinguishes timeouts from other connection failures', () {
    final strings = AppLocalizationsEn();

    expect(
      apiErrorMessage(strings, TimeoutException('slow')),
      'The request took too long. Check your connection and try again.',
    );
    expect(
      apiErrorMessage(strings, const SocketException('offline')),
      'Could not connect. Check your internet connection and try again.',
    );
  });

  test('does not expose unexpected exception details', () {
    expect(
      apiErrorMessage(AppLocalizationsEn(), StateError('private detail')),
      'Something went wrong. Please try again.',
    );
  });
}
