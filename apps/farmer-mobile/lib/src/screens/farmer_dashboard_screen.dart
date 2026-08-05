import 'package:flutter/material.dart';
import 'cart_screen.dart';
import '../marketplace/marketplace_api.dart';
import 'product_browse_screen.dart';
import '../strings/app_strings.dart';

class FarmerDashboardScreen extends StatelessWidget {
  const FarmerDashboardScreen({
    super.key,
    this.marketplaceProductRepository,
  });

  final MarketplaceProductRepository? marketplaceProductRepository;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.en;

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.appTitle),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              strings.welcomeTitle,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(strings.phaseBoundary),
            const SizedBox(height: 20),
            _ActionTile(
              title: strings.otpLogin,
              subtitle: strings.otpLoginSubtitle,
            ),
            _ActionTile(
              title: strings.farmProfile,
              subtitle: strings.farmProfileSubtitle,
            ),
            _ActionTile(
              title: strings.productBrowsing,
              subtitle: strings.productBrowsingSubtitle,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ProductBrowseScreen(
                      repository: marketplaceProductRepository,
                    ),
                  ),
                );
              },
            ),
            _ActionTile(
              title: strings.cart,
              subtitle: strings.cartSubtitle,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const CartScreen(),
                  ),
                );
              },
            ),
            _ActionTile(
              title: strings.supportAccess,
              subtitle: strings.supportAccessSubtitle,
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
