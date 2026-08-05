import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  CatalogueStatus,
  DistributorOfferStatus,
  InventoryBatchStatus,
  OrganisationStatus,
  PlatformRole,
  Prisma,
  WarehouseStatus,
  type CartItem,
  type FarmerAddress,
  type FarmerProfile,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { AddCartItemDto } from './dto/add-cart-item.dto';
import type { UpdateCartContextDto } from './dto/update-cart-context.dto';
import type { UpdateCartItemDto } from './dto/update-cart-item.dto';

const cartInclude = Prisma.validator<Prisma.CartInclude>()({
  deliveryAddress: true,
  items: {
    orderBy: { createdAt: 'asc' },
  },
});

const cartOfferInclude = Prisma.validator<Prisma.DistributorOfferInclude>()({
  distributorOrganisation: true,
  warehouse: true,
  batch: {
    include: {
      inventoryMovements: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  },
  product: {
    include: {
      brand: true,
      companyOrganisation: true,
    },
  },
  variant: true,
});

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type CartOffer = Prisma.DistributorOfferGetPayload<{ include: typeof cartOfferInclude }>;

type CartDestinationInput = Pick<
  AddCartItemDto | UpdateCartContextDto,
  'farmerAddressId' | 'serviceablePincode'
>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
  ) {}

  async getMyCart(actor: CurrentUser) {
    this.ensureCartPermission(actor, PermissionCode.CART_READ_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const cart = await this.findOrCreateActiveCart(profile.id);

    return this.toCartDetail(cart);
  }

  async updateCartContext(dto: UpdateCartContextDto, actor: CurrentUser, requestId?: string) {
    this.ensureCartPermission(actor, PermissionCode.CART_WRITE_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const cart = await this.findOrCreateActiveCart(profile.id);
    const destination = await this.resolveCartDestination(dto, profile.id);
    this.ensurePincodeChangeAllowed(cart, destination.pincode);

    const updatedCart = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.update({
        where: { id: cart.id },
        data: {
          serviceablePincode: destination.pincode,
          deliveryAddressId: destination.addressId,
        },
        include: cartInclude,
      });

      const auditInput = this.withActor(actor, {
        action: 'CART_CONTEXT_UPDATED',
        resourceType: 'Cart',
        resourceId: updated.id,
        previousValue: this.cartContextAuditValue(cart),
        newValue: this.cartContextAuditValue(updated),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return updated;
    });

    return this.toCartDetail(updatedCart);
  }

  async addItem(dto: AddCartItemDto, actor: CurrentUser, requestId?: string) {
    this.ensureCartPermission(actor, PermissionCode.CART_WRITE_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const cart = await this.findOrCreateActiveCart(profile.id);
    const destination = await this.resolveCartDestination(dto, profile.id);
    this.ensurePincodeChangeAllowed(cart, destination.pincode);

    const offer = await this.findOfferOrThrow(dto.offerId);
    const availableQuantity = await this.validateOfferForCart(
      offer,
      destination.pincode,
      dto.quantity,
    );
    const existingItem = cart.items.find((item) => item.offerId === offer.id);
    const itemData = this.cartItemSnapshot(offer, {
      quantity: dto.quantity,
      serviceablePincode: destination.pincode,
      availableQuantity,
    });

    const updatedCart = await this.prisma.$transaction(async (tx) => {
      await tx.cart.update({
        where: { id: cart.id },
        data: {
          serviceablePincode: destination.pincode,
          deliveryAddressId: destination.addressId,
        },
      });

      const savedItem = await tx.cartItem.upsert({
        where: {
          cartId_offerId: {
            cartId: cart.id,
            offerId: offer.id,
          },
        },
        create: {
          cartId: cart.id,
          ...itemData,
        },
        update: itemData,
      });

      const auditInput = this.withActor(actor, {
        action: existingItem ? 'CART_ITEM_UPDATED' : 'CART_ITEM_ADDED',
        resourceType: 'CartItem',
        resourceId: savedItem.id,
        newValue: this.cartItemAuditValue(savedItem),
      });
      if (existingItem) {
        auditInput.previousValue = this.cartItemAuditValue(existingItem);
      }
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return this.findCartOrThrow(cart.id, tx);
    });

    return this.toCartDetail(updatedCart);
  }

  async updateItem(
    cartItemId: string,
    dto: UpdateCartItemDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureCartPermission(actor, PermissionCode.CART_WRITE_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const cart = await this.findOrCreateActiveCart(profile.id);
    const existingItem = this.findOwnedCartItemOrThrow(cart, cartItemId);
    const serviceablePincode = cart.serviceablePincode ?? existingItem.serviceablePincodeSnapshot;
    const offer = await this.findOfferOrThrow(existingItem.offerId);
    const availableQuantity = await this.validateOfferForCart(
      offer,
      serviceablePincode,
      dto.quantity,
    );
    const itemData = this.cartItemSnapshot(offer, {
      quantity: dto.quantity,
      serviceablePincode,
      availableQuantity,
    });

    const updatedCart = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.cartItem.update({
        where: { id: cartItemId },
        data: itemData,
      });

      const auditInput = this.withActor(actor, {
        action: 'CART_ITEM_UPDATED',
        resourceType: 'CartItem',
        resourceId: updatedItem.id,
        previousValue: this.cartItemAuditValue(existingItem),
        newValue: this.cartItemAuditValue(updatedItem),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return this.findCartOrThrow(cart.id, tx);
    });

    return this.toCartDetail(updatedCart);
  }

  async removeItem(cartItemId: string, actor: CurrentUser, requestId?: string) {
    this.ensureCartPermission(actor, PermissionCode.CART_WRITE_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const cart = await this.findOrCreateActiveCart(profile.id);
    const existingItem = this.findOwnedCartItemOrThrow(cart, cartItemId);

    const updatedCart = await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({
        where: { id: cartItemId },
      });

      const auditInput = this.withActor(actor, {
        action: 'CART_ITEM_REMOVED',
        resourceType: 'CartItem',
        resourceId: existingItem.id,
        previousValue: this.cartItemAuditValue(existingItem),
      });
      this.attachAuditContext(auditInput, requestId, 'Farmer removed cart item');
      await this.auditService.record(auditInput, tx);

      return this.findCartOrThrow(cart.id, tx);
    });

    return this.toCartDetail(updatedCart);
  }

  async clearCart(actor: CurrentUser, requestId?: string) {
    this.ensureCartPermission(actor, PermissionCode.CART_WRITE_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const cart = await this.findOrCreateActiveCart(profile.id);

    const updatedCart = await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      const auditInput = this.withActor(actor, {
        action: 'CART_CLEARED',
        resourceType: 'Cart',
        resourceId: cart.id,
        previousValue: cart.items.map((item) => this.cartItemAuditValue(item)),
      });
      this.attachAuditContext(auditInput, requestId, 'Farmer cleared cart');
      await this.auditService.record(auditInput, tx);

      return this.findCartOrThrow(cart.id, tx);
    });

    return this.toCartDetail(updatedCart);
  }

  private async findOrCreateActiveCart(farmerProfileId: string): Promise<CartWithItems> {
    const existing = await this.prisma.cart.findUnique({
      where: { farmerProfileId },
      include: cartInclude,
    });

    if (existing) {
      return existing;
    }

    return this.prisma.cart.create({
      data: {
        farmerProfileId,
        status: CartStatus.ACTIVE,
      },
      include: cartInclude,
    });
  }

  private async findCartOrThrow(
    cartId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<CartWithItems> {
    const cart = await client.cart.findUnique({
      where: { id: cartId },
      include: cartInclude,
    });

    if (!cart) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Cart was not found',
      });
    }

    return cart;
  }

  private async findProfileForActorOrThrow(actor: CurrentUser): Promise<FarmerProfile> {
    const profile = await this.prisma.farmerProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!profile) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Create the farmer profile before managing the cart',
      });
    }

    return profile;
  }

  private async resolveCartDestination(
    input: CartDestinationInput,
    farmerProfileId: string,
  ): Promise<{ pincode: string; addressId: string | null }> {
    if (input.farmerAddressId) {
      const address = await this.findAddressForProfileOrThrow(
        farmerProfileId,
        input.farmerAddressId,
      );
      if (input.serviceablePincode && input.serviceablePincode !== address.pincode) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Cart pincode must match the selected farmer address pincode',
        });
      }

      return {
        pincode: address.pincode,
        addressId: address.id,
      };
    }

    if (!input.serviceablePincode) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'A serviceable pincode or farmer address is required for cart validation',
      });
    }

    return {
      pincode: input.serviceablePincode,
      addressId: null,
    };
  }

  private async findAddressForProfileOrThrow(
    farmerProfileId: string,
    addressId: string,
  ): Promise<FarmerAddress> {
    const address = await this.prisma.farmerAddress.findFirst({
      where: {
        id: addressId,
        farmerProfileId,
      },
    });

    if (!address) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Farmer address was not found',
      });
    }

    return address;
  }

  private ensurePincodeChangeAllowed(cart: CartWithItems, nextPincode: string): void {
    if (
      cart.serviceablePincode &&
      cart.serviceablePincode !== nextPincode &&
      cart.items.length > 0
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Clear the cart before changing the serviceable pincode',
      });
    }
  }

  private findOwnedCartItemOrThrow(cart: CartWithItems, cartItemId: string): CartItem {
    const item = cart.items.find((cartItem) => cartItem.id === cartItemId);
    if (!item) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Cart item was not found',
      });
    }

    return item;
  }

  private async findOfferOrThrow(offerId: string): Promise<CartOffer> {
    const offer = await this.prisma.distributorOffer.findUnique({
      where: { id: offerId },
      include: cartOfferInclude,
    });

    if (!offer) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Distributor offer was not found',
      });
    }

    return offer;
  }

  private async validateOfferForCart(
    offer: CartOffer,
    pincode: string,
    quantity: number,
  ): Promise<number> {
    const missingRequirements = this.offerMissingRequirements(offer, pincode);
    if (missingRequirements.length > 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Offer cannot be added to cart: ${missingRequirements.join(', ')}`,
      });
    }

    this.ensureCartQuantityAllowed(offer, quantity);
    const availableQuantity = await this.availableQuantityForOffer(offer);
    if (availableQuantity <= 0 || quantity > availableQuantity) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Requested quantity exceeds backend-derived sellable availability',
      });
    }

    return availableQuantity;
  }

  private offerMissingRequirements(offer: CartOffer, pincode: string): string[] {
    const missingRequirements: string[] = [];
    if (offer.status !== DistributorOfferStatus.APPROVED) {
      missingRequirements.push('APPROVED_OFFER');
    }
    if (!offer.serviceablePincodes.includes(pincode)) {
      missingRequirements.push('SERVICEABLE_PINCODE');
    }
    if (offer.product.status !== CatalogueStatus.APPROVED) {
      missingRequirements.push('APPROVED_PRODUCT');
    }
    if (offer.product.brand.status !== CatalogueStatus.APPROVED) {
      missingRequirements.push('APPROVED_BRAND');
    }
    if (!offer.variant.isActive) {
      missingRequirements.push('ACTIVE_VARIANT');
    }
    if (offer.warehouse.status !== WarehouseStatus.ACTIVE) {
      missingRequirements.push('ACTIVE_WAREHOUSE');
    }
    if (offer.distributorOrganisation.status !== OrganisationStatus.ACTIVE) {
      missingRequirements.push('ACTIVE_DISTRIBUTOR');
    }
    if (offer.batch && !this.isBatchSellable(offer.batch)) {
      missingRequirements.push('SELLABLE_BATCH');
    }

    return missingRequirements;
  }

  private ensureCartQuantityAllowed(offer: CartOffer, quantity: number): void {
    if (quantity < offer.minimumOrderQuantity) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Requested quantity is below the offer minimum order quantity',
      });
    }
    if (offer.maximumOrderQuantity !== null && quantity > offer.maximumOrderQuantity) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Requested quantity exceeds the offer maximum order quantity',
      });
    }
  }

  private async availableQuantityForOffer(offer: CartOffer): Promise<number> {
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        distributorOrganisationId: offer.distributorOrganisationId,
        warehouseId: offer.warehouseId,
        productId: offer.productId,
        variantId: offer.variantId,
        ...(offer.batchId ? { id: offer.batchId } : {}),
        status: InventoryBatchStatus.ACTIVE,
        OR: [{ expiryDate: null }, { expiryDate: { gte: this.todayStartUtc() } }],
      },
      include: {
        inventoryMovements: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return batches.reduce((total, batch) => {
      const balance = batch.inventoryMovements[0]?.balanceAfter ?? 0;
      return total + Math.max(0, balance);
    }, 0);
  }

  private cartItemSnapshot(
    offer: CartOffer,
    input: {
      quantity: number;
      serviceablePincode: string;
      availableQuantity: number;
    },
  ): Omit<Prisma.CartItemUncheckedCreateInput, 'cartId'> {
    return {
      offerId: offer.id,
      distributorOrganisationId: offer.distributorOrganisationId,
      productId: offer.productId,
      variantId: offer.variantId,
      warehouseId: offer.warehouseId,
      batchId: offer.batchId ?? null,
      quantity: input.quantity,
      priceSnapshotPaise: offer.sellingPricePaise,
      availableQuantitySnapshot: input.availableQuantity,
      serviceablePincodeSnapshot: input.serviceablePincode,
      productNameSnapshot: offer.product.name,
      variantNameSnapshot: offer.variant.variantName,
      sellerNameSnapshot: offer.distributorOrganisation.displayName,
      warehouseNameSnapshot: offer.warehouse.name,
      fulfilmentModeSnapshot: offer.fulfilmentMode,
      deliverySlaDaysSnapshot: offer.deliverySlaDays,
    };
  }

  private toCartDetail(cart: CartWithItems) {
    const items = cart.items.map((item) => ({
      id: item.id,
      offerId: item.offerId,
      distributorOrganisationId: item.distributorOrganisationId,
      productId: item.productId,
      variantId: item.variantId,
      warehouseId: item.warehouseId,
      batchId: item.batchId,
      quantity: item.quantity,
      priceSnapshotPaise: item.priceSnapshotPaise,
      availableQuantitySnapshot: item.availableQuantitySnapshot,
      serviceablePincodeSnapshot: item.serviceablePincodeSnapshot,
      productNameSnapshot: item.productNameSnapshot,
      variantNameSnapshot: item.variantNameSnapshot,
      sellerNameSnapshot: item.sellerNameSnapshot,
      warehouseNameSnapshot: item.warehouseNameSnapshot,
      fulfilmentModeSnapshot: item.fulfilmentModeSnapshot,
      deliverySlaDaysSnapshot: item.deliverySlaDaysSnapshot,
      lineTotalPaise: item.priceSnapshotPaise * item.quantity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
    const subtotalPaise = items.reduce((total, item) => total + item.lineTotalPaise, 0);

    return {
      id: cart.id,
      farmerProfileId: cart.farmerProfileId,
      deliveryAddress: cart.deliveryAddress
        ? {
            id: cart.deliveryAddress.id,
            label: cart.deliveryAddress.label,
            recipientName: cart.deliveryAddress.recipientName,
            phone: cart.deliveryAddress.phone,
            addressLine1: cart.deliveryAddress.addressLine1,
            addressLine2: cart.deliveryAddress.addressLine2,
            village: cart.deliveryAddress.village,
            city: cart.deliveryAddress.city,
            district: cart.deliveryAddress.district,
            state: cart.deliveryAddress.state,
            pincode: cart.deliveryAddress.pincode,
            landmark: cart.deliveryAddress.landmark,
            isDefault: cart.deliveryAddress.isDefault,
          }
        : null,
      serviceablePincode: cart.serviceablePincode,
      status: cart.status,
      itemCount: items.length,
      subtotalPaise,
      items,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private isBatchSellable(batch: {
    status: InventoryBatchStatus;
    expiryDate?: Date | null;
  }): boolean {
    return batch.status === InventoryBatchStatus.ACTIVE && !this.isBatchExpired(batch.expiryDate);
  }

  private isBatchExpired(expiryDate?: Date | null): boolean {
    if (!expiryDate) {
      return false;
    }

    return expiryDate.getTime() < this.todayStartUtc().getTime();
  }

  private todayStartUtc(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  private ensureCartPermission(actor: CurrentUser, permission: PermissionCode): void {
    if (actor.role !== PlatformRole.FARMER) {
      throw this.forbidden('Farmer role is required');
    }
    if (!this.accessService.hasPermission(actor, permission)) {
      throw this.forbidden('Cart permission is required');
    }
  }

  private cartContextAuditValue(cart: CartWithItems): Prisma.InputJsonObject {
    return {
      farmerProfileId: cart.farmerProfileId,
      deliveryAddressId: cart.deliveryAddressId,
      serviceablePincode: cart.serviceablePincode,
      status: cart.status,
    };
  }

  private cartItemAuditValue(item: CartItem): Prisma.InputJsonObject {
    return {
      cartId: item.cartId,
      offerId: item.offerId,
      distributorOrganisationId: item.distributorOrganisationId,
      productId: item.productId,
      variantId: item.variantId,
      warehouseId: item.warehouseId,
      batchId: item.batchId,
      quantity: item.quantity,
      priceSnapshotPaise: item.priceSnapshotPaise,
      availableQuantitySnapshot: item.availableQuantitySnapshot,
      serviceablePincodeSnapshot: item.serviceablePincodeSnapshot,
      productNameSnapshot: item.productNameSnapshot,
      variantNameSnapshot: item.variantNameSnapshot,
      sellerNameSnapshot: item.sellerNameSnapshot,
      warehouseNameSnapshot: item.warehouseNameSnapshot,
      fulfilmentModeSnapshot: item.fulfilmentModeSnapshot,
      deliverySlaDaysSnapshot: item.deliverySlaDaysSnapshot,
    };
  }

  private withActor(actor: CurrentUser, input: AuditRecordInput): AuditRecordInput {
    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: actor.organisationId,
    };
  }

  private attachAuditContext(
    auditInput: AuditRecordInput,
    requestId?: string,
    reason?: string,
  ): void {
    if (requestId) {
      auditInput.requestId = requestId;
    }
    if (reason) {
      auditInput.reason = reason;
    }
  }

  private forbidden(message: string): ForbiddenException {
    return new ForbiddenException({
      code: ApiErrorCode.FORBIDDEN,
      message,
    });
  }
}
