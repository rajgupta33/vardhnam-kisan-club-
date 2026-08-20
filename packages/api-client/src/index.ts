export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | undefined>;
  defaultHeaders?: Record<string, string>;
  fetchOptions?: RequestInit;
}

export interface ApiSuccessEnvelope<TData> {
  data: TData;
  requestId: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    statusCode: number;
    requestId: string;
    timestamp: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type OrganisationType = 'VARDHNAM' | 'COMPANY' | 'DISTRIBUTOR' | 'SERVICE_PROVIDER';

export type OrganisationStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export type KycDocumentType =
  | 'GST_CERTIFICATE'
  | 'PAN'
  | 'BUSINESS_REGISTRATION'
  | 'DISTRIBUTOR_AUTHORISATION'
  | 'BANK_PROOF'
  | 'ADDRESS_PROOF'
  | 'LICENCE'
  | 'OTHER';

export type KycDocumentStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type OrganisationReviewDecision = 'APPROVE' | 'REJECT';

export type CatalogueStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export type ProductDocumentType =
  | 'LABEL'
  | 'REGISTRATION_CERTIFICATE'
  | 'SAFETY_DATA_SHEET'
  | 'PRODUCT_IMAGE'
  | 'TEST_REPORT'
  | 'OTHER';

export type CatalogueReviewDecision = 'APPROVE' | 'REJECT';

export type AdvisoryCategory =
  | 'CROP_STAGE'
  | 'IRRIGATION'
  | 'NUTRITION'
  | 'PEST_MONITORING'
  | 'DISEASE_RISK'
  | 'HARVEST'
  | 'GENERAL_PRACTICE';

export type AdvisoryRuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface AdvisoryRule {
  id: string;
  cropName: string;
  varietyName?: string | null;
  category: AdvisoryCategory;
  minDaysAfterSowing: number;
  maxDaysAfterSowing: number;
  eligibleStates: string[];
  eligibleDistricts: string[];
  seasons: string[];
  titleEn: string;
  bodyEn: string;
  titleHi: string;
  bodyHi: string;
  status: AdvisoryRuleStatus;
  version: number;
  authoredByUserId?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  sourceReference?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisoryRuleQuery {
  status?: AdvisoryRuleStatus;
  category?: AdvisoryCategory;
  page?: number;
  limit?: number;
}

export interface CreateAdvisoryRuleInput {
  cropName: string;
  varietyName?: string;
  category: AdvisoryCategory;
  minDaysAfterSowing: number;
  maxDaysAfterSowing: number;
  eligibleStates?: string[];
  eligibleDistricts?: string[];
  seasons?: string[];
  titleEn: string;
  bodyEn: string;
  titleHi: string;
  bodyHi: string;
  sourceReference?: string;
  reason: string;
}

export type UpdateAdvisoryRuleInput = Partial<CreateAdvisoryRuleInput>;

export interface ReviewAdvisoryRuleInput {
  approved: boolean;
  reason?: string;
}

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type InventoryBatchStatus = 'ACTIVE' | 'BLOCKED' | 'EXPIRED';

export type InventoryMovementType =
  | 'OPENING_STOCK'
  | 'STOCK_RECEIVED'
  | 'MANUAL_INCREASE'
  | 'MANUAL_DECREASE'
  | 'DAMAGE_WRITE_OFF'
  | 'RESERVED_FOR_ORDER'
  | 'RELEASED_FROM_ORDER';

export type DistributorOfferStatus =
  'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'ARCHIVED';

export type FulfilmentMode = 'DISTRIBUTOR_FULFILLED' | 'VARDHNAM_FULFILLED' | 'PICKUP';

export type OfferReviewDecision = 'APPROVE' | 'REJECT';

export type CartStatus = 'ACTIVE' | 'ABANDONED';

export type OrderType = 'PRODUCT_ORDER' | 'SERVICE_ORDER';

export type ProductCheckoutStatus =
  'PENDING_PAYMENT' | 'PAYMENT_PROCESSING' | 'PAYMENT_FAILED' | 'PAID' | 'CANCELLED';

export type ProductOrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_FAILED'
  | 'CONFIRMED'
  | 'DISTRIBUTOR_ACCEPTED'
  | 'DISTRIBUTOR_REJECTED'
  | 'INVENTORY_RESERVED'
  | 'READY_TO_PACK'
  | 'PACKED'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLATION_REQUESTED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'RETURN_IN_TRANSIT'
  | 'RETURNED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'CLOSED';

export type ReturnRequestStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ReturnPickupAssignmentStatus =
  'ASSIGNED' | 'ACCEPTED' | 'REJECTED' | 'COLLECTED' | 'CANCELLED';

export type ReturnReasonCode =
  | 'DAMAGED_IN_TRANSIT'
  | 'WRONG_ITEM'
  | 'EXPIRED_OR_NEAR_EXPIRY'
  | 'QUALITY_ISSUE'
  | 'NOT_AS_DESCRIBED'
  | 'ORDERED_BY_MISTAKE'
  | 'OTHER';

export type ReturnInspectionOutcome =
  'RESTOCKABLE' | 'DAMAGED_WRITE_OFF' | 'QUARANTINED' | 'REJECTED_RETURN';

export type ProductInvoiceStatus = 'GENERATED' | 'VOIDED';

export type ProductDispatchStatus = 'READY_FOR_PICKUP' | 'CANCELLED';

export type ProductDeliveryAssignmentStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED';

export type DeliveryFailureReasonCode =
  | 'FARMER_UNAVAILABLE'
  | 'FARMER_REFUSED'
  | 'ADDRESS_NOT_FOUND'
  | 'ACCESS_RESTRICTED'
  | 'VEHICLE_BREAKDOWN'
  | 'WEATHER_OR_ROUTE_BLOCKED'
  | 'PACKAGE_DAMAGED'
  | 'OTHER';

export type PaymentProviderMode = 'MOCK';

export type PaymentIntentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export type PaymentEventType =
  'INTENT_CREATED' | 'CONFIRMATION_STARTED' | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED';

export type MockPaymentOutcome = 'SUCCESS' | 'FAILURE';

export type RefundStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type RefundMethod = 'ORIGINAL_PAYMENT_METHOD' | 'MANUAL_BANK_TRANSFER' | 'ADJUSTMENT';
export type RefundEventType =
  'REFUND_CREATED' | 'PROCESSING_STARTED' | 'REFUND_SUCCEEDED' | 'REFUND_FAILED';
export type MockRefundOutcome = 'SUCCEEDED' | 'FAILED';

export interface MarketplaceProductQuery {
  pincode: string;
  category?: string;
  brandId?: string;
  brandSlug?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  total: number;
}

export interface UserProfileSummary {
  displayName: string;
}

export interface UserSummary {
  id: string;
  email?: string | null;
  phone?: string | null;
  profile?: UserProfileSummary | null;
}

export type ReviewedBySummary = UserSummary;

export interface OrganisationSummary {
  id: string;
  type: OrganisationType;
  slug: string;
  legalName: string;
  displayName: string;
  gstin?: string | null;
  registeredStateCode?: string | null;
  gstinVerifiedAt?: string | null;
  status: OrganisationStatus;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  reviewedBy?: ReviewedBySummary | null;
  reviewReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  id: string;
  organisationId: string;
  brandName?: string | null;
  registrationNumber?: string | null;
  pan?: string | null;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail?: string | null;
  website?: string | null;
  registeredAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DistributorProfile {
  id: string;
  organisationId: string;
  distributorCode?: string | null;
  pan?: string | null;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail?: string | null;
  operatingAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  serviceablePincodes: string[];
  fulfilmentCapability?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KycDocument {
  id: string;
  organisationId: string;
  documentType: KycDocumentType;
  status: KycDocumentStatus;
  documentNumber?: string | null;
  fileName?: string | null;
  storageKey?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingOrganisation extends OrganisationSummary {
  companyProfile?: CompanyProfile | null;
  distributorProfile?: DistributorProfile | null;
  kycDocuments: KycDocument[];
}

export interface OnboardingQueueItem {
  organisation: OnboardingOrganisation;
  hasProfile: boolean;
  submittedDocumentCount: number;
  approvedDocumentCount: number;
  rejectedDocumentCount: number;
  missingRequirements: string[];
}

export interface ApprovalQueueQuery {
  type?: Extract<OrganisationType, 'COMPANY' | 'DISTRIBUTOR'>;
  status?: OrganisationStatus;
  missingProfile?: boolean;
  page?: number;
  limit?: number;
}

export interface ReviewOrganisationInput {
  decision: OrganisationReviewDecision;
  reason?: string;
}

export interface ReviewKycDocumentInput {
  status: KycDocumentStatus;
  reason?: string;
  rejectionReason?: string;
}

export interface AuditLog {
  id: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  organisationId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  requestId?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  organisationId?: string;
  actorUserId?: string;
  page?: number;
  limit?: number;
}

export interface Brand {
  id: string;
  companyOrganisationId: string;
  companyOrganisation?: OrganisationSummary;
  name: string;
  slug: string;
  description?: string | null;
  website?: string | null;
  status: CatalogueStatus;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  reviewedBy?: ReviewedBySummary | null;
  reviewReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MasterProduct {
  id: string;
  companyOrganisationId: string;
  companyOrganisation?: OrganisationSummary;
  brandId: string;
  brand: Brand;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  cropTargets: string[];
  status: CatalogueStatus;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  reviewedBy?: ReviewedBySummary | null;
  reviewReason?: string | null;
  variants: ProductVariant[];
  documents: ProductDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface MasterProductSummary {
  id: string;
  companyOrganisationId: string;
  companyOrganisation?: OrganisationSummary;
  brandId: string;
  brand: Brand;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  cropTargets: string[];
  status: CatalogueStatus;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  reviewedBy?: ReviewedBySummary | null;
  reviewReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku?: string | null;
  variantName: string;
  packSize: string;
  packUnit: string;
  mrpPaise?: number | null;
  hsnCode?: string | null;
  gstRateBps?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDocument {
  id: string;
  productId: string;
  documentType: ProductDocumentType;
  title: string;
  documentNumber?: string | null;
  fileName?: string | null;
  storageKey?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceBrandSummary {
  id: string;
  name: string;
  slug: string;
}

export interface MarketplaceCompanySummary {
  id: string;
  displayName: string;
}

export interface MarketplaceVariantSummary {
  id: string;
  variantName: string;
  packSize: string;
  packUnit: string;
  mrpPaise?: number | null;
}

export interface MarketplaceSellerSummary {
  organisationId: string;
  displayName: string;
  legalName: string;
  gstin?: string | null;
}

export interface MarketplaceWarehouseSummary {
  id: string;
  name: string;
  city: string;
  state: string;
  pincode: string;
}

export interface MarketplaceBatchSummary {
  id: string;
  batchNumber: string;
  expiryDate?: string | null;
  germinationPercentage?: string | null;
}

export interface MarketplaceOfferSummary {
  id: string;
  variant: MarketplaceVariantSummary;
  seller: MarketplaceSellerSummary;
  warehouse: MarketplaceWarehouseSummary;
  batch?: MarketplaceBatchSummary | null;
  sellingPricePaise: number;
  minimumOrderQuantity: number;
  maximumOrderQuantity?: number | null;
  availableQuantity: number;
  fulfilmentMode: FulfilmentMode;
  deliverySlaDays?: number | null;
}

export interface MarketplaceProductSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  cropTargets: string[];
  brand: MarketplaceBrandSummary;
  company: MarketplaceCompanySummary;
  serviceablePincode: string;
  lowestPricePaise: number;
  availableQuantity: number;
  offerCount: number;
  sellerCount: number;
  fulfilmentModes: FulfilmentMode[];
  offers: MarketplaceOfferSummary[];
}

export interface MarketplaceProductDocument {
  id: string;
  documentType: ProductDocumentType;
  title: string;
  documentNumber?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
}

export interface MarketplaceProductDetail extends MarketplaceProductSummary {
  description?: string | null;
  variants: MarketplaceVariantSummary[];
  documents: MarketplaceProductDocument[];
}

export interface ProductQueueItem {
  product: MasterProduct;
  activeVariantCount: number;
  documentCount: number;
  missingRequirements: string[];
}

export interface ProductDetail extends MasterProduct {
  missingRequirements: string[];
}

export interface Warehouse {
  id: string;
  distributorOrganisationId: string;
  distributorOrganisation?: OrganisationSummary;
  code: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  contactName?: string | null;
  contactPhone?: string | null;
  status: WarehouseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  distributorOrganisationId: string;
  distributorOrganisation?: OrganisationSummary;
  warehouseId: string;
  warehouse?: Warehouse;
  batchId: string;
  batch?: InventoryBatchReference;
  productId: string;
  product?: MasterProductSummary;
  variantId: string;
  variant?: ProductVariant;
  movementType: InventoryMovementType;
  quantityDelta: number;
  balanceAfter: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  createdByUserId?: string | null;
  createdBy?: ReviewedBySummary | null;
  createdAt: string;
}

export interface InventoryBatchReference {
  id: string;
  distributorOrganisationId: string;
  warehouseId: string;
  productId: string;
  variantId: string;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  germinationPercentage?: string | null;
  status: InventoryBatchStatus;
  blockedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBatch {
  id: string;
  distributorOrganisationId: string;
  distributorOrganisation?: OrganisationSummary;
  warehouseId: string;
  warehouse?: Warehouse;
  productId: string;
  product: MasterProductSummary;
  variantId: string;
  variant: ProductVariant;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  germinationPercentage?: string | null;
  status: InventoryBatchStatus;
  blockedReason?: string | null;
  inventoryMovements: InventoryMovement[];
  onHandQuantity: number;
  sellableQuantity: number;
  isExpired: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InventoryAgeingBucket =
  'BLOCKED' | 'EXPIRED' | 'LOW_STOCK' | 'EXPIRING_SOON' | 'HEALTHY';

export type StockAgeBucket = 'DAYS_0_30' | 'DAYS_31_60' | 'DAYS_61_90' | 'DAYS_90_PLUS';

export interface InventoryAgeingQuery {
  distributorOrganisationId?: string;
  warehouseId?: string;
  productId?: string;
  variantId?: string;
  lowStockThreshold?: number;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
}

export interface InventoryAgeingReportItem {
  batch: InventoryBatch;
  distributorOrganisation?: OrganisationSummary;
  warehouse?: Warehouse;
  product: MasterProductSummary;
  variant: ProductVariant;
  onHandQuantity: number;
  sellableQuantity: number;
  ageInDays: number;
  stockAgeBucket: StockAgeBucket;
  daysUntilExpiry?: number | null;
  isLowStock: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
  isBlocked: boolean;
  ageingBucket: InventoryAgeingBucket;
}

export interface InventoryAgeingReport extends PaginatedResult<InventoryAgeingReportItem> {
  lowStockThreshold: number;
  expiringWithinDays: number;
}

export interface DistributorOffer {
  id: string;
  distributorOrganisationId: string;
  distributorOrganisation?: OrganisationSummary;
  productId: string;
  product: MasterProductSummary;
  variantId: string;
  variant: ProductVariant;
  warehouseId: string;
  warehouse: Warehouse;
  batchId?: string | null;
  batch?: InventoryBatchReference | null;
  offerCode?: string | null;
  sellingPricePaise: number;
  minimumOrderQuantity: number;
  maximumOrderQuantity?: number | null;
  serviceablePincodes: string[];
  fulfilmentMode: FulfilmentMode;
  deliverySlaDays?: number | null;
  status: DistributorOfferStatus;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  reviewedBy?: ReviewedBySummary | null;
  reviewReason?: string | null;
  availableQuantity: number;
  missingRequirements: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OfferQueueItem {
  offer: DistributorOffer;
  availableQuantity: number;
  missingRequirements: string[];
}

export interface FarmerAddress {
  id: string;
  farmerProfileId: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  village?: string | null;
  city: string;
  district?: string | null;
  state: string;
  stateCode?: string | null;
  pincode: string;
  landmark?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FarmerProfile {
  id: string;
  userId: string;
  fullName: string;
  alternatePhone?: string | null;
  preferredLocale: string;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  primaryPincode?: string | null;
  cropInterests: string[];
  addresses?: FarmerAddress[];
  createdAt: string;
  updatedAt: string;
}

export type KisanClubMembershipStatus =
  'PENDING_PROFILE' | 'AWAITING_PROMOTER' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface KisanClubMembership {
  id: string;
  farmerProfileId: string;
  farmerProfile: FarmerProfile;
  memberNumber: string;
  status: KisanClubMembershipStatus;
  homePincode: string;
  homeVillage?: string | null;
  homeDistrict?: string | null;
  homeState?: string | null;
  joinedAt: string;
  termsVersion: string;
  termsAcceptedAt: string;
  advisoryConsent: boolean;
  advisoryConsentAt?: string | null;
  marketingConsent: boolean;
  marketingConsentAt?: string | null;
  preciseLocationConsent: boolean;
  preciseLocationConsentAt?: string | null;
  referredByMembershipId?: string | null;
  suspendedReason?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KisanClubMembershipQuery {
  status?: KisanClubMembershipStatus;
  q?: string;
  page?: number;
  limit?: number;
}

export interface SuspendKisanClubMembershipInput {
  reason: string;
}

export type PromoterTerritoryStatus = 'ACTIVE' | 'INACTIVE';

export interface PromoterTerritory {
  id: string;
  name: string;
  state: string;
  district: string;
  blocks: string[];
  pincodes: string[];
  villages: string[];
  status: PromoterTerritoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PromoterTerritoryQuery {
  status?: PromoterTerritoryStatus;
  q?: string;
  page?: number;
  limit?: number;
}

export interface CreatePromoterTerritoryInput {
  name: string;
  state: string;
  district: string;
  blocks?: string[];
  pincodes?: string[];
  villages?: string[];
  status?: PromoterTerritoryStatus;
}

export type UpdatePromoterTerritoryInput = Partial<CreatePromoterTerritoryInput>;

export interface KisanClubPromoterProfile {
  id: string;
  promoterUserId: string;
  promoterOrganisationId: string;
  territoryId?: string | null;
  territory?: PromoterTerritory | null;
  homeVillage?: string | null;
  homePincode?: string | null;
  clubEnabled: boolean;
  acceptingNewFarmers: boolean;
  maxActiveFarmers: number;
  activeFarmerCount: number;
  promoterUser: {
    id: string;
    email?: string | null;
    phone?: string | null;
    status: string;
    profile?: { displayName?: string | null } | null;
  };
  promoterOrganisation: {
    id: string;
    displayName: string;
    status: OrganisationStatus;
  };
  createdAt: string;
  updatedAt: string;
}

export interface KisanClubPromoterProfileQuery {
  territoryId?: string;
  clubEnabled?: boolean;
  page?: number;
  limit?: number;
}

export interface UpsertKisanClubPromoterProfileInput {
  promoterUserId: string;
  promoterOrganisationId: string;
  territoryId?: string;
  homeVillage?: string;
  homePincode?: string;
  clubEnabled?: boolean;
  acceptingNewFarmers?: boolean;
  maxActiveFarmers?: number;
}

export type KisanClubProgrammeStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';

export interface KisanClubProductProgramme {
  id: string;
  productId: string;
  product: MasterProduct;
  variantId?: string | null;
  variant?: ProductVariant | null;
  status: KisanClubProgrammeStatus;
  startsAt: string;
  endsAt?: string | null;
  eligiblePincodes: string[];
  eligibleDistricts: string[];
  displayPriority: number;
  createdByUserId?: string | null;
  createdByRole?: string | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KisanClubProgrammeQuery {
  status?: KisanClubProgrammeStatus;
  productId?: string;
  page?: number;
  limit?: number;
}

export interface CreateKisanClubProgrammeInput {
  productId: string;
  variantId?: string;
  startsAt: string;
  endsAt?: string;
  eligiblePincodes?: string[];
  eligibleDistricts?: string[];
  displayPriority?: number;
  reason: string;
}

export interface UpdateKisanClubProgrammeInput {
  status?: KisanClubProgrammeStatus;
  startsAt?: string;
  endsAt?: string;
  eligiblePincodes?: string[];
  eligibleDistricts?: string[];
  displayPriority?: number;
  reason?: string;
}

export type KisanClubBenefitType = 'FLAT_AMOUNT_OFF' | 'PERCENT_OFF' | 'QUANTITY_THRESHOLD';
export type KisanClubBenefitStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';

export interface KisanClubBenefitRule {
  id: string;
  programmeId: string;
  programme: KisanClubProductProgramme;
  benefitType: KisanClubBenefitType;
  flatAmountPaise?: number | null;
  percentBps?: number | null;
  maxBenefitPaise?: number | null;
  minimumQuantity: number;
  eligiblePincodes: string[];
  eligibleCropIds: string[];
  status: KisanClubBenefitStatus;
  startsAt: string;
  endsAt?: string | null;
  totalUsageLimit?: number | null;
  perMemberUsageLimit?: number | null;
  usageCount: number;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KisanClubBenefitRuleQuery {
  status?: KisanClubBenefitStatus;
  programmeId?: string;
  page?: number;
  limit?: number;
}

export interface CreateKisanClubBenefitRuleInput {
  programmeId: string;
  benefitType: KisanClubBenefitType;
  flatAmountPaise?: number;
  percentBps?: number;
  maxBenefitPaise?: number;
  minimumQuantity?: number;
  eligiblePincodes?: string[];
  eligibleCropIds?: string[];
  startsAt: string;
  endsAt?: string;
  totalUsageLimit?: number;
  perMemberUsageLimit?: number;
  reason: string;
}

export interface UpdateKisanClubBenefitRuleInput {
  status?: KisanClubBenefitStatus;
  benefitType?: KisanClubBenefitType;
  flatAmountPaise?: number;
  percentBps?: number;
  maxBenefitPaise?: number;
  minimumQuantity?: number;
  eligiblePincodes?: string[];
  eligibleCropIds?: string[];
  startsAt?: string;
  endsAt?: string;
  totalUsageLimit?: number;
  perMemberUsageLimit?: number;
  reason: string;
}

export type KisanClubFulfilmentStatus =
  | 'ASSIGNED'
  | 'PROMOTER_ACCEPTED'
  | 'PROMOTER_DECLINED'
  | 'PRODUCT_READY'
  | 'FARMER_CONTACTED'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'FAILED'
  | 'REASSIGNED'
  | 'CANCELLED';
export type KisanClubFulfilmentMode =
  'CLUB_HOME_DELIVERY' | 'PROMOTER_PICKUP' | 'ASSISTED_PURCHASE';

export interface KisanClubFulfilmentStatusHistoryItem {
  id: string;
  fromStatus?: KisanClubFulfilmentStatus | null;
  toStatus: KisanClubFulfilmentStatus;
  changedByUserId?: string | null;
  changedByRole?: string | null;
  reason?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export interface KisanClubFulfilmentAssignment {
  id: string;
  productOrderId: string;
  membershipId: string;
  promoterUserId: string;
  promoterName?: string | null;
  mode: KisanClubFulfilmentMode;
  status: KisanClubFulfilmentStatus;
  assignedAt: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
  failureReason?: string | null;
  member: {
    memberNumber: string;
    fullName: string;
    status: KisanClubMembershipStatus;
    village?: string | null;
    district?: string | null;
    state?: string | null;
    pincode: string;
  };
  order: {
    orderNumber: string;
    status: ProductOrderStatus;
    sellerOrganisationId: string;
    sellerNameSnapshot: string;
    serviceablePincode: string;
    subtotalPaise: number;
    clubBenefitPaise: number;
    farmerPayablePaise: number;
    isKisanClubOrder: boolean;
    createdAt: string;
  };
  statusHistory: KisanClubFulfilmentStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface KisanClubFulfilmentQuery {
  status?: KisanClubFulfilmentStatus;
  promoterUserId?: string;
  membershipId?: string;
  productOrderId?: string;
  page?: number;
  limit?: number;
}

export type KisanClubFulfilmentAction =
  | 'accept'
  | 'decline'
  | 'product-ready'
  | 'farmer-contacted'
  | 'ready-for-pickup'
  | 'out-for-delivery'
  | 'complete'
  | 'fail'
  | 'cancel';

export interface KisanClubFulfilmentActionInput {
  reason?: string;
}

export interface ReassignKisanClubFulfilmentInput {
  promoterUserId: string;
  reason: string;
}

export type CropCycleStatus = 'PLANNED' | 'ACTIVE' | 'HARVESTED' | 'ABANDONED';

export interface KisanClubCropIntelligenceQuery {
  state?: string;
  district?: string;
  cropId?: string;
  season?: string;
  status?: CropCycleStatus;
}

export interface KisanClubAcreageBucket {
  cycleCount: number;
  areaAcres: number;
}

export interface KisanClubCropSummary {
  generatedAt: string;
  filters: {
    state?: string | null;
    district?: string | null;
    cropId?: string | null;
    season?: string | null;
    status?: CropCycleStatus | null;
  };
  scopeNote: string;
  totals: {
    cropCycleCount: number;
    farmCount: number;
    cropCount: number;
    districtCount: number;
    areaAcres: number;
  };
  byCrop: Array<
    KisanClubAcreageBucket & {
      cropId: string;
      cropCode: string;
      cropNameEn: string;
      cropNameHi: string;
    }
  >;
  byDistrict: Array<KisanClubAcreageBucket & { state: string; district: string }>;
  byCropDistrict: Array<
    KisanClubAcreageBucket & {
      cropId: string;
      cropCode: string;
      cropNameEn: string;
      state: string;
      district: string;
    }
  >;
  bySeason: Array<KisanClubAcreageBucket & { season: string }>;
  byCycleStatus: Array<KisanClubAcreageBucket & { status: CropCycleStatus }>;
  bySowingMonth: Array<KisanClubAcreageBucket & { month: string }>;
}

export interface KisanClubPromoterPerformanceQuery {
  territoryId?: string;
  promoterUserId?: string;
  clubEnabled?: boolean;
  page?: number;
  limit?: number;
}

export interface KisanClubPromoterPerformanceItem {
  promoterUserId: string;
  promoterName?: string | null;
  promoterOrganisation: { id: string; displayName: string };
  territory?: PromoterTerritory | null;
  clubEnabled: boolean;
  acceptingNewFarmers: boolean;
  maxActiveFarmers: number;
  activeFarmerCount: number;
  remainingCapacity: number;
  fulfilment: {
    totalCount: number;
    activeCount: number;
    resolvedCount: number;
    completedCount: number;
    failedCount: number;
    declinedCount: number;
    cancelledCount: number;
    resolvedCompletionRateBps?: number | null;
  };
}

export interface KisanClubPromoterPerformance {
  generatedAt: string;
  scopeNote: string;
  items: KisanClubPromoterPerformanceItem[];
  page: number;
  limit: number;
  total: number;
  pageSummary: {
    profileCount: number;
    enabledProfileCount: number;
    activeFarmerCount: number;
    totalCapacity: number;
    totalFulfilmentCount: number;
    resolvedCompletionRateBps?: number | null;
  };
}

export interface CartItem {
  id: string;
  offerId: string;
  distributorOrganisationId: string;
  productId: string;
  variantId: string;
  warehouseId: string;
  batchId?: string | null;
  quantity: number;
  priceSnapshotPaise: number;
  availableQuantitySnapshot: number;
  serviceablePincodeSnapshot: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  sellerNameSnapshot: string;
  warehouseNameSnapshot: string;
  fulfilmentModeSnapshot: FulfilmentMode;
  deliverySlaDaysSnapshot?: number | null;
  lineTotalPaise: number;
  createdAt: string;
  updatedAt: string;
}

export interface FarmerCart {
  id: string;
  farmerProfileId: string;
  deliveryAddress?: FarmerAddress | null;
  serviceablePincode?: string | null;
  status: CartStatus;
  itemCount: number;
  subtotalPaise: number;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductOrderItemReservation {
  id: string;
  batchId: string;
  batchNumber: string;
  inventoryMovementId: string;
  quantity: number;
  movementBalanceAfter: number;
  createdAt: string;
}

export interface ProductOrderItem {
  id: string;
  productOrderId: string;
  sourceCartItemId?: string | null;
  offerId: string;
  distributorOrganisationId: string;
  productId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  hsnCodeSnapshot?: string | null;
  gstRateBpsSnapshot?: number | null;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  sellerNameSnapshot: string;
  warehouseNameSnapshot: string;
  fulfilmentModeSnapshot: FulfilmentMode;
  deliverySlaDaysSnapshot?: number | null;
  reservations: ProductOrderItemReservation[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductOrderStatusHistoryItem {
  id: string;
  fromStatus?: ProductOrderStatus | null;
  toStatus: ProductOrderStatus;
  actorUserId?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export interface ProductInvoiceReservationSnapshot {
  reservationId: string;
  batchId: string;
  batchNumber: string;
  inventoryMovementId: string;
  quantity: number;
}

export interface ProductInvoiceLineItemSnapshot {
  productOrderItemId: string;
  offerId: string;
  distributorOrganisationId: string;
  productId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  hsnCode?: string | null;
  gstRateBps?: number | null;
  taxableAmountPaise?: number;
  taxPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  sellerNameSnapshot: string;
  warehouseNameSnapshot: string;
  fulfilmentModeSnapshot: FulfilmentMode;
  deliverySlaDaysSnapshot?: number | null;
  reservations: ProductInvoiceReservationSnapshot[];
}

export interface ProductInvoice {
  id: string;
  productOrderId: string;
  checkoutId: string;
  farmerProfileId: string;
  sellerOrganisationId: string;
  invoiceNumber: string;
  status: ProductInvoiceStatus;
  currency: string;
  subtotalPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  itemCount: number;
  sellerLegalNameSnapshot: string;
  sellerDisplayNameSnapshot: string;
  sellerGstinSnapshot?: string | null;
  sellerStateCodeSnapshot?: string | null;
  sellerAddressSnapshot?: string | null;
  placeOfSupplyStateCode?: string | null;
  financialYear?: string | null;
  sequenceNumber?: number | null;
  farmerNameSnapshot: string;
  deliveryAddressSnapshot: unknown;
  lineItemsSnapshot: ProductInvoiceLineItemSnapshot[];
  generatedByUserId?: string | null;
  generatedByRole?: string | null;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductInvoiceDocumentStatus = 'QUEUED' | 'PROCESSING' | 'AVAILABLE' | 'FAILED';

export interface ProductInvoiceDocument {
  id: string;
  productInvoiceId: string;
  status: ProductInvoiceDocumentStatus;
  fileId?: string | null;
  checksumSha256?: string | null;
  attemptCount: number;
  lastError?: string | null;
  generatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignedFileDownload {
  downloadUrl: string;
  expiresAt: string;
}

export interface ProductDispatchWarehouseSnapshot {
  warehouseId: string;
  warehouseNameSnapshot: string;
  itemCount: number;
  totalQuantity: number;
}

export interface ProductDispatchItemSnapshot {
  productOrderItemId: string;
  offerId: string;
  productId: string;
  variantId: string;
  warehouseId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  warehouseNameSnapshot: string;
  quantity: number;
  reservations: ProductInvoiceReservationSnapshot[];
}

export interface ProductDispatch {
  id: string;
  productOrderId: string;
  checkoutId: string;
  invoiceId: string;
  farmerProfileId: string;
  sellerOrganisationId: string;
  dispatchNumber: string;
  status: ProductDispatchStatus;
  serviceablePincode: string;
  invoiceNumberSnapshot: string;
  sellerNameSnapshot: string;
  sellerGstinSnapshot?: string | null;
  deliveryAddressSnapshot: unknown;
  warehouseSnapshot: ProductDispatchWarehouseSnapshot[];
  itemsSnapshot: ProductDispatchItemSnapshot[];
  readyForPickupReason?: string | null;
  readyByUserId?: string | null;
  readyByRole?: string | null;
  packageQrIssuedAt?: string | null;
  packageQrIssuedByUserId?: string | null;
  readyAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDeliveryAssignment {
  id: string;
  productOrderId: string;
  checkoutId: string;
  dispatchId: string;
  farmerProfileId: string;
  sellerOrganisationId: string;
  deliveryPartnerUserId: string;
  assignmentNumber: string;
  status: ProductDeliveryAssignmentStatus;
  serviceablePincode: string;
  dispatchNumberSnapshot: string;
  invoiceNumberSnapshot: string;
  sellerNameSnapshot: string;
  sellerGstinSnapshot?: string | null;
  deliveryAddressSnapshot: unknown;
  pickupSnapshot: unknown;
  itemsSnapshot: unknown;
  otpExpiresAt: string;
  otpAttemptCount: number;
  otpVerifiedAt?: string | null;
  pickupVerificationAttemptCount: number;
  pickupVerifiedAt?: string | null;
  pickupVerifiedByUserId?: string | null;
  pickupVerifiedByRole?: string | null;
  assignedByUserId?: string | null;
  assignedByRole?: string | null;
  assignedAt: string;
  startedByUserId?: string | null;
  startedByRole?: string | null;
  startedAt?: string | null;
  completedByUserId?: string | null;
  completedByRole?: string | null;
  completedAt?: string | null;
  deliveryProofNote?: string | null;
  proofLocationStatus?: 'GRANTED' | 'DENIED' | 'UNAVAILABLE' | null;
  proofLatitude?: number | null;
  proofLongitude?: number | null;
  proofAccuracyMetres?: number | null;
  proofLocationCapturedAt?: string | null;
  failureAttemptCount: number;
  lastFailureReasonCode?: DeliveryFailureReasonCode | null;
  lastFailureNote?: string | null;
  lastFailedAt?: string | null;
  lastFailedByUserId?: string | null;
  lastFailedByRole?: string | null;
  retryScheduledAt?: string | null;
  mockOtpCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchPackageLabelResult {
  dispatch: ProductDispatch;
  packageQrCode: string;
}

export interface ProductOrder {
  id: string;
  checkoutId: string;
  orderType: OrderType;
  farmerProfileId: string;
  deliveryAddressId?: string | null;
  sellerOrganisationId: string;
  orderNumber: string;
  status: ProductOrderStatus;
  serviceablePincode: string;
  sellerNameSnapshot: string;
  sellerGstinSnapshot?: string | null;
  deliveryAddressSnapshot: unknown;
  subtotalPaise: number;
  itemCount: number;
  items: ProductOrderItem[];
  statusHistory: ProductOrderStatusHistoryItem[];
  invoice?: ProductInvoice | null;
  dispatch?: ProductDispatch | null;
  deliveryAssignment?: ProductDeliveryAssignment | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequestItem {
  id: string;
  productOrderItemId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPricePaise: number;
  lineRefundPaise: number;
  reservations: ReturnRequestReservation[];
}

export interface ReturnRequestReservation {
  id: string;
  batchId: string;
  batchNumber: string;
  batchStatus: string;
  expiryDate?: string | null;
  quantity: number;
}

export interface ReturnInspectionDisposition {
  id: string;
  returnRequestItemId: string;
  reservationId: string;
  batchId: string;
  batchNumber: string;
  outcome: ReturnInspectionOutcome;
  quantity: number;
  inventoryMovementId?: string | null;
  quantityDelta?: number | null;
  balanceAfter?: number | null;
  createdAt: string;
}

export interface ReturnRequestStatusHistoryItem {
  id: string;
  fromStatus?: ReturnRequestStatus | null;
  toStatus: ReturnRequestStatus;
  actorUserId?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export interface ReturnRefundSummary {
  id: string;
  amountPaise: number;
  method: RefundMethod;
  status: RefundStatus;
  providerMode: PaymentProviderMode;
  providerRefundReference?: string | null;
  failureReason?: string | null;
  initiatedAt: string;
  completedAt?: string | null;
}

export interface ReturnRequest {
  id: string;
  productOrderId: string;
  orderNumber: string;
  sellerName: string;
  status: ReturnRequestStatus;
  reasonCode: ReturnReasonCode;
  reasonNote?: string | null;
  requestedAt: string;
  windowExpiresAt: string;
  refundableAmountPaise: number;
  approvedRefundAmountPaise?: number | null;
  inspectedByUserId?: string | null;
  inspectedAt?: string | null;
  inspectionNote?: string | null;
  items: ReturnRequestItem[];
  inspectionDispositions: ReturnInspectionDisposition[];
  refunds: ReturnRefundSummary[];
  statusHistory: ReturnRequestStatusHistoryItem[];
  pickupAssignment?: ReturnPickupAssignmentSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnPickupAssignmentSummary {
  id: string;
  assignmentNumber: string;
  deliveryPartnerUserId: string;
  status: ReturnPickupAssignmentStatus;
  assignedAt: string;
  respondedAt?: string | null;
  rejectionReason?: string | null;
  collectedAt?: string | null;
  collectionNote?: string | null;
}

export interface ReturnPickupAssignment extends ReturnPickupAssignmentSummary {
  returnRequestId: string;
  productOrderId: string;
  distributorOrganisationId: string;
  orderNumber: string;
  sellerName: string;
  pickupAddress: unknown;
  items: unknown;
  returnReasonCode: ReturnReasonCode;
  returnReasonNote?: string | null;
  returnStatus: ReturnRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AssignReturnPickupInput {
  deliveryPartnerUserId: string;
  reason?: string;
}

export interface ReturnPickupQuery {
  status?: ReturnPickupAssignmentStatus;
  page?: number;
  limit?: number;
}

export interface ProductCheckout {
  id: string;
  farmerProfileId: string;
  sourceCartId?: string | null;
  deliveryAddress?: FarmerAddress | null;
  serviceablePincode: string;
  status: ProductCheckoutStatus;
  subtotalPaise: number;
  itemCount: number;
  childOrderCount: number;
  orders: ProductOrder[];
  createdAt: string;
  updatedAt: string;
}

export interface CancelOrderInput {
  reason?: string;
}

export interface PaymentCheckoutOrderSummary {
  id: string;
  orderNumber: string;
  status: ProductOrderStatus;
  sellerOrganisationId: string;
  sellerNameSnapshot: string;
  subtotalPaise: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCheckoutSummary {
  id: string;
  status: ProductCheckoutStatus;
  subtotalPaise: number;
  itemCount: number;
  childOrderCount: number;
  orders: PaymentCheckoutOrderSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEvent {
  id: string;
  eventType: PaymentEventType;
  status: PaymentIntentStatus;
  providerReference: string;
  payload?: unknown;
  actorUserId?: string | null;
  actorRole?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export interface MockPaymentIntent {
  id: string;
  checkoutId: string;
  farmerProfileId: string;
  providerMode: PaymentProviderMode;
  providerReference: string;
  status: PaymentIntentStatus;
  amountPaise: number;
  currency: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  checkout: PaymentCheckoutSummary;
  events: PaymentEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface RefundEvent {
  id: string;
  eventType: RefundEventType;
  status: RefundStatus;
  providerReference?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export interface Refund {
  id: string;
  productOrderId: string;
  returnRequestId?: string | null;
  paymentIntentId?: string | null;
  farmerUserId: string;
  orderNumber: string;
  sellerName: string;
  amountPaise: number;
  method: RefundMethod;
  status: RefundStatus;
  providerMode: PaymentProviderMode;
  providerRefundReference?: string | null;
  failureReason?: string | null;
  initiatedByUserId: string;
  initiatedAt: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  events: RefundEvent[];
}

export type CreditNoteDocumentStatus = 'QUEUED' | 'PROCESSING' | 'AVAILABLE' | 'FAILED';

export interface CreditNote {
  id: string;
  refundId: string;
  productInvoiceId: string;
  productOrderId: string;
  creditNoteNumber: string;
  financialYear: string;
  grossCreditPaise: number;
  farmerRefundPaise: number;
  subsidyReversalPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  originalInvoiceNumber: string;
  originalInvoiceDate: string;
  reasonSnapshot: string;
  issuedAt: string;
  document?: {
    id: string;
    status: CreditNoteDocumentStatus;
    fileId?: string | null;
    checksumSha256?: string | null;
    attemptCount: number;
    lastError?: string | null;
    generatedAt?: string | null;
  } | null;
}

export interface CatalogueQuery {
  status?: CatalogueStatus;
  companyOrganisationId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface CreateBrandInput {
  companyOrganisationId?: string;
  name: string;
  slug?: string;
  description?: string;
  website?: string;
  reason?: string;
}

export interface UpdateBrandInput {
  name?: string;
  slug?: string;
  description?: string;
  website?: string;
  reason?: string;
}

export interface CreateProductInput {
  brandId: string;
  name: string;
  slug?: string;
  category: string;
  description?: string;
  cropTargets?: string[];
  reason?: string;
}

export interface UpdateProductInput {
  name?: string;
  slug?: string;
  category?: string;
  description?: string;
  cropTargets?: string[];
  reason?: string;
}

export interface CreateProductVariantInput {
  sku?: string;
  variantName: string;
  packSize: number;
  packUnit: string;
  mrpPaise?: number;
  hsnCode?: string;
  gstRateBps?: number;
  isActive?: boolean;
  reason?: string;
}

export type UpdateProductVariantInput = Partial<CreateProductVariantInput>;

export interface CreateProductDocumentInput {
  documentType: ProductDocumentType;
  title: string;
  documentNumber?: string;
  fileName?: string;
  storageKey?: string;
  issuedAt?: string;
  expiresAt?: string;
  reason?: string;
}

export interface SubmitCatalogueInput {
  reason?: string;
}

export interface ReviewCatalogueInput {
  decision: CatalogueReviewDecision;
  reason?: string;
}

export interface WarehouseQuery {
  status?: WarehouseStatus;
  distributorOrganisationId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface CreateWarehouseInput {
  distributorOrganisationId?: string;
  code: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  contactName?: string;
  contactPhone?: string;
  reason?: string;
}

export interface UpdateWarehouseInput {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactName?: string;
  contactPhone?: string;
  status?: WarehouseStatus;
  reason?: string;
}

export interface InventoryBatchQuery {
  status?: InventoryBatchStatus;
  distributorOrganisationId?: string;
  warehouseId?: string;
  batchId?: string;
  productId?: string;
  variantId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface CreateInventoryBatchInput {
  warehouseId: string;
  variantId: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  germinationPercentage?: number;
  openingQuantity?: number;
  reason: string;
}

export interface UpdateInventoryBatchInput {
  manufacturingDate?: string;
  expiryDate?: string;
  germinationPercentage?: number;
  status?: InventoryBatchStatus;
  blockedReason?: string;
  reason: string;
}

export interface InventoryMovementQuery {
  distributorOrganisationId?: string;
  warehouseId?: string;
  batchId?: string;
  productId?: string;
  variantId?: string;
  movementType?: InventoryMovementType;
  page?: number;
  limit?: number;
}

export interface CreateInventoryAdjustmentInput {
  movementType: InventoryMovementType;
  quantity: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
}

export interface OfferQuery {
  status?: DistributorOfferStatus;
  distributorOrganisationId?: string;
  productId?: string;
  variantId?: string;
  warehouseId?: string;
  batchId?: string;
  serviceablePincode?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface CreateOfferInput {
  distributorOrganisationId?: string;
  variantId: string;
  warehouseId: string;
  batchId?: string;
  offerCode?: string;
  sellingPricePaise: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  serviceablePincodes?: string[];
  fulfilmentMode: FulfilmentMode;
  deliverySlaDays?: number;
  reason?: string;
}

export interface UpdateOfferInput {
  offerCode?: string;
  sellingPricePaise?: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  serviceablePincodes?: string[];
  fulfilmentMode?: FulfilmentMode;
  deliverySlaDays?: number;
  reason?: string;
}

export interface SubmitOfferInput {
  reason?: string;
}

export interface ReviewOfferInput {
  decision: OfferReviewDecision;
  reason?: string;
}

export interface OfferStatusOperationInput {
  reason: string;
}

export interface UpsertFarmerProfileInput {
  fullName: string;
  alternatePhone?: string;
  preferredLocale?: string;
  village?: string;
  district?: string;
  state?: string;
  primaryPincode?: string;
  cropInterests?: string[];
}

export interface CreateFarmerAddressInput {
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  village?: string;
  city: string;
  district?: string;
  state: string;
  stateCode?: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface UpdateFarmerAddressInput {
  label?: string;
  recipientName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  village?: string;
  city?: string;
  district?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface UpdateCartContextInput {
  serviceablePincode?: string;
  farmerAddressId?: string;
  reason?: string;
}

export interface AddCartItemInput extends UpdateCartContextInput {
  offerId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
  reason?: string;
}

export interface CheckoutFromCartInput {
  farmerAddressId?: string;
  reason?: string;
}

export interface CheckoutFromCartOptions {
  idempotencyKey: string;
}

export interface CancellationOptions {
  idempotencyKey: string;
}

export interface CreateMockPaymentIntentInput {
  checkoutId: string;
  reason?: string;
}

export interface ConfirmMockPaymentIntentInput {
  outcome: MockPaymentOutcome;
  failureCode?: string;
  failureMessage?: string;
  reason?: string;
}

export interface MockPaymentIntentOptions {
  idempotencyKey: string;
}

export interface CreateRefundInput {
  returnRequestId: string;
}

export interface ConfirmMockRefundInput {
  outcome: MockRefundOutcome;
  failureReason?: string;
}

export interface RefundMutationOptions {
  idempotencyKey: string;
}

export interface RefundQuery {
  status?: RefundStatus;
  productOrderId?: string;
  returnRequestId?: string;
  page?: number;
  limit?: number;
}

export interface PaymentIntentQuery {
  checkoutId?: string;
  page?: number;
  limit?: number;
}

export interface ProductOrderQuery {
  status?: ProductOrderStatus;
  page?: number;
  limit?: number;
}

export interface FulfilmentOrderQuery {
  status?: ProductOrderStatus;
  sellerOrganisationId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface FulfilmentOrderDecisionInput {
  reason?: string;
}

export interface ReturnRequestQuery {
  status?: ReturnRequestStatus;
  distributorOrganisationId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ReturnTransitionInput {
  reason?: string;
}

export interface InspectReturnRequestInput {
  inspectionNote: string;
  dispositions: Array<{
    returnRequestItemId: string;
    reservationId: string;
    outcome: ReturnInspectionOutcome;
    quantity: number;
  }>;
}

export interface GenerateProductInvoiceInput {
  reason?: string;
}

export interface AssignDeliveryInput {
  deliveryPartnerUserId: string;
  reason?: string;
}

export interface CompleteDeliveryInput {
  otpCode: string;
  proofNote?: string;
  proofLocationStatus: 'GRANTED' | 'DENIED' | 'UNAVAILABLE';
  proofLatitude?: number;
  proofLongitude?: number;
  proofAccuracyMetres?: number;
  proofLocationCapturedAt?: string;
}

export interface ReportDeliveryFailureInput {
  reasonCode: DeliveryFailureReasonCode;
  note?: string;
  retryAt: string;
}

export interface RetryDeliveryInput {
  reason?: string;
}

type QueryValue = string | number | boolean | undefined;

export class VardhnamApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  health(): Promise<unknown> {
    return this.request<unknown>('/api/v1/health');
  }

  listMarketplaceProducts(
    query: MarketplaceProductQuery,
  ): Promise<PaginatedResult<MarketplaceProductSummary>> {
    return this.request<PaginatedResult<MarketplaceProductSummary>>(
      `/api/v1/marketplace/products${this.toQueryString(this.marketplaceProductQueryParams(query))}`,
    );
  }

  getMarketplaceProduct(productId: string, pincode: string): Promise<MarketplaceProductDetail> {
    return this.request<MarketplaceProductDetail>(
      `/api/v1/marketplace/products/${productId}${this.toQueryString({ pincode })}`,
    );
  }

  getMyFarmerProfile(): Promise<FarmerProfile> {
    return this.request<FarmerProfile>('/api/v1/farmers/me');
  }

  upsertMyFarmerProfile(input: UpsertFarmerProfileInput): Promise<FarmerProfile> {
    return this.request<FarmerProfile>('/api/v1/farmers/me/profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  listMyFarmerAddresses(): Promise<FarmerAddress[]> {
    return this.request<FarmerAddress[]>('/api/v1/farmers/me/addresses');
  }

  createMyFarmerAddress(input: CreateFarmerAddressInput): Promise<FarmerAddress> {
    return this.request<FarmerAddress>('/api/v1/farmers/me/addresses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateMyFarmerAddress(
    addressId: string,
    input: UpdateFarmerAddressInput,
  ): Promise<FarmerAddress> {
    return this.request<FarmerAddress>(`/api/v1/farmers/me/addresses/${addressId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  getMyCart(): Promise<FarmerCart> {
    return this.request<FarmerCart>('/api/v1/cart');
  }

  updateCartContext(input: UpdateCartContextInput): Promise<FarmerCart> {
    return this.request<FarmerCart>('/api/v1/cart/context', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  addCartItem(input: AddCartItemInput): Promise<FarmerCart> {
    return this.request<FarmerCart>('/api/v1/cart/items', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateCartItem(cartItemId: string, input: UpdateCartItemInput): Promise<FarmerCart> {
    return this.request<FarmerCart>(`/api/v1/cart/items/${cartItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  removeCartItem(cartItemId: string): Promise<FarmerCart> {
    return this.request<FarmerCart>(`/api/v1/cart/items/${cartItemId}`, {
      method: 'DELETE',
    });
  }

  clearCart(): Promise<FarmerCart> {
    return this.request<FarmerCart>('/api/v1/cart/items', {
      method: 'DELETE',
    });
  }

  checkoutFromCart(
    input: CheckoutFromCartInput,
    options: CheckoutFromCartOptions,
  ): Promise<ProductCheckout> {
    return this.request<ProductCheckout>('/api/v1/checkout/from-cart', {
      method: 'POST',
      headers: {
        'Idempotency-Key': options.idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  }

  getMyCheckout(checkoutId: string): Promise<ProductCheckout> {
    return this.request<ProductCheckout>(`/api/v1/checkout/${checkoutId}`);
  }

  cancelMyCheckout(
    checkoutId: string,
    input: CancelOrderInput,
    options: CancellationOptions,
  ): Promise<ProductCheckout> {
    return this.request<ProductCheckout>(`/api/v1/checkout/${checkoutId}/cancel`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': options.idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  }

  createMockPaymentIntent(
    input: CreateMockPaymentIntentInput,
    options: MockPaymentIntentOptions,
  ): Promise<MockPaymentIntent> {
    return this.request<MockPaymentIntent>('/api/v1/payments/mock-intents', {
      method: 'POST',
      headers: {
        'Idempotency-Key': options.idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  }

  listMyMockPaymentIntents(
    query: PaymentIntentQuery = {},
  ): Promise<PaginatedResult<MockPaymentIntent>> {
    const queryParams: Record<string, QueryValue> = {
      checkoutId: query.checkoutId,
      page: query.page,
      limit: query.limit,
    };

    return this.request<PaginatedResult<MockPaymentIntent>>(
      `/api/v1/payments/mock-intents${this.toQueryString(queryParams)}`,
    );
  }

  getMyMockPaymentIntent(paymentIntentId: string): Promise<MockPaymentIntent> {
    return this.request<MockPaymentIntent>(`/api/v1/payments/mock-intents/${paymentIntentId}`);
  }

  confirmMockPaymentIntent(
    paymentIntentId: string,
    input: ConfirmMockPaymentIntentInput,
    options: MockPaymentIntentOptions,
  ): Promise<MockPaymentIntent> {
    return this.request<MockPaymentIntent>(
      `/api/v1/payments/mock-intents/${paymentIntentId}/confirm`,
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': options.idempotencyKey,
        },
        body: JSON.stringify(input),
      },
    );
  }

  listMyOrders(query: ProductOrderQuery = {}): Promise<PaginatedResult<ProductOrder>> {
    const queryParams: Record<string, QueryValue> = {
      status: query.status,
      page: query.page,
      limit: query.limit,
    };

    return this.request<PaginatedResult<ProductOrder>>(
      `/api/v1/orders${this.toQueryString(queryParams)}`,
    );
  }

  getMyOrder(orderId: string): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/orders/${orderId}`);
  }

  requestMyInvoicePdf(orderId: string): Promise<ProductInvoiceDocument> {
    return this.request<ProductInvoiceDocument>(`/api/v1/orders/${orderId}/invoice/pdf`, {
      method: 'POST',
    });
  }

  getMyInvoicePdf(orderId: string): Promise<ProductInvoiceDocument> {
    return this.request<ProductInvoiceDocument>(`/api/v1/orders/${orderId}/invoice/pdf`);
  }

  downloadMyInvoicePdf(orderId: string): Promise<SignedFileDownload> {
    return this.request<SignedFileDownload>(`/api/v1/orders/${orderId}/invoice/pdf/download`);
  }

  cancelMyOrder(
    orderId: string,
    input: CancelOrderInput,
    options: CancellationOptions,
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': options.idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  }

  listFulfilmentOrders(query: FulfilmentOrderQuery = {}): Promise<PaginatedResult<ProductOrder>> {
    return this.request<PaginatedResult<ProductOrder>>(
      `/api/v1/fulfilment/orders${this.toQueryString(this.fulfilmentOrderQueryParams(query))}`,
    );
  }

  getFulfilmentOrder(orderId: string): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}`);
  }

  listReturnRequests(query: ReturnRequestQuery = {}): Promise<PaginatedResult<ReturnRequest>> {
    return this.request<PaginatedResult<ReturnRequest>>(
      `/api/v1/returns${this.toQueryString(this.returnRequestQueryParams(query))}`,
    );
  }

  getReturnRequest(returnRequestId: string): Promise<ReturnRequest> {
    return this.request<ReturnRequest>(`/api/v1/returns/${returnRequestId}`);
  }

  approveReturnRequest(
    returnRequestId: string,
    input: ReturnTransitionInput = {},
  ): Promise<ReturnRequest> {
    return this.returnTransition(returnRequestId, 'approve', input);
  }

  rejectReturnRequest(
    returnRequestId: string,
    input: ReturnTransitionInput,
  ): Promise<ReturnRequest> {
    return this.returnTransition(returnRequestId, 'reject', input);
  }

  markReturnInTransit(
    returnRequestId: string,
    input: ReturnTransitionInput = {},
  ): Promise<ReturnRequest> {
    return this.returnTransition(returnRequestId, 'pickup', input);
  }

  assignReturnPickup(
    returnRequestId: string,
    input: AssignReturnPickupInput,
  ): Promise<ReturnPickupAssignment> {
    return this.request<ReturnPickupAssignment>(
      `/api/v1/return-pickups/returns/${returnRequestId}/assignment`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  listReturnPickups(
    query: ReturnPickupQuery = {},
  ): Promise<PaginatedResult<ReturnPickupAssignment>> {
    return this.request<PaginatedResult<ReturnPickupAssignment>>(
      `/api/v1/return-pickups${this.toQueryString({ status: query.status, page: query.page, limit: query.limit })}`,
    );
  }

  getReturnPickup(assignmentId: string): Promise<ReturnPickupAssignment> {
    return this.request<ReturnPickupAssignment>(`/api/v1/return-pickups/${assignmentId}`);
  }

  acceptReturnPickup(assignmentId: string): Promise<ReturnPickupAssignment> {
    return this.returnPickupTransition(assignmentId, 'accept', {});
  }

  rejectReturnPickup(
    assignmentId: string,
    input: ReturnTransitionInput,
  ): Promise<ReturnPickupAssignment> {
    return this.returnPickupTransition(assignmentId, 'reject', input);
  }

  collectReturnPickup(
    assignmentId: string,
    input: ReturnTransitionInput = {},
  ): Promise<ReturnPickupAssignment> {
    return this.returnPickupTransition(assignmentId, 'collect', input);
  }

  receiveReturnRequest(
    returnRequestId: string,
    input: ReturnTransitionInput = {},
  ): Promise<ReturnRequest> {
    return this.returnTransition(returnRequestId, 'receive', input);
  }

  inspectReturnRequest(
    returnRequestId: string,
    input: InspectReturnRequestInput,
  ): Promise<ReturnRequest> {
    return this.request<ReturnRequest>(`/api/v1/returns/${returnRequestId}/inspect`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  createRefund(input: CreateRefundInput, options: RefundMutationOptions): Promise<Refund> {
    return this.request<Refund>('/api/v1/refunds', {
      method: 'POST',
      headers: { 'Idempotency-Key': options.idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  listRefunds(query: RefundQuery = {}): Promise<PaginatedResult<Refund>> {
    return this.request<PaginatedResult<Refund>>(
      `/api/v1/refunds${this.toQueryString({
        status: query.status,
        productOrderId: query.productOrderId,
        returnRequestId: query.returnRequestId,
        page: query.page,
        limit: query.limit,
      })}`,
    );
  }

  listMyRefunds(query: RefundQuery = {}): Promise<PaginatedResult<Refund>> {
    return this.request<PaginatedResult<Refund>>(
      `/api/v1/refunds/me${this.toQueryString({
        status: query.status,
        productOrderId: query.productOrderId,
        returnRequestId: query.returnRequestId,
        page: query.page,
        limit: query.limit,
      })}`,
    );
  }

  getRefund(refundId: string): Promise<Refund> {
    return this.request<Refund>(`/api/v1/refunds/${refundId}`);
  }

  getCreditNote(refundId: string): Promise<CreditNote> {
    return this.request<CreditNote>(`/api/v1/refunds/${refundId}/credit-note`);
  }

  downloadCreditNote(refundId: string): Promise<SignedFileDownload> {
    return this.request<SignedFileDownload>(`/api/v1/refunds/${refundId}/credit-note/download`);
  }

  confirmMockRefund(
    refundId: string,
    input: ConfirmMockRefundInput,
    options: RefundMutationOptions,
  ): Promise<Refund> {
    return this.request<Refund>(`/api/v1/refunds/${refundId}/confirm`, {
      method: 'POST',
      headers: { 'Idempotency-Key': options.idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  acceptFulfilmentOrder(
    orderId: string,
    input: FulfilmentOrderDecisionInput = {},
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/accept`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  rejectFulfilmentOrder(
    orderId: string,
    input: FulfilmentOrderDecisionInput,
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  markFulfilmentOrderReadyToPack(
    orderId: string,
    input: FulfilmentOrderDecisionInput = {},
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/ready-to-pack`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  packFulfilmentOrder(
    orderId: string,
    input: FulfilmentOrderDecisionInput = {},
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/pack`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  generateFulfilmentOrderInvoice(
    orderId: string,
    input: GenerateProductInvoiceInput = {},
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/invoice`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  requestFulfilmentOrderInvoicePdf(orderId: string): Promise<ProductInvoiceDocument> {
    return this.request<ProductInvoiceDocument>(
      `/api/v1/fulfilment/orders/${orderId}/invoice/pdf`,
      { method: 'POST' },
    );
  }

  getFulfilmentOrderInvoicePdf(orderId: string): Promise<ProductInvoiceDocument> {
    return this.request<ProductInvoiceDocument>(
      `/api/v1/fulfilment/orders/${orderId}/invoice/pdf`,
    );
  }

  downloadFulfilmentOrderInvoicePdf(orderId: string): Promise<SignedFileDownload> {
    return this.request<SignedFileDownload>(
      `/api/v1/fulfilment/orders/${orderId}/invoice/pdf/download`,
    );
  }

  markFulfilmentOrderReadyForPickup(
    orderId: string,
    input: FulfilmentOrderDecisionInput = {},
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/ready-for-pickup`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  assignFulfilmentOrderDelivery(
    orderId: string,
    input: AssignDeliveryInput,
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  issueDispatchPackageLabel(
    orderId: string,
    input: FulfilmentOrderDecisionInput = {},
  ): Promise<DispatchPackageLabelResult> {
    return this.request<DispatchPackageLabelResult>(
      `/api/v1/fulfilment/orders/${orderId}/dispatch-label`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  markFulfilmentOrderOutForDelivery(
    orderId: string,
    input: FulfilmentOrderDecisionInput = {},
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  completeFulfilmentOrderDelivery(
    orderId: string,
    input: CompleteDeliveryInput,
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/deliver`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  reportFulfilmentOrderDeliveryFailure(
    orderId: string,
    input: ReportDeliveryFailureInput,
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/delivery-failure`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  retryFulfilmentOrderDelivery(
    orderId: string,
    input: RetryDeliveryInput = {},
  ): Promise<ProductOrder> {
    return this.request<ProductOrder>(`/api/v1/fulfilment/orders/${orderId}/delivery-retry`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listOnboardingApprovalQueue(
    query: ApprovalQueueQuery = {},
  ): Promise<PaginatedResult<OnboardingQueueItem>> {
    const queryParams: Record<string, QueryValue> = {
      type: query.type,
      status: query.status,
      missingProfile: query.missingProfile,
      page: query.page,
      limit: query.limit,
    };

    return this.request<PaginatedResult<OnboardingQueueItem>>(
      `/api/v1/onboarding/approval-queue${this.toQueryString(queryParams)}`,
    );
  }

  getOnboardingOrganisation(organisationId: string): Promise<OnboardingOrganisation> {
    return this.request<OnboardingOrganisation>(
      `/api/v1/onboarding/organisations/${organisationId}`,
    );
  }

  reviewOrganisation(
    organisationId: string,
    input: ReviewOrganisationInput,
  ): Promise<OrganisationSummary> {
    return this.request<OrganisationSummary>(`/api/v1/organisations/${organisationId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateKycDocument(
    organisationId: string,
    documentId: string,
    input: ReviewKycDocumentInput,
  ): Promise<KycDocument> {
    return this.request<KycDocument>(
      `/api/v1/onboarding/organisations/${organisationId}/kyc-documents/${documentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
  }

  listAuditLogs(query: AuditLogQuery = {}): Promise<PaginatedResult<AuditLog>> {
    const queryParams: Record<string, QueryValue> = {
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      organisationId: query.organisationId,
      actorUserId: query.actorUserId,
      page: query.page,
      limit: query.limit,
    };

    return this.request<PaginatedResult<AuditLog>>(
      `/api/v1/audit-logs${this.toQueryString(queryParams)}`,
    );
  }

  listBrands(query: CatalogueQuery = {}): Promise<PaginatedResult<Brand>> {
    return this.request<PaginatedResult<Brand>>(
      `/api/v1/catalogue/brands${this.toQueryString(this.catalogueQueryParams(query))}`,
    );
  }

  listBrandReviewQueue(query: CatalogueQuery = {}): Promise<PaginatedResult<Brand>> {
    return this.request<PaginatedResult<Brand>>(
      `/api/v1/catalogue/brands/review-queue${this.toQueryString(this.catalogueQueryParams(query))}`,
    );
  }

  createBrand(input: CreateBrandInput): Promise<Brand> {
    return this.request<Brand>('/api/v1/catalogue/brands', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getBrand(brandId: string): Promise<Brand> {
    return this.request<Brand>(`/api/v1/catalogue/brands/${brandId}`);
  }

  updateBrand(brandId: string, input: UpdateBrandInput): Promise<Brand> {
    return this.request<Brand>(`/api/v1/catalogue/brands/${brandId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  submitBrand(brandId: string, input: SubmitCatalogueInput = {}): Promise<Brand> {
    return this.request<Brand>(`/api/v1/catalogue/brands/${brandId}/submit`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  reviewBrand(brandId: string, input: ReviewCatalogueInput): Promise<Brand> {
    return this.request<Brand>(`/api/v1/catalogue/brands/${brandId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listProducts(query: CatalogueQuery = {}): Promise<PaginatedResult<MasterProduct>> {
    return this.request<PaginatedResult<MasterProduct>>(
      `/api/v1/catalogue/products${this.toQueryString(this.catalogueQueryParams(query))}`,
    );
  }

  listProductReviewQueue(query: CatalogueQuery = {}): Promise<PaginatedResult<ProductQueueItem>> {
    return this.request<PaginatedResult<ProductQueueItem>>(
      `/api/v1/catalogue/products/review-queue${this.toQueryString(this.catalogueQueryParams(query))}`,
    );
  }

  createProduct(input: CreateProductInput): Promise<MasterProduct> {
    return this.request<MasterProduct>('/api/v1/catalogue/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getProduct(productId: string): Promise<ProductDetail> {
    return this.request<ProductDetail>(`/api/v1/catalogue/products/${productId}`);
  }

  updateProduct(productId: string, input: UpdateProductInput): Promise<MasterProduct> {
    return this.request<MasterProduct>(`/api/v1/catalogue/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  addProductVariant(productId: string, input: CreateProductVariantInput): Promise<ProductVariant> {
    return this.request<ProductVariant>(`/api/v1/catalogue/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateProductVariant(
    productId: string,
    variantId: string,
    input: UpdateProductVariantInput,
  ): Promise<ProductVariant> {
    return this.request<ProductVariant>(
      `/api/v1/catalogue/products/${productId}/variants/${variantId}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
  }

  addProductDocument(
    productId: string,
    input: CreateProductDocumentInput,
  ): Promise<ProductDocument> {
    return this.request<ProductDocument>(`/api/v1/catalogue/products/${productId}/documents`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  submitProduct(productId: string, input: SubmitCatalogueInput = {}): Promise<MasterProduct> {
    return this.request<MasterProduct>(`/api/v1/catalogue/products/${productId}/submit`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  reviewProduct(productId: string, input: ReviewCatalogueInput): Promise<MasterProduct> {
    return this.request<MasterProduct>(`/api/v1/catalogue/products/${productId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listWarehouses(query: WarehouseQuery = {}): Promise<PaginatedResult<Warehouse>> {
    return this.request<PaginatedResult<Warehouse>>(
      `/api/v1/inventory/warehouses${this.toQueryString(this.warehouseQueryParams(query))}`,
    );
  }

  createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
    return this.request<Warehouse>('/api/v1/inventory/warehouses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getWarehouse(warehouseId: string): Promise<Warehouse> {
    return this.request<Warehouse>(`/api/v1/inventory/warehouses/${warehouseId}`);
  }

  updateWarehouse(warehouseId: string, input: UpdateWarehouseInput): Promise<Warehouse> {
    return this.request<Warehouse>(`/api/v1/inventory/warehouses/${warehouseId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  listInventoryBatches(query: InventoryBatchQuery = {}): Promise<PaginatedResult<InventoryBatch>> {
    return this.request<PaginatedResult<InventoryBatch>>(
      `/api/v1/inventory/batches${this.toQueryString(this.inventoryBatchQueryParams(query))}`,
    );
  }

  createInventoryBatch(input: CreateInventoryBatchInput): Promise<InventoryBatch> {
    return this.request<InventoryBatch>('/api/v1/inventory/batches', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getInventoryBatch(batchId: string): Promise<InventoryBatch> {
    return this.request<InventoryBatch>(`/api/v1/inventory/batches/${batchId}`);
  }

  updateInventoryBatch(batchId: string, input: UpdateInventoryBatchInput): Promise<InventoryBatch> {
    return this.request<InventoryBatch>(`/api/v1/inventory/batches/${batchId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  createInventoryAdjustment(
    batchId: string,
    input: CreateInventoryAdjustmentInput,
  ): Promise<InventoryMovement> {
    return this.request<InventoryMovement>(`/api/v1/inventory/batches/${batchId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listInventoryMovements(
    query: InventoryMovementQuery = {},
  ): Promise<PaginatedResult<InventoryMovement>> {
    return this.request<PaginatedResult<InventoryMovement>>(
      `/api/v1/inventory/movements${this.toQueryString(this.inventoryMovementQueryParams(query))}`,
    );
  }

  listInventoryAgeing(query: InventoryAgeingQuery = {}): Promise<InventoryAgeingReport> {
    return this.request<InventoryAgeingReport>(
      `/api/v1/inventory/reports/ageing${this.toQueryString(this.inventoryAgeingQueryParams(query))}`,
    );
  }

  listLowStockInventory(query: InventoryAgeingQuery = {}): Promise<InventoryAgeingReport> {
    return this.request<InventoryAgeingReport>(
      `/api/v1/inventory/reports/low-stock${this.toQueryString(this.inventoryAgeingQueryParams(query))}`,
    );
  }

  listExpiringInventory(query: InventoryAgeingQuery = {}): Promise<InventoryAgeingReport> {
    return this.request<InventoryAgeingReport>(
      `/api/v1/inventory/reports/expiring-batches${this.toQueryString(this.inventoryAgeingQueryParams(query))}`,
    );
  }

  listOffers(query: OfferQuery = {}): Promise<PaginatedResult<DistributorOffer>> {
    return this.request<PaginatedResult<DistributorOffer>>(
      `/api/v1/offers${this.toQueryString(this.offerQueryParams(query))}`,
    );
  }

  listOfferReviewQueue(query: OfferQuery = {}): Promise<PaginatedResult<OfferQueueItem>> {
    return this.request<PaginatedResult<OfferQueueItem>>(
      `/api/v1/offers/review-queue${this.toQueryString(this.offerQueryParams(query))}`,
    );
  }

  createOffer(input: CreateOfferInput): Promise<DistributorOffer> {
    return this.request<DistributorOffer>('/api/v1/offers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getOffer(offerId: string): Promise<DistributorOffer> {
    return this.request<DistributorOffer>(`/api/v1/offers/${offerId}`);
  }

  updateOffer(offerId: string, input: UpdateOfferInput): Promise<DistributorOffer> {
    return this.request<DistributorOffer>(`/api/v1/offers/${offerId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  submitOffer(offerId: string, input: SubmitOfferInput = {}): Promise<DistributorOffer> {
    return this.request<DistributorOffer>(`/api/v1/offers/${offerId}/submit`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  reviewOffer(offerId: string, input: ReviewOfferInput): Promise<DistributorOffer> {
    return this.request<DistributorOffer>(`/api/v1/offers/${offerId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  pauseOffer(offerId: string, input: OfferStatusOperationInput): Promise<DistributorOffer> {
    return this.request<DistributorOffer>(`/api/v1/offers/${offerId}/pause`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  reactivateOffer(offerId: string, input: OfferStatusOperationInput): Promise<DistributorOffer> {
    return this.request<DistributorOffer>(`/api/v1/offers/${offerId}/reactivate`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  archiveOffer(offerId: string, input: OfferStatusOperationInput): Promise<DistributorOffer> {
    return this.request<DistributorOffer>(`/api/v1/offers/${offerId}/archive`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listAdvisoryRules(query: AdvisoryRuleQuery = {}): Promise<PaginatedResult<AdvisoryRule>> {
    return this.request<PaginatedResult<AdvisoryRule>>(
      `/api/v1/advisory/rules${this.toQueryString(this.advisoryRuleQueryParams(query))}`,
    );
  }

  getAdvisoryRule(ruleId: string): Promise<AdvisoryRule> {
    return this.request<AdvisoryRule>(`/api/v1/advisory/rules/${ruleId}`);
  }

  createAdvisoryRule(input: CreateAdvisoryRuleInput): Promise<AdvisoryRule> {
    return this.request<AdvisoryRule>('/api/v1/advisory/rules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateAdvisoryRule(ruleId: string, input: UpdateAdvisoryRuleInput): Promise<AdvisoryRule> {
    return this.request<AdvisoryRule>(`/api/v1/advisory/rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  submitAdvisoryRule(ruleId: string, reason: string): Promise<AdvisoryRule> {
    return this.request<AdvisoryRule>(`/api/v1/advisory/rules/${ruleId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  reviewAdvisoryRule(ruleId: string, input: ReviewAdvisoryRuleInput): Promise<AdvisoryRule> {
    return this.request<AdvisoryRule>(`/api/v1/advisory/rules/${ruleId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  archiveAdvisoryRule(ruleId: string, reason: string): Promise<AdvisoryRule> {
    return this.request<AdvisoryRule>(`/api/v1/advisory/rules/${ruleId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  listKisanClubMemberships(
    query: KisanClubMembershipQuery = {},
  ): Promise<PaginatedResult<KisanClubMembership>> {
    return this.request<PaginatedResult<KisanClubMembership>>(
      `/api/v1/kisan-club/memberships${this.toQueryString(this.kisanClubMembershipQueryParams(query))}`,
    );
  }

  getKisanClubMembership(membershipId: string): Promise<KisanClubMembership> {
    return this.request<KisanClubMembership>(`/api/v1/kisan-club/memberships/${membershipId}`);
  }

  suspendKisanClubMembership(
    membershipId: string,
    input: SuspendKisanClubMembershipInput,
  ): Promise<KisanClubMembership> {
    return this.request<KisanClubMembership>(
      `/api/v1/kisan-club/memberships/${membershipId}/suspend`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  listPromoterTerritories(
    query: PromoterTerritoryQuery = {},
  ): Promise<PaginatedResult<PromoterTerritory>> {
    return this.request<PaginatedResult<PromoterTerritory>>(
      `/api/v1/kisan-club/territories${this.toQueryString(this.promoterTerritoryQueryParams(query))}`,
    );
  }

  createPromoterTerritory(input: CreatePromoterTerritoryInput): Promise<PromoterTerritory> {
    return this.request<PromoterTerritory>('/api/v1/kisan-club/territories', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updatePromoterTerritory(
    territoryId: string,
    input: UpdatePromoterTerritoryInput,
  ): Promise<PromoterTerritory> {
    return this.request<PromoterTerritory>(`/api/v1/kisan-club/territories/${territoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  listKisanClubPromoterProfiles(
    query: KisanClubPromoterProfileQuery = {},
  ): Promise<PaginatedResult<KisanClubPromoterProfile>> {
    return this.request<PaginatedResult<KisanClubPromoterProfile>>(
      `/api/v1/kisan-club/promoter-profiles${this.toQueryString(this.kisanClubPromoterProfileQueryParams(query))}`,
    );
  }

  upsertKisanClubPromoterProfile(
    input: UpsertKisanClubPromoterProfileInput,
  ): Promise<KisanClubPromoterProfile> {
    return this.request<KisanClubPromoterProfile>('/api/v1/kisan-club/promoter-profiles', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listKisanClubProgrammes(
    query: KisanClubProgrammeQuery = {},
  ): Promise<PaginatedResult<KisanClubProductProgramme>> {
    return this.request<PaginatedResult<KisanClubProductProgramme>>(
      `/api/v1/kisan-club/programmes${this.toQueryString(this.kisanClubProgrammeQueryParams(query))}`,
    );
  }

  createKisanClubProgramme(
    input: CreateKisanClubProgrammeInput,
  ): Promise<KisanClubProductProgramme> {
    return this.request<KisanClubProductProgramme>('/api/v1/kisan-club/programmes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateKisanClubProgramme(
    programmeId: string,
    input: UpdateKisanClubProgrammeInput,
  ): Promise<KisanClubProductProgramme> {
    return this.request<KisanClubProductProgramme>(`/api/v1/kisan-club/programmes/${programmeId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  listKisanClubBenefitRules(
    query: KisanClubBenefitRuleQuery = {},
  ): Promise<PaginatedResult<KisanClubBenefitRule>> {
    return this.request<PaginatedResult<KisanClubBenefitRule>>(
      `/api/v1/kisan-club/benefit-rules${this.toQueryString(this.kisanClubBenefitRuleQueryParams(query))}`,
    );
  }

  createKisanClubBenefitRule(
    input: CreateKisanClubBenefitRuleInput,
  ): Promise<KisanClubBenefitRule> {
    return this.request<KisanClubBenefitRule>('/api/v1/kisan-club/benefit-rules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateKisanClubBenefitRule(
    ruleId: string,
    input: UpdateKisanClubBenefitRuleInput,
  ): Promise<KisanClubBenefitRule> {
    return this.request<KisanClubBenefitRule>(`/api/v1/kisan-club/benefit-rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  listKisanClubFulfilmentAssignments(
    query: KisanClubFulfilmentQuery = {},
  ): Promise<PaginatedResult<KisanClubFulfilmentAssignment>> {
    return this.request<PaginatedResult<KisanClubFulfilmentAssignment>>(
      `/api/v1/kisan-club/fulfilment/assignments${this.toQueryString(this.kisanClubFulfilmentQueryParams(query))}`,
    );
  }

  getKisanClubFulfilmentAssignment(assignmentId: string): Promise<KisanClubFulfilmentAssignment> {
    return this.request<KisanClubFulfilmentAssignment>(
      `/api/v1/kisan-club/fulfilment/assignments/${assignmentId}`,
    );
  }

  transitionKisanClubFulfilment(
    assignmentId: string,
    action: KisanClubFulfilmentAction,
    input: KisanClubFulfilmentActionInput = {},
  ): Promise<KisanClubFulfilmentAssignment> {
    return this.request<KisanClubFulfilmentAssignment>(
      `/api/v1/kisan-club/fulfilment/assignments/${assignmentId}/${action}`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  reassignKisanClubFulfilment(
    assignmentId: string,
    input: ReassignKisanClubFulfilmentInput,
  ): Promise<KisanClubFulfilmentAssignment> {
    return this.request<KisanClubFulfilmentAssignment>(
      `/api/v1/kisan-club/fulfilment/assignments/${assignmentId}/reassign`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  getKisanClubCropSummary(
    query: KisanClubCropIntelligenceQuery = {},
  ): Promise<KisanClubCropSummary> {
    return this.request<KisanClubCropSummary>(
      `/api/v1/kisan-club/intelligence/crop-summary${this.toQueryString(this.kisanClubCropIntelligenceQueryParams(query))}`,
    );
  }

  getKisanClubPromoterPerformance(
    query: KisanClubPromoterPerformanceQuery = {},
  ): Promise<KisanClubPromoterPerformance> {
    return this.request<KisanClubPromoterPerformance>(
      `/api/v1/kisan-club/intelligence/promoter-performance${this.toQueryString(this.kisanClubPromoterPerformanceQueryParams(query))}`,
    );
  }

  private async request<TData>(path: string, init: RequestInit = {}): Promise<TData> {
    const response = await fetch(this.buildUrl(path), {
      ...this.options.fetchOptions,
      ...init,
      headers: await this.buildHeaders(init.headers),
    });
    const payload = await this.parseJson(response);

    if (!response.ok) {
      const errorEnvelope = this.asErrorEnvelope(payload);
      throw new ApiClientError(
        errorEnvelope?.error.message ?? `API request failed with ${response.status}`,
        response.status,
        errorEnvelope?.error.code,
        errorEnvelope?.error.requestId,
      );
    }

    const successEnvelope = payload as ApiSuccessEnvelope<TData>;
    return successEnvelope.data;
  }

  private buildUrl(path: string): string {
    const baseUrl = this.options.baseUrl.endsWith('/')
      ? this.options.baseUrl
      : `${this.options.baseUrl}/`;
    return new URL(path.replace(/^\//, ''), baseUrl).toString();
  }

  private async buildHeaders(headers?: HeadersInit): Promise<Record<string, string>> {
    const token = await this.options.getAccessToken?.();
    const mergedHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...this.options.defaultHeaders,
      ...this.headersToRecord(headers),
    };

    if (token) {
      mergedHeaders.Authorization = `Bearer ${token}`;
    }
    if (!mergedHeaders['Content-Type']) {
      mergedHeaders['Content-Type'] = 'application/json';
    }

    return mergedHeaders;
  }

  private headersToRecord(headers?: HeadersInit): Record<string, string> {
    if (!headers) {
      return {};
    }
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    return headers;
  }

  private async parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return undefined;
    }
    return JSON.parse(text) as unknown;
  }

  private asErrorEnvelope(payload: unknown): ApiErrorEnvelope | undefined {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as ApiErrorEnvelope).error.message === 'string'
    ) {
      return payload as ApiErrorEnvelope;
    }

    return undefined;
  }

  private catalogueQueryParams(query: CatalogueQuery): Record<string, QueryValue> {
    return {
      status: query.status,
      companyOrganisationId: query.companyOrganisationId,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private warehouseQueryParams(query: WarehouseQuery): Record<string, QueryValue> {
    return {
      status: query.status,
      distributorOrganisationId: query.distributorOrganisationId,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private inventoryBatchQueryParams(query: InventoryBatchQuery): Record<string, QueryValue> {
    return {
      status: query.status,
      distributorOrganisationId: query.distributorOrganisationId,
      warehouseId: query.warehouseId,
      batchId: query.batchId,
      productId: query.productId,
      variantId: query.variantId,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private inventoryMovementQueryParams(query: InventoryMovementQuery): Record<string, QueryValue> {
    return {
      distributorOrganisationId: query.distributorOrganisationId,
      warehouseId: query.warehouseId,
      batchId: query.batchId,
      productId: query.productId,
      variantId: query.variantId,
      movementType: query.movementType,
      page: query.page,
      limit: query.limit,
    };
  }

  private inventoryAgeingQueryParams(query: InventoryAgeingQuery): Record<string, QueryValue> {
    return {
      distributorOrganisationId: query.distributorOrganisationId,
      warehouseId: query.warehouseId,
      productId: query.productId,
      variantId: query.variantId,
      lowStockThreshold: query.lowStockThreshold,
      expiringWithinDays: query.expiringWithinDays,
      page: query.page,
      limit: query.limit,
    };
  }

  private offerQueryParams(query: OfferQuery): Record<string, QueryValue> {
    return {
      status: query.status,
      distributorOrganisationId: query.distributorOrganisationId,
      productId: query.productId,
      variantId: query.variantId,
      warehouseId: query.warehouseId,
      batchId: query.batchId,
      serviceablePincode: query.serviceablePincode,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private advisoryRuleQueryParams(query: AdvisoryRuleQuery): Record<string, QueryValue> {
    return {
      status: query.status,
      category: query.category,
      page: query.page,
      limit: query.limit,
    };
  }

  private kisanClubMembershipQueryParams(
    query: KisanClubMembershipQuery,
  ): Record<string, QueryValue> {
    return {
      status: query.status,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private promoterTerritoryQueryParams(query: PromoterTerritoryQuery): Record<string, QueryValue> {
    return {
      status: query.status,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private kisanClubPromoterProfileQueryParams(
    query: KisanClubPromoterProfileQuery,
  ): Record<string, QueryValue> {
    return {
      territoryId: query.territoryId,
      clubEnabled: query.clubEnabled,
      page: query.page,
      limit: query.limit,
    };
  }

  private kisanClubProgrammeQueryParams(
    query: KisanClubProgrammeQuery,
  ): Record<string, QueryValue> {
    return {
      status: query.status,
      productId: query.productId,
      page: query.page,
      limit: query.limit,
    };
  }

  private kisanClubBenefitRuleQueryParams(
    query: KisanClubBenefitRuleQuery,
  ): Record<string, QueryValue> {
    return {
      status: query.status,
      programmeId: query.programmeId,
      page: query.page,
      limit: query.limit,
    };
  }

  private kisanClubFulfilmentQueryParams(
    query: KisanClubFulfilmentQuery,
  ): Record<string, QueryValue> {
    return {
      status: query.status,
      promoterUserId: query.promoterUserId,
      membershipId: query.membershipId,
      productOrderId: query.productOrderId,
      page: query.page,
      limit: query.limit,
    };
  }

  private kisanClubCropIntelligenceQueryParams(
    query: KisanClubCropIntelligenceQuery,
  ): Record<string, QueryValue> {
    return {
      state: query.state,
      district: query.district,
      cropId: query.cropId,
      season: query.season,
      status: query.status,
    };
  }

  private kisanClubPromoterPerformanceQueryParams(
    query: KisanClubPromoterPerformanceQuery,
  ): Record<string, QueryValue> {
    return {
      territoryId: query.territoryId,
      promoterUserId: query.promoterUserId,
      clubEnabled: query.clubEnabled,
      page: query.page,
      limit: query.limit,
    };
  }

  private marketplaceProductQueryParams(
    query: MarketplaceProductQuery,
  ): Record<string, QueryValue> {
    return {
      pincode: query.pincode,
      category: query.category,
      brandId: query.brandId,
      brandSlug: query.brandSlug,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private fulfilmentOrderQueryParams(query: FulfilmentOrderQuery): Record<string, QueryValue> {
    return {
      status: query.status,
      sellerOrganisationId: query.sellerOrganisationId,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private returnRequestQueryParams(query: ReturnRequestQuery): Record<string, QueryValue> {
    return {
      status: query.status,
      distributorOrganisationId: query.distributorOrganisationId,
      q: query.q,
      page: query.page,
      limit: query.limit,
    };
  }

  private returnTransition(
    returnRequestId: string,
    action: 'approve' | 'reject' | 'pickup' | 'receive',
    input: ReturnTransitionInput,
  ): Promise<ReturnRequest> {
    return this.request<ReturnRequest>(`/api/v1/returns/${returnRequestId}/${action}`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  private returnPickupTransition(
    assignmentId: string,
    action: 'accept' | 'reject' | 'collect',
    input: ReturnTransitionInput,
  ): Promise<ReturnPickupAssignment> {
    return this.request<ReturnPickupAssignment>(
      `/api/v1/return-pickups/${assignmentId}/${action}`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  private toQueryString(query: Record<string, QueryValue>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }

    const value = params.toString();
    return value ? `?${value}` : '';
  }
}
