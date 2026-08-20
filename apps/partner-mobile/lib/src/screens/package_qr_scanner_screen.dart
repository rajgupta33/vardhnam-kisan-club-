import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../l10n/app_localizations.dart';

class PackageQrScannerScreen extends StatefulWidget {
  const PackageQrScannerScreen({super.key});

  @override
  State<PackageQrScannerScreen> createState() => _PackageQrScannerScreenState();
}

class _PackageQrScannerScreenState extends State<PackageQrScannerScreen> {
  bool _returningResult = false;

  void _onDetect(BarcodeCapture capture) {
    if (_returningResult) return;
    for (final barcode in capture.barcodes) {
      final code = barcode.rawValue?.trim();
      if (code != null && code.isNotEmpty) {
        _returningResult = true;
        Navigator.pop(context, code);
        return;
      }
    }
  }

  Future<void> _enterManually() async {
    final code = await showDialog<String>(
      context: context,
      builder: (context) => const PackageQrManualEntryDialog(),
    );
    if (code != null && mounted) Navigator.pop(context, code);
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.scanPackageQr)),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(strings.scanPackageQrHelp),
            ),
            Expanded(child: MobileScanner(onDetect: _onDetect)),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _enterManually,
                  icon: const Icon(Icons.keyboard_outlined),
                  label: Text(strings.enterPackageCodeManually),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PackageQrManualEntryDialog extends StatefulWidget {
  const PackageQrManualEntryDialog({super.key});

  @override
  State<PackageQrManualEntryDialog> createState() =>
      _PackageQrManualEntryDialogState();
}

class _PackageQrManualEntryDialogState
    extends State<PackageQrManualEntryDialog> {
  final _controller = TextEditingController();
  bool _invalid = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(strings.enterPackageCodeManually),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLength: 300,
        decoration: InputDecoration(
          labelText: strings.packageCode,
          errorText: _invalid ? strings.packageCodeRequired : null,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(strings.cancelAction),
        ),
        FilledButton(
          onPressed: () {
            final code = _controller.text.trim();
            if (code.length < 20) {
              setState(() => _invalid = true);
              return;
            }
            Navigator.pop(context, code);
          },
          child: Text(strings.verifyPackagePickup),
        ),
      ],
    );
  }
}
