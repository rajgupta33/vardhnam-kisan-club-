import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../farms/farm_repository.dart';
import '../kisan_club/kisan_club_membership_repository.dart';
import '../network/api_error_presentation.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';
import 'crop_detail_screen.dart';
import 'farm_detail_screen.dart';

class MyFarmsScreen extends ConsumerStatefulWidget {
  const MyFarmsScreen({
    required this.defaultPincode,
    this.completionMode = false,
    super.key,
  });

  final String defaultPincode;
  final bool completionMode;

  @override
  ConsumerState<MyFarmsScreen> createState() => _MyFarmsScreenState();
}

class _MyFarmsScreenState extends ConsumerState<MyFarmsScreen> {
  List<FarmerFarm>? _farms;
  Object? _error;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final farms = await ref.read(farmRepositoryProvider).listMine();
      if (!mounted) return;
      setState(() => _farms = farms);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createFarm() async {
    final created = await showDialog<bool>(
      context: context,
      builder: (context) =>
          _CreateFarmDialog(defaultPincode: widget.defaultPincode),
    );
    if (created == true) await _load();
  }

  Future<void> _createCropCycle(FarmerFarm farm) async {
    final created = await showDialog<bool>(
      context: context,
      builder: (context) => _CreateCropCycleDialog(farm: farm),
    );
    if (created == true) {
      ref.invalidate(kisanClubMembershipProvider);
      await _load();
      if (widget.completionMode && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocalizations.of(context)!.kisanClubProfileCompletedMessage,
            ),
          ),
        );
        context.go(AppRoutes.kisanClub);
      }
    }
  }

  Future<void> _editCropCycle(
    FarmerFarm farm,
    FarmCropCycleSummary cycle,
  ) async {
    final updated = await showDialog<bool>(
      context: context,
      builder: (context) => _EditCropCycleDialog(farm: farm, cycle: cycle),
    );
    if (updated == true) await _load();
  }

  Future<void> _editFarm(FarmerFarm farm) async {
    final updated = await showDialog<bool>(
      context: context,
      builder: (context) => _EditFarmDialog(farm: farm),
    );
    if (updated == true) await _load();
  }

  Future<void> _openFarm(FarmerFarm farm) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => FarmDetailScreen(
          farm: farm,
          onEdit: () => _editFarm(farm),
          onAddCrop: () => _createCropCycle(farm),
          onEditCrop: (cycle) => _editCropCycle(farm, cycle),
          onOpenDiary: (cycle) => _openDiary(farm, cycle),
        ),
      ),
    );
  }

  Future<void> _openCropDetail(
    FarmerFarm farm,
    FarmCropCycleSummary cycle,
  ) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => CropDetailScreen(
          farm: farm,
          cycle: cycle,
          onEdit: () => _editCropCycle(farm, cycle),
          onOpenDiary: () => _openDiary(farm, cycle),
        ),
      ),
    );
  }

  Future<void> _openDiary(FarmerFarm farm, FarmCropCycleSummary cycle) async {
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    await context.push(
      AppRoutes.cropDiary(
        farm.id,
        cycle.id,
        isHindi ? cycle.cropNameHi : cycle.cropNameEn,
        cycle.status.name,
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.completionMode
              ? strings.kisanClubProfileCompletionTitle
              : strings.myFarmsTitle,
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createFarm,
        icon: const Icon(Icons.add),
        label: Text(strings.addFarmAction),
      ),
      body: SafeArea(
        child: switch ((_loading, _farms, _error)) {
          (true, null, _) => FarmerListLoadingState(
            label: strings.myFarmsLoading,
          ),
          (false, null, final Object error) => VardhnamEmptyState(
            icon: Icons.cloud_off_outlined,
            title: strings.myFarmsTitle,
            message: apiErrorMessage(strings, error),
            actionLabel: strings.retryActionLabel,
            onAction: _load,
          ),
          (_, final List<FarmerFarm> farms, _) => RefreshIndicator(
            onRefresh: _load,
            child: farms.isEmpty
                ? ListView(
                    padding: const EdgeInsets.all(VardhnamSpacing.large),
                    children: [
                      if (widget.completionMode) ...[
                        const _ProfileCompletionCard(hasFarm: false),
                        const SizedBox(height: VardhnamSpacing.xLarge),
                      ],
                      VardhnamEmptyState(
                        icon: Icons.agriculture_outlined,
                        title: strings.addFirstFarmTitle,
                        message: strings.myFarmsEmpty,
                        actionLabel: strings.addFarmAction,
                        onAction: _createFarm,
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                    itemCount: farms.length + (widget.completionMode ? 1 : 0),
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      if (widget.completionMode && index == 0) {
                        return const _ProfileCompletionCard(hasFarm: true);
                      }
                      final farmIndex = widget.completionMode
                          ? index - 1
                          : index;
                      final farm = farms[farmIndex];
                      return _FarmCard(
                        farm: farm,
                        onView: () => _openFarm(farm),
                        onEdit: () => _editFarm(farm),
                        onAddCropCycle: () => _createCropCycle(farm),
                        onEditCropCycle: (cycle) => _editCropCycle(farm, cycle),
                        onOpenCrop: (cycle) => _openCropDetail(farm, cycle),
                      );
                    },
                  ),
          ),
          _ => const SizedBox.shrink(),
        },
      ),
    );
  }
}

class _ProfileCompletionCard extends StatelessWidget {
  const _ProfileCompletionCard({required this.hasFarm});

  final bool hasFarm;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return VardhnamAlertCard(
      icon: hasFarm ? Icons.grass_outlined : Icons.landscape_outlined,
      title: hasFarm
          ? strings.kisanClubProfileStepTwoTitle
          : strings.kisanClubProfileStepOneTitle,
      message:
          '${hasFarm ? strings.kisanClubProfileStepTwoMessage : strings.kisanClubProfileStepOneMessage}\n\n${strings.kisanClubProfileSavedProgressMessage}',
      backgroundColor: VardhnamColors.surfaceGreen,
    );
  }
}

class _FarmCard extends StatelessWidget {
  const _FarmCard({
    required this.farm,
    required this.onView,
    required this.onEdit,
    required this.onAddCropCycle,
    required this.onEditCropCycle,
    required this.onOpenCrop,
  });
  final FarmerFarm farm;
  final VoidCallback onView;
  final VoidCallback onEdit;
  final VoidCallback onAddCropCycle;
  final ValueChanged<FarmCropCycleSummary> onEditCropCycle;
  final ValueChanged<FarmCropCycleSummary> onOpenCrop;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: const BoxDecoration(
                    color: VardhnamColors.surfaceGreen,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.landscape_outlined,
                    color: VardhnamColors.primaryGreenDark,
                  ),
                ),
                const SizedBox(width: VardhnamSpacing.medium),
                Expanded(
                  child: Text(
                    farm.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  tooltip: strings.editFarmAction,
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              strings.farmAreaAndPincode(
                farm.areaAcres.toString(),
                farm.pincode,
              ),
            ),
            Text(_ownershipLabel(strings, farm.ownershipType)),
            if (farm.village?.isNotEmpty ?? false) Text(farm.village!),
            const Divider(height: 24),
            Text(strings.cropCyclesCount(farm.cropCycles.length)),
            for (final cycle in farm.cropCycles.take(3))
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.grass_outlined),
                title: Text(isHindi ? cycle.cropNameHi : cycle.cropNameEn),
                subtitle: Text(
                  '${cycle.season} · ${cycle.areaAcres} ${strings.acresUnit}',
                ),
                trailing:
                    cycle.status == CropCycleStatus.planned ||
                        cycle.status == CropCycleStatus.active
                    ? IconButton(
                        tooltip: strings.editCropCycleAction,
                        onPressed: () => onEditCropCycle(cycle),
                        icon: const Icon(Icons.edit_outlined),
                      )
                    : const Icon(Icons.chevron_right),
                onTap: () => onOpenCrop(cycle),
              ),
            if (farm.cropCycles.isEmpty) Text(strings.noCropCyclesYet),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: onView,
              icon: const Icon(Icons.visibility_outlined),
              label: Text(strings.viewFarmAction),
            ),
            if (farm.isActive) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: onAddCropCycle,
                icon: const Icon(Icons.add),
                label: Text(strings.addCropCycleAction),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EditCropCycleDialog extends ConsumerStatefulWidget {
  const _EditCropCycleDialog({required this.farm, required this.cycle});

  final FarmerFarm farm;
  final FarmCropCycleSummary cycle;

  @override
  ConsumerState<_EditCropCycleDialog> createState() =>
      _EditCropCycleDialogState();
}

class _EditCropCycleDialogState extends ConsumerState<_EditCropCycleDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _variety;
  late final TextEditingController _area;
  late final TextEditingController _season;
  late final Future<List<CropReference>> _crops;
  CropReference? _selectedCrop;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    _variety = TextEditingController(text: widget.cycle.varietyName ?? '');
    _area = TextEditingController(text: widget.cycle.areaAcres.toString());
    _season = TextEditingController(text: widget.cycle.season);
    _crops = ref.read(farmRepositoryProvider).listReferenceCrops();
  }

  @override
  void dispose() {
    _variety.dispose();
    _area.dispose();
    _season.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate() || _saving) return;
    final strings = AppLocalizations.of(context)!;
    setState(() => _saving = true);
    try {
      await ref
          .read(farmRepositoryProvider)
          .updateCropCycle(
            widget.farm.id,
            widget.cycle.id,
            UpdateCropCycleInput(
              cropId: _selectedCrop!.id,
              varietyName: _variety.text,
              areaAcres: double.parse(_area.text),
              season: _season.text,
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
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    return AlertDialog(
      title: Text(strings.editCropCycleTitle),
      content: SizedBox(
        width: 420,
        child: FutureBuilder<List<CropReference>>(
          future: _crops,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: Text(strings.referenceCropsLoading)),
              );
            }
            if (snapshot.hasError) {
              return Text(apiErrorMessage(strings, snapshot.error!));
            }
            final crops = snapshot.data ?? const [];
            if (crops.isEmpty) return Text(strings.referenceCropsEmpty);
            _selectedCrop ??= crops
                .where((crop) => crop.id == widget.cycle.cropId)
                .firstOrNull;
            return Form(
              key: _formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<CropReference>(
                      initialValue: _selectedCrop,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: strings.cropReferenceLabel,
                      ),
                      items: crops
                          .map(
                            (crop) => DropdownMenuItem(
                              value: crop,
                              child: Text(isHindi ? crop.nameHi : crop.nameEn),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (value) => _selectedCrop = value,
                      validator: (value) =>
                          value == null ? strings.cropReferenceRequired : null,
                    ),
                    TextFormField(
                      controller: _variety,
                      decoration: InputDecoration(
                        labelText: strings.cropVarietyLabel,
                      ),
                      maxLength: 120,
                    ),
                    TextFormField(
                      controller: _area,
                      decoration: InputDecoration(
                        labelText: strings.cropAreaLabel,
                        helperText: strings.cropAreaLimit(
                          widget.farm.areaAcres.toString(),
                        ),
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      validator: (value) {
                        final area = double.tryParse(value ?? '');
                        return area != null &&
                                area > 0 &&
                                area <= widget.farm.areaAcres
                            ? null
                            : strings.invalidCropAreaMessage;
                      },
                    ),
                    TextFormField(
                      controller: _season,
                      decoration: InputDecoration(
                        labelText: strings.cropSeasonLabel,
                        hintText: strings.cropSeasonHint,
                      ),
                      textCapitalization: TextCapitalization.characters,
                      maxLength: 40,
                      validator: (value) =>
                          RegExp(r'^[A-Za-z0-9_-]{2,40}$').hasMatch(value ?? '')
                          ? null
                          : strings.invalidCropSeasonMessage,
                    ),
                  ],
                ),
              ),
            );
          },
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
            _saving
                ? strings.savingCropCycleChangesLabel
                : strings.saveCropCycleChangesAction,
          ),
        ),
      ],
    );
  }
}

class _EditFarmDialog extends ConsumerStatefulWidget {
  const _EditFarmDialog({required this.farm});

  final FarmerFarm farm;

  @override
  ConsumerState<_EditFarmDialog> createState() => _EditFarmDialogState();
}

class _EditFarmDialogState extends ConsumerState<_EditFarmDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _village;
  late final TextEditingController _pincode;
  late final TextEditingController _area;
  late FarmOwnershipType _ownership;
  late bool _isActive;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    final farm = widget.farm;
    _name = TextEditingController(text: farm.name);
    _village = TextEditingController(text: farm.village ?? '');
    _pincode = TextEditingController(text: farm.pincode);
    _area = TextEditingController(text: farm.areaAcres.toString());
    _ownership = farm.ownershipType;
    _isActive = farm.isActive;
  }

  @override
  void dispose() {
    _name.dispose();
    _village.dispose();
    _pincode.dispose();
    _area.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate() || _saving) return;
    final strings = AppLocalizations.of(context)!;
    setState(() => _saving = true);
    try {
      await ref
          .read(farmRepositoryProvider)
          .update(
            widget.farm.id,
            UpdateFarmInput(
              name: _name.text,
              village: _village.text,
              pincode: _pincode.text,
              areaAcres: double.parse(_area.text),
              ownershipType: _ownership,
              isActive: _isActive,
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
    return AlertDialog(
      title: Text(strings.editFarmTitle),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _name,
                  decoration: InputDecoration(labelText: strings.farmNameLabel),
                  maxLength: 120,
                  validator: (value) => value?.trim().isEmpty ?? true
                      ? strings.requiredFieldMessage
                      : null,
                ),
                TextFormField(
                  controller: _village,
                  decoration: InputDecoration(
                    labelText: strings.farmVillageLabel,
                  ),
                  maxLength: 120,
                ),
                TextFormField(
                  controller: _pincode,
                  decoration: InputDecoration(labelText: strings.pincodeLabel),
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  validator: (value) => RegExp(r'^\d{6}$').hasMatch(value ?? '')
                      ? null
                      : strings.enterValidPincode,
                ),
                TextFormField(
                  controller: _area,
                  decoration: InputDecoration(labelText: strings.farmAreaLabel),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  validator: (value) {
                    final area = double.tryParse(value ?? '');
                    return area != null && area > 0
                        ? null
                        : strings.invalidFarmAreaMessage;
                  },
                ),
                DropdownButtonFormField<FarmOwnershipType>(
                  initialValue: _ownership,
                  decoration: InputDecoration(
                    labelText: strings.farmOwnershipLabel,
                  ),
                  items: FarmOwnershipType.values
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(_ownershipLabel(strings, value)),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) =>
                      setState(() => _ownership = value ?? _ownership),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(strings.farmActiveLabel),
                  value: _isActive,
                  onChanged: (value) => setState(() => _isActive = value),
                ),
              ],
            ),
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
            _saving
                ? strings.savingFarmChangesLabel
                : strings.saveFarmChangesAction,
          ),
        ),
      ],
    );
  }
}

class _CreateCropCycleDialog extends ConsumerStatefulWidget {
  const _CreateCropCycleDialog({required this.farm});

  final FarmerFarm farm;

  @override
  ConsumerState<_CreateCropCycleDialog> createState() =>
      _CreateCropCycleDialogState();
}

class _CreateCropCycleDialogState
    extends ConsumerState<_CreateCropCycleDialog> {
  final _formKey = GlobalKey<FormState>();
  final _variety = TextEditingController();
  final _area = TextEditingController();
  final _season = TextEditingController();
  late final Future<List<CropReference>> _crops;
  CropReference? _selectedCrop;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    _crops = ref.read(farmRepositoryProvider).listReferenceCrops();
  }

  @override
  void dispose() {
    _variety.dispose();
    _area.dispose();
    _season.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate() || _saving) return;
    final strings = AppLocalizations.of(context)!;
    setState(() => _saving = true);
    try {
      await ref
          .read(farmRepositoryProvider)
          .createCropCycle(
            widget.farm.id,
            CreateCropCycleInput(
              cropId: _selectedCrop!.id,
              varietyName: _variety.text,
              areaAcres: double.parse(_area.text),
              season: _season.text,
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
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    return AlertDialog(
      title: Text(strings.addCropCycleTitle(widget.farm.name)),
      content: SizedBox(
        width: 420,
        child: FutureBuilder<List<CropReference>>(
          future: _crops,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: Text(strings.referenceCropsLoading)),
              );
            }
            if (snapshot.hasError) {
              return Text(apiErrorMessage(strings, snapshot.error!));
            }
            final crops = snapshot.data ?? const [];
            if (crops.isEmpty) return Text(strings.referenceCropsEmpty);
            return Form(
              key: _formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<CropReference>(
                      initialValue: _selectedCrop,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: strings.cropReferenceLabel,
                      ),
                      items: crops
                          .map(
                            (crop) => DropdownMenuItem(
                              value: crop,
                              child: Text(isHindi ? crop.nameHi : crop.nameEn),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (value) =>
                          setState(() => _selectedCrop = value),
                      validator: (value) =>
                          value == null ? strings.cropReferenceRequired : null,
                    ),
                    TextFormField(
                      controller: _variety,
                      decoration: InputDecoration(
                        labelText: strings.cropVarietyLabel,
                      ),
                      maxLength: 120,
                    ),
                    TextFormField(
                      controller: _area,
                      decoration: InputDecoration(
                        labelText: strings.cropAreaLabel,
                        helperText: strings.cropAreaLimit(
                          widget.farm.areaAcres.toString(),
                        ),
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      validator: (value) {
                        final area = double.tryParse(value ?? '');
                        return area != null &&
                                area > 0 &&
                                area <= widget.farm.areaAcres
                            ? null
                            : strings.invalidCropAreaMessage;
                      },
                    ),
                    TextFormField(
                      controller: _season,
                      decoration: InputDecoration(
                        labelText: strings.cropSeasonLabel,
                        hintText: strings.cropSeasonHint,
                      ),
                      textCapitalization: TextCapitalization.characters,
                      maxLength: 40,
                      validator: (value) =>
                          RegExp(r'^[A-Za-z0-9_-]{2,40}$').hasMatch(value ?? '')
                          ? null
                          : strings.invalidCropSeasonMessage,
                    ),
                  ],
                ),
              ),
            );
          },
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
            _saving
                ? strings.savingCropCycleLabel
                : strings.saveCropCycleAction,
          ),
        ),
      ],
    );
  }
}

class _CreateFarmDialog extends ConsumerStatefulWidget {
  const _CreateFarmDialog({required this.defaultPincode});
  final String defaultPincode;

  @override
  ConsumerState<_CreateFarmDialog> createState() => _CreateFarmDialogState();
}

class _CreateFarmDialogState extends ConsumerState<_CreateFarmDialog> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _village = TextEditingController();
  final _area = TextEditingController();
  late final TextEditingController _pincode;
  var _ownership = FarmOwnershipType.owned;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    _pincode = TextEditingController(text: widget.defaultPincode);
  }

  @override
  void dispose() {
    _name.dispose();
    _village.dispose();
    _area.dispose();
    _pincode.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate() || _saving) return;
    final strings = AppLocalizations.of(context)!;
    setState(() => _saving = true);
    try {
      await ref
          .read(farmRepositoryProvider)
          .create(
            CreateFarmInput(
              name: _name.text,
              village: _village.text,
              pincode: _pincode.text,
              areaAcres: double.parse(_area.text),
              ownershipType: _ownership,
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
    return AlertDialog(
      title: Text(strings.addFarmTitle),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _name,
                  decoration: InputDecoration(labelText: strings.farmNameLabel),
                  maxLength: 120,
                  validator: (value) => value?.trim().isEmpty ?? true
                      ? strings.requiredFieldMessage
                      : null,
                ),
                TextFormField(
                  controller: _village,
                  decoration: InputDecoration(
                    labelText: strings.farmVillageLabel,
                  ),
                  maxLength: 120,
                ),
                TextFormField(
                  controller: _pincode,
                  decoration: InputDecoration(labelText: strings.pincodeLabel),
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  validator: (value) => RegExp(r'^\d{6}$').hasMatch(value ?? '')
                      ? null
                      : strings.enterValidPincode,
                ),
                TextFormField(
                  controller: _area,
                  decoration: InputDecoration(labelText: strings.farmAreaLabel),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  validator: (value) {
                    final area = double.tryParse(value ?? '');
                    return area != null && area > 0
                        ? null
                        : strings.invalidFarmAreaMessage;
                  },
                ),
                DropdownButtonFormField<FarmOwnershipType>(
                  initialValue: _ownership,
                  decoration: InputDecoration(
                    labelText: strings.farmOwnershipLabel,
                  ),
                  items: FarmOwnershipType.values
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(_ownershipLabel(strings, value)),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) =>
                      setState(() => _ownership = value ?? _ownership),
                ),
              ],
            ),
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
            _saving ? strings.savingFarmLabel : strings.saveFarmAction,
          ),
        ),
      ],
    );
  }
}

String _ownershipLabel(AppLocalizations strings, FarmOwnershipType value) =>
    switch (value) {
      FarmOwnershipType.owned => strings.farmOwnershipOwned,
      FarmOwnershipType.leased => strings.farmOwnershipLeased,
      FarmOwnershipType.sharecropped => strings.farmOwnershipSharecropped,
      FarmOwnershipType.other => strings.farmOwnershipOther,
    };
