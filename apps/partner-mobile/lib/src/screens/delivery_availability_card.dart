import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../delivery/delivery_partner_profile.dart';
import '../delivery/delivery_partner_profile_repository.dart';

class DeliveryAvailabilityCard extends ConsumerStatefulWidget {
  const DeliveryAvailabilityCard({super.key});

  @override
  ConsumerState<DeliveryAvailabilityCard> createState() =>
      _DeliveryAvailabilityCardState();
}

class _DeliveryAvailabilityCardState
    extends ConsumerState<DeliveryAvailabilityCard> {
  DeliveryPartnerProfile? _profile;
  bool _loading = true;
  bool _saving = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final profile = await ref
          .read(deliveryPartnerProfileRepositoryProvider)
          .getMyProfile();
      if (mounted) setState(() => _profile = profile);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(bool online) async {
    final strings = AppLocalizations.of(context);
    setState(() => _saving = true);
    try {
      final profile = await ref
          .read(deliveryPartnerProfileRepositoryProvider)
          .updateAvailability(
            online
                ? DeliveryPartnerAvailability.online
                : DeliveryPartnerAvailability.offline,
          );
      if (!mounted) return;
      setState(() => _profile = profile);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            online ? strings.deliveryNowOnline : strings.deliveryNowOffline,
          ),
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(strings.deliveryAvailabilityUpdateFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    if (_loading) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    if (_failed || _profile == null) {
      return Card(
        child: ListTile(
          title: Text(strings.deliveryAvailabilityLoadFailed),
          trailing: IconButton(
            tooltip: strings.tryAgain,
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ),
      );
    }
    final online = _profile!.availability == DeliveryPartnerAvailability.online;
    return Card(
      child: SwitchListTile(
        value: online,
        onChanged: _saving ? null : _toggle,
        secondary: Icon(online ? Icons.location_on : Icons.location_off),
        title: Text(strings.deliveryAvailability),
        subtitle: Text(
          online
              ? strings.deliveryOnlineExplanation
              : strings.deliveryOfflineExplanation,
        ),
      ),
    );
  }
}
