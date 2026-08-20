import '../../l10n/app_localizations.dart';
import 'partner_earnings_models.dart';

String earningsStatusLabel(AppLocalizations strings, EarningsStatus status) =>
    switch (status) {
      EarningsStatus.provisional => strings.earningsProvisional,
      EarningsStatus.finalised => strings.earningsFinal,
      EarningsStatus.reversed => strings.earningsReversed,
    };

String earningsTypeLabel(AppLocalizations strings, EarningsType type) =>
    switch (type) {
      EarningsType.promoterCommission => strings.promoterCommission,
      EarningsType.deliveryFee => strings.deliveryEarning,
    };

String payoutAccountStatusLabel(AppLocalizations strings, String status) =>
    switch (status) {
      'PENDING_VERIFICATION' => strings.payoutPendingVerification,
      'VERIFIED' => strings.payoutVerified,
      'REJECTED' => strings.payoutRejected,
      _ => status,
    };

String formatPaise(int paise) {
  final sign = paise < 0 ? '-' : '';
  final absolute = paise.abs();
  final whole = absolute ~/ 100;
  final fraction = (absolute % 100).toString().padLeft(2, '0');
  return '$sign₹$whole.$fraction';
}

String earningsDate(DateTime value) {
  final local = value.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')}/${local.year}';
}
