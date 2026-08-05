import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  KycDocumentStatus,
  KycDocumentType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

describe('Phase 1C onboarding approval workflow', () => {
  let app: INestApplication | undefined;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();

    const suffix = randomUUID();
    const adminOrganisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `phase1c-admin-${suffix}`,
        legalName: 'Phase 1C Admin Organisation',
        displayName: 'Phase 1C Admin',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const adminUser = await prisma.user.create({
      data: {
        email: `phase1c-admin-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Phase 1C Admin',
          },
        },
      },
    });

    await prisma.organisationMembership.create({
      data: {
        userId: adminUser.id,
        organisationId: adminOrganisation.id,
        role: PlatformRole.SUPER_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    authHeaders = {
      'x-user-id': adminUser.id,
      'x-user-role': PlatformRole.SUPER_ADMIN,
      'x-organisation-id': adminOrganisation.id,
    };

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

  it('reviews KYC metadata before approving a company organisation', async () => {
    const suffix = randomUUID();
    const company = await prisma.organisation.create({
      data: {
        type: OrganisationType.COMPANY,
        slug: `phase1c-company-${suffix}`,
        legalName: 'Phase 1C Seeds Private Limited',
        displayName: 'Phase 1C Seeds',
      },
    });
    await prisma.companyProfile.create({
      data: {
        organisationId: company.id,
        brandName: 'Phase 1C Seeds',
        registrationNumber: 'U01100RJ2026PTC000001',
        pan: 'ABCDE1234F',
        primaryContactName: 'Ramesh Sharma',
        primaryContactPhone: '+919999999999',
        primaryContactEmail: 'phase1c-company@example.local',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
      },
    });
    const kycDocument = await prisma.kycDocument.create({
      data: {
        organisationId: company.id,
        documentType: KycDocumentType.GST_CERTIFICATE,
        documentNumber: '27ABCDE1234F1Z5',
        fileName: 'gst-certificate.pdf',
        storageKey: 'mock/kyc/gst-certificate.pdf',
      },
    });

    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    const queueResponse = await request(server)
      .get('/api/v1/onboarding/approval-queue')
      .query({ type: OrganisationType.COMPANY })
      .set(authHeaders)
      .expect(200);

    expect(queueResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organisation: expect.objectContaining({ id: company.id }),
          missingRequirements: ['APPROVED_KYC_DOCUMENT'],
        }),
      ]),
    );

    await request(server)
      .post(`/api/v1/organisations/${company.id}/review`)
      .set(authHeaders)
      .send({
        decision: 'APPROVE',
        reason: 'Trying before KYC review',
      })
      .expect(400);

    await request(server)
      .patch(`/api/v1/onboarding/organisations/${company.id}/kyc-documents/${kycDocument.id}`)
      .set(authHeaders)
      .send({
        status: KycDocumentStatus.APPROVED,
        reason: 'GST metadata verified',
      })
      .expect(200);

    const approvalResponse = await request(server)
      .post(`/api/v1/organisations/${company.id}/review`)
      .set(authHeaders)
      .send({
        decision: 'APPROVE',
        reason: 'Profile and KYC metadata verified',
      })
      .expect(201);

    expect(approvalResponse.body.data.status).toBe(OrganisationStatus.ACTIVE);

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ organisationId: company.id, limit: 20 })
      .set(authHeaders)
      .expect(200);

    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'KYC_DOCUMENT_REVIEWED' }),
        expect.objectContaining({ action: 'ORGANISATION_APPROVED' }),
      ]),
    );
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
