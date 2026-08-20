import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../app/assets/app_assets.dart';
import '../localization/locale_controller.dart';

class LanguageChoiceScreen extends ConsumerStatefulWidget {
  const LanguageChoiceScreen({required this.onCompleted, super.key});

  final VoidCallback onCompleted;

  @override
  ConsumerState<LanguageChoiceScreen> createState() =>
      _LanguageChoiceScreenState();
}

class _LanguageChoiceScreenState extends ConsumerState<LanguageChoiceScreen> {
  var _isSaving = false;
  String? _errorMessage;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final selectedLanguage = ref.watch(localeControllerProvider).languageCode;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                    image: true,
                    label: strings.appTitle,
                    child: ExcludeSemantics(
                      child: Image.asset(
                        AppAssets.vardhnamLogoFull,
                        width: 128,
                        height: 128,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    strings.firstLaunchLanguageTitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    strings.firstLaunchLanguageMessage,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  _LanguageButton(
                    label: strings.englishLanguageLabel,
                    languageCode: 'en',
                    selected: selectedLanguage == 'en',
                    enabled: !_isSaving,
                    onSelected: _selectLanguage,
                  ),
                  const SizedBox(height: 12),
                  _LanguageButton(
                    label: strings.hindiLanguageLabel,
                    languageCode: 'hi',
                    selected: selectedLanguage == 'hi',
                    enabled: !_isSaving,
                    onSelected: _selectLanguage,
                  ),
                  if (_isSaving) ...[
                    const SizedBox(height: 20),
                    const Center(child: CircularProgressIndicator()),
                  ],
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _selectLanguage(String languageCode) async {
    if (_isSaving) return;
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    try {
      await ref
          .read(localeControllerProvider.notifier)
          .selectLanguage(languageCode);
      if (mounted) widget.onCompleted();
    } on Exception {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _errorMessage = AppLocalizations.of(context)!.languageSaveFailed;
      });
    }
  }
}

class _LanguageButton extends StatelessWidget {
  const _LanguageButton({
    required this.label,
    required this.languageCode,
    required this.selected,
    required this.enabled,
    required this.onSelected,
  });

  final String label;
  final String languageCode;
  final bool selected;
  final bool enabled;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 56,
    child: selected
        ? FilledButton.icon(
            onPressed: enabled ? () => onSelected(languageCode) : null,
            icon: const Icon(Icons.check_circle_outline),
            label: Text(label),
          )
        : OutlinedButton(
            onPressed: enabled ? () => onSelected(languageCode) : null,
            child: Text(label),
          ),
  );
}
