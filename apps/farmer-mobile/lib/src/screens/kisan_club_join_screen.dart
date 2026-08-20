import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../core/widgets/vardhnam_components.dart';
import '../farms/farm_repository.dart';
import '../kisan_club/kisan_club_membership_repository.dart';
import '../kisan_club/kisan_club_models.dart';
import '../profile/farmer_profile_repository.dart';
import '../routing/app_routes.dart';

class KisanClubJoinScreen extends ConsumerStatefulWidget {
  const KisanClubJoinScreen({super.key});

  @override
  ConsumerState<KisanClubJoinScreen> createState() =>
      _KisanClubJoinScreenState();
}

class _KisanClubJoinScreenState extends ConsumerState<KisanClubJoinScreen> {
  final _basicFormKey = GlobalKey<FormState>();
  final _farmFormKey = GlobalKey<FormState>();
  final _cropFormKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();

  final _pincode = TextEditingController();
  final _village = TextEditingController();
  final _district = TextEditingController();
  final _state = TextEditingController();
  final _farmName = TextEditingController();
  final _farmArea = TextEditingController();
  final _cropArea = TextEditingController();
  final _cropVariety = TextEditingController();
  final _cropSeason = TextEditingController();

  String? _farmerName;
  String? _preferredLocale;
  FarmOwnershipType _ownership = FarmOwnershipType.owned;
  CropReference? _selectedCrop;
  DateTime? _sowingDate;
  List<CropReference>? _crops;
  Object? _cropLoadError;
  var _loadingProfile = true;
  var _loadingCrops = false;
  var _cropSelectionAttempted = false;
  var _saving = false;
  var _termsAccepted = false;
  var _advisoryConsent = false;
  var _marketingConsent = false;
  var _locationConsent = false;
  var _step = 0;

  @override
  void initState() {
    super.initState();
    _prefillProfile();
  }

  @override
  void dispose() {
    for (final controller in [
      _pincode,
      _village,
      _district,
      _state,
      _farmName,
      _farmArea,
      _cropArea,
      _cropVariety,
      _cropSeason,
    ]) {
      controller.dispose();
    }
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _prefillProfile() async {
    try {
      final profile = await ref
          .read(farmerProfileRepositoryProvider)
          .getProfile();
      if (!mounted) return;
      _farmerName = profile.fullName;
      _preferredLocale = profile.preferredLocale;
      _pincode.text = profile.primaryPincode ?? '';
      _village.text = profile.village ?? '';
      _district.text = profile.district ?? '';
      _state.text = profile.state ?? '';
    } on Object {
      // The form remains available when optional profile prefill is offline.
    } finally {
      if (mounted) setState(() => _loadingProfile = false);
    }
  }

  Future<void> _loadCrops() async {
    setState(() {
      _loadingCrops = true;
      _cropLoadError = null;
    });
    try {
      final crops = await ref.read(farmRepositoryProvider).listReferenceCrops();
      if (!mounted) return;
      setState(() => _crops = crops);
    } catch (error) {
      if (!mounted) return;
      setState(() => _cropLoadError = error);
    } finally {
      if (mounted) setState(() => _loadingCrops = false);
    }
  }

  void _continueBasic() {
    if (!(_basicFormKey.currentState?.validate() ?? false)) return;
    _showStep(1);
  }

  Future<void> _continueFarm() async {
    if (!(_farmFormKey.currentState?.validate() ?? false)) return;
    if (_cropArea.text.trim().isEmpty) _cropArea.text = _farmArea.text.trim();
    _showStep(2);
    if (_crops == null && !_loadingCrops) await _loadCrops();
  }

  void _continueCrop() {
    setState(() => _cropSelectionAttempted = true);
    final valid = _cropFormKey.currentState?.validate() ?? false;
    if (!valid || _selectedCrop == null || _sowingDate == null) return;
    _showStep(3);
  }

  void _back() {
    if (_saving || _step == 0) return;
    _showStep(_step - 1);
  }

  void _showStep(int step) {
    setState(() => _step = step);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) _scrollController.jumpTo(0);
    });
  }

  Future<void> _pickCrop() async {
    final crops = _crops ?? const <CropReference>[];
    if (crops.isEmpty) return;
    final selected = await showModalBottomSheet<CropReference>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _CropPicker(crops: crops),
    );
    if (selected != null && mounted) {
      setState(() => _selectedCrop = selected);
    }
  }

  Future<void> _pickSowingDate() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: _sowingDate ?? now,
      firstDate: DateTime(now.year - 3),
      lastDate: DateTime(now.year + 1),
    );
    if (selected != null && mounted) setState(() => _sowingDate = selected);
  }

  Future<void> _join() async {
    final strings = AppLocalizations.of(context)!;
    if (!_termsAccepted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.kisanClubTermsRequired)));
      return;
    }

    setState(() => _saving = true);
    final membershipRepository = ref.read(
      kisanClubMembershipRepositoryProvider,
    );
    final farmRepository = ref.read(farmRepositoryProvider);
    try {
      await membershipRepository.join(
        KisanClubMembershipInput(
          homePincode: _pincode.text.trim(),
          homeVillage: _optional(_village.text),
          homeDistrict: _optional(_district.text),
          homeState: _optional(_state.text),
          termsVersion: kisanClubTermsVersion,
        ),
      );
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.kisanClubJoinFailed)));
      setState(() => _saving = false);
      return;
    }

    var consentWarning = false;
    try {
      await membershipRepository.updateConsents(
        KisanClubConsentInput(
          advisoryConsent: _advisoryConsent,
          marketingConsent: _marketingConsent,
          preciseLocationConsent: _locationConsent,
        ),
      );
    } on Object {
      // Optional permissions can be retried from the member dashboard. They do
      // not prevent the required farm profile from being completed.
      consentWarning = true;
    }

    try {
      final farm = await farmRepository.create(
        CreateFarmInput(
          name: _farmName.text,
          village: _optional(_village.text),
          pincode: _pincode.text.trim(),
          areaAcres: double.parse(_farmArea.text),
          ownershipType: _ownership,
        ),
      );
      await farmRepository.createCropCycle(
        farm.id,
        CreateCropCycleInput(
          cropId: _selectedCrop!.id,
          varietyName: _optional(_cropVariety.text),
          areaAcres: double.parse(_cropArea.text),
          season: _cropSeason.text,
          sowingDate: _sowingDate,
        ),
      );
    } on Object {
      ref.invalidate(kisanClubMembershipProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(strings.kisanClubProfileSetupPartial)),
      );
      context.go(AppRoutes.completeKisanClubProfile(_pincode.text.trim()));
      return;
    }

    ref.invalidate(kisanClubMembershipProvider);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          consentWarning
              ? strings.kisanClubJoinConsentWarning
              : strings.kisanClubJoinSuccess,
        ),
      ),
    );
    context.go(AppRoutes.kisanClub);
  }

  String? _optional(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.kisanClubJoinTitle)),
      body: SafeArea(
        child: _loadingProfile
            ? ListView(
                padding: const EdgeInsets.all(VardhnamSpacing.large),
                children: [
                  Semantics(
                    liveRegion: true,
                    child: Text(strings.kisanClubLoading),
                  ),
                  const SizedBox(height: VardhnamSpacing.medium),
                  const VardhnamSkeleton(height: 220),
                  const SizedBox(height: VardhnamSpacing.medium),
                  const VardhnamSkeleton(height: 180),
                ],
              )
            : ListView(
                controller: _scrollController,
                padding: const EdgeInsets.all(VardhnamSpacing.large),
                children: [
                  Semantics(
                    label: strings.kisanClubJoinProgress(_step + 1),
                    child: LinearProgressIndicator(value: (_step + 1) / 4),
                  ),
                  const SizedBox(height: VardhnamSpacing.small),
                  Text(
                    strings.kisanClubJoinProgress(_step + 1),
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  const SizedBox(height: VardhnamSpacing.large),
                  switch (_step) {
                    0 => _basicStep(strings),
                    1 => _farmStep(strings),
                    2 => _cropStep(strings),
                    _ => _confirmationStep(strings),
                  },
                ],
              ),
      ),
    );
  }

  Widget _basicStep(AppLocalizations strings) => Form(
    key: _basicFormKey,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          strings.kisanClubBasicInformationTitle,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: VardhnamSpacing.medium),
        VardhnamInfoCard(
          backgroundColor: VardhnamColors.surfaceGreen,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                strings.kisanClubFarmerDetailsTitle,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (_farmerName?.trim().isNotEmpty ?? false) ...[
                const SizedBox(height: VardhnamSpacing.xSmall),
                Text(_farmerName!),
              ],
              const SizedBox(height: VardhnamSpacing.xSmall),
              Text(
                strings.kisanClubPreferredLanguageLabel(
                  _preferredLocale == 'hi'
                      ? strings.hindiLanguageLabel
                      : strings.englishLanguageLabel,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: VardhnamSpacing.large),
        TextFormField(
          controller: _pincode,
          decoration: InputDecoration(labelText: strings.primaryPincodeLabel),
          keyboardType: TextInputType.number,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          validator: (value) =>
              RegExp(r'^[1-9][0-9]{5}$').hasMatch(value?.trim() ?? '')
              ? null
              : strings.enterValidPincode,
        ),
        TextFormField(
          controller: _village,
          decoration: InputDecoration(labelText: strings.villageLabel),
          textCapitalization: TextCapitalization.words,
          maxLength: 120,
        ),
        TextFormField(
          controller: _district,
          decoration: InputDecoration(labelText: strings.districtLabel),
          textCapitalization: TextCapitalization.words,
          maxLength: 120,
        ),
        TextFormField(
          controller: _state,
          decoration: InputDecoration(labelText: strings.stateLabel),
          textCapitalization: TextCapitalization.words,
          maxLength: 120,
        ),
        FilledButton.icon(
          onPressed: _continueBasic,
          icon: const Icon(Icons.arrow_forward),
          label: Text(strings.continueActionLabel),
        ),
      ],
    ),
  );

  Widget _farmStep(AppLocalizations strings) => Form(
    key: _farmFormKey,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          strings.kisanClubFarmInformationTitle,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: VardhnamSpacing.small),
        Text(strings.kisanClubFarmInformationMessage),
        const SizedBox(height: VardhnamSpacing.large),
        TextFormField(
          controller: _farmName,
          decoration: InputDecoration(labelText: strings.farmNameLabel),
          maxLength: 120,
          textCapitalization: TextCapitalization.words,
          validator: (value) => value?.trim().isEmpty ?? true
              ? strings.requiredFieldMessage
              : null,
        ),
        TextFormField(
          controller: _farmArea,
          decoration: InputDecoration(labelText: strings.farmAreaLabel),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          validator: (value) {
            final area = double.tryParse(value ?? '');
            return area != null && area > 0
                ? null
                : strings.invalidFarmAreaMessage;
          },
        ),
        DropdownButtonFormField<FarmOwnershipType>(
          initialValue: _ownership,
          decoration: InputDecoration(labelText: strings.farmOwnershipLabel),
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
        const SizedBox(height: VardhnamSpacing.medium),
        _navigationButtons(strings, onContinue: _continueFarm),
      ],
    ),
  );

  Widget _cropStep(AppLocalizations strings) {
    if (_loadingCrops) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            strings.kisanClubCropInformationTitle,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: VardhnamSpacing.medium),
          const VardhnamSkeleton(height: 240),
        ],
      );
    }
    if (_cropLoadError != null) {
      return VardhnamErrorState(
        message: strings.networkErrorMessage,
        retryLabel: strings.retryActionLabel,
        onRetry: _loadCrops,
      );
    }
    if (_crops?.isEmpty ?? true) {
      return VardhnamEmptyState(
        icon: Icons.grass_outlined,
        title: strings.kisanClubCropInformationTitle,
        message: strings.referenceCropsEmpty,
      );
    }

    final selectedCrop = _selectedCrop;
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    return Form(
      key: _cropFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            strings.kisanClubCropInformationTitle,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: VardhnamSpacing.small),
          Text(strings.kisanClubCropInformationMessage),
          const SizedBox(height: VardhnamSpacing.large),
          OutlinedButton.icon(
            onPressed: _pickCrop,
            icon: const Icon(Icons.search),
            label: Text(
              selectedCrop == null
                  ? strings.kisanClubSelectCropAction
                  : '${isHindi ? selectedCrop.nameHi : selectedCrop.nameEn} · ${strings.kisanClubChangeCropAction}',
            ),
          ),
          if (_cropSelectionAttempted && selectedCrop == null)
            Padding(
              padding: const EdgeInsets.only(top: VardhnamSpacing.xSmall),
              child: Text(
                strings.cropReferenceRequired,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: VardhnamSpacing.medium),
          TextFormField(
            controller: _cropVariety,
            decoration: InputDecoration(labelText: strings.cropVarietyLabel),
            maxLength: 120,
          ),
          TextFormField(
            controller: _cropArea,
            decoration: InputDecoration(
              labelText: strings.cropAreaLabel,
              helperText: strings.cropAreaLimit(_farmArea.text),
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            validator: (value) {
              final area = double.tryParse(value ?? '');
              final farmArea = double.tryParse(_farmArea.text) ?? 0;
              return area != null && area > 0 && area <= farmArea
                  ? null
                  : strings.invalidCropAreaMessage;
            },
          ),
          TextFormField(
            controller: _cropSeason,
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
          const SizedBox(height: VardhnamSpacing.small),
          OutlinedButton.icon(
            onPressed: _pickSowingDate,
            icon: const Icon(Icons.calendar_today_outlined),
            label: Text(
              _sowingDate == null
                  ? strings.kisanClubSelectSowingDateAction
                  : '${strings.kisanClubSowingDateLabel}: ${MaterialLocalizations.of(context).formatMediumDate(_sowingDate!)}',
            ),
          ),
          if (_cropSelectionAttempted && _sowingDate == null)
            Padding(
              padding: const EdgeInsets.only(top: VardhnamSpacing.xSmall),
              child: Text(
                strings.kisanClubSowingDateRequired,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: VardhnamSpacing.large),
          _navigationButtons(strings, onContinue: _continueCrop),
        ],
      ),
    );
  }

  Widget _confirmationStep(AppLocalizations strings) {
    final crop = _selectedCrop!;
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          strings.kisanClubConfirmDetailsTitle,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: VardhnamSpacing.medium),
        _ReviewCard(
          title: strings.kisanClubFarmerDetailsTitle,
          lines: [
            if (_farmerName?.trim().isNotEmpty ?? false) _farmerName!,
            _locationSummary(),
            _pincode.text,
          ],
        ),
        const SizedBox(height: VardhnamSpacing.medium),
        _ReviewCard(
          title: strings.kisanClubFarmReviewTitle,
          lines: [
            _farmName.text,
            '${_farmArea.text} ${strings.acresUnit}',
            _ownershipLabel(strings, _ownership),
          ],
        ),
        const SizedBox(height: VardhnamSpacing.medium),
        _ReviewCard(
          title: strings.kisanClubCropReviewTitle,
          lines: [
            isHindi ? crop.nameHi : crop.nameEn,
            if (_cropVariety.text.trim().isNotEmpty) _cropVariety.text.trim(),
            '${_cropArea.text} ${strings.acresUnit}',
            _cropSeason.text.toUpperCase(),
            '${strings.kisanClubSowingDateLabel}: ${MaterialLocalizations.of(context).formatMediumDate(_sowingDate!)}',
          ],
        ),
        const SizedBox(height: VardhnamSpacing.large),
        VardhnamInfoCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(strings.kisanClubTermsSummary),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _termsAccepted,
                title: Text(strings.kisanClubAcceptTerms),
                onChanged: _saving
                    ? null
                    : (value) =>
                          setState(() => _termsAccepted = value ?? false),
              ),
            ],
          ),
        ),
        const SizedBox(height: VardhnamSpacing.large),
        VardhnamInfoCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                strings.kisanClubOptionalConsentsTitle,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: VardhnamSpacing.xSmall),
              Text(strings.kisanClubOptionalConsentsMessage),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _advisoryConsent,
                title: Text(strings.kisanClubAdvisoryConsent),
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _advisoryConsent = value),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _marketingConsent,
                title: Text(strings.kisanClubMarketingConsent),
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _marketingConsent = value),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _locationConsent,
                title: Text(strings.kisanClubLocationConsent),
                subtitle: Text(strings.kisanClubLocationConsentHelp),
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _locationConsent = value),
              ),
            ],
          ),
        ),
        const SizedBox(height: VardhnamSpacing.large),
        OutlinedButton.icon(
          onPressed: _saving ? null : _back,
          icon: const Icon(Icons.arrow_back),
          label: Text(strings.backActionLabel),
        ),
        const SizedBox(height: VardhnamSpacing.small),
        FilledButton.icon(
          onPressed: _saving ? null : _join,
          icon: _saving
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.agriculture),
          label: Text(strings.kisanClubJoinAction),
        ),
      ],
    );
  }

  Widget _navigationButtons(
    AppLocalizations strings, {
    required VoidCallback onContinue,
  }) => Row(
    children: [
      Expanded(
        child: OutlinedButton.icon(
          onPressed: _back,
          icon: const Icon(Icons.arrow_back),
          label: Text(strings.backActionLabel),
        ),
      ),
      const SizedBox(width: VardhnamSpacing.small),
      Expanded(
        child: FilledButton.icon(
          onPressed: onContinue,
          icon: const Icon(Icons.arrow_forward),
          label: Text(strings.continueActionLabel),
        ),
      ),
    ],
  );

  String _locationSummary() => [
    _village.text.trim(),
    _district.text.trim(),
    _state.text.trim(),
  ].where((value) => value.isNotEmpty).join(', ');
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.title, required this.lines});

  final String title;
  final List<String> lines;

  @override
  Widget build(BuildContext context) => VardhnamInfoCard(
    backgroundColor: VardhnamColors.surfaceGreen,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: VardhnamSpacing.small),
        for (final line in lines.where((line) => line.trim().isNotEmpty))
          Text(line),
      ],
    ),
  );
}

class _CropPicker extends StatefulWidget {
  const _CropPicker({required this.crops});

  final List<CropReference> crops;

  @override
  State<_CropPicker> createState() => _CropPickerState();
}

class _CropPickerState extends State<_CropPicker> {
  var _query = '';

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final isHindi = Localizations.localeOf(context).languageCode == 'hi';
    final query = _query.trim().toLowerCase();
    final visible = widget.crops
        .where((crop) {
          if (query.isEmpty) return true;
          return crop.nameEn.toLowerCase().contains(query) ||
              crop.nameHi.contains(_query.trim()) ||
              crop.code.toLowerCase().contains(query);
        })
        .toList(growable: false);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          VardhnamSpacing.large,
          VardhnamSpacing.large,
          VardhnamSpacing.large,
          MediaQuery.viewInsetsOf(context).bottom + VardhnamSpacing.large,
        ),
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.7,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                strings.kisanClubSelectCropAction,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: VardhnamSpacing.medium),
              TextField(
                autofocus: true,
                decoration: InputDecoration(
                  labelText: strings.kisanClubSearchCropLabel,
                  prefixIcon: const Icon(Icons.search),
                ),
                onChanged: (value) => setState(() => _query = value),
              ),
              const SizedBox(height: VardhnamSpacing.medium),
              Expanded(
                child: ListView.separated(
                  itemCount: visible.length,
                  separatorBuilder: (context, index) => const Divider(),
                  itemBuilder: (context, index) {
                    final crop = visible[index];
                    return ListTile(
                      leading: const Icon(Icons.grass_outlined),
                      title: Text(isHindi ? crop.nameHi : crop.nameEn),
                      subtitle: Text(crop.code),
                      onTap: () => Navigator.pop(context, crop),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
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
