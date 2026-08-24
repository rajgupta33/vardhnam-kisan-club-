import { colors, typography } from '@vardhnam/design-tokens';
import type { CSSProperties } from 'react';

/**
 * Adapts the shared TypeScript design tokens to CSS custom properties once at
 * the document root. Portal styles consume these variables rather than
 * maintaining a second colour and typography source in globals.css.
 */
export const portalThemeStyle = {
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
} as CSSProperties;
