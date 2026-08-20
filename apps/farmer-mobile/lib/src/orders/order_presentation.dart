import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import 'farmer_order.dart';

String orderStatusLabel(AppLocalizations strings, String status) =>
    switch (status) {
      'PENDING_PAYMENT' => strings.orderStatusPendingPayment,
      'PAYMENT_PROCESSING' => strings.paymentProcessingStatus,
      'PAYMENT_FAILED' => strings.paymentFailedStatus,
      'INVENTORY_RESERVED' => strings.inventoryReservedStatus,
      'CONFIRMED' => strings.orderStatusConfirmed,
      'DISTRIBUTOR_ACCEPTED' => strings.orderStatusAccepted,
      'DISTRIBUTOR_REJECTED' => strings.orderStatusRejected,
      'READY_TO_PACK' => strings.orderStatusReadyToPack,
      'PACKED' => strings.orderStatusPacked,
      'READY_FOR_PICKUP' => strings.orderStatusReadyForPickup,
      'OUT_FOR_DELIVERY' => strings.orderStatusOutForDelivery,
      'DELIVERED' => strings.orderStatusDelivered,
      'RETURN_REQUESTED' => strings.orderStatusReturnRequested,
      'DELIVERY_FAILED' => strings.orderStatusDeliveryFailed,
      'CANCELLED' => strings.orderStatusCancelled,
      'CLOSED' => strings.orderStatusClosed,
      _ => _formatCode(status),
    };

String formatPaise(int value) {
  final rupees = value ~/ 100;
  final paise = value % 100;
  return paise == 0
      ? '\u20b9$rupees'
      : '\u20b9$rupees.${paise.toString().padLeft(2, '0')}';
}

String formatOrderDateTime(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final date = MaterialLocalizations.of(context).formatShortDate(local);
  final time = MaterialLocalizations.of(
    context,
  ).formatTimeOfDay(TimeOfDay.fromDateTime(local));
  return '$date, $time';
}

String formatOrderAddress(FarmerOrderAddress address) => [
  address.recipientName,
  address.addressLine1,
  if (address.addressLine2 != null) address.addressLine2!,
  if (address.village != null) address.village!,
  address.city,
  if (address.district != null) address.district!,
  address.state,
  address.pincode,
].join(', ');

String _formatCode(String value) => value
    .split('_')
    .map(
      (part) =>
          part.isEmpty ? part : '${part[0]}${part.substring(1).toLowerCase()}',
    )
    .join(' ');
