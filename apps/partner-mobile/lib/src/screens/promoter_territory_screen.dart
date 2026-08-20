import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../territory/promoter_territory_repository.dart';

class PromoterTerritoryScreen extends ConsumerWidget {
  const PromoterTerritoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.myTerritory)),
      body: FutureBuilder(
        future: ref.read(promoterTerritoryRepositoryProvider).getMyTerritory(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text(strings.territoryLoadFailed));
          }
          final assignment = snapshot.requireData;
          final territory = assignment.territory;
          if (!assignment.assigned || territory == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  strings.noTerritoryAssigned,
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        territory.name,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(strings.territoryDistrict(territory.district)),
                      Text(strings.territoryState(territory.state)),
                      const SizedBox(height: 16),
                      _TerritoryValues(
                        label: strings.territoryBlocks,
                        values: territory.blocks,
                        emptyText: strings.notSpecified,
                      ),
                      _TerritoryValues(
                        label: strings.territoryPincodes,
                        values: territory.pincodes,
                        emptyText: strings.notSpecified,
                      ),
                      _TerritoryValues(
                        label: strings.territoryVillages,
                        values: territory.villages,
                        emptyText: strings.notSpecified,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(strings.territoryReadOnlyNotice),
            ],
          );
        },
      ),
    );
  }
}

class _TerritoryValues extends StatelessWidget {
  const _TerritoryValues({
    required this.label,
    required this.values,
    required this.emptyText,
  });

  final String label;
  final List<String> values;
  final String emptyText;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 4),
        Text(values.isEmpty ? emptyText : values.join(', ')),
      ],
    ),
  );
}
