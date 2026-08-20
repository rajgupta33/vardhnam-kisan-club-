import type { ProductOrderStatus } from '@vardhnam/api-client';

interface OrderQueueMetricInput {
  itemCount: number;
  status: ProductOrderStatus;
}

const sellerActionStatuses = new Set<ProductOrderStatus>([
  'CONFIRMED',
  'DISTRIBUTOR_ACCEPTED',
  'READY_TO_PACK',
  'PACKED',
]);

export function summarizeOrderQueue(orders: readonly OrderQueueMetricInput[]) {
  return {
    sellerActionCount: orders.filter((order) => sellerActionStatuses.has(order.status)).length,
    itemCount: orders.reduce((total, order) => total + order.itemCount, 0),
  };
}

export function parseOrderPage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
