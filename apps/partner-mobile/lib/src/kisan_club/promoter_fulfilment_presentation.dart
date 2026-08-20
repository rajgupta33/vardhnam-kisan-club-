import '../../l10n/app_localizations.dart';
import 'promoter_fulfilment_models.dart';

String fulfilmentStatusLabel(
  AppLocalizations strings,
  ClubFulfilmentStatus status,
) => switch (status) {
  ClubFulfilmentStatus.assigned => strings.statusAssigned,
  ClubFulfilmentStatus.promoterAccepted => strings.statusPromoterAccepted,
  ClubFulfilmentStatus.promoterDeclined => strings.statusPromoterDeclined,
  ClubFulfilmentStatus.productReady => strings.statusProductReady,
  ClubFulfilmentStatus.farmerContacted => strings.statusFarmerContacted,
  ClubFulfilmentStatus.readyForPickup => strings.statusReadyForPickup,
  ClubFulfilmentStatus.outForDelivery => strings.statusOutForDelivery,
  ClubFulfilmentStatus.completed => strings.statusCompleted,
  ClubFulfilmentStatus.failed => strings.statusFailed,
  ClubFulfilmentStatus.reassigned => strings.statusReassigned,
  ClubFulfilmentStatus.cancelled => strings.statusCancelled,
};

String fulfilmentActionLabel(
  AppLocalizations strings,
  ClubFulfilmentAction action,
) => switch (action) {
  ClubFulfilmentAction.accept => strings.actionAccept,
  ClubFulfilmentAction.decline => strings.actionDecline,
  ClubFulfilmentAction.productReady => strings.actionProductReady,
  ClubFulfilmentAction.farmerContacted => strings.actionFarmerContacted,
  ClubFulfilmentAction.readyForPickup => strings.actionReadyForPickup,
  ClubFulfilmentAction.outForDelivery => strings.actionOutForDelivery,
  ClubFulfilmentAction.complete => strings.actionComplete,
  ClubFulfilmentAction.fail => strings.actionFail,
};

String shortDate(DateTime value) {
  final local = value.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')}/${local.year}';
}
