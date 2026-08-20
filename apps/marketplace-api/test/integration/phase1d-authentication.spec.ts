import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { hashPassword } from '../../src/auth/crypto.util';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

// `ConfigModule.forRoot()` runs synchronously when `app.module.ts` is imported
// above -- before this file's own `beforeAll` runs -- so `AUTH_MODE=production`
// must already be set in the shell environment invoking Jest for this file, not
// assigned to `process.env` here (that would be too late to take effect).
if (process.env.AUTH_MODE !== 'production') {
  throw new Error(
    'phase1d-authentication.spec.ts must be run with AUTH_MODE=production set in the shell environment before Jest starts',
  );
}

describe('Phase 1D production authentication (AUTH_MODE=production)', () => {
  let app: INestApplication | undefined;
  let farmerPhone: string;
  let companyEmail: string;
  const password = 'Demo@12345';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();

    const suffix = randomUUID();
    farmerPhone = `+9190${Math.floor(10000000 + Math.random() * 89999999)}`;
    companyEmail = `phase1d-company-${suffix}@example.local`;

    const farmerOrganisation = await prisma.organisation.upsert({
      where: { slug: 'vardhnam-farmer-context' },
      create: {
        type: OrganisationType.VARDHNAM,
        slug: 'vardhnam-farmer-context',
        legalName: 'Phase 1D Farmer Context',
        displayName: 'Phase 1D Farmer Context',
        status: OrganisationStatus.ACTIVE,
      },
      update: {
        type: OrganisationType.VARDHNAM,
        status: OrganisationStatus.ACTIVE,
      },
    });
    const farmerUser = await prisma.user.create({
      data: {
        phone: farmerPhone,
        status: 'ACTIVE',
        profile: { create: { displayName: 'Phase 1D Farmer' } },
        farmerProfile: { create: { fullName: 'Phase 1D Farmer', preferredLocale: 'hi-IN' } },
      },
    });
    await prisma.organisationMembership.create({
      data: {
        userId: farmerUser.id,
        organisationId: farmerOrganisation.id,
        role: PlatformRole.FARMER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const companyOrganisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.COMPANY,
        slug: `phase1d-company-${suffix}`,
        legalName: 'Phase 1D Company Private Limited',
        displayName: 'Phase 1D Company',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const companyOwnerUser = await prisma.user.create({
      data: {
        email: companyEmail,
        passwordHash: await hashPassword(password),
        status: 'ACTIVE',
        profile: { create: { displayName: 'Phase 1D Company Owner' } },
      },
    });
    await prisma.organisationMembership.create({
      data: {
        userId: companyOwnerUser.id,
        organisationId: companyOrganisation.id,
        role: PlatformRole.COMPANY_OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  function requireServer() {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    return app.getHttpServer();
  }

  it('logs a farmer in via OTP and authorises a protected request with the access token', async () => {
    const server = requireServer();

    const requestResponse = await request(server)
      .post('/api/v1/auth/otp/request')
      .send({ phone: farmerPhone })
      .expect(200);
    const otpCode = requestResponse.body.data.mockOtpCode as string;
    expect(otpCode).toMatch(/^[0-9]{6}$/);

    const verifyResponse = await request(server)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: farmerPhone, code: otpCode })
      .expect(200);
    expect(verifyResponse.body.data.accessToken).toEqual(expect.any(String));
    expect(verifyResponse.body.data.refreshToken).toEqual(expect.any(String));
    expect(verifyResponse.body.data.role).toBe(PlatformRole.FARMER);

    const accessToken = verifyResponse.body.data.accessToken as string;

    const meResponse = await request(server)
      .get('/api/v1/farmers/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meResponse.body.data.fullName).toBe('Phase 1D Farmer');

    await request(server).get('/api/v1/farmers/me').expect(401);
  });

  it('self-registers a new farmer only through the explicit farmer OTP flow', async () => {
    const server = requireServer();
    const phone = `+9191${Math.floor(10000000 + Math.random() * 89999999)}`;

    const requestResponse = await request(server)
      .post('/api/v1/auth/farmer/otp/request')
      .send({ phone })
      .expect(200);
    const otpCode = requestResponse.body.data.mockOtpCode as string;

    const verifyResponse = await request(server)
      .post('/api/v1/auth/farmer/otp/verify')
      .send({
        phone,
        code: otpCode,
        fullName: 'New Farmer',
        preferredLocale: 'hi-IN',
      })
      .expect(200);

    expect(verifyResponse.body.data.role).toBe(PlatformRole.FARMER);
    expect(verifyResponse.body.data.accessToken).toEqual(expect.any(String));
    expect(verifyResponse.body.data.refreshToken).toEqual(expect.any(String));

    const meResponse = await request(server)
      .get('/api/v1/farmers/me')
      .set('Authorization', `Bearer ${verifyResponse.body.data.accessToken as string}`)
      .expect(200);
    expect(meResponse.body.data).toMatchObject({
      fullName: 'New Farmer',
      preferredLocale: 'hi-IN',
    });

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { memberships: true, farmerProfile: true },
    });
    if (!user) {
      throw new Error('Expected the verified farmer to be persisted');
    }
    expect(user.farmerProfile?.fullName).toBe('New Farmer');
    expect(
      user.memberships.filter((membership) => membership.role === PlatformRole.FARMER),
    ).toHaveLength(1);
    expect(
      await prisma.auditLog.count({
        where: {
          actorUserId: user.id,
          action: {
            in: [
              'USER_CREATED',
              'FARMER_PROFILE_CREATED',
              'ORGANISATION_MEMBERSHIP_CREATED',
              'AUTH_FARMER_OTP_VERIFIED',
            ],
          },
        },
      }),
    ).toBe(4);
  });

  it('binds farmer membership selection to the farmer-only OTP candidates', async () => {
    const server = requireServer();
    const suffix = randomUUID();
    const phone = `+9189${Math.floor(10000000 + Math.random() * 89999999)}`;
    const [firstFarmerContext, secondFarmerContext, companyContext] = await Promise.all([
      prisma.organisation.create({
        data: {
          type: OrganisationType.VARDHNAM,
          slug: `farmer-selection-a-${suffix}`,
          legalName: 'Farmer Selection Context A',
          displayName: 'Jaipur Farmer Group',
          status: OrganisationStatus.ACTIVE,
        },
      }),
      prisma.organisation.create({
        data: {
          type: OrganisationType.VARDHNAM,
          slug: `farmer-selection-b-${suffix}`,
          legalName: 'Farmer Selection Context B',
          displayName: 'Ajmer Farmer Group',
          status: OrganisationStatus.ACTIVE,
        },
      }),
      prisma.organisation.create({
        data: {
          type: OrganisationType.COMPANY,
          slug: `farmer-selection-company-${suffix}`,
          legalName: 'Hidden Company Context Private Limited',
          displayName: 'Hidden Company Context',
          status: OrganisationStatus.ACTIVE,
        },
      }),
    ]);
    const user = await prisma.user.create({
      data: {
        phone,
        status: 'ACTIVE',
        profile: { create: { displayName: 'Multi Context Farmer' } },
        farmerProfile: {
          create: { fullName: 'Multi Context Farmer', preferredLocale: 'en-IN' },
        },
      },
    });
    await prisma.organisationMembership.createMany({
      data: [
        {
          userId: user.id,
          organisationId: firstFarmerContext.id,
          role: PlatformRole.FARMER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: user.id,
          organisationId: secondFarmerContext.id,
          role: PlatformRole.FARMER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: user.id,
          organisationId: companyContext.id,
          role: PlatformRole.COMPANY_OWNER,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const otpResponse = await request(server)
      .post('/api/v1/auth/farmer/otp/request')
      .send({ phone })
      .expect(200);
    const verifyResponse = await request(server)
      .post('/api/v1/auth/farmer/otp/verify')
      .send({
        phone,
        code: otpResponse.body.data.mockOtpCode,
        fullName: 'Multi Context Farmer',
        preferredLocale: 'en-IN',
      })
      .expect(200);

    expect(verifyResponse.body.data.membershipSelectionRequired).toBe(true);
    expect(verifyResponse.body.data.candidates).toHaveLength(2);
    expect(verifyResponse.body.data.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organisationId: firstFarmerContext.id,
          role: PlatformRole.FARMER,
        }),
        expect.objectContaining({
          organisationId: secondFarmerContext.id,
          role: PlatformRole.FARMER,
        }),
      ]),
    );
    expect(verifyResponse.body.data.candidates).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ organisationId: companyContext.id })]),
    );

    await request(server)
      .post('/api/v1/auth/select-organisation')
      .send({
        selectionToken: verifyResponse.body.data.selectionToken,
        organisationId: companyContext.id,
      })
      .expect(401);

    const selectedResponse = await request(server)
      .post('/api/v1/auth/select-organisation')
      .send({
        selectionToken: verifyResponse.body.data.selectionToken,
        organisationId: secondFarmerContext.id,
      })
      .expect(200);
    expect(selectedResponse.body.data).toMatchObject({
      organisationId: secondFarmerContext.id,
      role: PlatformRole.FARMER,
    });
  });

  it('locks out OTP verification after too many wrong attempts', async () => {
    const server = requireServer();
    const phone = `+9190${Math.floor(10000000 + Math.random() * 89999999)}`;

    await request(server).post('/api/v1/auth/otp/request').send({ phone }).expect(200);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '000000' })
        .expect(401);
    }

    await request(server)
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code: '000000' })
      .expect(401);
  });

  it('logs a business-role user in via password and authorises a protected request', async () => {
    const server = requireServer();

    const wrongPasswordResponse = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: companyEmail, password: 'wrong-password' })
      .expect(401);
    expect(wrongPasswordResponse.body.error?.code ?? wrongPasswordResponse.body.code).toBe(
      'UNAUTHENTICATED',
    );

    const loginResponse = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: companyEmail, password })
      .expect(200);
    expect(loginResponse.body.data.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.data.role).toBe(PlatformRole.COMPANY_OWNER);

    const accessToken = loginResponse.body.data.accessToken as string;
    const organisationId = loginResponse.body.data.organisationId as string;

    await request(server)
      .get(`/api/v1/organisations/${organisationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('rejects password login for an OTP-only role and OTP login for a password-only role', async () => {
    const server = requireServer();

    await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: farmerPhone, password })
      .expect(401);
  });

  it('rotates the refresh token on use and rejects the old token afterwards', async () => {
    const server = requireServer();

    const loginResponse = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: companyEmail, password })
      .expect(200);
    const firstRefreshToken = loginResponse.body.data.refreshToken as string;

    const refreshResponse = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(200);
    const secondRefreshToken = refreshResponse.body.data.refreshToken as string;
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(401);

    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: secondRefreshToken })
      .expect(200);
  });

  it('revokes a refresh token on logout', async () => {
    const server = requireServer();

    const loginResponse = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: companyEmail, password })
      .expect(200);
    const refreshToken = loginResponse.body.data.refreshToken as string;

    await request(server).post('/api/v1/auth/logout').send({ refreshToken }).expect(200);

    await request(server).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });
});

async function seedPermissions(): Promise<void> {
  const permissionByCode = new Map<string, string>();
  for (const permission of permissionDefinitions) {
    const savedPermission = await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        description: permission.description,
      },
      update: {
        description: permission.description,
      },
    });
    permissionByCode.set(savedPermission.code, savedPermission.id);
  }

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    for (const permissionCode of permissions) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Missing permission ${permissionCode}`);
      }
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as PlatformRole,
            permissionId,
          },
        },
        create: {
          role: role as PlatformRole,
          permissionId,
        },
        update: {},
      });
    }
  }
}
