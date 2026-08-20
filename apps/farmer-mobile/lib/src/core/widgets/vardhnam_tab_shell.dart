import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import 'vardhnam_bottom_navigation.dart';

/// The persistent five-tab shell: Home, Shop, Club, Orders, Account.
///
/// Each tab owns its own navigation stack, so opening a product from Shop and
/// then switching to Orders and back returns to that product rather than to the
/// top of Shop. Before this existed the navigation bar only appeared on the
/// dashboard and every tab reset on each switch, which made the app feel like a
/// set of pages rather than one place.
///
/// Tapping the tab you are already on pops that tab back to its root -- the
/// behaviour people expect from the pattern, and the quickest way back out of a
/// deep stack.
class VardhnamTabShell extends StatelessWidget {
  const VardhnamTabShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: VardhnamBottomNavigation(
        currentIndex: navigationShell.currentIndex,
        // Short, dedicated tab labels rather than the longer descriptive
        // strings used elsewhere ("Product browsing", "Farm profile"). Five
        // destinations have to share one row, and Devanagari at 200% text is
        // the case that decides how long a label can be.
        homeLabel: strings.homeNavLabel,
        shopLabel: strings.shopTabLabel,
        clubLabel: strings.kisanClubTitle,
        ordersLabel: strings.ordersTabLabel,
        accountLabel: strings.accountTabLabel,
        onSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
      ),
    );
  }
}
