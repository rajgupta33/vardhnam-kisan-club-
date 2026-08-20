import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../farms/farm_repository.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';

class CropActivityScreen extends ConsumerStatefulWidget {
  const CropActivityScreen({
    required this.farmId,
    required this.cycleId,
    required this.cropName,
    required this.initialStatus,
    super.key,
  });

  final String farmId;
  final String cycleId;
  final String cropName;
  final String initialStatus;

  @override
  ConsumerState<CropActivityScreen> createState() => _CropActivityScreenState();
}

class _CropActivityScreenState extends ConsumerState<CropActivityScreen> {
  List<FarmActivity>? _activities;
  Object? _error;
  var _loading = true;
  late bool _canHarvest;

  @override
  void initState() {
    super.initState();
    _canHarvest = widget.initialStatus == CropCycleStatus.active.name;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final activities = await ref
          .read(farmRepositoryProvider)
          .listActivities(widget.cycleId);
      if (!mounted) return;
      setState(() => _activities = activities);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addActivity() async {
    final created = await showDialog<bool>(
      context: context,
      builder: (context) => _AddActivityDialog(cycleId: widget.cycleId),
    );
    if (created == true) await _load();
  }

  Future<void> _harvest() async {
    final harvested = await showDialog<bool>(
      context: context,
      builder: (context) =>
          _HarvestDialog(farmId: widget.farmId, cycleId: widget.cycleId),
    );
    if (harvested == true) {
      setState(() => _canHarvest = false);
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.cropName.isEmpty
              ? strings.cropDiaryTitle
              : strings.cropDiaryFor(widget.cropName),
        ),
        actions: [
          if (_canHarvest && widget.farmId.isNotEmpty)
            IconButton(
              onPressed: _harvest,
              tooltip: strings.harvestCropAction,
              icon: const Icon(Icons.agriculture_outlined),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addActivity,
        icon: const Icon(Icons.add),
        label: Text(strings.addCropActivityAction),
      ),
      body: SafeArea(
        child: switch ((_loading, _activities, _error)) {
          (true, null, _) => FarmerListLoadingState(
            label: strings.cropDiaryLoading,
          ),
          (false, null, final Object error) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    apiErrorMessage(strings, error),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _load,
                    child: Text(strings.retryActionLabel),
                  ),
                ],
              ),
            ),
          ),
          (_, final List<FarmActivity> activities, _) => RefreshIndicator(
            onRefresh: _load,
            child: activities.isEmpty
                ? ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      const SizedBox(height: 72),
                      const Icon(Icons.event_note_outlined, size: 56),
                      const SizedBox(height: 16),
                      Text(strings.cropDiaryEmpty, textAlign: TextAlign.center),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                    itemCount: activities.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) =>
                        _ActivityCard(activity: activities[index]),
                  ),
          ),
          _ => const SizedBox.shrink(),
        },
      ),
    );
  }
}

class _HarvestDialog extends ConsumerStatefulWidget {
  const _HarvestDialog({required this.farmId, required this.cycleId});
  final String farmId;
  final String cycleId;

  @override
  ConsumerState<_HarvestDialog> createState() => _HarvestDialogState();
}

class _HarvestDialogState extends ConsumerState<_HarvestDialog> {
  final _formKey = GlobalKey<FormState>();
  final _yield = TextEditingController();
  var _harvestDate = DateTime.now();
  var _saving = false;

  @override
  void dispose() {
    _yield.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: _harvestDate,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (selected != null) setState(() => _harvestDate = selected);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _saving) return;
    final strings = AppLocalizations.of(context)!;
    setState(() => _saving = true);
    try {
      final yieldText = _yield.text.trim();
      await ref
          .read(farmRepositoryProvider)
          .harvestCropCycle(
            widget.farmId,
            widget.cycleId,
            HarvestCropCycleInput(
              actualHarvestDate: _harvestDate,
              yieldQuintals: yieldText.isEmpty ? null : double.parse(yieldText),
            ),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(apiErrorMessage(strings, error))));
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).toLanguageTag();
    return AlertDialog(
      title: Text(strings.harvestCropTitle),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(strings.actualHarvestDateLabel),
              subtitle: Text(DateFormat.yMMMd(locale).format(_harvestDate)),
              trailing: const Icon(Icons.calendar_month_outlined),
              onTap: _pickDate,
            ),
            TextFormField(
              controller: _yield,
              decoration: InputDecoration(
                labelText: strings.harvestYieldLabel,
                helperText: strings.harvestYieldOptionalHelp,
              ),
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.isEmpty) return null;
                final amount = double.tryParse(text);
                return amount != null && amount >= 0
                    ? null
                    : strings.invalidHarvestYieldMessage;
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: Text(strings.cancelAction),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: Text(
            _saving ? strings.savingHarvestLabel : strings.confirmHarvestAction,
          ),
        ),
      ],
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.activity});
  final FarmActivity activity;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).toLanguageTag();
    return Card(
      child: ListTile(
        leading: Icon(_activityIcon(activity.activityType)),
        title: Text(_activityLabel(strings, activity.activityType)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              DateFormat.yMMMd(locale).format(activity.occurredOn.toLocal()),
            ),
            if (activity.notes?.isNotEmpty ?? false) Text(activity.notes!),
            Text(
              _sourceLabel(strings, activity.recordedSource),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _AddActivityDialog extends ConsumerStatefulWidget {
  const _AddActivityDialog({required this.cycleId});
  final String cycleId;

  @override
  ConsumerState<_AddActivityDialog> createState() => _AddActivityDialogState();
}

class _AddActivityDialogState extends ConsumerState<_AddActivityDialog> {
  final _notes = TextEditingController();
  var _type = FarmActivityType.irrigation;
  var _occurredOn = DateTime.now();
  var _saving = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: _occurredOn,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (selected != null) setState(() => _occurredOn = selected);
  }

  Future<void> _save() async {
    if (_saving) return;
    final strings = AppLocalizations.of(context)!;
    setState(() => _saving = true);
    try {
      await ref
          .read(farmRepositoryProvider)
          .createActivity(
            widget.cycleId,
            CreateFarmActivityInput(
              activityType: _type,
              occurredOn: _occurredOn,
              notes: _notes.text,
            ),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(apiErrorMessage(strings, error))));
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final allowedTypes = FarmActivityType.values
        .where((value) => value.canFarmerAppend)
        .toList(growable: false);
    return AlertDialog(
      title: Text(strings.addCropActivityTitle),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<FarmActivityType>(
                initialValue: _type,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: strings.cropActivityTypeLabel,
                ),
                items: allowedTypes
                    .map(
                      (value) => DropdownMenuItem(
                        value: value,
                        child: Text(_activityLabel(strings, value)),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (value) => setState(() => _type = value ?? _type),
              ),
              const SizedBox(height: 8),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(strings.cropActivityDateLabel),
                subtitle: Text(DateFormat.yMMMd(locale).format(_occurredOn)),
                trailing: const Icon(Icons.calendar_month_outlined),
                onTap: _pickDate,
              ),
              TextField(
                controller: _notes,
                decoration: InputDecoration(
                  labelText: strings.cropActivityNotesLabel,
                  helperText: strings.cropActivityFactualHelp,
                ),
                maxLength: 1000,
                maxLines: 3,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: Text(strings.cancelAction),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: Text(
            _saving ? strings.savingCropActivity : strings.saveCropActivity,
          ),
        ),
      ],
    );
  }
}

String _activityLabel(AppLocalizations strings, FarmActivityType type) =>
    switch (type) {
      FarmActivityType.sowing => strings.activitySowing,
      FarmActivityType.irrigation => strings.activityIrrigation,
      FarmActivityType.fertilizerApplied => strings.activityFertilizerApplied,
      FarmActivityType.cropProtectionApplied =>
        strings.activityCropProtectionApplied,
      FarmActivityType.pestObserved => strings.activityPestObserved,
      FarmActivityType.diseaseObserved => strings.activityDiseaseObserved,
      FarmActivityType.weeding => strings.activityWeeding,
      FarmActivityType.cropDamage => strings.activityCropDamage,
      FarmActivityType.harvest => strings.activityHarvest,
      FarmActivityType.other => strings.activityOther,
    };

String _sourceLabel(AppLocalizations strings, String source) =>
    switch (source) {
      'FARMER' => strings.activitySourceFarmer,
      'PROMOTER' => strings.activitySourcePromoter,
      _ => strings.activitySourceSystem,
    };

IconData _activityIcon(FarmActivityType type) => switch (type) {
  FarmActivityType.sowing => Icons.eco_outlined,
  FarmActivityType.irrigation => Icons.water_drop_outlined,
  FarmActivityType.fertilizerApplied => Icons.science_outlined,
  FarmActivityType.cropProtectionApplied => Icons.shield_outlined,
  FarmActivityType.pestObserved => Icons.bug_report_outlined,
  FarmActivityType.diseaseObserved => Icons.coronavirus_outlined,
  FarmActivityType.weeding => Icons.grass_outlined,
  FarmActivityType.cropDamage => Icons.warning_amber_outlined,
  FarmActivityType.harvest => Icons.agriculture_outlined,
  FarmActivityType.other => Icons.notes_outlined,
};
