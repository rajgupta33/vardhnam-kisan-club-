import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../visits/promoter_visit_models.dart';
import '../visits/promoter_visit_repository.dart';

class PromoterVisitsScreen extends ConsumerWidget {
  const PromoterVisitsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.promoterVisits)),
      body: FutureBuilder<PromoterVisitPage>(
        future: ref.read(promoterVisitRepositoryProvider).listMine(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text(strings.visitsLoadFailed));
          }
          final items = snapshot.data!.items;
          if (items.isEmpty) {
            return Center(child: Text(strings.noPromoterVisits));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final visit = items[index];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.place_outlined),
                  title: Text(visit.targetName),
                  subtitle: Text(
                    '${_purposeLabel(strings, visit.purpose)}\n${DateFormat.yMMMd().add_jm().format(visit.occurredAt.toLocal())}',
                  ),
                  isThreeLine: true,
                ),
              );
            },
          );
        },
      ),
    );
  }
}

String promoterVisitPurposeLabel(
  AppLocalizations strings,
  PromoterVisitPurpose purpose,
) => _purposeLabel(strings, purpose);

String _purposeLabel(AppLocalizations strings, PromoterVisitPurpose purpose) =>
    switch (purpose) {
      PromoterVisitPurpose.leadFollowUp => strings.visitPurposeLeadFollowUp,
      PromoterVisitPurpose.farmerSupport => strings.visitPurposeFarmerSupport,
      PromoterVisitPurpose.orderAssistance =>
        strings.visitPurposeOrderAssistance,
      PromoterVisitPurpose.farmSurvey => strings.visitPurposeFarmSurvey,
      PromoterVisitPurpose.complaintFollowUp =>
        strings.visitPurposeComplaintFollowUp,
      PromoterVisitPurpose.other => strings.optionOther,
    };
