import '../../l10n/app_localizations.dart';

String supportStatusLabel(AppLocalizations strings, String status) =>
    switch (status) {
      'OPEN' => strings.supportStatusOpen,
      'ASSIGNED' => strings.supportStatusAssigned,
      'WAITING_FOR_CUSTOMER' => strings.supportStatusWaitingForCustomer,
      'WAITING_FOR_SELLER' => strings.supportStatusWaitingForSeller,
      'ESCALATED' => strings.supportStatusEscalated,
      'RESOLVED' => strings.supportStatusResolved,
      'CLOSED' => strings.supportStatusClosed,
      'REOPENED' => strings.supportStatusReopened,
      _ => status,
    };

String supportCategoryLabel(AppLocalizations strings, String category) =>
    switch (category) {
      'ORDER_ISSUE' => strings.supportCategoryOrder,
      'PAYMENT_ISSUE' => strings.supportCategoryPayment,
      'DELIVERY_ISSUE' => strings.supportCategoryDelivery,
      'PRODUCT_QUALITY' => strings.supportCategoryProductQuality,
      'ACCOUNT_ISSUE' => strings.supportCategoryAccount,
      'ONBOARDING_ISSUE' => strings.supportCategoryOnboarding,
      'OTHER' => strings.supportCategoryOther,
      _ => category,
    };

String supportPriorityLabel(AppLocalizations strings, String priority) =>
    switch (priority) {
      'LOW' => strings.supportPriorityLow,
      'MEDIUM' => strings.supportPriorityMedium,
      'HIGH' => strings.supportPriorityHigh,
      'URGENT' => strings.supportPriorityUrgent,
      _ => priority,
    };
