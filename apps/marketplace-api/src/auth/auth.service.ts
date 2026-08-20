import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  OtpPurpose,
  PlatformRole,
  Prisma,
  UserStatus,
  type OrganisationMembership,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from './current-user.interface';
import { OtpSenderService } from '../notifications/otp-sender.service';
import { generateOtp, generateRefreshToken, hashOtp, verifyPassword } from './crypto.util';
import { JwtTokenService } from './jwt-token.service';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenContext } from './refresh-token.guard';
import type { RequestOtpDto } from './dto/request-otp.dto';
import type { SelectOrganisationDto } from './dto/select-organisation.dto';
import type { VerifyFarmerOtpDto } from './dto/verify-farmer-otp.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';

const FARMER_CONTEXT_SLUG = 'vardhnam-farmer-context';

const OTP_ELIGIBLE_ROLES: PlatformRole[] = [
  PlatformRole.FARMER,
  PlatformRole.DELIVERY_PARTNER,
  PlatformRole.PROMOTER,
  PlatformRole.SALES_PARTNER,
  PlatformRole.SERVICE_PROVIDER,
];

const PASSWORD_ELIGIBLE_ROLES: PlatformRole[] = [
  PlatformRole.DISTRIBUTOR_OWNER,
  PlatformRole.DISTRIBUTOR_STAFF,
  PlatformRole.COMPANY_OWNER,
  PlatformRole.COMPANY_STAFF,
  PlatformRole.ADMIN,
  PlatformRole.SUPER_ADMIN,
  PlatformRole.OPERATIONS_MANAGER,
  PlatformRole.FINANCE_MANAGER,
  PlatformRole.SUPPORT_AGENT,
  PlatformRole.CATALOGUE_REVIEWER,
  PlatformRole.AGRONOMIST,
];

type MembershipWithOrganisation = Prisma.OrganisationMembershipGetPayload<{
  include: { organisation: true };
}>;

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  membershipId: string;
  organisationId: string;
  role: PlatformRole;
}

export interface SelectionRequiredResponse {
  membershipSelectionRequired: true;
  selectionToken: string;
  candidates: Array<{ organisationId: string; organisationName: string; role: PlatformRole }>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly configService: ConfigService,
    private readonly otpSender: OtpSenderService,
  ) {}

  async requestOtp(
    dto: RequestOtpDto,
    requestId: string | undefined,
    requestIp: string | undefined,
  ): Promise<{ expiresAt: string; mockOtpCode?: string }> {
    return this.createOtpChallenge(
      normalizeIndianPhone(dto.phone),
      OtpPurpose.LOGIN,
      requestId,
      requestIp,
    );
  }

  async requestFarmerOtp(
    dto: RequestOtpDto,
    requestId: string | undefined,
    requestIp: string | undefined,
  ): Promise<{ expiresAt: string; mockOtpCode?: string }> {
    return this.createOtpChallenge(
      normalizeIndianPhone(dto.phone),
      OtpPurpose.FARMER_REGISTRATION,
      requestId,
      requestIp,
    );
  }

  private async createOtpChallenge(
    phone: string,
    purpose: OtpPurpose,
    requestId: string | undefined,
    requestIp: string | undefined,
  ): Promise<{ expiresAt: string; mockOtpCode?: string }> {
    const otpExpiryMinutes = this.configService.getOrThrow<number>('OTP_EXPIRY_MINUTES');
    const { code, salt, hash } = generateOtp();
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60_000);

    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose,
        otpHash: hash,
        otpSalt: salt,
        expiresAt,
        requestedIp: requestIp ?? null,
      },
    });

    await this.auditService.record({
      action:
        purpose === OtpPurpose.FARMER_REGISTRATION
          ? 'AUTH_FARMER_OTP_REQUESTED'
          : 'AUTH_OTP_REQUESTED',
      resourceType: 'OtpChallenge',
      resourceId: challenge.id,
      requestId,
      reason:
        purpose === OtpPurpose.FARMER_REGISTRATION
          ? 'Farmer registration OTP requested'
          : 'OTP login requested',
    });

    // The code is handed to the SMS transport here, and only its hash is stored.
    // `mockOtpCode` comes back populated only while SMS is mocked -- against a
    // real provider the code exists solely on the recipient's phone.
    //
    // A send failure propagates rather than being swallowed: returning success
    // for an OTP that was never transmitted would leave the caller waiting for a
    // message that is not coming.
    const dispatch = await this.otpSender.sendOtp({
      phone,
      code,
      expiryMinutes: otpExpiryMinutes,
      challengeId: challenge.id,
    });

    return {
      expiresAt: expiresAt.toISOString(),
      ...(dispatch.mockOtpCode ? { mockOtpCode: dispatch.mockOtpCode } : {}),
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    requestId: string | undefined,
    requestMeta: { userAgent?: string; ip?: string } = {},
  ): Promise<TokenPairResponse | SelectionRequiredResponse> {
    const maxAttempts = this.configService.getOrThrow<number>('OTP_MAX_ATTEMPTS');

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone: normalizeIndianPhone(dto.phone),
        purpose: OtpPurpose.LOGIN,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (
      !challenge ||
      challenge.attemptCount >= maxAttempts ||
      challenge.expiresAt.getTime() < Date.now()
    ) {
      throw this.genericAuthFailure();
    }

    if (hashOtp(dto.code, challenge.otpSalt) !== challenge.otpHash) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      await this.auditService.record({
        action: 'AUTH_OTP_FAILED',
        resourceType: 'OtpChallenge',
        resourceId: challenge.id,
        requestId,
        reason: 'Invalid OTP code',
      });
      throw this.genericAuthFailure();
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const user = await this.prisma.user.findFirst({
      where: {
        phone: { in: indianPhoneCandidates(dto.phone) },
        status: UserStatus.ACTIVE,
      },
      include: {
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          include: { organisation: true },
        },
      },
    });

    const eligibleMemberships = (user?.memberships ?? []).filter(
      (membership): membership is MembershipWithOrganisation =>
        OTP_ELIGIBLE_ROLES.includes(membership.role) &&
        membership.organisation.status === OrganisationStatus.ACTIVE,
    );

    if (!user || eligibleMemberships.length === 0) {
      throw this.genericAuthFailure();
    }

    await this.auditService.record({
      action: 'AUTH_OTP_VERIFIED',
      actorUserId: user.id,
      resourceType: 'User',
      resourceId: user.id,
      requestId,
      reason: 'OTP login verified',
    });

    return this.resolveMembershipOrSelection(user.id, eligibleMemberships, requestId, requestMeta);
  }

  async verifyFarmerOtp(
    dto: VerifyFarmerOtpDto,
    requestId: string | undefined,
    requestMeta: { userAgent?: string; ip?: string },
  ): Promise<TokenPairResponse | SelectionRequiredResponse> {
    const result = await this.registerFarmerFromOtp(dto, requestId);
    return this.resolveMembershipOrSelection(
      result.userId,
      result.memberships,
      requestId,
      requestMeta,
    );
  }

  async verifyFarmerOtpForAssistance(
    dto: VerifyFarmerOtpDto,
    requestId: string | undefined,
    assistedBy: CurrentUser,
  ): Promise<{ userId: string }> {
    const result = await this.registerFarmerFromOtp(dto, requestId, assistedBy);
    return { userId: result.userId };
  }

  private async registerFarmerFromOtp(
    dto: VerifyFarmerOtpDto,
    requestId: string | undefined,
    assistedBy?: CurrentUser,
  ): Promise<{ userId: string; memberships: MembershipWithOrganisation[] }> {
    const phone = normalizeIndianPhone(dto.phone);
    const maxAttempts = this.configService.getOrThrow<number>('OTP_MAX_ATTEMPTS');
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: OtpPurpose.FARMER_REGISTRATION,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (
      !challenge ||
      challenge.attemptCount >= maxAttempts ||
      challenge.expiresAt.getTime() < Date.now()
    ) {
      throw this.genericAuthFailure();
    }

    if (hashOtp(dto.code, challenge.otpSalt) !== challenge.otpHash) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      await this.auditService.record({
        action: 'AUTH_FARMER_OTP_FAILED',
        resourceType: 'OtpChallenge',
        resourceId: challenge.id,
        requestId,
        reason: 'Invalid farmer registration OTP code',
      });
      throw this.genericAuthFailure();
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.otpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw this.genericAuthFailure();
      }

      let user = await tx.user.findFirst({
        where: { phone: { in: indianPhoneCandidates(phone) } },
        include: {
          profile: true,
          farmerProfile: true,
          memberships: {
            where: { status: MembershipStatus.ACTIVE },
            include: { organisation: true },
          },
        },
      });

      if (user && user.status !== UserStatus.ACTIVE) {
        throw this.genericAuthFailure();
      }

      let eligibleMemberships = (user?.memberships ?? []).filter(
        (membership): membership is MembershipWithOrganisation =>
          membership.role === PlatformRole.FARMER &&
          membership.organisation.status === OrganisationStatus.ACTIVE,
      );

      if (!user || eligibleMemberships.length === 0) {
        const farmerContext = await tx.organisation.findUnique({
          where: { slug: FARMER_CONTEXT_SLUG },
        });
        if (
          !farmerContext ||
          farmerContext.type !== OrganisationType.VARDHNAM ||
          farmerContext.status !== OrganisationStatus.ACTIVE
        ) {
          throw new ServiceUnavailableException({
            code: ApiErrorCode.READINESS_CHECK_FAILED,
            message: 'Farmer registration is temporarily unavailable',
          });
        }

        if (!user) {
          user = await tx.user.create({
            data: {
              phone,
              status: UserStatus.ACTIVE,
              profile: {
                create: {
                  displayName: dto.fullName,
                  preferredLocale: dto.preferredLocale,
                  timezone: 'Asia/Kolkata',
                },
              },
              farmerProfile: {
                create: {
                  fullName: dto.fullName,
                  preferredLocale: dto.preferredLocale,
                },
              },
            },
            include: {
              profile: true,
              farmerProfile: true,
              memberships: { include: { organisation: true } },
            },
          });
          await this.auditService.record(
            {
              action: 'USER_CREATED',
              actorUserId: assistedBy?.userId ?? user.id,
              actorRole: assistedBy?.role ?? PlatformRole.FARMER,
              organisationId: assistedBy?.organisationId,
              resourceType: 'User',
              resourceId: user.id,
              newValue: {
                phone: user.phone,
                status: user.status,
                registrationMethod: assistedBy
                  ? 'PROMOTER_ASSISTED_FARMER_OTP'
                  : 'FARMER_OTP',
              } satisfies Prisma.InputJsonObject,
              requestId,
              reason: assistedBy
                ? 'Promoter-assisted farmer registration after farmer OTP verification'
                : 'Farmer self-registration after OTP verification',
            },
            tx,
          );
          await this.auditService.record(
            {
              action: 'FARMER_PROFILE_CREATED',
              actorUserId: assistedBy?.userId ?? user.id,
              actorRole: assistedBy?.role ?? PlatformRole.FARMER,
              organisationId: assistedBy?.organisationId,
              resourceType: 'FarmerProfile',
              resourceId: user.farmerProfile!.id,
              newValue: {
                fullName: dto.fullName,
                preferredLocale: dto.preferredLocale,
              } satisfies Prisma.InputJsonObject,
              requestId,
              reason: assistedBy
                ? 'Initial farmer profile created during promoter-assisted OTP registration'
                : 'Initial farmer profile created during OTP registration',
            },
            tx,
          );
        } else {
          if (!user.profile) {
            await tx.userProfile.create({
              data: {
                userId: user.id,
                displayName: dto.fullName,
                preferredLocale: dto.preferredLocale,
                timezone: 'Asia/Kolkata',
              },
            });
          }
          if (!user.farmerProfile) {
            const farmerProfile = await tx.farmerProfile.create({
              data: {
                userId: user.id,
                fullName: dto.fullName,
                preferredLocale: dto.preferredLocale,
              },
            });
            await this.auditService.record(
              {
                action: 'FARMER_PROFILE_CREATED',
                actorUserId: assistedBy?.userId ?? user.id,
                actorRole: assistedBy?.role ?? PlatformRole.FARMER,
                organisationId: assistedBy?.organisationId,
                resourceType: 'FarmerProfile',
                resourceId: farmerProfile.id,
                newValue: {
                  fullName: dto.fullName,
                  preferredLocale: dto.preferredLocale,
                } satisfies Prisma.InputJsonObject,
                requestId,
                reason: assistedBy
                  ? 'Farmer profile added during promoter-assisted OTP registration'
                  : 'Farmer profile added after OTP verification',
              },
              tx,
            );
          }
        }

        const existingContextMembership = await tx.organisationMembership.findUnique({
          where: {
            userId_organisationId_role: {
              userId: user.id,
              organisationId: farmerContext.id,
              role: PlatformRole.FARMER,
            },
          },
        });
        if (
          existingContextMembership &&
          existingContextMembership.status !== MembershipStatus.ACTIVE
        ) {
          throw this.genericAuthFailure();
        }

        if (!existingContextMembership) {
          const membership = await tx.organisationMembership.create({
            data: {
              userId: user.id,
              organisationId: farmerContext.id,
              role: PlatformRole.FARMER,
              status: MembershipStatus.ACTIVE,
            },
          });
          await this.auditService.record(
            {
              action: 'ORGANISATION_MEMBERSHIP_CREATED',
              actorUserId: assistedBy?.userId ?? user.id,
              actorRole: assistedBy?.role ?? PlatformRole.FARMER,
              organisationId: farmerContext.id,
              resourceType: 'OrganisationMembership',
              resourceId: membership.id,
              newValue: {
                userId: user.id,
                role: membership.role,
                status: membership.status,
              } satisfies Prisma.InputJsonObject,
              requestId,
              reason: assistedBy
                ? 'Farmer membership created during promoter-assisted OTP registration'
                : 'Farmer membership created during OTP registration',
            },
            tx,
          );
        }

        eligibleMemberships = await tx.organisationMembership.findMany({
          where: {
            userId: user.id,
            role: PlatformRole.FARMER,
            status: MembershipStatus.ACTIVE,
            organisation: { status: OrganisationStatus.ACTIVE },
          },
          include: { organisation: true },
        });
      }

      await this.auditService.record(
        {
          action: 'AUTH_FARMER_OTP_VERIFIED',
          actorUserId: assistedBy?.userId ?? user.id,
          actorRole: assistedBy?.role ?? PlatformRole.FARMER,
          organisationId: assistedBy?.organisationId,
          resourceType: 'User',
          resourceId: user.id,
          requestId,
          reason: assistedBy
            ? 'Farmer OTP verified during promoter-assisted registration'
            : 'Farmer OTP verified',
        },
        tx,
      );

      return { userId: user.id, memberships: eligibleMemberships };
    });

    return result;
  }

  async login(
    dto: LoginDto,
    requestId: string | undefined,
    requestMeta: { userAgent?: string; ip?: string },
  ): Promise<TokenPairResponse | SelectionRequiredResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        status: UserStatus.ACTIVE,
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
      },
      include: {
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          include: { organisation: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      await this.auditService.record({
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'User',
        requestId,
        reason: 'Unknown identifier or no password set',
      });
      throw this.genericAuthFailure();
    }

    const passwordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.auditService.record({
        action: 'AUTH_LOGIN_FAILED',
        actorUserId: user.id,
        resourceType: 'User',
        resourceId: user.id,
        requestId,
        reason: 'Invalid password',
      });
      throw this.genericAuthFailure();
    }

    const eligibleMemberships = user.memberships.filter(
      (membership): membership is MembershipWithOrganisation =>
        PASSWORD_ELIGIBLE_ROLES.includes(membership.role) &&
        membership.organisation.status === OrganisationStatus.ACTIVE,
    );

    if (eligibleMemberships.length === 0) {
      await this.auditService.record({
        action: 'AUTH_LOGIN_FAILED',
        actorUserId: user.id,
        resourceType: 'User',
        resourceId: user.id,
        requestId,
        reason: 'No password-eligible active membership',
      });
      throw this.genericAuthFailure();
    }

    await this.auditService.record({
      action: 'AUTH_LOGIN_SUCCEEDED',
      actorUserId: user.id,
      resourceType: 'User',
      resourceId: user.id,
      requestId,
      reason: 'Password login succeeded',
    });

    return this.resolveMembershipOrSelection(user.id, eligibleMemberships, requestId, requestMeta);
  }

  async selectOrganisation(
    dto: SelectOrganisationDto,
    requestId: string | undefined,
    requestMeta: { userAgent?: string; ip?: string },
  ): Promise<TokenPairResponse> {
    const payload = this.jwtTokenService.verifySelectionToken(dto.selectionToken);

    const membership = await this.prisma.organisationMembership.findFirst({
      where: {
        id: { in: payload.membershipIds },
        userId: payload.sub,
        organisationId: dto.organisationId,
        status: MembershipStatus.ACTIVE,
        organisation: { status: OrganisationStatus.ACTIVE },
      },
    });

    if (!membership) {
      throw this.genericAuthFailure();
    }

    const issued = await this.issueTokenPair(payload.sub, membership, requestId, requestMeta);
    return issued.response;
  }

  async refresh(
    context: RefreshTokenContext,
    requestId: string | undefined,
    requestMeta: { userAgent?: string; ip?: string },
  ): Promise<TokenPairResponse> {
    const membership = await this.prisma.organisationMembership.findFirst({
      where: {
        id: context.refreshToken.membershipId,
        userId: context.refreshToken.userId,
        status: MembershipStatus.ACTIVE,
        organisation: { status: OrganisationStatus.ACTIVE },
      },
    });

    if (!membership) {
      throw this.genericAuthFailure();
    }

    const revokedAt = new Date();
    const issued = await this.issueTokenPair(
      context.refreshToken.userId,
      membership,
      requestId,
      requestMeta,
    );

    await this.prisma.refreshToken.update({
      where: { id: context.refreshToken.id },
      data: { revokedAt, replacedByTokenId: issued.refreshTokenId },
    });

    await this.auditService.record({
      action: 'AUTH_TOKEN_REFRESHED',
      actorUserId: context.refreshToken.userId,
      resourceType: 'RefreshToken',
      resourceId: context.refreshToken.id,
      requestId,
      reason: 'Refresh token rotated',
    });

    return issued.response;
  }

  async logout(context: RefreshTokenContext, requestId: string | undefined): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: context.refreshToken.id },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      action: 'AUTH_LOGOUT',
      actorUserId: context.refreshToken.userId,
      resourceType: 'RefreshToken',
      resourceId: context.refreshToken.id,
      requestId,
      reason: 'User logged out',
    });
  }

  private async resolveMembershipOrSelection(
    userId: string,
    memberships: MembershipWithOrganisation[],
    requestId: string | undefined,
    requestMeta: { userAgent?: string; ip?: string } = {},
  ): Promise<TokenPairResponse | SelectionRequiredResponse> {
    if (memberships.length === 1) {
      const { response } = await this.issueTokenPair(
        userId,
        memberships[0] as MembershipWithOrganisation,
        requestId,
        requestMeta,
      );
      return response;
    }

    return {
      membershipSelectionRequired: true,
      selectionToken: this.jwtTokenService.signSelectionToken(
        userId,
        memberships.map((membership) => membership.id),
      ),
      candidates: memberships.map((membership) => ({
        organisationId: membership.organisationId,
        organisationName: membership.organisation.displayName,
        role: membership.role,
      })),
    };
  }

  private async issueTokenPair(
    userId: string,
    membership: Pick<OrganisationMembership, 'id' | 'organisationId' | 'role'>,
    requestId: string | undefined,
    requestMeta: { userAgent?: string; ip?: string } = {},
  ): Promise<{ response: TokenPairResponse; refreshTokenId: string }> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: membership.role },
      include: { permission: true },
    });

    const accessToken = this.jwtTokenService.signAccessToken({
      sub: userId,
      membershipId: membership.id,
      organisationId: membership.organisationId,
      role: membership.role,
      permissions: rolePermissions.map((rolePermission) => rolePermission.permission.code),
    });

    const refreshTtlDays = this.configService.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');
    const { token: refreshTokenPlain, hash } = generateRefreshToken();
    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        userId,
        membershipId: membership.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + refreshTtlDays * 86_400_000),
        userAgent: requestMeta.userAgent ?? null,
        ip: requestMeta.ip ?? null,
      },
    });

    return {
      refreshTokenId: refreshTokenRecord.id,
      response: {
        accessToken,
        refreshToken: refreshTokenPlain,
        tokenType: 'Bearer',
        expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_TTL'),
        membershipId: membership.id,
        organisationId: membership.organisationId,
        role: membership.role,
      },
    };
  }

  private genericAuthFailure(): UnauthorizedException {
    return new UnauthorizedException({
      code: ApiErrorCode.UNAUTHENTICATED,
      message: 'Invalid credentials',
    });
  }
}

function normalizeIndianPhone(phone: string): string {
  return phone.startsWith('+91') ? phone : `+91${phone}`;
}

function indianPhoneCandidates(phone: string): string[] {
  const canonicalPhone = normalizeIndianPhone(phone);
  return [canonicalPhone, canonicalPhone.substring(3)];
}
