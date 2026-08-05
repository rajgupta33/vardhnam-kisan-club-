import 'package:flutter/material.dart';
import 'screens/partner_dashboard_screen.dart';
import 'strings/app_strings.dart';

class PartnerApp extends StatelessWidget {
  const PartnerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: AppStrings.en.appTitle,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xff277da1),
          secondary: const Color(0xffd9a441),
        ),
        useMaterial3: true,
      ),
      home: const PartnerDashboardScreen(),
    );
  }
}

