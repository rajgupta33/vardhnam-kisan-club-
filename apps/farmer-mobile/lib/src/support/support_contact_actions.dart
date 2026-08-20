import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import 'support_contact.dart';

class SupportContactActions extends ConsumerStatefulWidget {
  const SupportContactActions({super.key});

  @override
  ConsumerState<SupportContactActions> createState() =>
      _SupportContactActionsState();
}

class _SupportContactActionsState extends ConsumerState<SupportContactActions> {
  Uri? _launchingUri;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final configuration = ref.watch(supportContactConfigurationProvider);
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              strings.contactSupportTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(strings.contactSupportSubtitle),
            const SizedBox(height: 12),
            if (!configuration.isConfigured)
              Text(
                strings.supportContactUnavailableMessage,
                style: Theme.of(context).textTheme.bodySmall,
              )
            else
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  if (configuration.phoneUri case final Uri phoneUri)
                    OutlinedButton.icon(
                      onPressed: _launchingUri == null
                          ? () => unawaited(_launch(phoneUri))
                          : null,
                      icon: const Icon(Icons.call_outlined),
                      label: Text(strings.callSupportAction),
                    ),
                  if (configuration.whatsAppUri(strings.whatsAppSupportMessage)
                      case final Uri whatsAppUri)
                    OutlinedButton.icon(
                      onPressed: _launchingUri == null
                          ? () => unawaited(_launch(whatsAppUri))
                          : null,
                      icon: const Icon(Icons.chat_outlined),
                      label: Text(strings.whatsAppSupportAction),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _launch(Uri uri) async {
    setState(() => _launchingUri = uri);
    var launched = false;
    try {
      launched = await ref.read(externalSupportLauncherProvider).launch(uri);
    } on Exception {
      launched = false;
    } finally {
      if (mounted) setState(() => _launchingUri = null);
    }
    if (!launched && mounted) {
      final strings = AppLocalizations.of(context)!;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(strings.supportContactLaunchFailed)),
      );
    }
  }
}
