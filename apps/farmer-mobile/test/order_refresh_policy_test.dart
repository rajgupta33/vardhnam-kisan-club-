import 'package:flutter_test/flutter_test.dart';
import 'package:vardhnam_farmer_mobile/src/orders/order_refresh_policy.dart';

void main() {
  test('polls statuses that may still advance', () {
    expect(OrderRefreshPolicy.shouldPoll('CONFIRMED'), isTrue);
    expect(OrderRefreshPolicy.shouldPoll('READY_FOR_PICKUP'), isTrue);
    expect(OrderRefreshPolicy.shouldPoll('OUT_FOR_DELIVERY'), isTrue);
    expect(OrderRefreshPolicy.shouldPoll('RETURN_IN_TRANSIT'), isTrue);
  });

  test('does not poll terminal order statuses', () {
    expect(OrderRefreshPolicy.shouldPoll('DISTRIBUTOR_REJECTED'), isFalse);
    expect(OrderRefreshPolicy.shouldPoll('DELIVERED'), isFalse);
    expect(OrderRefreshPolicy.shouldPoll('CANCELLED'), isFalse);
    expect(OrderRefreshPolicy.shouldPoll('REFUNDED'), isFalse);
    expect(OrderRefreshPolicy.shouldPoll('CLOSED'), isFalse);
  });
}
