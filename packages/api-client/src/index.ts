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

export type ProductInvoiceStatus = 'GENERATED' | 'VOIDED';

export type ProductDispatchStatus = 'READY_FOR_PICKUP' | 'CANCELLED';

export type ProductDeliveryAssignmentStatus =
  'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'DELIVERY_FAILED' | 'CANCELLED';

export type PaymentProviderMode = 'MOCK';

export type PaymentIntentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export type PaymentEventType =
  'INTENT_CREATED' | 'CONFIRMATION_STARTED' | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED';

export type MockPaymentOutcome = 'SUCCESS' | 'FAILURE';

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
  taxPaise: number;
  totalPaise: number;
  itemCount: number;
  sellerLegalNameSnapshot: string;
  sellerDisplayNameSnapshot: string;
  sellerGstinSnapshot?: string | null;
  farmerNameSnapshot: string;
  deliveryAddressSnapshot: unknown;
  lineItemsSnapshot: ProductInvoiceLineItemSnapshot[];
  generatedByUserId?: string | null;
  generatedByRole?: string | null;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
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
  mockOtpCode?: string;
  createdAt: string;
  updatedAt: string;
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
  reason?: string;
}

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
