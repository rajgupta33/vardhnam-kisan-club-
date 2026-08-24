import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { colors, typography } from '@vardhnam/design-tokens';
import { portalThemeStyle } from './portal-theme';

describe('portal theme', () => {
  it('maps shared design tokens to the CSS properties used by the portal', () => {
    assert.deepEqual(portalThemeStyle, {
      '--field-green': colors.fieldGreen,
      '--soil': colors.soilBrown,
      '--harvest': colors.harvestGold,
      '--sky': colors.skyBlue,
      '--ink': colors.ink,
      '--muted': colors.muted,
      '--line': colors.line,
      '--surface': colors.surface,
      '--background': colors.background,
      '--danger': colors.danger,
      '--warning': colors.warning,
      '--success': colors.success,
      '--focus': colors.focus,
      '--font-family': typography.fontFamily,
    });
  });
});
