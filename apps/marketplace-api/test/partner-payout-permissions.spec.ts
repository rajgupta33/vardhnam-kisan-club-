import { PlatformRole } from '@prisma/client';
import { PermissionCode, rolePermissions } from '../src/access/permission-codes';

describe('partner payout role permissions', () => {
  it.each([
    PlatformRole.PROMOTER,
    PlatformRole.SALES_PARTNER,
    PlatformRole.SERVICE_PROVIDER,
    PlatformRole.DELIVERY_PARTNER,
  ])('grants own-account and own-statement access to %s', (role) => {
    expect(rolePermissions[role]).toEqual(
      expect.arrayContaining([
        PermissionCode.PAYOUT_ACCOUNTS_WRITE_OWN,
        PermissionCode.PAYOUT_ACCOUNTS_READ_OWN,
        PermissionCode.PAYOUT_STATEMENTS_READ_OWN,
      ]),
    );
  });
});

describe('promoter lead role permissions', () => {
  it.each([PlatformRole.PROMOTER, PlatformRole.SALES_PARTNER])(
    'grants own lead capture and management to %s',
    (role) => {
      expect(rolePermissions[role]).toEqual(
        expect.arrayContaining([
          PermissionCode.PROMOTER_LEADS_CREATE_OWN,
          PermissionCode.PROMOTER_LEADS_READ_OWN,
          PermissionCode.PROMOTER_LEADS_MANAGE_OWN,
        ]),
      );
    },
  );
});
