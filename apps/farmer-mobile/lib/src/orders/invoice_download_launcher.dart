import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

final invoiceDownloadLauncherProvider = Provider<InvoiceDownloadLauncher>(
  (ref) => const UrlInvoiceDownloadLauncher(),
);

abstract interface class InvoiceDownloadLauncher {
  Future<bool> launch(Uri uri);
}

class UrlInvoiceDownloadLauncher implements InvoiceDownloadLauncher {
  const UrlInvoiceDownloadLauncher();

  @override
  Future<bool> launch(Uri uri) =>
      launchUrl(uri, mode: LaunchMode.externalApplication);
}
