import '../../l10n/app_localizations.dart';

String returnStatusLabel(AppLocalizations strings, String status) =>
    switch (status) {
      'REQUESTED' => strings.returnStatusRequested,
      'APPROVED' => strings.returnStatusApproved,
      'REJECTED' => strings.returnStatusRejected,
      'IN_TRANSIT' => strings.returnStatusInTransit,
      'RECEIVED' => strings.returnStatusReceived,
      'INSPECTED' => strings.returnStatusInspected,
      'COMPLETED' => strings.returnStatusCompleted,
      'CANCELLED' => strings.returnStatusCancelled,
      _ => status,
    };

String refundStatusLabel(AppLocalizations strings, String status) =>
    switch (status) {
      'PENDING' => strings.refundStatusPending,
      'PROCESSING' => strings.refundStatusProcessing,
      'SUCCEEDED' => strings.refundStatusSucceeded,
      'FAILED' => strings.refundStatusFailed,
      'CANCELLED' => strings.refundStatusCancelled,
      _ => status,
    };

String returnReasonLabel(AppLocalizations strings, String reason) =>
    switch (reason) {
      'DAMAGED_IN_TRANSIT' => strings.returnReasonDamaged,
      'WRONG_ITEM' => strings.returnReasonWrongItem,
      'EXPIRED_OR_NEAR_EXPIRY' => strings.returnReasonExpiry,
      'QUALITY_ISSUE' => strings.returnReasonQuality,
      'NOT_AS_DESCRIBED' => strings.returnReasonNotAsDescribed,
      'ORDERED_BY_MISTAKE' => strings.returnReasonMistake,
      'OTHER' => strings.returnReasonOther,
      _ => reason,
    };
