import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_error_presentation.dart';
import '../routing/app_routes.dart';
import '../support/farmer_support_repository.dart';
import '../support/farmer_support_ticket.dart';
import '../support/support_presentation.dart';

class CreateSupportTicketScreen extends ConsumerStatefulWidget {
  const CreateSupportTicketScreen({this.orderId, super.key});

  final String? orderId;

  @override
  ConsumerState<CreateSupportTicketScreen> createState() =>
      _CreateSupportTicketScreenState();
}

class _CreateSupportTicketScreenState
    extends ConsumerState<CreateSupportTicketScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();
  var _category = 'ORDER_ISSUE';
  var _priority = 'MEDIUM';
  var _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(strings.createSupportTicketTitle)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(strings.supportTicketCreateIntro),
              if (widget.orderId != null) ...[
                const SizedBox(height: 12),
                InputDecorator(
                  decoration: InputDecoration(
                    labelText: strings.linkedOrderLabel,
                    border: const OutlineInputBorder(),
                  ),
                  child: Text(widget.orderId!),
                ),
              ],
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _category,
                decoration: InputDecoration(
                  labelText: strings.supportCategoryLabel,
                  border: const OutlineInputBorder(),
                ),
                items: [
                  for (final category in _categories)
                    DropdownMenuItem(
                      value: category,
                      child: Text(supportCategoryLabel(strings, category)),
                    ),
                ],
                onChanged: _isSubmitting
                    ? null
                    : (value) => setState(() => _category = value!),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _priority,
                decoration: InputDecoration(
                  labelText: strings.supportPriorityLabel,
                  border: const OutlineInputBorder(),
                ),
                items: [
                  for (final priority in _priorities)
                    DropdownMenuItem(
                      value: priority,
                      child: Text(supportPriorityLabel(strings, priority)),
                    ),
                ],
                onChanged: _isSubmitting
                    ? null
                    : (value) => setState(() => _priority = value!),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _subjectController,
                enabled: !_isSubmitting,
                maxLength: 200,
                decoration: InputDecoration(
                  labelText: strings.supportSubjectLabel,
                  border: const OutlineInputBorder(),
                ),
                validator: (value) => (value?.trim().length ?? 0) < 3
                    ? strings.supportMinimumLengthMessage
                    : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _descriptionController,
                enabled: !_isSubmitting,
                minLines: 4,
                maxLines: 8,
                maxLength: 2000,
                decoration: InputDecoration(
                  labelText: strings.supportDescriptionLabel,
                  alignLabelWithHint: true,
                  border: const OutlineInputBorder(),
                ),
                validator: (value) => (value?.trim().length ?? 0) < 3
                    ? strings.supportMinimumLengthMessage
                    : null,
              ),
              if (_errorMessage != null)
                Text(
                  _errorMessage!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: _isSubmitting ? null : _submit,
                icon: _isSubmitting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_outlined),
                label: Text(strings.submitSupportTicketAction),
              ),
              const SizedBox(height: 10),
              Text(
                strings.supportEvidenceUnavailableMessage,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      final ticket = await ref
          .read(farmerSupportRepositoryProvider)
          .createTicket(
            FarmerSupportTicketInput(
              category: _category,
              priority: _priority,
              subject: _subjectController.text.trim(),
              description: _descriptionController.text.trim(),
              productOrderId: widget.orderId,
            ),
          );
      if (mounted) context.replace(AppRoutes.supportTicket(ticket.id));
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = apiErrorMessage(AppLocalizations.of(context)!, error);
      });
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}

const _categories = [
  'ORDER_ISSUE',
  'PAYMENT_ISSUE',
  'DELIVERY_ISSUE',
  'PRODUCT_QUALITY',
  'ACCOUNT_ISSUE',
  'ONBOARDING_ISSUE',
  'OTHER',
];
const _priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
