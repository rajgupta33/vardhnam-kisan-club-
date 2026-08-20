import 'package:flutter/material.dart';

import '../../app/theme/vardhnam_colors.dart';

class VardhnamBottomNavigation extends StatelessWidget {
  const VardhnamBottomNavigation({
    required this.currentIndex,
    required this.homeLabel,
    required this.shopLabel,
    required this.clubLabel,
    required this.ordersLabel,
    required this.accountLabel,
    required this.onSelected,
    super.key,
  });

  final int currentIndex;
  final String homeLabel;
  final String shopLabel;
  final String clubLabel;
  final String ordersLabel;
  final String accountLabel;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) => NavigationBar(
    selectedIndex: currentIndex,
    labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
    onDestinationSelected: onSelected,
    destinations: [
      NavigationDestination(
        icon: const Icon(Icons.home_outlined),
        selectedIcon: const Icon(Icons.home),
        label: homeLabel,
      ),
      NavigationDestination(
        icon: const Icon(Icons.storefront_outlined),
        selectedIcon: const Icon(Icons.storefront),
        label: shopLabel,
      ),
      NavigationDestination(
        icon: Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(
            color: VardhnamColors.surfaceGreen,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.agriculture_outlined),
        ),
        selectedIcon: Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(
            color: VardhnamColors.primaryGreen,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.agriculture, color: Colors.white),
        ),
        label: clubLabel,
      ),
      NavigationDestination(
        icon: const Icon(Icons.receipt_long_outlined),
        selectedIcon: const Icon(Icons.receipt_long),
        label: ordersLabel,
      ),
      NavigationDestination(
        icon: const Icon(Icons.person_outline),
        selectedIcon: const Icon(Icons.person),
        label: accountLabel,
      ),
    ],
  );
}
