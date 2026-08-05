import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipStatus,
  OrganisationStatus,
  PlatformRole,
  Prisma,
  UserStatus,
  type OrganisationMembership,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { generateOtp, generateRefreshToken, hashOtp, verifyPassword } from './crypto.util';
import { JwtTokenService } from './jwt-token.service';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenContext } from './refresh-token.guard';
import type { RequestOtpDto } from './dto/request-otp.dto';
import type { SelectOrganisationDto } from './dto/select-organisation.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';

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
  ) {}

  async requestOtp(
    dto: RequestOtpDto,
    requestId: string | undefined,
    requestIp: string | undefined,
  ): Promise<{ expiresAt: string; mockOtpCode?: string }> {
    const otpExpiryMinutes = this.configService.getOrThrow<number>('OTP_EXPIRY_MINUTES');
    const { code, salt, hash } = generateOtp();
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60_000);

    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phone: dto.phone,
        otpHash: hash,
        otpSalt: salt,
        expiresAt,
        requestedIp: requestIp ?? null,
      },
    });

    await this.auditService.record({
      action: 'AUTH_OTP_REQUESTED',
      resourceType: 'OtpChallenge',
      resourceId: challenge.id,
      requestId,
      reason: 'OTP login requested',
    });

    // mockOtpCode reflects SMS_PROVIDER, not AUTH_MODE: production authentication
    // does not by itself mean OTPs are actually delivered anywhere. Until
    // SMS_PROVIDER is something other than 'mock', there is no other channel
    // through which a caller could ever learn the code.
    const smsProvider = this.configService.get<string>('SMS_PROVIDER');
    return {
      expiresAt: expiresAt.toISOString(),
      ...(smsProvider === 'mock' ? { mockOtpCode: code } : {}),
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    requestId: string | undefined,
  ): Promise<TokenPairResponse | SelectionRequiredResponse> {
    const maxAttempts = this.configService.getOrThrow<number>('OTP_MAX_ATTEMPTS');

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone: dto.phone, purpose: 'LOGIN', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.attemptCount >= maxAttempts || challenge.expiresAt.getTime() < Date.now()) {
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
      where: { phone: dto.phone, status: UserStatus.ACTIVE },
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

    return this.resolveMembershipOrSelection(user.id, eligibleMemberships, requestId);
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
      selectionToken: this.jwtTokenService.signSelectionToken(userId),
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
