import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../leads/farmer_lead_models.dart';
import '../leads/farmer_lead_repository.dart';

class CreateFarmerLeadScreen extends ConsumerStatefulWidget {
  const CreateFarmerLeadScreen({super.key});

  @override
  ConsumerState<CreateFarmerLeadScreen> createState() =>
      _CreateFarmerLeadScreenState();
}

class _CreateFarmerLeadScreenState
    extends ConsumerState<CreateFarmerLeadScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _village = TextEditingController();
  final _district = TextEditingController();
  final _state = TextEditingController();
  final _pincode = TextEditingController();
  final _crops = TextEditingController();
  final _notes = TextEditingController();
  FarmerLeadSource _source = FarmerLeadSource.fieldVisit;
  bool _saving = false;

  @override
  void dispose() {
    for (final controller in [
      _name,
      _phone,
      _village,
      _district,
      _state,
      _pincode,
      _crops,
      _notes,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  String? _optional(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  Future<void> _save() async {
    if (_saving || !_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(farmerLeadRepositoryProvider)
          .createLead(
            CreateFarmerLeadInput(
              fullName: _name.text.trim(),
              phone: _phone.text.trim(),
              source: _source,
              village: _optional(_village.text),
              district: _optional(_district.text),
              state: _optional(_state.text),
              pincode: _optional(_pincode.text),
              cropInterests: _crops.text
                  .split(',')
                  .map((crop) => crop.trim())
                  .where((crop) => crop.isNotEmpty)
                  .toSet()
                  .toList(),
              notes: _optional(_notes.text),
            ),
          );
      if (mounted) context.pop(true);
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context).leadCreateFailed)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.captureFarmerLead)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(strings.leadPrivacyNotice),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(labelText: strings.farmerName),
              validator: (value) => (value?.trim().length ?? 0) >= 2
                  ? null
                  : strings.requiredField,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(labelText: strings.phoneNumber),
              validator: (value) =>
                  RegExp(
                    r'^(\+91)?[6-9][0-9]{9}$',
                  ).hasMatch(value?.trim() ?? '')
                  ? null
                  : strings.invalidIndianPhone,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<FarmerLeadSource>(
              initialValue: _source,
              decoration: InputDecoration(labelText: strings.leadSource),
              items: [
                for (final source in FarmerLeadSource.values)
                  DropdownMenuItem(
                    value: source,
                    child: Text(_sourceText(strings, source)),
                  ),
              ],
              onChanged: (value) => setState(() => _source = value ?? _source),
            ),
            const SizedBox(height: 12),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text(strings.leadOptionalDetails),
              children: [
                for (final field in [
                  (_village, strings.village),
                  (_district, strings.district),
                  (_state, strings.state),
                ]) ...[
                  TextFormField(
                    controller: field.$1,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(labelText: field.$2),
                  ),
                  const SizedBox(height: 12),
                ],
                TextFormField(
                  controller: _pincode,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: strings.pincodeOptional,
                  ),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    return text.isEmpty ||
                            RegExp(r'^[1-9][0-9]{5}$').hasMatch(text)
                        ? null
                        : strings.invalidPincode;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _crops,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: strings.cropInterestsCommaSeparated,
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _notes,
                  maxLength: 1000,
                  maxLines: 3,
                  decoration: InputDecoration(labelText: strings.notesOptional),
                ),
              ],
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(strings.saveLead),
            ),
          ],
        ),
      ),
    );
  }
}

String _sourceText(AppLocalizations strings, FarmerLeadSource source) =>
    switch (source) {
      FarmerLeadSource.fieldVisit => strings.leadSourceFieldVisit,
      FarmerLeadSource.referral => strings.leadSourceReferral,
      FarmerLeadSource.campaign => strings.leadSourceCampaign,
      FarmerLeadSource.inbound => strings.leadSourceInbound,
      FarmerLeadSource.other => strings.optionOther,
    };
