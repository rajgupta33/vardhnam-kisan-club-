import 'package:flutter/material.dart';

import 'vardhnam_colors.dart';
import 'vardhnam_radius.dart';
import 'vardhnam_typography.dart';

abstract final class VardhnamTheme {
  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: VardhnamColors.primaryGreenDark,
      brightness: Brightness.light,
      primary: VardhnamColors.primaryGreenDark,
      secondary: VardhnamColors.saffron,
      surface: VardhnamColors.surface,
      error: VardhnamColors.error,
    );
    final base = ThemeData(colorScheme: scheme, useMaterial3: true);
    final textTheme = VardhnamTypography.textTheme(base.textTheme);

    return base.copyWith(
      scaffoldBackgroundColor: VardhnamColors.background,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: VardhnamColors.background,
        foregroundColor: VardhnamColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 1,
        surfaceTintColor: VardhnamColors.surface,
        titleTextStyle: textTheme.titleLarge,
      ),
      cardTheme: CardThemeData(
        color: VardhnamColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(VardhnamRadius.card),
          side: const BorderSide(color: VardhnamColors.border),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(VardhnamRadius.button),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 52),
          side: const BorderSide(color: VardhnamColors.primaryGreen),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(VardhnamRadius.button),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: VardhnamColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(VardhnamRadius.button),
          borderSide: const BorderSide(color: VardhnamColors.border),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: VardhnamColors.surface,
        indicatorColor: VardhnamColors.surfaceGreen,
        elevation: 2,
        labelTextStyle: WidgetStatePropertyAll(
          textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      dividerColor: VardhnamColors.border,
    );
  }
}
