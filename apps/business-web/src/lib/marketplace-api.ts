import 'server-only';
import {
  ApiClientError,
  VardhnamApiClient,
  type AssignDeliveryInput,
  type ApprovalQueueQuery,
  type AuditLogQuery,
  type Brand,
  type CatalogueQuery,
  type CompleteDeliveryInput,
  type InventoryBatch,
  type InventoryAgeingQuery,
  type InventoryAgeingReport,
  type InventoryBatchQuery,
  type InventoryMovement,
  type InventoryMovementQuery,
  type OnboardingOrganisation,
  type OnboardingQueueItem,
  type DistributorOffer,
  type FulfilmentOrderDecisionInput,
  type FulfilmentOrderQuery,
  type GenerateProductInvoiceInput,
  type OfferQuery,
  type OfferQueueItem,
  type OfferStatusOperationInput,
  type PaginatedResult,
  type ProductDetail,
  type ProductOrder,
  type ProductQueueItem,
  type Warehouse,
  type WarehouseQuery,
} from '@vardhnam/api-client';

export interface PortalApiConfig {
  baseUrl: string;
  configured: boolean;
  missingVariables: string[];
}

export type PortalResult<TData> =
  | {
      ok: true;
      config: PortalApiConfig;
      data: TData;
    }
  | {
      ok: false;
      config: PortalApiConfig;
      error: string;
    };

const requiredMockVariables = [
  'BUSINESS_WEB_MOCK_USER_ID',
  'BUSINESS_WEB_MOCK_ROLE',
  'BUSINESS_WEB_MOCK_ORGANISATION_ID',
] as const;

export function createBusinessApiClient(): {
  config: PortalApiConfig;
  client?: VardhnamApiClient;
} {
  const baseUrl =
    readOptionalEnv('BUSINESS_WEB_API_BASE_URL') ??
    readOptionalEnv('NEXT_PUBLIC_API_BASE_URL') ??
    'http://127.0.0.1:3001';
  const missingVariables = requiredMockVariables.filter((name) => !readOptionalEnv(name));
  const config: PortalApiConfig = {
    baseUrl,
    configured: missingVariables.length === 0,
    missingVariables,
  };

  if (!config.configured) {
    return { config };
  }

  return {
    config,
    client: new VardhnamApiClient({
      baseUrl,
      defaultHeaders: {
        'x-user-id': readRequiredEnv('BUSINESS_WEB_MOCK_USER_ID'),
        'x-user-role': readRequiredEnv('BUSINESS_WEB_MOCK_ROLE'),
        'x-organisation-id': readRequiredEnv('BUSINESS_WEB_MOCK_ORGANISATION_ID'),
      },
      fetchOptions: {
        cache: 'no-store',
      },
    }),
  };
}

export async function loadApprovalQueue(
  query: ApprovalQueueQuery,
): Promise<PortalResult<PaginatedResult<OnboardingQueueItem>>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return {
      ok: false,
      config,
      error: `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    };
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listOnboardingApprovalQueue(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadAuditLogs(query: AuditLogQuery) {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return {
      ok: false as const,
      config,
      error: `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    };
  }

  try {
    return {
      ok: true as const,
      config,
      data: await client.listAuditLogs(query),
    };
  } catch (error) {
    return {
      ok: false as const,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadOnboardingOrganisation(
  organisationId: string,
): Promise<PortalResult<OnboardingOrganisation>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return {
      ok: false,
      config,
      error: `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    };
  }

  try {
    return {
      ok: true,
      config,
      data: await client.getOnboardingOrganisation(organisationId),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadBrandReviewQueue(
  query: CatalogueQuery,
): Promise<PortalResult<PaginatedResult<Brand>>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listBrandReviewQueue(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadProductReviewQueue(
  query: CatalogueQuery,
): Promise<PortalResult<PaginatedResult<ProductQueueItem>>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listProductReviewQueue(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadProductDetail(productId: string): Promise<PortalResult<ProductDetail>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.getProduct(productId),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadWarehouses(
  query: WarehouseQuery,
): Promise<PortalResult<PaginatedResult<Warehouse>>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listWarehouses(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadWarehouseDetail(warehouseId: string): Promise<PortalResult<Warehouse>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.getWarehouse(warehouseId),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadInventoryBatches(
  query: InventoryBatchQuery,
): Promise<PortalResult<PaginatedResult<InventoryBatch>>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listInventoryBatches(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadInventoryMovements(
  query: InventoryMovementQuery,
): Promise<PortalResult<PaginatedResult<InventoryMovement>>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listInventoryMovements(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadInventoryAgeing(
  query: InventoryAgeingQuery,
): Promise<PortalResult<InventoryAgeingReport>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listInventoryAgeing(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadLowStockInventory(
  query: InventoryAgeingQuery,
): Promise<PortalResult<InventoryAgeingReport>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listLowStockInventory(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadExpiringInventory(
  query: InventoryAgeingQuery,
): Promise<PortalResult<InventoryAgeingReport>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listExpiringInventory(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadOfferReviewQueue(
  query: OfferQuery,
): Promise<PortalResult<PaginatedResult<OfferQueueItem>>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listOfferReviewQueue(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadOfferDetail(offerId: string): Promise<PortalResult<DistributorOffer>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.getOffer(offerId),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadFulfilmentOrders(
  query: FulfilmentOrderQuery,
): Promise<PortalResult<PaginatedResult<ProductOrder>>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.listFulfilmentOrders(query),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function loadFulfilmentOrderDetail(
  orderId: string,
): Promise<PortalResult<ProductOrder>> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    return missingConfigResult(config);
  }

  try {
    return {
      ok: true,
      config,
      data: await client.getFulfilmentOrder(orderId),
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: formatApiError(error),
    };
  }
}

export async function acceptFulfilmentOrder(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.acceptFulfilmentOrder(orderId, input);
}

export async function rejectFulfilmentOrder(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.rejectFulfilmentOrder(orderId, input);
}

export async function markFulfilmentOrderReadyToPack(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.markFulfilmentOrderReadyToPack(orderId, input);
}

export async function packFulfilmentOrder(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.packFulfilmentOrder(orderId, input);
}

export async function generateProductInvoice(
  orderId: string,
  input: GenerateProductInvoiceInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.generateFulfilmentOrderInvoice(orderId, input);
}

export async function markFulfilmentOrderReadyForPickup(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.markFulfilmentOrderReadyForPickup(orderId, input);
}

export async function assignFulfilmentOrderDelivery(
  orderId: string,
  input: AssignDeliveryInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.assignFulfilmentOrderDelivery(orderId, input);
}

export async function markFulfilmentOrderOutForDelivery(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.markFulfilmentOrderOutForDelivery(orderId, input);
}

export async function completeFulfilmentOrderDelivery(
  orderId: string,
  input: CompleteDeliveryInput,
): Promise<ProductOrder> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.completeFulfilmentOrderDelivery(orderId, input);
}

export async function pauseOffer(
  offerId: string,
  input: OfferStatusOperationInput,
): Promise<DistributorOffer> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.pauseOffer(offerId, input);
}

export async function reactivateOffer(
  offerId: string,
  input: OfferStatusOperationInput,
): Promise<DistributorOffer> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.reactivateOffer(offerId, input);
}

export async function archiveOffer(
  offerId: string,
  input: OfferStatusOperationInput,
): Promise<DistributorOffer> {
  const { client, config } = createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
    );
  }

  return client.archiveOffer(offerId, input);
}

function missingConfigResult<TData>(config: PortalApiConfig): PortalResult<TData> {
  return {
    ok: false,
    config,
    error: `Set ${config.missingVariables.join(', ')} to enable server-side mock-auth API calls.`,
  };
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    const code = error.code ? `${error.code}: ` : '';
    return `${code}${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected API error';
}

function readRequiredEnv(name: (typeof requiredMockVariables)[number]): string {
  const value = readOptionalEnv(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}
