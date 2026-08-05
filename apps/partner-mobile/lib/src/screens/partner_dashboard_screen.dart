import 'package:flutter/material.dart';
import '../strings/app_strings.dart';

class PartnerDashboardScreen extends StatelessWidget {
  const PartnerDashboardScreen({super.key});

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
            _RoleTile(
              role: strings.promoterRole,
              summary: strings.promoterSummary,
            ),
            _RoleTile(
              role: strings.serviceProviderRole,
              summary: strings.serviceProviderSummary,
            ),
            _RoleTile(
              role: strings.deliveryPartnerRole,
              summary: strings.deliveryPartnerSummary,
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleTile extends StatelessWidget {
  const _RoleTile({
    required this.role,
    required this.summary,
  });

  final String role;
  final String summary;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(role),
        subtitle: Text(summary),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

