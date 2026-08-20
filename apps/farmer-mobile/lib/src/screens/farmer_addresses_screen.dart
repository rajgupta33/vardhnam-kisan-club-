import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../addresses/farmer_address_repository.dart';
import '../profile/farmer_profile.dart';
import '../profile/farmer_profile_repository.dart';
import '../presentation/farmer_loading_state.dart';

class FarmerAddressesScreen extends ConsumerStatefulWidget {
  const FarmerAddressesScreen({super.key});

  @override
  ConsumerState<FarmerAddressesScreen> createState() =>
      _FarmerAddressesScreenState();
}

class _FarmerAddressesScreenState extends ConsumerState<FarmerAddressesScreen> {
  List<FarmerAddress> _addresses = const [];
  Object? _loadError;
  String? _updatingAddressId;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  Future<void> _loadAddresses() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final addresses = await ref
          .read(farmerAddressRepositoryProvider)
          .listAddresses();
      if (!mounted) return;
      setState(() {
        _addresses = addresses;
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

  Future<void> _openEditor([FarmerAddress? address]) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _AddressEditorSheet(address: address),
    );
    if (changed == true && mounted) {
      await _loadAddresses();
    }
  }

  Future<void> _setDefault(FarmerAddress address) async {
    setState(() => _updatingAddressId = address.id);
    try {
      await ref
          .read(farmerAddressRepositoryProvider)
          .setDefaultAddress(address.id);
      ref.invalidate(farmerProfileProvider);
      if (!mounted) return;
      await _loadAddresses();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocalizations.of(context)!.defaultAddressUpdatedMessage,
          ),
        ),
      );
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context)!.addressSaveFailed),
        ),
      );
    } finally {
      if (mounted) setState(() => _updatingAddressId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.addressesTitle)),
      floatingActionButton: _loading || _loadError != null
          ? null
          : FloatingActionButton.extended(
              onPressed: _openEditor,
              icon: const Icon(Icons.add_location_alt_outlined),
              label: Text(strings.addAddressAction),
            ),
      body: SafeArea(child: _buildBody(strings)),
    );
  }

  Widget _buildBody(AppLocalizations strings) {
    if (_loading) {
      return FarmerListLoadingState(label: strings.loadingAddresses);
    }
    if (_loadError != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(strings.addressesLoadFailed),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _loadAddresses,
              child: Text(strings.retryActionLabel),
            ),
          ],
        ),
      );
    }
    if (_addresses.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(strings.noSavedAddresses, textAlign: TextAlign.center),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadAddresses,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        itemCount: _addresses.length,
        itemBuilder: (context, index) {
          final address = _addresses[index];
          final updating = _updatingAddressId == address.id;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          address.label,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      if (address.isDefault)
                        Chip(label: Text(strings.defaultAddressLabel)),
                    ],
                  ),
                  Text(address.recipientName),
                  Text(address.phone),
                  const SizedBox(height: 4),
                  Text(_formatAddress(address)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      TextButton.icon(
                        onPressed: updating ? null : () => _openEditor(address),
                        icon: const Icon(Icons.edit_outlined),
                        label: Text(strings.editAddressAction),
                      ),
                      if (!address.isDefault)
                        TextButton.icon(
                          onPressed: updating
                              ? null
                              : () => _setDefault(address),
                          icon: updating
                              ? const SizedBox.square(
                                  dimension: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.home_outlined),
                          label: Text(strings.setDefaultAddressAction),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  String _formatAddress(FarmerAddress address) {
    return [
      address.addressLine1,
      address.addressLine2,
      address.village,
      address.city,
      address.district,
      address.state,
      address.pincode,
      address.landmark,
    ].whereType<String>().where((part) => part.isNotEmpty).join(', ');
  }
}

class _AddressEditorSheet extends ConsumerStatefulWidget {
  const _AddressEditorSheet({this.address});

  final FarmerAddress? address;

  @override
  ConsumerState<_AddressEditorSheet> createState() =>
      _AddressEditorSheetState();
}

class _AddressEditorSheetState extends ConsumerState<_AddressEditorSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _label;
  late final TextEditingController _recipientName;
  late final TextEditingController _phone;
  late final TextEditingController _addressLine1;
  late final TextEditingController _addressLine2;
  late final TextEditingController _village;
  late final TextEditingController _city;
  late final TextEditingController _district;
  late final TextEditingController _state;
  late final TextEditingController _pincode;
  late final TextEditingController _landmark;
  late bool _isDefault;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    final address = widget.address;
    _label = TextEditingController(text: address?.label);
    _recipientName = TextEditingController(text: address?.recipientName);
    _phone = TextEditingController(text: address?.phone);
    _addressLine1 = TextEditingController(text: address?.addressLine1);
    _addressLine2 = TextEditingController(text: address?.addressLine2);
    _village = TextEditingController(text: address?.village);
    _city = TextEditingController(text: address?.city);
    _district = TextEditingController(text: address?.district);
    _state = TextEditingController(text: address?.state);
    _pincode = TextEditingController(text: address?.pincode);
    _landmark = TextEditingController(text: address?.landmark);
    _isDefault = address?.isDefault ?? false;
  }

  @override
  void dispose() {
    _label.dispose();
    _recipientName.dispose();
    _phone.dispose();
    _addressLine1.dispose();
    _addressLine2.dispose();
    _village.dispose();
    _city.dispose();
    _district.dispose();
    _state.dispose();
    _pincode.dispose();
    _landmark.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final input = FarmerAddressInput(
      label: _label.text.trim(),
      recipientName: _recipientName.text.trim(),
      phone: _normalisePhone(_phone.text),
      addressLine1: _addressLine1.text.trim(),
      addressLine2: _optional(_addressLine2.text),
      village: _optional(_village.text),
      city: _city.text.trim(),
      district: _optional(_district.text),
      state: _state.text.trim(),
      pincode: _pincode.text.trim(),
      landmark: _optional(_landmark.text),
      isDefault: _isDefault,
    );
    try {
      final repository = ref.read(farmerAddressRepositoryProvider);
      final address = widget.address;
      if (address == null) {
        await repository.createAddress(input);
      } else {
        await repository.updateAddress(address.id, input);
      }
      ref.invalidate(farmerProfileProvider);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on Object {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context)!.addressSaveFailed),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    final editingDefault = widget.address?.isDefault == true;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.94,
        maxChildSize: 0.98,
        minChildSize: 0.6,
        builder: (context, scrollController) => Form(
          key: _formKey,
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.all(20),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.address == null
                          ? strings.addAddressTitle
                          : strings.editAddressTitle,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  IconButton(
                    tooltip: strings.closeAction,
                    onPressed: _saving
                        ? null
                        : () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _field(_label, strings.addressLabelField, 40, minimum: 2),
              _field(
                _recipientName,
                strings.recipientNameLabel,
                120,
                minimum: 2,
              ),
              TextFormField(
                controller: _phone,
                decoration: InputDecoration(
                  labelText: strings.addressPhoneLabel,
                ),
                keyboardType: TextInputType.phone,
                maxLength: 20,
                validator: (value) => _isValidIndianPhone(value ?? '')
                    ? null
                    : strings.invalidPhoneMessage,
              ),
              _field(_addressLine1, strings.addressLine1Label, 180, minimum: 3),
              _field(_addressLine2, strings.addressLine2Label, 180),
              _field(_village, strings.villageLabel, 80),
              _field(_city, strings.cityLabel, 80, minimum: 2),
              _field(_district, strings.districtLabel, 80),
              _field(_state, strings.stateLabel, 80, minimum: 2),
              TextFormField(
                controller: _pincode,
                decoration: InputDecoration(labelText: strings.pincodeLabel),
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (value) =>
                    RegExp(r'^[1-9][0-9]{5}$').hasMatch(value ?? '')
                    ? null
                    : strings.enterValidPincode,
              ),
              _field(_landmark, strings.landmarkLabel, 120),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(strings.makeDefaultAddressLabel),
                subtitle: editingDefault
                    ? Text(strings.defaultAddressCannotBeUnsetHelp)
                    : null,
                value: _isDefault,
                onChanged: editingDefault
                    ? null
                    : (value) => setState(() => _isDefault = value),
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
                label: Text(strings.saveAddressAction),
              ),
            ],
          ),
        ),
      ),
    );
  }

  TextFormField _field(
    TextEditingController controller,
    String label,
    int maximum, {
    int? minimum,
  }) => TextFormField(
    controller: controller,
    decoration: InputDecoration(labelText: label),
    textCapitalization: TextCapitalization.words,
    maxLength: maximum,
    validator: minimum == null
        ? null
        : (value) => (value?.trim().length ?? 0) < minimum
              ? AppLocalizations.of(context)!.requiredFieldMessage
              : null,
  );

  String? _optional(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  bool _isValidIndianPhone(String value) => RegExp(r'^[6-9][0-9]{9}$').hasMatch(
    value
        .replaceAll(RegExp(r'\D'), '')
        .replaceFirst(RegExp(r'^91(?=[6-9][0-9]{9}$)'), ''),
  );

  String _normalisePhone(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    final local = digits.length == 12 && digits.startsWith('91')
        ? digits.substring(2)
        : digits;
    return '+91$local';
  }
}
