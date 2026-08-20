import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../app/assets/app_assets.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../localization/locale_controller.dart';
import '../routing/app_routes.dart';

class FarmerLoginScreen extends ConsumerStatefulWidget {
  const FarmerLoginScreen({super.key});

  @override
  ConsumerState<FarmerLoginScreen> createState() => _FarmerLoginScreenState();
}

class _FarmerLoginScreenState extends ConsumerState<FarmerLoginScreen> {
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  Timer? _resendTimer;
  String? _mockOtpCode;
  String? _errorCode;
  FarmerMembershipSelectionRequired? _membershipSelection;
  var _otpRequested = false;
  var _isSubmitting = false;
  var _resendSeconds = 0;

  @override
  void dispose() {
    _resendTimer?.cancel();
    _fullNameController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final languageCode = ref.watch(localeControllerProvider).languageCode;

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.farmerLoginTitle),
        actions: [
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: languageCode,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              items: [
                DropdownMenuItem(
                  value: 'en',
                  child: Text(strings.englishLanguageLabel),
                ),
                DropdownMenuItem(
                  value: 'hi',
                  child: Text(strings.hindiLanguageLabel),
                ),
              ],
              onChanged: _isSubmitting
                  ? null
                  : (value) {
                      if (value != null) {
                        unawaited(_selectLanguage(value));
                      }
                    },
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: FocusTraversalGroup(
          policy: OrderedTraversalPolicy(),
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (!_otpRequested) ...[
                Semantics(
                  image: true,
                  label: strings.appTitle,
                  child: ExcludeSemantics(
                    child: Center(
                      child: Image.asset(
                        AppAssets.vardhnamLogoFull,
                        width: 112,
                        height: 112,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              Text(strings.loginIntro),
              const SizedBox(height: 20),
              FocusTraversalOrder(
                order: const NumericFocusOrder(1),
                child: TextField(
                  controller: _fullNameController,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  enabled: !_otpRequested && !_isSubmitting,
                  autofillHints: const [AutofillHints.name],
                  decoration: InputDecoration(
                    labelText: strings.fullNameLabel,
                    prefixIcon: const Icon(Icons.person_outline),
                    border: const OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              FocusTraversalOrder(
                order: const NumericFocusOrder(2),
                child: TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textInputAction: _otpRequested
                      ? TextInputAction.next
                      : TextInputAction.done,
                  enabled: !_otpRequested && !_isSubmitting,
                  autofillHints: const [AutofillHints.telephoneNumberNational],
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  decoration: InputDecoration(
                    labelText: strings.mobileNumberLabel,
                    hintText: strings.mobileNumberHint,
                    prefixText: '+91 ',
                    prefixIcon: const Icon(Icons.phone_android),
                    border: const OutlineInputBorder(),
                  ),
                  onSubmitted: (_) {
                    if (!_otpRequested) {
                      unawaited(_requestOtp());
                    }
                  },
                ),
              ),
              if (_otpRequested) ...[
                const SizedBox(height: 14),
                FocusTraversalOrder(
                  order: const NumericFocusOrder(3),
                  child: TextField(
                    controller: _otpController,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.done,
                    enabled: !_isSubmitting,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(6),
                    ],
                    decoration: InputDecoration(
                      labelText: strings.otpCodeLabel,
                      prefixIcon: const Icon(Icons.password_outlined),
                      border: const OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => unawaited(_verifyOtp()),
                  ),
                ),
                const SizedBox(height: 10),
                Semantics(
                  liveRegion: true,
                  child: Text(strings.otpSentMessage),
                ),
                if (_mockOtpCode != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    strings.mockOtpLabel(_mockOtpCode!),
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ],
              ],
              if (_errorCode != null) ...[
                const SizedBox(height: 12),
                Semantics(
                  container: true,
                  liveRegion: true,
                  child: Text(
                    _localizedError(strings, _errorCode!),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ],
              if (_membershipSelection case final selection?) ...[
                const SizedBox(height: 18),
                Text(
                  strings.farmerContextSelectionTitle,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(strings.farmerContextSelectionMessage),
                const SizedBox(height: 12),
                for (final candidate in selection.candidates) ...[
                  SizedBox(
                    height: 56,
                    child: OutlinedButton.icon(
                      onPressed: _isSubmitting
                          ? null
                          : () => _selectMembership(selection, candidate),
                      icon: const Icon(Icons.agriculture_outlined),
                      label: Text(candidate.organisationName),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ],
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _isSubmitting || _membershipSelection != null
                    ? null
                    : _otpRequested
                    ? _verifyOtp
                    : _requestOtp,
                icon: _isSubmitting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        _otpRequested
                            ? Icons.verified_user_outlined
                            : Icons.sms_outlined,
                      ),
                label: Text(
                  _otpRequested
                      ? strings.verifyOtpAction
                      : strings.requestOtpAction,
                ),
              ),
              if (_otpRequested && _membershipSelection == null) ...[
                const SizedBox(height: 10),
                TextButton(
                  onPressed: _isSubmitting || _resendSeconds > 0
                      ? null
                      : _requestOtp,
                  child: Text(
                    _resendSeconds > 0
                        ? strings.resendOtpCountdown(_resendSeconds)
                        : strings.resendOtpAction,
                  ),
                ),
              ],
              const SizedBox(height: 8),
              TextButton(
                onPressed: _isSubmitting
                    ? null
                    : () => context.go(AppRoutes.browse),
                child: Text(strings.browseWithoutLoginAction),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _requestOtp() async {
    final fullName = _fullNameController.text.trim();
    final phone = _phoneController.text.trim();
    if (fullName.length < 2) {
      setState(() => _errorCode = 'INVALID_NAME');
      return;
    }
    if (!RegExp(r'^[6-9][0-9]{9}$').hasMatch(phone)) {
      setState(() => _errorCode = 'INVALID_PHONE');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorCode = null;
    });
    try {
      final result = await ref
          .read(farmerAuthRepositoryProvider)
          .requestOtp('+91$phone');
      if (!mounted) return;
      setState(() {
        _otpRequested = true;
        _mockOtpCode = result.mockOtpCode;
        _membershipSelection = null;
        _resendSeconds = 30;
      });
      _startResendTimer();
    } on FarmerAuthException catch (error) {
      if (mounted) setState(() => _errorCode = error.code);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _verifyOtp() async {
    final code = _otpController.text.trim();
    if (!RegExp(r'^[0-9]{6}$').hasMatch(code)) {
      setState(() => _errorCode = 'INVALID_OTP');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorCode = null;
    });
    try {
      final languageCode = ref.read(localeControllerProvider).languageCode;
      final result = await ref
          .read(farmerAuthRepositoryProvider)
          .verifyOtp(
            phone: '+91${_phoneController.text.trim()}',
            code: code,
            fullName: _fullNameController.text.trim(),
            preferredLocale: '$languageCode-IN',
          );
      switch (result) {
        case FarmerOtpAuthenticated(:final session):
          await ref
              .read(authSessionControllerProvider.notifier)
              .accept(session);
          if (mounted) context.go(AppRoutes.dashboard);
        case final FarmerMembershipSelectionRequired selection:
          if (mounted) setState(() => _membershipSelection = selection);
      }
    } on FarmerAuthException catch (error) {
      if (mounted) setState(() => _errorCode = error.code);
    } on Exception {
      if (mounted) setState(() => _errorCode = 'SESSION_STORAGE_ERROR');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _selectMembership(
    FarmerMembershipSelectionRequired selection,
    FarmerMembershipCandidate candidate,
  ) async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
      _errorCode = null;
    });
    try {
      final session = await ref
          .read(farmerAuthRepositoryProvider)
          .selectFarmerMembership(
            selectionToken: selection.selectionToken,
            organisationId: candidate.organisationId,
          );
      await ref.read(authSessionControllerProvider.notifier).accept(session);
      if (mounted) context.go(AppRoutes.dashboard);
    } on FarmerAuthException catch (error) {
      if (mounted) setState(() => _errorCode = error.code);
    } on Exception {
      if (mounted) setState(() => _errorCode = 'SESSION_STORAGE_ERROR');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _selectLanguage(String languageCode) async {
    try {
      await ref
          .read(localeControllerProvider.notifier)
          .selectLanguage(languageCode);
    } on Exception {
      if (mounted) setState(() => _errorCode = 'LANGUAGE_SAVE_FAILED');
    }
  }

  void _startResendTimer() {
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _resendSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendSeconds = 0);
        return;
      }
      setState(() => _resendSeconds -= 1);
    });
  }
}

String _localizedError(AppLocalizations strings, String code) {
  return switch (code) {
    'INVALID_NAME' => strings.invalidNameMessage,
    'INVALID_PHONE' => strings.invalidPhoneMessage,
    'INVALID_OTP' => strings.invalidOtpMessage,
    'UNAUTHENTICATED' => strings.invalidCredentialsMessage,
    'RATE_LIMITED' => strings.rateLimitedMessage,
    'NETWORK_ERROR' => strings.networkErrorMessage,
    'MEMBERSHIP_SELECTION_REQUIRED' => strings.multipleMembershipsMessage,
    'LANGUAGE_SAVE_FAILED' => strings.languageSaveFailed,
    _ => strings.authenticationErrorMessage,
  };
}
