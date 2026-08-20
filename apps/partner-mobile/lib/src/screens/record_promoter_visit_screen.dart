import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../delivery/delivery_location_proof.dart';
import '../leads/farmer_lead_models.dart';
import '../visits/promoter_visit_models.dart';
import '../visits/promoter_visit_repository.dart';
import 'promoter_visits_screen.dart';

class RecordPromoterVisitScreen extends ConsumerStatefulWidget {
  const RecordPromoterVisitScreen({required this.lead, super.key});
  final FarmerLead lead;

  @override
  ConsumerState<RecordPromoterVisitScreen> createState() =>
      _RecordPromoterVisitScreenState();
}

class _RecordPromoterVisitScreenState
    extends ConsumerState<RecordPromoterVisitScreen> {
  final _notes = TextEditingController();
  var _purpose = PromoterVisitPurpose.leadFollowUp;
  var _includeLocation = false;
  var _saving = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final strings = AppLocalizations.of(context);
    setState(() => _saving = true);
    try {
      final occurredAt = DateTime.now().toUtc();
      final proof = _includeLocation
          ? await ref.read(deliveryLocationProofCollectorProvider).collect()
          : null;
      final farmerProfileId = widget.lead.convertedFarmerProfileId;
      await ref
          .read(promoterVisitRepositoryProvider)
          .create(
            CreatePromoterVisitInput(
              farmerLeadId: farmerProfileId == null ? widget.lead.id : null,
              farmerProfileId: farmerProfileId,
              purpose: _purpose,
              notes: _notes.text,
              occurredAt: occurredAt,
              locationProof: proof,
            ),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.visitRecorded)));
      context.pop(true);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.visitRecordFailed)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.recordVisit)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            widget.lead.fullName,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 20),
          DropdownButtonFormField<PromoterVisitPurpose>(
            key: const Key('visit-purpose'),
            initialValue: _purpose,
            decoration: InputDecoration(labelText: strings.visitPurpose),
            items: [
              for (final purpose in PromoterVisitPurpose.values)
                DropdownMenuItem(
                  value: purpose,
                  child: Text(promoterVisitPurposeLabel(strings, purpose)),
                ),
            ],
            onChanged: _saving
                ? null
                : (value) => setState(() => _purpose = value!),
          ),
          const SizedBox(height: 16),
          TextField(
            key: const Key('visit-notes'),
            controller: _notes,
            maxLength: 2000,
            maxLines: 4,
            decoration: InputDecoration(labelText: strings.visitNotes),
          ),
          SwitchListTile(
            key: const Key('visit-location'),
            value: _includeLocation,
            onChanged: _saving
                ? null
                : (value) => setState(() => _includeLocation = value),
            title: Text(strings.includeVisitLocation),
            subtitle: Text(strings.includeVisitLocationHelp),
          ),
          const SizedBox(height: 16),
          FilledButton(
            key: const Key('save-visit'),
            onPressed: _saving ? null : _save,
            child: Text(strings.saveVisit),
          ),
        ],
      ),
    );
  }
}
