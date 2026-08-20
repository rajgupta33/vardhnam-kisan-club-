import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlatformRole, Prisma, type FarmerAddress, type FarmerProfile } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { stateCodeForAddress } from '../common/india-gst';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFarmerAddressDto } from './dto/create-farmer-address.dto';
import type { UpdateFarmerAddressDto } from './dto/update-farmer-address.dto';
import type { UpsertFarmerProfileDto } from './dto/upsert-farmer-profile.dto';

const farmerProfileInclude = Prisma.validator<Prisma.FarmerProfileInclude>()({
  addresses: {
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  },
});

type FarmerProfileWithAddresses = Prisma.FarmerProfileGetPayload<{
  include: typeof farmerProfileInclude;
}>;

@Injectable()
export class FarmersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
  ) {}

  async getMyProfile(actor: CurrentUser) {
    this.ensureFarmerRead(actor, PermissionCode.FARMER_PROFILE_READ_OWN);
    const profile = await this.prisma.farmerProfile.findUnique({
      where: { userId: actor.userId },
      include: farmerProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Farmer profile was not found',
      });
    }

    return profile;
  }

  async upsertMyProfile(
    dto: UpsertFarmerProfileDto,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<FarmerProfileWithAddresses> {
    this.ensureFarmerRead(actor, PermissionCode.FARMER_PROFILE_WRITE_OWN);
    const existing = await this.prisma.farmerProfile.findUnique({
      where: { userId: actor.userId },
    });

    const saved = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.farmerProfile.upsert({
        where: { userId: actor.userId },
        create: this.profileCreateInput(actor.userId, dto),
        update: this.profileUpdateInput(dto),
        include: farmerProfileInclude,
      });

      const auditInput = this.withActor(actor, {
        action: existing ? 'FARMER_PROFILE_UPDATED' : 'FARMER_PROFILE_CREATED',
        resourceType: 'FarmerProfile',
        resourceId: profile.id,
        newValue: this.profileAuditValue(profile),
      });
      if (existing) {
        auditInput.previousValue = this.profileAuditValue(existing);
      }
      this.attachAuditContext(auditInput, requestId, 'Farmer profile saved');
      await this.auditService.record(auditInput, tx);

      return profile;
    });

    return saved;
  }

  async listMyAddresses(actor: CurrentUser): Promise<FarmerAddress[]> {
    this.ensureFarmerRead(actor, PermissionCode.FARMER_ADDRESS_READ_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);

    return this.prisma.farmerAddress.findMany({
      where: { farmerProfileId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createMyAddress(
    dto: CreateFarmerAddressDto,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<FarmerAddress> {
    this.ensureFarmerRead(actor, PermissionCode.FARMER_ADDRESS_WRITE_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const existingAddressCount = await this.prisma.farmerAddress.count({
      where: { farmerProfileId: profile.id },
    });
    const shouldBeDefault = dto.isDefault ?? existingAddressCount === 0;

    const address = await this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.farmerAddress.updateMany({
          where: { farmerProfileId: profile.id },
          data: { isDefault: false },
        });
      }

      const created = await tx.farmerAddress.create({
        data: {
          ...this.addressCreateFields(dto),
          farmerProfileId: profile.id,
          isDefault: shouldBeDefault,
        },
      });

      const auditInput = this.withActor(actor, {
        action: 'FARMER_ADDRESS_CREATED',
        resourceType: 'FarmerAddress',
        resourceId: created.id,
        newValue: this.addressAuditValue(created),
      });
      this.attachAuditContext(auditInput, requestId, 'Farmer address created');
      await this.auditService.record(auditInput, tx);

      return created;
    });

    return address;
  }

  async updateMyAddress(
    addressId: string,
    dto: UpdateFarmerAddressDto,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<FarmerAddress> {
    this.ensureFarmerRead(actor, PermissionCode.FARMER_ADDRESS_WRITE_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const existing = await this.findAddressForProfileOrThrow(profile.id, addressId);

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.farmerAddress.updateMany({
          where: { farmerProfileId: profile.id, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      const updated = await tx.farmerAddress.update({
        where: { id: addressId },
        data: this.addressUpdateFields(dto, existing),
      });

      const auditInput = this.withActor(actor, {
        action: 'FARMER_ADDRESS_UPDATED',
        resourceType: 'FarmerAddress',
        resourceId: updated.id,
        previousValue: this.addressAuditValue(existing),
        newValue: this.addressAuditValue(updated),
      });
      this.attachAuditContext(
        auditInput,
        requestId,
        dto.isDefault ? 'Default address changed' : undefined,
      );
      await this.auditService.record(auditInput, tx);

      return updated;
    });

    return address;
  }

  private profileCreateInput(
    userId: string,
    dto: UpsertFarmerProfileDto,
  ): Prisma.FarmerProfileUncheckedCreateInput {
    return {
      userId,
      fullName: dto.fullName,
      alternatePhone: dto.alternatePhone ?? null,
      preferredLocale: dto.preferredLocale ?? 'en-IN',
      village: dto.village ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      primaryPincode: dto.primaryPincode ?? null,
      cropInterests: this.normaliseList(dto.cropInterests ?? []),
    };
  }

  private profileUpdateInput(dto: UpsertFarmerProfileDto): Prisma.FarmerProfileUpdateInput {
    return {
      fullName: dto.fullName,
      alternatePhone: dto.alternatePhone ?? null,
      preferredLocale: dto.preferredLocale ?? 'en-IN',
      village: dto.village ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      primaryPincode: dto.primaryPincode ?? null,
      cropInterests: this.normaliseList(dto.cropInterests ?? []),
    };
  }

  private addressCreateFields(
    dto: CreateFarmerAddressDto,
  ): Omit<Prisma.FarmerAddressUncheckedCreateInput, 'farmerProfileId'> {
    const stateCode = this.requireAddressStateCode(dto.state, dto.stateCode);
    return {
      label: dto.label,
      recipientName: dto.recipientName,
      phone: dto.phone,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2 ?? null,
      village: dto.village ?? null,
      city: dto.city,
      district: dto.district ?? null,
      state: dto.state,
      stateCode,
      pincode: dto.pincode,
      landmark: dto.landmark ?? null,
      isDefault: dto.isDefault ?? false,
    };
  }

  private addressUpdateFields(
    dto: UpdateFarmerAddressDto,
    existing: FarmerAddress,
  ): Prisma.FarmerAddressUpdateInput {
    const data: Prisma.FarmerAddressUpdateInput = {};
    if (dto.label !== undefined) {
      data.label = dto.label;
    }
    if (dto.recipientName !== undefined) {
      data.recipientName = dto.recipientName;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
    }
    if (dto.addressLine1 !== undefined) {
      data.addressLine1 = dto.addressLine1;
    }
    if (dto.addressLine2 !== undefined) {
      data.addressLine2 = dto.addressLine2;
    }
    if (dto.village !== undefined) {
      data.village = dto.village;
    }
    if (dto.city !== undefined) {
      data.city = dto.city;
    }
    if (dto.district !== undefined) {
      data.district = dto.district;
    }
    if (dto.state !== undefined) {
      data.state = dto.state;
    }
    if (dto.state !== undefined || dto.stateCode !== undefined) {
      data.stateCode = this.requireAddressStateCode(
        dto.state ?? existing.state,
        dto.stateCode ?? undefined,
      );
    }
    if (dto.pincode !== undefined) {
      data.pincode = dto.pincode;
    }
    if (dto.landmark !== undefined) {
      data.landmark = dto.landmark;
    }
    if (dto.isDefault !== undefined) {
      data.isDefault = dto.isDefault;
    }

    return data;
  }

  private requireAddressStateCode(state: string, supplied?: string): string {
    const stateCode = stateCodeForAddress(state, supplied);
    if (!stateCode) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Address state and GST state code are missing or inconsistent',
      });
    }
    return stateCode;
  }

  private async findProfileForActorOrThrow(actor: CurrentUser): Promise<FarmerProfile> {
    this.ensureFarmerRead(actor, PermissionCode.FARMER_PROFILE_READ_OWN);
    const profile = await this.prisma.farmerProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!profile) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Create the farmer profile before managing addresses or cart',
      });
    }

    return profile;
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

  private ensureFarmerRead(actor: CurrentUser, permission: PermissionCode): void {
    if (actor.role !== PlatformRole.FARMER) {
      throw this.forbidden('Farmer role is required');
    }
    if (!this.accessService.hasPermission(actor, permission)) {
      throw this.forbidden('Farmer permission is required');
    }
  }

  private normaliseList(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
  }

  private profileAuditValue(profile: FarmerProfile): Prisma.InputJsonObject {
    return {
      userId: profile.userId,
      fullName: profile.fullName,
      alternatePhone: profile.alternatePhone,
      preferredLocale: profile.preferredLocale,
      village: profile.village,
      district: profile.district,
      state: profile.state,
      primaryPincode: profile.primaryPincode,
      cropInterests: profile.cropInterests,
    };
  }

  private addressAuditValue(address: FarmerAddress): Prisma.InputJsonObject {
    return {
      farmerProfileId: address.farmerProfileId,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      village: address.village,
      city: address.city,
      district: address.district,
      state: address.state,
      stateCode: address.stateCode,
      pincode: address.pincode,
      landmark: address.landmark,
      isDefault: address.isDefault,
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
