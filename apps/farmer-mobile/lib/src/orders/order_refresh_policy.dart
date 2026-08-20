abstract final class OrderRefreshPolicy {
  static const pollInterval = Duration(seconds: 30);

  static bool shouldPoll(String status) => !_terminalStatuses.contains(status);

  static const _terminalStatuses = {
    'DISTRIBUTOR_REJECTED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
    'CLOSED',
  };
}
