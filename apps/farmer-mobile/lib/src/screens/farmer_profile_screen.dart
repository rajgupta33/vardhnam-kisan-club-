import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../app/theme/vardhnam_colors.dart';
import '../app/theme/vardhnam_spacing.dart';
import '../auth/auth_controller.dart';
import '../core/widgets/vardhnam_components.dart';
import '../localization/locale_controller.dart';
import '../legal/farmer_legal_links.dart';
import '../profile/farmer_profile.dart';
import '../profile/farmer_profile_repository.dart';
import '../presentation/farmer_loading_state.dart';
import '../routing/app_routes.dart';

class FarmerProfileScreen extends ConsumerStatefulWidget {
  const FarmerProfileScreen({super.key});

  @override
  ConsumerState<FarmerProfileScreen> createState() =>
      _FarmerProfileScreenState();
}

class _FarmerProfileScreenState extends ConsumerState<FarmerProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _alternatePhone = TextEditingController();
  final _village = TextEditingController();
  final _district = TextEditingController();
  final _state = TextEditingController();
  final _pincode = TextEditingController();
  final _cropInterests = TextEditingController();

  FarmerProfile? _profile;
  Object? _loadError;
  var _loading = true;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _fullName.dispose();
    _alternatePhone.dispose();
    _village.dispose();
    _district.dispose();
    _state.dispose();
    _pincode.dispose();
    _cropInterests.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _loadError = null;
      });
    }
    try {
      final profile = await ref
          .read(farmerProfileRepositoryProvider)
          .getProfile();
      if (!mounted) return;
      _populate(profile);
      setState(() {
        _profile = profile;
        _loading = false;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error;
        _loading = false;
      });
    }
  }

  void _populate(FarmerProfile profile) {
    _fullName.text = profile.fullName;
    _alternatePhone.text = profile.alternatePhone ?? '';
    _village.text = profile.village ?? '';
    _district.text = profile.district ?? '';
    _state.text = profile.state ?? '';
    _pincode.text = profile.primaryPincode ?? '';
    _cropInterests.text = profile.cropInterests.join(', ');
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final crops = _cropInterests.text
        .split(',')
        .map((crop) => crop.trim())
        .where((crop) => crop.isNotEmpty)
        .toSet()
        .toList(growable: false);
    if (crops.length > 20 || crops.any((crop) => crop.length > 60)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context)!.invalidCropsMessage),
        ),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final locale = ref.read(localeControllerProvider).languageCode;
      final profile = await ref
          .read(farmerProfileRepositoryProvider)
          .saveProfile(
            FarmerProfileInput(
              fullName: _fullName.text.trim(),
              alternatePhone: _optional(_alternatePhone.text),
              preferredLocale: locale == 'hi' ? 'hi-IN' : 'en-IN',
              village: _optional(_village.text),
              district: _optional(_district.text),
              state: _optional(_state.text),
              primaryPincode: _optional(_pincode.text),
              cropInterests: crops,
            ),
          );
      ref.invalidate(farmerProfileProvider);
      if (!mounted) return;
      _populate(profile);
      setState(() => _profile = profile);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context)!.profileSavedMessage),
        ),
      );
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context)!.profileSaveFailed),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String? _optional(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  Future<void> _openLegalLink(Uri? uri) async {
    final strings = AppLocalizations.of(context)!;
    if (uri == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.legalLinkNotConfigured)));
      return;
    }

    try {
      final opened = await ref
          .read(externalLegalLinkLauncherProvider)
          .launch(uri);
      if (opened || !mounted) return;
    } on Object {
      if (!mounted) return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(strings.legalLinkOpenFailed)));
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.accountTitle)),
      body: SafeArea(child: _buildBody(strings)),
    );
  }

  Widget _buildBody(AppLocalizations strings) {
    if (_loading) {
      return FarmerDetailLoadingState(label: strings.loadingProfile);
    }
    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(strings.profileLoadFailed, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _loadProfile,
                child: Text(strings.retryActionLabel),
              ),
            ],
          ),
        ),
      );
    }

    final profile = _profile!;
    final legalLinks = ref.watch(farmerLegalLinksProvider);
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          VardhnamInfoCard(
            backgroundColor: VardhnamColors.surfaceGreen,
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: VardhnamColors.primaryGreen,
                  foregroundColor: Colors.white,
                  child: Text(
                    profile.fullName.trim().isEmpty
                        ? '?'
                        : profile.fullName
                              .trim()
                              .characters
                              .first
                              .toUpperCase(),
                    style: Theme.of(
                      context,
                    ).textTheme.titleLarge?.copyWith(color: Colors.white),
                  ),
                ),
                const SizedBox(width: VardhnamSpacing.medium),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.fullName,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      if (profile.primaryPincode case final pincode?)
                        Text('${strings.primaryPincodeLabel}: $pincode'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: VardhnamSpacing.xLarge),
          VardhnamSectionHeader(title: strings.accountServicesTitle),
          const SizedBox(height: VardhnamSpacing.small),
          VardhnamInfoCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                _AccountRow(
                  icon: Icons.grass_outlined,
                  label: strings.myFarmsTitle,
                  onTap: () => context.push(
                    AppRoutes.myFarms(profile.primaryPincode ?? ''),
                  ),
                ),
                _AccountRow(
                  icon: Icons.location_on_outlined,
                  label: strings.savedAddressesTitle,
                  onTap: () => context.push(AppRoutes.addresses),
                ),
                _AccountRow(
                  icon: Icons.language_outlined,
                  label: strings.languageActionLabel,
                  onTap: () => context.push(AppRoutes.language),
                ),
                _AccountRow(
                  icon: Icons.groups_outlined,
                  label: strings.kisanClubTitle,
                  onTap: () => context.push(AppRoutes.kisanClub),
                ),
                _AccountRow(
                  icon: Icons.support_agent_outlined,
                  label: strings.supportAccountLabel,
                  onTap: () => context.push(AppRoutes.support),
                ),
                _AccountRow(
                  icon: Icons.notifications_outlined,
                  label: strings.notificationsTitle,
                  onTap: () => context.push(AppRoutes.notifications),
                ),
                _AccountRow(
                  icon: Icons.privacy_tip_outlined,
                  label: strings.privacyPolicyLabel,
                  onTap: () => _openLegalLink(legalLinks.privacyPolicyUrl),
                ),
                _AccountRow(
                  icon: Icons.description_outlined,
                  label: strings.termsAndConditionsLabel,
                  onTap: () => _openLegalLink(legalLinks.termsUrl),
                ),
                _AccountRow(
                  icon: Icons.person_remove_outlined,
                  label: strings.requestAccountDeletionLabel,
                  isDestructive: true,
                  onTap: () => _openLegalLink(legalLinks.accountDeletionUrl),
                ),
                _AccountRow(
                  icon: Icons.logout,
                  label: strings.logoutAction,
                  isDestructive: true,
                  showDivider: false,
                  onTap: () async {
                    await ref
                        .read(authSessionControllerProvider.notifier)
                        .logout();
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: VardhnamSpacing.xLarge),
          VardhnamSectionHeader(title: strings.accountProfileDetailsTitle),
          const SizedBox(height: VardhnamSpacing.small),
          Text(strings.profileIntro),
          const SizedBox(height: 16),
          TextFormField(
            controller: _fullName,
            decoration: InputDecoration(labelText: strings.fullNameLabel),
            textCapitalization: TextCapitalization.words,
            maxLength: 120,
            validator: (value) => (value?.trim().length ?? 0) < 2
                ? strings.invalidNameMessage
                : null,
          ),
          TextFormField(
            controller: _alternatePhone,
            decoration: InputDecoration(labelText: strings.alternatePhoneLabel),
            keyboardType: TextInputType.phone,
            maxLength: 20,
          ),
          TextFormField(
            controller: _village,
            decoration: InputDecoration(labelText: strings.villageLabel),
            textCapitalization: TextCapitalization.words,
            maxLength: 80,
          ),
          TextFormField(
            controller: _district,
            decoration: InputDecoration(labelText: strings.districtLabel),
            textCapitalization: TextCapitalization.words,
            maxLength: 80,
          ),
          TextFormField(
            controller: _state,
            decoration: InputDecoration(labelText: strings.stateLabel),
            textCapitalization: TextCapitalization.words,
            maxLength: 80,
          ),
          TextFormField(
            controller: _pincode,
            decoration: InputDecoration(labelText: strings.primaryPincodeLabel),
            keyboardType: TextInputType.number,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            validator: (value) {
              final pincode = value?.trim() ?? '';
              return pincode.isNotEmpty &&
                      !RegExp(r'^[1-9][0-9]{5}$').hasMatch(pincode)
                  ? strings.enterValidPincode
                  : null;
            },
          ),
          TextFormField(
            controller: _cropInterests,
            decoration: InputDecoration(
              labelText: strings.cropInterestsLabel,
              helperText: strings.cropInterestsHelp,
            ),
            textCapitalization: TextCapitalization.words,
            minLines: 1,
            maxLines: 3,
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_outlined),
            label: Text(strings.saveProfileAction),
          ),
          const SizedBox(height: 24),
          Text(
            strings.savedAddressesTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              onPressed: () async {
                await context.push(AppRoutes.addresses);
                if (mounted) await _loadProfile();
              },
              icon: const Icon(Icons.manage_accounts_outlined),
              label: Text(strings.manageAddressesAction),
            ),
          ),
          const SizedBox(height: 8),
          if (profile.addresses.isEmpty)
            Text(strings.noSavedAddresses)
          else
            ...profile.addresses.map(
              (address) => Padding(
                padding: const EdgeInsets.only(bottom: VardhnamSpacing.small),
                child: VardhnamInfoCard(
                  padding: EdgeInsets.zero,
                  child: ListTile(
                    leading: Icon(
                      address.isDefault
                          ? Icons.home
                          : Icons.location_on_outlined,
                    ),
                    title: Text(address.label),
                    subtitle: Text(
                      '${address.addressLine1}, ${address.city}, ${address.state} - ${address.pincode}',
                    ),
                    trailing: address.isDefault
                        ? VardhnamStatusChip(
                            label: strings.defaultAddressLabel,
                            icon: Icons.check_circle_outline,
                          )
                        : null,
                  ),
                ),
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _AccountRow extends StatelessWidget {
  const _AccountRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isDestructive = false,
    this.showDivider = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isDestructive;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final color = isDestructive
        ? Theme.of(context).colorScheme.error
        : VardhnamColors.primaryGreenDark;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ListTile(
          leading: Icon(icon, color: color),
          title: Text(label, style: TextStyle(color: color)),
          trailing: isDestructive ? null : const Icon(Icons.chevron_right),
          onTap: onTap,
        ),
        if (showDivider) const Divider(height: 1),
      ],
    );
  }
}
