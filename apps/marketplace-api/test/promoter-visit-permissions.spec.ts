import { PlatformRole } from '@prisma/client';
import { PermissionCode, rolePermissions } from '../src/access/permission-codes';

describe('promoter visit permissions', () => {
  it.each([PlatformRole.PROMOTER, PlatformRole.SALES_PARTNER])(
    'allows %s to create and read only own visits',
    (role) => {
      expect(rolePermissions[role]).toEqual(
        expect.arrayContaining([
          PermissionCode.PROMOTER_VISITS_CREATE_OWN,
          PermissionCode.PROMOTER_VISITS_READ_OWN,
        ]),
      );
      expect(rolePermissions[role]).not.toContain(PermissionCode.PROMOTER_VISITS_READ_ANY);
    },
  );

  it('gives operations read-only any-scope access and no visit creation permission', () => {
    expect(rolePermissions[PlatformRole.OPERATIONS_MANAGER]).toContain(
      PermissionCode.PROMOTER_VISITS_READ_ANY,
    );
    expect(rolePermissions[PlatformRole.OPERATIONS_MANAGER]).not.toContain(
      PermissionCode.PROMOTER_VISITS_CREATE_OWN,
    );
  });

  it('does not expose promoter visits to delivery partners', () => {
    expect(rolePermissions[PlatformRole.DELIVERY_PARTNER]).not.toEqual(
      expect.arrayContaining([
        PermissionCode.PROMOTER_VISITS_CREATE_OWN,
        PermissionCode.PROMOTER_VISITS_READ_OWN,
        PermissionCode.PROMOTER_VISITS_READ_ANY,
      ]),
    );
  });
});
