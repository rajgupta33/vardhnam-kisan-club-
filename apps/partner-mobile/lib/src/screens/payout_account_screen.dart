import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../earnings/partner_earnings_models.dart';
import '../earnings/partner_earnings_repository.dart';

class PayoutAccountScreen extends ConsumerStatefulWidget {
  const PayoutAccountScreen({super.key});

  @override
  ConsumerState<PayoutAccountScreen> createState() =>
      _PayoutAccountScreenState();
}

class _PayoutAccountScreenState extends ConsumerState<PayoutAccountScreen> {
  final _formKey = GlobalKey<FormState>();
  final _accountHolderController = TextEditingController();
  final _bankController = TextEditingController();
  final _accountNumberController = TextEditingController();
  final _ifscController = TextEditingController();
  final _upiController = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  bool _hasExistingAccount = false;
  Object? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final account = await ref
          .read(partnerEarningsRepositoryProvider)
          .getMyPayoutAccount();
      if (!mounted) return;
      if (account != null) {
        _accountHolderController.text = account.accountHolderName;
        _bankController.text = account.bankName;
        _ifscController.text = account.ifscCode;
        _upiController.text = account.upiId ?? '';
      }
      setState(() {
        _hasExistingAccount = account != null;
        _loading = false;
        _loadError = null;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = error;
      });
    }
  }

  Future<void> _save() async {
    if (_saving || !_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _saving = true);
    final upiId = _upiController.text.trim();
    try {
      final account = await ref
          .read(partnerEarningsRepositoryProvider)
          .saveMyPayoutAccount(
            PayoutAccountInput(
              accountHolderName: _accountHolderController.text.trim(),
              bankName: _bankController.text.trim(),
              accountNumber: _accountNumberController.text.trim(),
              ifscCode: _ifscController.text.trim().toUpperCase(),
              upiId: upiId.isEmpty ? null : upiId,
            ),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).payoutAccountSaved),
        ),
      );
      context.pop(account);
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).payoutAccountSaveFailed),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _accountHolderController.dispose();
    _bankController.dispose();
    _accountNumberController.dispose();
    _ifscController.dispose();
    _upiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.managePayoutAccount)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(strings.payoutAccountLoadFailed),
                    TextButton(onPressed: _load, child: Text(strings.tryAgain)),
                  ],
                ),
              ),
            )
          : SafeArea(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(strings.payoutAccountPrivacyNotice),
                    if (_hasExistingAccount) ...[
                      const SizedBox(height: 8),
                      Text(strings.payoutAccountResubmissionNotice),
                    ],
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _accountHolderController,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.name],
                      decoration: InputDecoration(
                        labelText: strings.accountHolderName,
                      ),
                      validator: (value) => _lengthValidator(
                        strings,
                        value,
                        minimum: 2,
                        maximum: 120,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _bankController,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(labelText: strings.bankName),
                      validator: (value) => _lengthValidator(
                        strings,
                        value,
                        minimum: 2,
                        maximum: 120,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _accountNumberController,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.next,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: strings.accountNumber,
                        helperText: _hasExistingAccount
                            ? strings.reenterAccountNumber
                            : null,
                      ),
                      validator: (value) =>
                          RegExp(r'^\d{6,20}$').hasMatch(value?.trim() ?? '')
                          ? null
                          : strings.invalidAccountNumber,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _ifscController,
                      textCapitalization: TextCapitalization.characters,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(labelText: strings.ifscCode),
                      validator: (value) =>
                          RegExp(
                            r'^[A-Za-z]{4}0[A-Za-z0-9]{6}$',
                          ).hasMatch(value?.trim() ?? '')
                          ? null
                          : strings.invalidIfscCode,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _upiController,
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: strings.upiIdOptional,
                      ),
                      validator: (value) => (value?.trim().length ?? 0) <= 120
                          ? null
                          : strings.fieldTooLong,
                      onFieldSubmitted: (_) => _save(),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox.square(
                              dimension: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(strings.submitForVerification),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

String? _lengthValidator(
  AppLocalizations strings,
  String? value, {
  required int minimum,
  required int maximum,
}) {
  final length = value?.trim().length ?? 0;
  if (length == 0) return strings.requiredField;
  if (length < minimum) return strings.fieldTooShort;
  if (length > maximum) return strings.fieldTooLong;
  return null;
}
