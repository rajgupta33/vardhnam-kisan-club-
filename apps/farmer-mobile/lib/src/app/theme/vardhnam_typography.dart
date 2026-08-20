import 'package:flutter/material.dart';

import 'vardhnam_colors.dart';

abstract final class VardhnamTypography {
  static TextTheme textTheme(TextTheme base) => base.copyWith(
    headlineLarge: base.headlineLarge?.copyWith(
      fontSize: 30,
      fontWeight: FontWeight.w700,
      color: VardhnamColors.textPrimary,
    ),
    headlineMedium: base.headlineMedium?.copyWith(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: VardhnamColors.textPrimary,
    ),
    headlineSmall: base.headlineSmall?.copyWith(
      fontSize: 22,
      fontWeight: FontWeight.w700,
      color: VardhnamColors.textPrimary,
    ),
    titleLarge: base.titleLarge?.copyWith(
      fontSize: 20,
      fontWeight: FontWeight.w700,
      color: VardhnamColors.textPrimary,
    ),
    titleMedium: base.titleMedium?.copyWith(
      fontSize: 17,
      fontWeight: FontWeight.w600,
      color: VardhnamColors.textPrimary,
    ),
    bodyLarge: base.bodyLarge?.copyWith(
      fontSize: 16,
      height: 1.45,
      color: VardhnamColors.textPrimary,
    ),
    bodyMedium: base.bodyMedium?.copyWith(
      fontSize: 15,
      height: 1.4,
      color: VardhnamColors.textPrimary,
    ),
    bodySmall: base.bodySmall?.copyWith(
      fontSize: 13,
      height: 1.35,
      color: VardhnamColors.textSecondary,
    ),
    labelLarge: base.labelLarge?.copyWith(
      fontSize: 15,
      fontWeight: FontWeight.w600,
    ),
  );
}
