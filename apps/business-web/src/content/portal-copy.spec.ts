import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { portalCopy } from './portal-copy';

describe('portal navigation copy', () => {
  it('uses unique keys and paths so active and route states stay unambiguous', () => {
    const keys = portalCopy.navItems.map((item) => item.key);
    const paths = portalCopy.navItems.map((item) => item.href);

    assert.equal(new Set(keys).size, keys.length);
    assert.equal(new Set(paths).size, paths.length);
  });

  it('assigns every navigation item to a visible group', () => {
    for (const item of portalCopy.navItems) {
      assert.ok(portalCopy.navigationGroups[item.group]);
    }
  });
});
