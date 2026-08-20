import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../kisan_club/promoter_club_models.dart';
import '../kisan_club/promoter_club_repository.dart';

class AssistedTokenRedemptionScreen extends ConsumerStatefulWidget {
  const AssistedTokenRedemptionScreen({required this.membershipId, super.key});

  final String membershipId;

  @override
  ConsumerState<AssistedTokenRedemptionScreen> createState() =>
      _AssistedTokenRedemptionScreenState();
}

class _AssistedTokenRedemptionScreenState
    extends ConsumerState<AssistedTokenRedemptionScreen> {
  final _controller = TextEditingController();
  bool _busy = false;
  bool _showValidation = false;
  String? _idempotencyKey;
  Object? _error;
  AssistedCheckoutResult? _result;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => _idempotencyKey = null);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _valid => RegExp(
    r'^VKC-[A-F0-9]{8}-[0-9]{6}$',
    caseSensitive: false,
  ).hasMatch(_controller.text.trim());

  Future<void> _redeem() async {
    if (!_valid) {
      setState(() => _showValidation = true);
      return;
    }
    final key = _idempotencyKey ??=
        'partner-kc-${widget.membershipId}-${DateTime.now().microsecondsSinceEpoch}';
    setState(() {
      _busy = true;
      _error = null;
      _showValidation = false;
    });
    try {
      final result = await ref
          .read(promoterClubRepositoryProvider)
          .redeemBenefitToken(
            membershipId: widget.membershipId,
            code: _controller.text,
            idempotencyKey: key,
          );
      if (mounted) setState(() => _result = result);
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final result = _result;
    return Scaffold(
      appBar: AppBar(title: Text(strings.redeemBenefitToken)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          if (result != null) ...[
            Icon(
              Icons.check_circle,
              size: 64,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 12),
            Text(
              strings.redemptionSuccess,
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Text(strings.checkoutReference(result.checkoutId)),
            Text(strings.orderReference(result.productOrderId)),
            Text(strings.benefitAmount(_money(result.clubBenefitPaise))),
            Text(strings.farmerPayable(_money(result.farmerPayablePaise))),
            if (result.paymentRequiredInApp) ...[
              const SizedBox(height: 12),
              Text(strings.paymentStillRequired),
            ],
          ] else ...[
            Text(strings.redemptionWarning),
            const SizedBox(height: 16),
            TextField(
              key: const Key('benefit-token-code'),
              controller: _controller,
              enabled: !_busy,
              autocorrect: false,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: strings.benefitTokenCode,
                hintText: strings.benefitTokenHint,
                errorText: _showValidation ? strings.invalidBenefitToken : null,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _redeem,
              child: Text(strings.confirmRedemption),
            ),
            if (_busy) ...[
              const SizedBox(height: 16),
              const Center(child: CircularProgressIndicator()),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                strings.loadFailed,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

String _money(int paise) =>
    '${paise ~/ 100}.${(paise % 100).toString().padLeft(2, '0')}';
