import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../kisan_club/promoter_club_models.dart';
import '../kisan_club/promoter_club_repository.dart';
import '../surveys/promoter_survey_repository.dart';

class PromoterFarmSurveyScreen extends ConsumerStatefulWidget {
  const PromoterFarmSurveyScreen({required this.membershipId, super.key})
    : farmerProfileId = null,
      initialVillage = null,
      initialDistrict = null,
      initialState = null,
      initialPincode = null;

  const PromoterFarmSurveyScreen.attributed({
    required this.farmerProfileId,
    this.initialVillage,
    this.initialDistrict,
    this.initialState,
    this.initialPincode,
    super.key,
  }) : membershipId = null;

  final String? membershipId;
  final String? farmerProfileId;
  final String? initialVillage;
  final String? initialDistrict;
  final String? initialState;
  final String? initialPincode;

  @override
  ConsumerState<PromoterFarmSurveyScreen> createState() =>
      _PromoterFarmSurveyScreenState();
}

class _PromoterFarmSurveyScreenState
    extends ConsumerState<PromoterFarmSurveyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _farmName = TextEditingController();
  final _village = TextEditingController();
  final _district = TextEditingController();
  final _state = TextEditingController();
  final _pincode = TextEditingController();
  final _farmArea = TextEditingController();
  final _soilType = TextEditingController();
  final _variety = TextEditingController();
  final _cropArea = TextEditingController();
  final _season = TextEditingController();
  final _sowingDate = TextEditingController();
  final _harvestDate = TextEditingController();

  late Future<List<CropReference>> _crops;
  String _ownership = 'OWNED';
  String? _irrigation;
  String? _cropId;
  bool _includeCrop = true;
  bool _busy = false;
  bool _created = false;
  Object? _error;

  static const _ownershipTypes = ['OWNED', 'LEASED', 'SHARECROPPED', 'OTHER'];
  static const _irrigationSources = [
    'TUBE_WELL',
    'CANAL',
    'RAIN_FED',
    'POND',
    'DRIP',
    'SPRINKLER',
    'OTHER',
  ];

  @override
  void initState() {
    super.initState();
    _crops = _load();
  }

  Future<List<CropReference>> _load() async {
    if (widget.farmerProfileId != null) {
      _village.text = widget.initialVillage ?? '';
      _district.text = widget.initialDistrict ?? '';
      _state.text = widget.initialState ?? '';
      _pincode.text = widget.initialPincode ?? '';
      return ref.read(promoterSurveyRepositoryProvider).listCropReferences();
    }
    final repository = ref.read(promoterClubRepositoryProvider);
    final results = await Future.wait<Object>([
      repository.getAssignedFarmer(widget.membershipId!),
      repository.listCropReferences(),
    ]);
    final farmer = results[0] as PromoterFarmerSummary;
    _village.text = farmer.village ?? '';
    _district.text = farmer.district ?? '';
    _pincode.text = farmer.pincode;
    return results[1] as List<CropReference>;
  }

  @override
  void dispose() {
    for (final controller in [
      _farmName,
      _village,
      _district,
      _state,
      _pincode,
      _farmArea,
      _soilType,
      _variety,
      _cropArea,
      _season,
      _sowingDate,
      _harvestDate,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  String? _requiredText(String? value) =>
      value == null || value.trim().isEmpty ? 'required' : null;

  String? _positiveArea(String? value) {
    final text = value?.trim() ?? '';
    final number = double.tryParse(text);
    return number == null ||
            number <= 0 ||
            number > 1000000 ||
            !RegExp(r'^\d+(\.\d{1,3})?$').hasMatch(text)
        ? 'area'
        : null;
  }

  String? _date(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null;
    return RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(text) &&
            DateTime.tryParse(text) != null
        ? null
        : 'date';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final strings = AppLocalizations.of(context);
    if (_includeCrop && _cropId == null) {
      setState(() => _error = strings.selectCropRequired);
      return;
    }
    final farmArea = double.parse(_farmArea.text.trim());
    final cropArea = _includeCrop ? double.parse(_cropArea.text.trim()) : null;
    if (cropArea != null && cropArea > farmArea) {
      setState(() => _error = strings.cropAreaTooLarge);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final survey = FarmSurveyInput(
        membershipId: widget.membershipId ?? '',
        farmName: _farmName.text,
        village: _village.text,
        district: _district.text,
        state: _state.text,
        pincode: _pincode.text,
        areaAcres: farmArea,
        ownershipType: _ownership,
        irrigationSource: _irrigation,
        soilType: _soilType.text,
        cropCycle: _includeCrop
            ? CropSurveyInput(
                cropId: _cropId!,
                varietyName: _variety.text,
                areaAcres: cropArea!,
                season: _season.text,
                sowingDate: _sowingDate.text,
                expectedHarvestDate: _harvestDate.text,
              )
            : null,
      );
      if (widget.farmerProfileId case final farmerProfileId?) {
        await ref
            .read(promoterSurveyRepositoryProvider)
            .createSurvey(farmerProfileId: farmerProfileId, survey: survey);
      } else {
        await ref.read(promoterClubRepositoryProvider).createFarmSurvey(survey);
      }
      if (mounted) setState(() => _created = true);
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.recordFarmSurvey)),
      body: _created
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle, size: 64),
                    const SizedBox(height: 12),
                    Text(strings.farmSurveyCreated),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => context.pop(true),
                      child: Text(strings.done),
                    ),
                  ],
                ),
              ),
            )
          : FutureBuilder<List<CropReference>>(
              future: _crops,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError || snapshot.data == null) {
                  return Center(child: Text(strings.loadFailed));
                }
                return _form(strings, snapshot.data!);
              },
            ),
    );
  }

  Widget _form(AppLocalizations strings, List<CropReference> crops) => Form(
    key: _formKey,
    child: ListView(
      key: const Key('survey-form-list'),
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          strings.farmDetails,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        TextFormField(
          key: const Key('survey-farm-name'),
          controller: _farmName,
          decoration: InputDecoration(labelText: strings.farmName),
          validator: (value) =>
              _requiredText(value) == null ? null : strings.requiredField,
        ),
        TextFormField(
          controller: _village,
          decoration: InputDecoration(labelText: strings.village),
        ),
        TextFormField(
          controller: _district,
          decoration: InputDecoration(labelText: strings.district),
        ),
        TextFormField(
          controller: _state,
          decoration: InputDecoration(labelText: strings.state),
        ),
        TextFormField(
          key: const Key('survey-pincode'),
          controller: _pincode,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: strings.pincode),
          validator: (value) => RegExp(r'^\d{6}$').hasMatch(value ?? '')
              ? null
              : strings.invalidPincode,
        ),
        TextFormField(
          key: const Key('survey-farm-area'),
          controller: _farmArea,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: strings.areaAcres),
          validator: (value) =>
              _positiveArea(value) == null ? null : strings.invalidArea,
        ),
        DropdownButtonFormField<String>(
          initialValue: _ownership,
          decoration: InputDecoration(labelText: strings.ownershipType),
          items: _ownershipTypes
              .map(
                (value) => DropdownMenuItem(
                  value: value,
                  child: Text(_ownershipLabel(strings, value)),
                ),
              )
              .toList(),
          onChanged: _busy ? null : (value) => _ownership = value!,
        ),
        DropdownButtonFormField<String?>(
          initialValue: _irrigation,
          decoration: InputDecoration(labelText: strings.irrigationSource),
          items: [
            DropdownMenuItem<String?>(
              value: null,
              child: Text(strings.notSpecified),
            ),
            ..._irrigationSources.map(
              (value) => DropdownMenuItem<String?>(
                value: value,
                child: Text(_irrigationLabel(strings, value)),
              ),
            ),
          ],
          onChanged: _busy ? null : (value) => _irrigation = value,
        ),
        TextFormField(
          controller: _soilType,
          decoration: InputDecoration(labelText: strings.soilTypeOptional),
        ),
        SwitchListTile(
          key: const Key('survey-include-crop'),
          contentPadding: EdgeInsets.zero,
          title: Text(strings.addCropCycle),
          value: _includeCrop,
          onChanged: _busy
              ? null
              : (value) => setState(() => _includeCrop = value),
        ),
        if (_includeCrop) ...[
          DropdownButtonFormField<String>(
            key: const Key('survey-crop'),
            initialValue: _cropId,
            decoration: InputDecoration(labelText: strings.crop),
            items: crops
                .map(
                  (crop) => DropdownMenuItem(
                    value: crop.id,
                    child: Text(
                      Localizations.localeOf(context).languageCode == 'hi'
                          ? crop.nameHi
                          : crop.nameEn,
                    ),
                  ),
                )
                .toList(),
            onChanged: _busy
                ? null
                : (value) => setState(() => _cropId = value),
          ),
          TextFormField(
            controller: _variety,
            decoration: InputDecoration(labelText: strings.varietyOptional),
          ),
          TextFormField(
            key: const Key('survey-crop-area'),
            controller: _cropArea,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: strings.cropAreaAcres),
            validator: (value) => !_includeCrop || _positiveArea(value) == null
                ? null
                : strings.invalidArea,
          ),
          TextFormField(
            key: const Key('survey-season'),
            controller: _season,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(labelText: strings.season),
            validator: (value) =>
                !_includeCrop ||
                    RegExp(r'^[A-Za-z0-9_-]{2,40}$').hasMatch(value ?? '')
                ? null
                : strings.invalidSeason,
          ),
          TextFormField(
            controller: _sowingDate,
            decoration: InputDecoration(labelText: strings.sowingDateOptional),
            validator: (value) =>
                _date(value) == null ? null : strings.invalidDate,
          ),
          TextFormField(
            controller: _harvestDate,
            decoration: InputDecoration(labelText: strings.harvestDateOptional),
            validator: (value) =>
                _date(value) == null ? null : strings.invalidDate,
          ),
        ],
        const SizedBox(height: 12),
        Text(strings.locationNotCollected),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(
            _error is String ? _error! as String : strings.farmSurveyFailed,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          key: const Key('submit-farm-survey'),
          onPressed: _busy ? null : _submit,
          child: Text(strings.submitFarmSurvey),
        ),
        if (_busy) const Center(child: CircularProgressIndicator()),
      ],
    ),
  );
}

String _ownershipLabel(AppLocalizations strings, String value) =>
    switch (value) {
      'OWNED' => strings.ownershipOwned,
      'LEASED' => strings.ownershipLeased,
      'SHARECROPPED' => strings.ownershipSharecropped,
      _ => strings.optionOther,
    };

String _irrigationLabel(AppLocalizations strings, String value) =>
    switch (value) {
      'TUBE_WELL' => strings.irrigationTubeWell,
      'CANAL' => strings.irrigationCanal,
      'RAIN_FED' => strings.irrigationRainFed,
      'POND' => strings.irrigationPond,
      'DRIP' => strings.irrigationDrip,
      'SPRINKLER' => strings.irrigationSprinkler,
      _ => strings.optionOther,
    };
