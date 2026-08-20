import 'server-only';
import {
  ApiClientError,
  VardhnamApiClient,
  type AssignDeliveryInput,
  type AssignReturnPickupInput,
  type ReturnPickupAssignment,
  type AdvisoryRule,
  type AdvisoryRuleQuery,
  type ApprovalQueueQuery,
  type AuditLogQuery,
  type Brand,
  type CatalogueQuery,
  type CompleteDeliveryInput,
  type CreditNote,
  type InventoryBatch,
  type InventoryAgeingQuery,
  type InventoryAgeingReport,
  type InventoryBatchQuery,
  type InventoryMovement,
  type InventoryMovementQuery,
  type KisanClubMembership,
  type KisanClubMembershipQuery,
  type KisanClubPromoterProfile,
  type KisanClubPromoterProfileQuery,
  type KisanClubProductProgramme,
  type KisanClubProgrammeQuery,
  type KisanClubBenefitRule,
  type KisanClubBenefitRuleQuery,
  type KisanClubFulfilmentAssignment,
  type KisanClubFulfilmentQuery,
  type KisanClubFulfilmentAction,
  type KisanClubCropIntelligenceQuery,
  type KisanClubCropSummary,
  type KisanClubPromoterPerformance,
  type KisanClubPromoterPerformanceQuery,
  type InspectReturnRequestInput,
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
  type ProductInvoiceDocument,
  type PromoterTerritory,
  type PromoterTerritoryQuery,
  type CreatePromoterTerritoryInput,
  type UpdatePromoterTerritoryInput,
  type UpsertKisanClubPromoterProfileInput,
  type CreateKisanClubProgrammeInput,
  type UpdateKisanClubProgrammeInput,
  type CreateKisanClubBenefitRuleInput,
  type UpdateKisanClubBenefitRuleInput,
  type ReassignKisanClubFulfilmentInput,
  type ProductQueueItem,
  type Refund,
  type ConfirmMockRefundInput,
  type CreateRefundInput,
  type ReturnRequest,
  type ReturnRequestQuery,
  type ReturnTransitionInput,
  type SignedFileDownload,
  type Warehouse,
  type WarehouseQuery,
} from '@vardhnam/api-client';
import { readPortalAccessToken } from './auth-session';

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

export async function createBusinessApiClient(): Promise<{
  config: PortalApiConfig;
  client?: VardhnamApiClient;
}> {
  const baseUrl =
    readOptionalEnv('BUSINESS_WEB_API_BASE_URL') ??
    readOptionalEnv('NEXT_PUBLIC_API_BASE_URL') ??
    'http://127.0.0.1:3001';
  const accessToken = await readPortalAccessToken();
  const missingVariables = accessToken ? [] : ['authenticated portal session'];
  const config: PortalApiConfig = {
    baseUrl,
    configured: Boolean(accessToken),
    missingVariables,
  };

  if (!config.configured) {
    return { config };
  }

  return {
    config,
    client: new VardhnamApiClient({
      baseUrl,
      getAccessToken: async () => accessToken,
      fetchOptions: {
        cache: 'no-store',
      },
    }),
  };
}

export async function loadAdvisoryRules(
  query: AdvisoryRuleQuery = {},
): Promise<PortalResult<PaginatedResult<AdvisoryRule>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    const data = await client.listAdvisoryRules(query);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadAdvisoryRule(ruleId: string): Promise<PortalResult<AdvisoryRule>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    const data = await client.getAdvisoryRule(ruleId);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadKisanClubMemberships(
  query: KisanClubMembershipQuery = {},
): Promise<PortalResult<PaginatedResult<KisanClubMembership>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.listKisanClubMemberships(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadKisanClubMembership(
  membershipId: string,
): Promise<PortalResult<KisanClubMembership>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.getKisanClubMembership(membershipId) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function suspendKisanClubMembership(
  membershipId: string,
  reason: string,
): Promise<KisanClubMembership> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.suspendKisanClubMembership(membershipId, { reason });
}

export async function loadPromoterTerritories(
  query: PromoterTerritoryQuery = {},
): Promise<PortalResult<PaginatedResult<PromoterTerritory>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.listPromoterTerritories(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function createPromoterTerritory(
  input: CreatePromoterTerritoryInput,
): Promise<PromoterTerritory> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.createPromoterTerritory(input);
}

export async function updatePromoterTerritory(
  territoryId: string,
  input: UpdatePromoterTerritoryInput,
): Promise<PromoterTerritory> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.updatePromoterTerritory(territoryId, input);
}

export async function loadKisanClubPromoterProfiles(
  query: KisanClubPromoterProfileQuery = {},
): Promise<PortalResult<PaginatedResult<KisanClubPromoterProfile>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.listKisanClubPromoterProfiles(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function upsertKisanClubPromoterProfile(
  input: UpsertKisanClubPromoterProfileInput,
): Promise<KisanClubPromoterProfile> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.upsertKisanClubPromoterProfile(input);
}

export async function loadKisanClubProgrammes(
  query: KisanClubProgrammeQuery = {},
): Promise<PortalResult<PaginatedResult<KisanClubProductProgramme>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.listKisanClubProgrammes(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function createKisanClubProgramme(
  input: CreateKisanClubProgrammeInput,
): Promise<KisanClubProductProgramme> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.createKisanClubProgramme(input);
}

export async function updateKisanClubProgramme(
  programmeId: string,
  input: UpdateKisanClubProgrammeInput,
): Promise<KisanClubProductProgramme> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.updateKisanClubProgramme(programmeId, input);
}

export async function loadKisanClubBenefitRules(
  query: KisanClubBenefitRuleQuery = {},
): Promise<PortalResult<PaginatedResult<KisanClubBenefitRule>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.listKisanClubBenefitRules(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function createKisanClubBenefitRule(
  input: CreateKisanClubBenefitRuleInput,
): Promise<KisanClubBenefitRule> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.createKisanClubBenefitRule(input);
}

export async function updateKisanClubBenefitRule(
  ruleId: string,
  input: UpdateKisanClubBenefitRuleInput,
): Promise<KisanClubBenefitRule> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.updateKisanClubBenefitRule(ruleId, input);
}

export async function loadKisanClubFulfilmentAssignments(
  query: KisanClubFulfilmentQuery = {},
): Promise<PortalResult<PaginatedResult<KisanClubFulfilmentAssignment>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.listKisanClubFulfilmentAssignments(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadKisanClubFulfilmentAssignment(
  assignmentId: string,
): Promise<PortalResult<KisanClubFulfilmentAssignment>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return {
      ok: true,
      config,
      data: await client.getKisanClubFulfilmentAssignment(assignmentId),
    };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function transitionKisanClubFulfilment(
  assignmentId: string,
  action: KisanClubFulfilmentAction,
  reason?: string,
): Promise<KisanClubFulfilmentAssignment> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.transitionKisanClubFulfilment(assignmentId, action, reason ? { reason } : {});
}

export async function reassignKisanClubFulfilment(
  assignmentId: string,
  input: ReassignKisanClubFulfilmentInput,
): Promise<KisanClubFulfilmentAssignment> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.reassignKisanClubFulfilment(assignmentId, input);
}

export async function loadKisanClubCropSummary(
  query: KisanClubCropIntelligenceQuery = {},
): Promise<PortalResult<KisanClubCropSummary>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.getKisanClubCropSummary(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadKisanClubPromoterPerformance(
  query: KisanClubPromoterPerformanceQuery = {},
): Promise<PortalResult<KisanClubPromoterPerformance>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.getKisanClubPromoterPerformance(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadApprovalQueue(
  query: ApprovalQueueQuery,
): Promise<PortalResult<PaginatedResult<OnboardingQueueItem>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    return {
      ok: false,
      config,
      error: 'Sign in to enable server-side API calls.',
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
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    return {
      ok: false as const,
      config,
      error: 'Sign in to enable server-side API calls.',
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
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    return {
      ok: false,
      config,
      error: 'Sign in to enable server-side API calls.',
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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
  const { client, config } = await createBusinessApiClient();
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

export async function loadFulfilmentInvoicePdf(
  orderId: string,
): Promise<PortalResult<ProductInvoiceDocument>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return {
      ok: true,
      config,
      data: await client.getFulfilmentOrderInvoicePdf(orderId),
    };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function requestFulfilmentInvoicePdf(
  orderId: string,
): Promise<ProductInvoiceDocument> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.requestFulfilmentOrderInvoicePdf(orderId);
}

export async function downloadFulfilmentInvoicePdf(orderId: string): Promise<SignedFileDownload> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.downloadFulfilmentOrderInvoicePdf(orderId);
}

export async function loadReturnRequests(
  query: ReturnRequestQuery,
): Promise<PortalResult<PaginatedResult<ReturnRequest>>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.listReturnRequests(query) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadReturnRequestDetail(
  returnRequestId: string,
): Promise<PortalResult<ReturnRequest>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.getReturnRequest(returnRequestId) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function approveReturnRequest(
  returnRequestId: string,
  input: ReturnTransitionInput,
): Promise<ReturnRequest> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.approveReturnRequest(returnRequestId, input);
}

export async function rejectReturnRequest(
  returnRequestId: string,
  input: ReturnTransitionInput,
): Promise<ReturnRequest> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.rejectReturnRequest(returnRequestId, input);
}

export async function markReturnInTransit(
  returnRequestId: string,
  input: ReturnTransitionInput,
): Promise<ReturnRequest> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.markReturnInTransit(returnRequestId, input);
}

export async function assignReturnPickup(
  returnRequestId: string,
  input: AssignReturnPickupInput,
): Promise<ReturnPickupAssignment> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.assignReturnPickup(returnRequestId, input);
}

export async function receiveReturnRequest(
  returnRequestId: string,
  input: ReturnTransitionInput,
): Promise<ReturnRequest> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.receiveReturnRequest(returnRequestId, input);
}

export async function inspectReturnRequest(
  returnRequestId: string,
  input: InspectReturnRequestInput,
): Promise<ReturnRequest> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.inspectReturnRequest(returnRequestId, input);
}

export async function createRefund(
  input: CreateRefundInput,
  idempotencyKey: string,
): Promise<Refund> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.createRefund(input, { idempotencyKey });
}

export async function confirmMockRefund(
  refundId: string,
  input: ConfirmMockRefundInput,
  idempotencyKey: string,
): Promise<Refund> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.confirmMockRefund(refundId, input, { idempotencyKey });
}

export async function loadCreditNote(refundId: string): Promise<PortalResult<CreditNote>> {
  const { client, config } = await createBusinessApiClient();
  if (!client) return missingConfigResult(config);
  try {
    return { ok: true, config, data: await client.getCreditNote(refundId) };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function downloadCreditNote(refundId: string): Promise<SignedFileDownload> {
  const { client, config } = await createBusinessApiClient();
  if (!client) throw new Error(`Set ${config.missingVariables.join(', ')} to enable API calls.`);
  return client.downloadCreditNote(refundId);
}

export async function acceptFulfilmentOrder(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.acceptFulfilmentOrder(orderId, input);
}

export async function rejectFulfilmentOrder(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.rejectFulfilmentOrder(orderId, input);
}

export async function markFulfilmentOrderReadyToPack(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.markFulfilmentOrderReadyToPack(orderId, input);
}

export async function packFulfilmentOrder(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.packFulfilmentOrder(orderId, input);
}

export async function generateProductInvoice(
  orderId: string,
  input: GenerateProductInvoiceInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.generateFulfilmentOrderInvoice(orderId, input);
}

export async function markFulfilmentOrderReadyForPickup(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.markFulfilmentOrderReadyForPickup(orderId, input);
}

export async function assignFulfilmentOrderDelivery(
  orderId: string,
  input: AssignDeliveryInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.assignFulfilmentOrderDelivery(orderId, input);
}

export async function markFulfilmentOrderOutForDelivery(
  orderId: string,
  input: FulfilmentOrderDecisionInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.markFulfilmentOrderOutForDelivery(orderId, input);
}

export async function completeFulfilmentOrderDelivery(
  orderId: string,
  input: CompleteDeliveryInput,
): Promise<ProductOrder> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.completeFulfilmentOrderDelivery(orderId, input);
}

export async function pauseOffer(
  offerId: string,
  input: OfferStatusOperationInput,
): Promise<DistributorOffer> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.pauseOffer(offerId, input);
}

export async function reactivateOffer(
  offerId: string,
  input: OfferStatusOperationInput,
): Promise<DistributorOffer> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.reactivateOffer(offerId, input);
}

export async function archiveOffer(
  offerId: string,
  input: OfferStatusOperationInput,
): Promise<DistributorOffer> {
  const { client, config } = await createBusinessApiClient();
  if (!client) {
    throw new Error(
      `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
    );
  }

  return client.archiveOffer(offerId, input);
}

function missingConfigResult<TData>(config: PortalApiConfig): PortalResult<TData> {
  return {
    ok: false,
    config,
    error: `Set ${config.missingVariables.join(', ')} to enable authenticated server-side API calls.`,
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

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

async function directApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { config } = await createBusinessApiClient();
  const accessToken = await readPortalAccessToken();
  if (!accessToken) {
    throw new Error('An authenticated portal session is required');
  }
  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${config.baseUrl}/api/v1/${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : `API error ${response.status}`;
    throw new Error(message);
  }
  if (!isRecord(payload) || !('data' in payload)) {
    throw new Error('The API returned an invalid response envelope');
  }
  return payload.data as T;
}

export type CommissionRuleStatus = 'ACTIVE' | 'INACTIVE';
export type CommissionEntryStatus = 'PROVISIONAL' | 'FINAL' | 'REVERSED';
export type CommissionEntryType =
  'MARKETPLACE_COMMISSION' | 'DISTRIBUTOR_PAYABLE' | 'PROMOTER_COMMISSION' | 'DELIVERY_FEE';

export interface CommissionRule {
  id: string;
  sellerOrganisationId: string | null;
  marketplaceCommissionBps: number;
  promoterCommissionBps: number;
  deliveryFeePaise: number;
  status: CommissionRuleStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  createdAt: string;
}

export interface CommissionEntry {
  id: string;
  productOrderId: string;
  sellerOrganisationId: string;
  commissionRuleId: string;
  entryType: CommissionEntryType;
  amountPaise: number;
  status: CommissionEntryStatus;
  eligibleAt: string;
  finalizedAt: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  settlementId: string | null;
  recipientUserId: string | null;
  createdAt: string;
}

export interface FinancialLedgerEntry {
  id: string;
  entryType: string;
  amountPaise: number;
  organisationId: string | null;
  productOrderId: string | null;
  paymentIntentId: string | null;
  commissionEntryId: string | null;
  settlementId: string | null;
  requestId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface Settlement {
  id: string;
  sellerOrganisationId: string;
  settlementNumber: string;
  totalPayablePaise: number;
  entryCount: number;
  status: 'ELIGIBLE';
  createdAt: string;
}

export interface SettlementDetail extends Settlement {
  commissionEntries: CommissionEntry[];
}

export interface CreateCommissionRuleInput {
  sellerOrganisationId?: string;
  marketplaceCommissionBps: number;
  reason: string;
}

export interface SupportTicket {
  id: string;
  raisedByUserId: string;
  raisedByRole: string;
  raiserOrganisationId: string | null;
  productOrderId: string | null;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subject: string;
  description: string;
  status:
    | 'OPEN'
    | 'ASSIGNED'
    | 'WAITING_FOR_CUSTOMER'
    | 'WAITING_FOR_SELLER'
    | 'ESCALATED'
    | 'RESOLVED'
    | 'CLOSED'
    | 'REOPENED';
  assignedToUserId: string | null;
  assignedAt: string | null;
  slaDueAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function loadCommissionRules(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<CommissionRule>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<CommissionRule>>(
      `finance/commission-rules?${params}`,
    );
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadCommissionEntries(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<CommissionEntry>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<CommissionEntry>>(
      `finance/commission-entries?${params}`,
    );
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadLedgerEntries(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<FinancialLedgerEntry>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<FinancialLedgerEntry>>(
      `finance/ledger?${params}`,
    );
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadSettlements(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<Settlement>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<Settlement>>(`finance/settlements?${params}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadSettlementDetail(
  settlementId: string,
): Promise<PortalResult<SettlementDetail>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<SettlementDetail>(`finance/settlements/${settlementId}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function createCommissionRule(
  body: CreateCommissionRuleInput,
): Promise<CommissionRule> {
  return directApiFetch<CommissionRule>('finance/commission-rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function finalizeCommissions(): Promise<{ finalizedCount: number }> {
  return directApiFetch<{ finalizedCount: number }>(
    'finance/commission-entries/finalize-eligible',
    {
      method: 'POST',
    },
  );
}

export async function reverseCommission(
  id: string,
  reason: string,
): Promise<{ reversedEntries: CommissionEntry[] }> {
  return directApiFetch<{ reversedEntries: CommissionEntry[] }>(
    `finance/commission-entries/${id}/reverse`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

export async function createSettlement(sellerOrganisationId: string): Promise<Settlement> {
  return directApiFetch<Settlement>('finance/settlements', {
    method: 'POST',
    body: JSON.stringify({ sellerOrganisationId }),
  });
}

export async function loadSupportTickets(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<SupportTicket>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<SupportTicket>>(`support/tickets?${params}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadSupportTicketDetail(
  ticketId: string,
): Promise<PortalResult<SupportTicket>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<SupportTicket>(`support/tickets/${ticketId}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function assignTicket(
  id: string,
  body: { assignedToUserId: string; reason?: string },
): Promise<SupportTicket> {
  return directApiFetch<SupportTicket>(`support/tickets/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export async function markTicketWaiting(
  id: string,
  body: { status: 'WAITING_FOR_CUSTOMER' | 'WAITING_FOR_SELLER'; reason?: string },
): Promise<SupportTicket> {
  return directApiFetch<SupportTicket>(`support/tickets/${id}/mark-waiting`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export async function resumeTicket(id: string, reason?: string): Promise<SupportTicket> {
  return supportTicketAction(id, 'resume', reason);
}
export async function escalateTicket(id: string, reason?: string): Promise<SupportTicket> {
  return supportTicketAction(id, 'escalate', reason);
}
export async function resolveTicket(id: string, resolutionNote: string): Promise<SupportTicket> {
  return directApiFetch<SupportTicket>(`support/tickets/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNote }),
  });
}
export async function closeTicket(id: string, reason?: string): Promise<SupportTicket> {
  return supportTicketAction(id, 'close', reason);
}
export async function reopenTicket(id: string, reason?: string): Promise<SupportTicket> {
  return supportTicketAction(id, 'reopen', reason);
}

async function supportTicketAction(
  id: string,
  action: 'resume' | 'escalate' | 'close' | 'reopen',
  reason?: string,
): Promise<SupportTicket> {
  return directApiFetch<SupportTicket>(`support/tickets/${id}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ ...(reason ? { reason } : {}) }),
  });
}

export type DashboardScope = 'PLATFORM' | 'ORGANISATION' | 'SELF';

export interface DashboardItem {
  code: string;
  label: string;
  scope: DashboardScope;
  count: number;
}

export async function loadDashboardSummary(): Promise<PortalResult<{ items: DashboardItem[] }>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<{ items: DashboardItem[] }>('dashboards/summary');
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

/** Used only by the CSV export route handler -- audited on the backend. */
export async function exportDashboardSummary(): Promise<{ items: DashboardItem[] }> {
  return directApiFetch<{ items: DashboardItem[] }>('dashboards/summary/export');
}

// ---------------------------------------------------------------------------
// Payouts (WP-09r)
// ---------------------------------------------------------------------------

export type PayoutAccountStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export interface PayoutAccount {
  id: string;
  userId: string;
  accountHolderName: string;
  bankName: string;
  /** Backend-masked -- only the last four digits ever leave the API. */
  accountNumber: string;
  ifscCode: string;
  upiId: string | null;
  status: PayoutAccountStatus;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutStatementTotal {
  status: CommissionEntryStatus;
  amountPaise: number;
}

export interface PayoutStatement {
  items: CommissionEntry[];
  page: number;
  limit: number;
  total: number;
  totalsByStatus: PayoutStatementTotal[];
}

export async function loadPayoutAccounts(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<PayoutAccount>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<PayoutAccount>>(`payouts/accounts?${params}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadPayoutAccountByUserId(
  userId: string,
): Promise<PortalResult<PayoutAccount>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<PayoutAccount>(`payouts/accounts/${userId}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function verifyPayoutAccount(
  accountId: string,
  body: { status: 'VERIFIED' | 'REJECTED'; reason?: string },
): Promise<PayoutAccount> {
  return directApiFetch<PayoutAccount>(`payouts/accounts/${accountId}/verify`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * The caller's own account. Distinguishes "not submitted yet" (backend 404s)
 * from a real connection failure so the statement page can render a
 * first-time submission form instead of an error banner.
 */
export async function loadMyPayoutAccount(): Promise<PortalResult<PayoutAccount | null>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<PayoutAccount>('payouts/accounts/me');
    return { ok: true, config, data };
  } catch (error) {
    if (formatApiError(error).toLowerCase().includes('not found')) {
      return { ok: true, config, data: null };
    }
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function upsertMyPayoutAccount(body: {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string;
}): Promise<PayoutAccount> {
  return directApiFetch<PayoutAccount>('payouts/accounts/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function loadMyPayoutStatement(
  query: Record<string, string>,
): Promise<PortalResult<PayoutStatement>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PayoutStatement>(`payouts/statements/me?${params}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

// ---------------------------------------------------------------------------
// Notifications (WP-09r)
// ---------------------------------------------------------------------------

export type NotificationChannel = 'PUSH' | 'SMS' | 'WHATSAPP' | 'EMAIL' | 'IN_APP';
export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface PortalNotification {
  id: string;
  recipientUserId: string;
  channel: NotificationChannel;
  category: string;
  title: string;
  body: string;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  providerReferenceId: string | null;
  readAt: string | null;
  relatedResourceType: string | null;
  relatedResourceId: string | null;
  reason: string | null;
  createdAt: string;
}

export async function loadNotifications(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<PortalNotification>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<PortalNotification>>(
      `notifications?${params}`,
    );
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function dispatchNotification(
  id: string,
): Promise<{ notificationId: string; queued: boolean }> {
  return directApiFetch<{ notificationId: string; queued: boolean }>(
    `notifications/${id}/dispatch`,
    { method: 'POST' },
  );
}

// ---------------------------------------------------------------------------
// Tally (WP-09r)
// ---------------------------------------------------------------------------

export type TallySyncRecordType =
  | 'PARTY_MASTER'
  | 'ITEM_MASTER'
  | 'INVOICE'
  | 'SETTLEMENT'
  | 'COMMISSION_INVOICE'
  | 'CREDIT_NOTE'
  | 'RECEIPT'
  | 'VOUCHER';
export type TallySyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface TallySyncAttempt {
  id: string;
  attemptNumber: number;
  outcome: TallySyncStatus;
  errorCode: string | null;
  errorMessage: string | null;
  performedByUserId: string | null;
  createdAt: string;
}

export interface TallySyncRecord {
  id: string;
  recordType: TallySyncRecordType;
  sourceEntityId: string | null;
  referenceLabelSnapshot: string;
  referenceNumberSnapshot: string | null;
  amountPaise: number | null;
  status: TallySyncStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  tallyReferenceId: string | null;
  reason: string | null;
  attempts?: TallySyncAttempt[];
  createdAt: string;
}

export interface TallyReconciliationRow {
  recordType: TallySyncRecordType;
  status: TallySyncStatus;
  count: number;
  totalAmountPaise: number;
  oldestUnsyncedAgeHours: number | null;
}

export async function loadTallySyncRecords(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<TallySyncRecord>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<TallySyncRecord>>(
      `tally/sync-records?${params}`,
    );
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadTallySyncRecord(id: string): Promise<PortalResult<TallySyncRecord>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<TallySyncRecord>(`tally/sync-records/${id}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadTallyReconciliation(): Promise<PortalResult<TallyReconciliationRow[]>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<TallyReconciliationRow[]>('tally/reconciliation');
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function attemptTallySync(
  id: string,
  body: {
    outcome: TallySyncStatus;
    tallyReferenceId?: string;
    errorCode?: string;
    errorMessage?: string;
    reason?: string;
  },
): Promise<TallySyncRecord> {
  return directApiFetch<TallySyncRecord>(`tally/sync-records/${id}/attempt`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Organisations and memberships (WP-09r)
// ---------------------------------------------------------------------------

export interface PortalOrganisation {
  id: string;
  type: string;
  slug: string;
  legalName: string;
  displayName: string;
  gstin: string | null;
  registeredStateCode: string | null;
  status: OrganisationDirectoryStatus;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
}

export type OrganisationDirectoryStatus =
  'PENDING_VERIFICATION' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface PortalMembership {
  id: string;
  userId: string;
  organisationId: string;
  role: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  createdAt: string;
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    profile: { displayName: string } | null;
  };
}

export interface PortalOrganisationDetail extends PortalOrganisation {
  memberships: PortalMembership[];
}

export async function loadOrganisations(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<PortalOrganisation>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<PortalOrganisation>>(
      `organisations?${params}`,
    );
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadOrganisation(
  organisationId: string,
): Promise<PortalResult<PortalOrganisationDetail>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<PortalOrganisationDetail>(`organisations/${organisationId}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function updateOrganisation(
  organisationId: string,
  body: {
    slug?: string;
    legalName?: string;
    displayName?: string;
    gstin?: string;
    reason?: string;
  },
): Promise<PortalOrganisation> {
  return directApiFetch<PortalOrganisation>(`organisations/${organisationId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function createMembership(
  organisationId: string,
  body: { userId: string; role: string; status?: string },
): Promise<PortalMembership> {
  return directApiFetch<PortalMembership>(`organisations/${organisationId}/memberships`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateMembership(
  organisationId: string,
  membershipId: string,
  body: { status?: string; reason?: string },
): Promise<PortalMembership> {
  return directApiFetch<PortalMembership>(
    `organisations/${organisationId}/memberships/${membershipId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

// ---------------------------------------------------------------------------
// Users (WP-09r)
// ---------------------------------------------------------------------------

export type PortalUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface PortalUser {
  id: string;
  email: string | null;
  phone: string | null;
  status: PortalUserStatus;
  profile: { displayName: string; preferredLocale: string; timezone: string } | null;
  createdAt: string;
}

export interface PortalUserDetail extends PortalUser {
  memberships: Array<PortalMembership & { organisation: PortalOrganisation }>;
}

export async function loadUsers(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<PortalUser>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<PortalUser>>(`users?${params}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadUser(userId: string): Promise<PortalResult<PortalUserDetail>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<PortalUserDetail>(`users/${userId}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function createPortalUser(body: {
  email?: string;
  phone?: string;
  displayName: string;
  preferredLocale?: string;
  timezone?: string;
}): Promise<PortalUser> {
  return directApiFetch<PortalUser>('users', { method: 'POST', body: JSON.stringify(body) });
}

export async function updatePortalUser(
  userId: string,
  body: {
    email?: string;
    phone?: string;
    displayName?: string;
    status?: PortalUserStatus;
    reason?: string;
  },
): Promise<PortalUser> {
  return directApiFetch<PortalUser>(`users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Disputes (WP-09r)
// ---------------------------------------------------------------------------

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'AWAITING_FARMER'
  | 'AWAITING_DISTRIBUTOR'
  | 'RESOLVED_FOR_FARMER'
  | 'RESOLVED_FOR_DISTRIBUTOR'
  | 'RESOLVED_SPLIT'
  | 'CLOSED';
export type DisputeCategory =
  'PRODUCT_QUALITY' | 'DELIVERY' | 'RETURN_DECISION' | 'REFUND_AMOUNT' | 'PAYMENT' | 'OTHER';
export type DisputeResolutionOutcome = 'FARMER' | 'DISTRIBUTOR' | 'SPLIT';

export interface DisputeEvent {
  id: string;
  eventType: string;
  fromStatus: DisputeStatus | null;
  toStatus: DisputeStatus | null;
  actorUserId: string | null;
  actorRole: string | null;
  note: string | null;
  createdAt: string;
}

export interface Dispute {
  id: string;
  productOrderId: string;
  orderNumber: string;
  sellerName: string;
  returnRequestId: string | null;
  returnStatus: string | null;
  farmerUserId: string;
  distributorOrganisationId: string;
  raisedByUserId: string;
  raisedByRole: string;
  againstOrganisationId: string;
  status: DisputeStatus;
  category: DisputeCategory;
  description: string;
  orderStatusBeforeDispute: string;
  assignedToUserId: string | null;
  resolutionOutcome: DisputeResolutionOutcome | null;
  resolutionNote: string | null;
  resolutionAmountPaise: number | null;
  resolvedAt: string | null;
  closedAt: string | null;
  events: DisputeEvent[];
}

export async function loadDisputes(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<Dispute>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<Dispute>>(`disputes?${params}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadDispute(disputeId: string): Promise<PortalResult<Dispute>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<Dispute>(`disputes/${disputeId}`);
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function assignDispute(
  disputeId: string,
  body: { assignedToUserId: string; note?: string },
): Promise<Dispute> {
  return directApiFetch<Dispute>(`disputes/${disputeId}/assign`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function addDisputeNote(disputeId: string, note: string): Promise<Dispute> {
  return directApiFetch<Dispute>(`disputes/${disputeId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function requestDisputeInfo(
  disputeId: string,
  body: { target: 'FARMER' | 'DISTRIBUTOR'; note: string },
): Promise<Dispute> {
  return directApiFetch<Dispute>(`disputes/${disputeId}/request-info`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function resolveDispute(
  disputeId: string,
  body: {
    outcome: DisputeResolutionOutcome;
    resolutionAmountPaise: number;
    resolutionNote: string;
  },
): Promise<Dispute> {
  return directApiFetch<Dispute>(`disputes/${disputeId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function closeDispute(disputeId: string, note: string): Promise<Dispute> {
  return directApiFetch<Dispute>(`disputes/${disputeId}/close`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

// ---------------------------------------------------------------------------
// Admin jobs (WP-09r)
// ---------------------------------------------------------------------------

export interface QueueDepth {
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  deadLetter: number;
}

export interface ScheduledJobDefinition {
  jobName: string;
  pattern: string;
  description: string;
}

export interface DeadLetterEntry {
  id: string;
  originalQueue: string;
  originalJobName: string;
  failedReason: string;
  attemptsMade: number;
  failedAt: string;
}

export async function loadQueues(): Promise<
  PortalResult<{ queues: QueueDepth[]; scheduledJobs: ScheduledJobDefinition[] }>
> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const data = await directApiFetch<{
      queues: QueueDepth[];
      scheduledJobs: ScheduledJobDefinition[];
    }>('admin/jobs/queues');
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function loadDeadLetterJobs(
  query: Record<string, string>,
): Promise<PortalResult<PaginatedResult<DeadLetterEntry>>> {
  const { config } = await createBusinessApiClient();
  if (!config.configured) return missingConfigResult(config);
  try {
    const params = new URLSearchParams(query);
    const data = await directApiFetch<PaginatedResult<DeadLetterEntry>>(
      `admin/jobs/dead-letter?${params}`,
    );
    return { ok: true, config, data };
  } catch (error) {
    return { ok: false, config, error: formatApiError(error) };
  }
}

export async function retryDeadLetterJob(
  jobId: string,
  body: { queue: string; reason?: string },
): Promise<{ queue: string; deadLetterJobId: string; replayJobId: string }> {
  return directApiFetch<{ queue: string; deadLetterJobId: string; replayJobId: string }>(
    `admin/jobs/dead-letter/${encodeURIComponent(jobId)}/retry`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
