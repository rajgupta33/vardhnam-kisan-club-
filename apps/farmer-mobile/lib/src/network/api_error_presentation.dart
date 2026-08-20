import 'dart:async';
import 'dart:io';

import '../../l10n/app_localizations.dart';
import '../marketplace/marketplace_api.dart';
import 'authenticated_api_client.dart';

String apiErrorMessage(AppLocalizations strings, Object error) =>
    switch (error) {
      AuthenticatedApiException(code: 'NETWORK_OFFLINE') =>
        strings.networkErrorMessage,
      AuthenticatedApiException(code: 'NETWORK_TIMEOUT') =>
        strings.networkTimeoutMessage,
      AuthenticatedApiException(code: 'NETWORK_ERROR') =>
        strings.networkErrorMessage,
      AuthenticatedApiException(code: 'INVALID_API_RESPONSE') =>
        strings.invalidServerResponseMessage,
      AuthenticatedApiException(:final message) => message,
      TimeoutException() => strings.networkTimeoutMessage,
      SocketException() => strings.networkErrorMessage,
      MarketplaceApiException(:final message) => message,
      _ => strings.unexpectedErrorMessage,
    };
