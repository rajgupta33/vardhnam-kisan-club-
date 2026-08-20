import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../auth/partner_auth_models.dart';
import '../auth/partner_session_controller.dart';

class PartnerLoginScreen extends ConsumerStatefulWidget {
  const PartnerLoginScreen({super.key});

  @override
  ConsumerState<PartnerLoginScreen> createState() => _PartnerLoginScreenState();
}

class _PartnerLoginScreenState extends ConsumerState<PartnerLoginScreen> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  OtpChallenge? _challenge;
  PartnerSelectionRequired? _selection;
  bool _busy = false;
  String? _errorCode;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  String get _normalizedPhone {
    final digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    return digits.length == 10 ? '+91$digits' : '+$digits';
  }

  Future<void> _requestOtp() async {
    final strings = AppLocalizations.of(context);
    if (!RegExp(r'^\+91[6-9][0-9]{9}$').hasMatch(_normalizedPhone)) {
      setState(() => _errorCode = 'INVALID_PHONE');
      return;
    }
    setState(() {
      _busy = true;
      _errorCode = null;
    });
    try {
      final challenge = await ref
          .read(partnerAuthRepositoryProvider)
          .requestOtp(_normalizedPhone);
      if (!mounted) return;
      setState(() => _challenge = challenge);
    } on PartnerAuthException catch (error) {
      if (!mounted) return;
      setState(() => _errorCode = error.code);
    } on Exception {
      if (!mounted) return;
      setState(() => _errorCode = 'AUTH_FAILED');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted || _challenge?.mockOtpCode == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(strings.mockOtpNotice(_challenge!.mockOtpCode!))),
    );
  }

  Future<void> _verifyOtp() async {
    if (!RegExp(r'^[0-9]{6}$').hasMatch(_otpController.text.trim())) {
      setState(() => _errorCode = 'INVALID_OTP');
      return;
    }
    setState(() {
      _busy = true;
      _errorCode = null;
    });
    try {
      final result = await ref
          .read(partnerAuthRepositoryProvider)
          .verifyOtp(phone: _normalizedPhone, code: _otpController.text.trim());
      if (!mounted) return;
      switch (result) {
        case PartnerAuthenticated(:final session):
          await ref
              .read(partnerSessionControllerProvider.notifier)
              .accept(session);
        case PartnerSelectionRequired():
          setState(() => _selection = result);
      }
    } on PartnerAuthException catch (error) {
      if (mounted) setState(() => _errorCode = error.code);
    } on Exception {
      if (mounted) setState(() => _errorCode = 'AUTH_FAILED');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _select(PartnerMembershipCandidate candidate) async {
    final selection = _selection;
    if (selection == null) return;
    setState(() {
      _busy = true;
      _errorCode = null;
    });
    try {
      final session = await ref
          .read(partnerAuthRepositoryProvider)
          .selectMembership(
            selectionToken: selection.selectionToken,
            candidate: candidate,
          );
      await ref.read(partnerSessionControllerProvider.notifier).accept(session);
    } on PartnerAuthException catch (error) {
      if (mounted) setState(() => _errorCode = error.code);
    } on Exception {
      if (mounted) setState(() => _errorCode = 'AUTH_FAILED');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final selection = _selection;
    return Scaffold(
      appBar: AppBar(title: Text(strings.loginTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            if (selection != null) ...[
              Text(
                strings.selectWorkspace,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(strings.selectWorkspaceHelp),
              const SizedBox(height: 16),
              for (final candidate in selection.candidates)
                Card(
                  child: ListTile(
                    enabled: !_busy,
                    title: Text(candidate.organisationName),
                    subtitle: Text(_roleLabel(strings, candidate.role)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _select(candidate),
                  ),
                ),
            ] else ...[
              TextField(
                key: const Key('partner-phone'),
                controller: _phoneController,
                enabled: !_busy && _challenge == null,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: strings.phoneLabel,
                  hintText: strings.phoneHint,
                ),
              ),
              if (_challenge != null) ...[
                const SizedBox(height: 16),
                TextField(
                  key: const Key('partner-otp'),
                  controller: _otpController,
                  enabled: !_busy,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: InputDecoration(labelText: strings.otpLabel),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy
                    ? null
                    : (_challenge == null ? _requestOtp : _verifyOtp),
                child: Text(
                  _challenge == null ? strings.requestOtp : strings.verifyOtp,
                ),
              ),
              if (_challenge != null)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                          _challenge = null;
                          _selection = null;
                          _otpController.clear();
                          _errorCode = null;
                        }),
                  child: Text(strings.changePhone),
                ),
            ],
            if (_busy) ...[
              const SizedBox(height: 16),
              const Center(child: CircularProgressIndicator()),
            ],
            if (_errorCode != null) ...[
              const SizedBox(height: 12),
              Text(
                _errorMessage(strings, _errorCode!),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _roleLabel(AppLocalizations strings, PartnerRole role) => switch (role) {
  PartnerRole.promoter => strings.promoterRole,
  PartnerRole.salesPartner => strings.salesPartnerRole,
  PartnerRole.serviceProvider => strings.serviceProviderRole,
  PartnerRole.deliveryPartner => strings.deliveryPartnerRole,
};

String _errorMessage(AppLocalizations strings, String code) => switch (code) {
  'INVALID_PHONE' => strings.invalidPhone,
  'INVALID_OTP' => strings.invalidOtp,
  'RATE_LIMITED' => strings.rateLimited,
  _ => strings.authFailed,
};
