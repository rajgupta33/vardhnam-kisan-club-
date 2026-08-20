import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

String notificationCategoryLabel(AppLocalizations strings, String category) =>
    switch (category) {
      'ORDER_UPDATE' => strings.notificationOrdersCategory,
      'KISAN_CLUB' => strings.notificationKisanClubCategory,
      'ADVISORY' => strings.notificationAdvisoryCategory,
      'SUPPORT' => strings.notificationSupportCategory,
      'RETURN_UPDATE' => strings.notificationReturnsCategory,
      _ => strings.notificationOtherCategory,
    };

IconData notificationCategoryIcon(String category) => switch (category) {
  'ORDER_UPDATE' => Icons.receipt_long_outlined,
  'KISAN_CLUB' => Icons.groups_outlined,
  'ADVISORY' => Icons.eco_outlined,
  'SUPPORT' => Icons.support_agent_outlined,
  'RETURN_UPDATE' => Icons.assignment_return_outlined,
  _ => Icons.notifications_none,
};
