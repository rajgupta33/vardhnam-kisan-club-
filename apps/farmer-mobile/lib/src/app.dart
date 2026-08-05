import 'package:flutter/material.dart';
import 'marketplace/marketplace_api.dart';
import 'screens/farmer_dashboard_screen.dart';
import 'strings/app_strings.dart';

class FarmerApp extends StatelessWidget {
  const FarmerApp({
    super.key,
    this.marketplaceProductRepository,
  });

  final MarketplaceProductRepository? marketplaceProductRepository;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: AppStrings.en.appTitle,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xff2f6b3f),
          secondary: const Color(0xffd9a441),
        ),
        useMaterial3: true,
      ),
      home: FarmerDashboardScreen(
        marketplaceProductRepository: marketplaceProductRepository,
      ),
    );
  }
}
