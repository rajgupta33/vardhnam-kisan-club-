import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../leads/farmer_lead_models.dart';
import '../leads/farmer_lead_repository.dart';
import '../routing/partner_routes.dart';

class FarmerLeadsScreen extends ConsumerStatefulWidget {
  const FarmerLeadsScreen({super.key});

  @override
  ConsumerState<FarmerLeadsScreen> createState() => _FarmerLeadsScreenState();
}

class _FarmerLeadsScreenState extends ConsumerState<FarmerLeadsScreen> {
  final _items = <FarmerLead>[];
  FarmerLeadStatus? _status;
  bool _loading = true;
  bool _loadingMore = false;
  int _page = 0;
  int _total = 0;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
      _items.clear();
      _page = 0;
      _total = 0;
    });
    await _loadPage(1);
  }

  Future<void> _loadPage(int page) async {
    if (page > 1) setState(() => _loadingMore = true);
    try {
      final result = await ref
          .read(farmerLeadRepositoryProvider)
          .listMyLeads(status: _status, page: page);
      if (!mounted) return;
      final byId = {for (final item in _items) item.id: item};
      for (final item in result.items) {
        byId[item.id] = item;
      }
      setState(() {
        _items
          ..clear()
          ..addAll(byId.values);
        _page = result.page;
        _total = result.total;
        _error = null;
      });
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _createLead() async {
    final created = await context.push<bool>(PartnerRoutes.createFarmerLead);
    if (created == true && mounted) await _reload();
  }

  Future<void> _recordSurvey(FarmerLead lead) async {
    await context.push(PartnerRoutes.promoterSurvey, extra: lead);
  }

  Future<void> _recordVisit(FarmerLead lead) async {
    await context.push(PartnerRoutes.recordPromoterVisit, extra: lead);
  }

  Future<void> _markContacted(FarmerLead lead) async {
    await _updateStatus(lead, FarmerLeadStatus.contacted);
  }

  Future<void> _markLost(FarmerLead lead) async {
    final strings = AppLocalizations.of(context);
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(strings.markLeadLost),
        content: TextField(
          controller: controller,
          maxLength: 500,
          decoration: InputDecoration(labelText: strings.lossReason),
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(),
            child: Text(strings.cancelAction),
          ),
          FilledButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.isNotEmpty) context.pop(value);
            },
            child: Text(strings.confirmAction),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason != null && mounted) {
      await _updateStatus(lead, FarmerLeadStatus.lost, reason: reason);
    }
  }

  Future<void> _convertLead(FarmerLead lead) async {
    final strings = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(strings.convertFarmerLead),
        content: Text(strings.convertFarmerLeadHelp),
        actions: [
          TextButton(
            onPressed: () => context.pop(false),
            child: Text(strings.cancelAction),
          ),
          FilledButton(
            onPressed: () => context.pop(true),
            child: Text(strings.confirmConversion),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      final updated = await ref
          .read(farmerLeadRepositoryProvider)
          .convertRegisteredFarmer(lead.id);
      if (!mounted) return;
      setState(() {
        final index = _items.indexWhere((item) => item.id == updated.id);
        if (index >= 0) _items[index] = updated;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.leadConvertedSuccess)));
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.leadConversionFailed)));
    }
  }

  Future<void> _registerWithFarmerOtp(FarmerLead lead) async {
    final strings = AppLocalizations.of(context);
    AssistedFarmerOtpChallenge challenge;
    try {
      challenge = await ref
          .read(farmerLeadRepositoryProvider)
          .requestAssistedRegistrationOtp(lead.id);
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.assistedOtpRequestFailed)));
      return;
    }
    if (!mounted) return;
    var enteredCode = challenge.mockOtpCode ?? '';
    final code = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(strings.registerFarmerWithOtp),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(strings.assistedOtpConsentNotice),
              if (challenge.mockOtpCode != null) ...[
                const SizedBox(height: 8),
                Text(strings.mockOtpCode(challenge.mockOtpCode!)),
              ],
              const SizedBox(height: 12),
              TextFormField(
                initialValue: enteredCode,
                onChanged: (value) => enteredCode = value.trim(),
                autofocus: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: InputDecoration(labelText: strings.farmerOtpCode),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(),
            child: Text(strings.cancelAction),
          ),
          FilledButton(
            onPressed: () {
              if (RegExp(r'^[0-9]{6}$').hasMatch(enteredCode)) {
                context.pop(enteredCode);
              }
            },
            child: Text(strings.verifyAndRegister),
          ),
        ],
      ),
    );
    if (code == null || !mounted) return;
    try {
      final locale = Localizations.localeOf(context).languageCode == 'hi'
          ? 'hi-IN'
          : 'en-IN';
      final updated = await ref
          .read(farmerLeadRepositoryProvider)
          .verifyAssistedRegistrationOtp(
            lead.id,
            code: code,
            preferredLocale: locale,
          );
      if (!mounted) return;
      setState(() {
        final index = _items.indexWhere((item) => item.id == updated.id);
        if (index >= 0) _items[index] = updated;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(strings.assistedRegistrationSuccess)),
      );
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(strings.assistedOtpVerificationFailed)),
      );
    }
  }

  Future<void> _updateStatus(
    FarmerLead lead,
    FarmerLeadStatus status, {
    String? reason,
  }) async {
    final strings = AppLocalizations.of(context);
    try {
      final updated = await ref
          .read(farmerLeadRepositoryProvider)
          .updateStatus(lead.id, status, reason: reason);
      if (!mounted) return;
      setState(() {
        final index = _items.indexWhere((item) => item.id == updated.id);
        if (index >= 0) _items[index] = updated;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.leadUpdated)));
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(strings.leadUpdateFailed)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.farmerLeads)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createLead,
        icon: const Icon(Icons.person_add_alt_1),
        label: Text(strings.captureLead),
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            Text(strings.leadPipelineHelp),
            const SizedBox(height: 12),
            DropdownButtonFormField<FarmerLeadStatus?>(
              initialValue: _status,
              decoration: InputDecoration(labelText: strings.leadStatus),
              items: [
                DropdownMenuItem(value: null, child: Text(strings.allStatuses)),
                for (final status in FarmerLeadStatus.values)
                  DropdownMenuItem(
                    value: status,
                    child: Text(_statusLabel(strings, status)),
                  ),
              ],
              onChanged: (value) {
                _status = value;
                _reload();
              },
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_error != null && _items.isEmpty)
              Center(child: Text(strings.leadsLoadFailed))
            else if (_items.isEmpty)
              Center(child: Text(strings.noFarmerLeads))
            else ...[
              for (final lead in _items)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          lead.fullName,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(lead.phone),
                        Text(_statusLabel(strings, lead.status)),
                        Text(_sourceLabel(strings, lead.source)),
                        if (lead.village != null || lead.pincode != null)
                          Text(
                            [
                              lead.village,
                              lead.pincode,
                            ].whereType<String>().join(' · '),
                          ),
                        if (lead.statusReason case final reason?) Text(reason),
                        Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: TextButton.icon(
                            onPressed: () => _recordVisit(lead),
                            icon: const Icon(Icons.place_outlined),
                            label: Text(strings.recordVisit),
                          ),
                        ),
                        if (lead.status == FarmerLeadStatus.newLead)
                          Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: TextButton(
                              onPressed: () => _markContacted(lead),
                              child: Text(strings.markContacted),
                            ),
                          ),
                        if (lead.status == FarmerLeadStatus.contacted)
                          Wrap(
                            alignment: WrapAlignment.end,
                            spacing: 8,
                            children: [
                              TextButton(
                                onPressed: () => _markLost(lead),
                                child: Text(strings.markLeadLost),
                              ),
                              FilledButton(
                                onPressed: () => _convertLead(lead),
                                child: Text(strings.convertFarmerLead),
                              ),
                              FilledButton.tonal(
                                onPressed: () => _registerWithFarmerOtp(lead),
                                child: Text(strings.registerFarmerWithOtp),
                              ),
                            ],
                          ),
                        if (lead.status == FarmerLeadStatus.converted &&
                            lead.convertedFarmerProfileId != null)
                          Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: FilledButton.tonalIcon(
                              onPressed: () => _recordSurvey(lead),
                              icon: const Icon(Icons.agriculture_outlined),
                              label: Text(strings.recordFarmSurvey),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              if (_items.length < _total)
                OutlinedButton(
                  onPressed: _loadingMore ? null : () => _loadPage(_page + 1),
                  child: Text(strings.loadMore),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

String _statusLabel(AppLocalizations strings, FarmerLeadStatus status) =>
    switch (status) {
      FarmerLeadStatus.newLead => strings.leadNew,
      FarmerLeadStatus.contacted => strings.leadContacted,
      FarmerLeadStatus.converted => strings.leadConverted,
      FarmerLeadStatus.lost => strings.leadLost,
    };

String _sourceLabel(AppLocalizations strings, FarmerLeadSource source) =>
    switch (source) {
      FarmerLeadSource.fieldVisit => strings.leadSourceFieldVisit,
      FarmerLeadSource.referral => strings.leadSourceReferral,
      FarmerLeadSource.campaign => strings.leadSourceCampaign,
      FarmerLeadSource.inbound => strings.leadSourceInbound,
      FarmerLeadSource.other => strings.optionOther,
    };
