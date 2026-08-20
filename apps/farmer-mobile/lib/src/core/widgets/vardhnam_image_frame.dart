import 'package:flutter/material.dart';

import '../../app/theme/vardhnam_colors.dart';
import '../../app/theme/vardhnam_radius.dart';

class VardhnamImageFrame extends StatelessWidget {
  const VardhnamImageFrame({
    required this.aspectRatio,
    required this.semanticLabel,
    super.key,
    this.imageUrl,
    this.assetPath,
    this.fit = BoxFit.cover,
    this.borderRadius = const BorderRadius.all(
      Radius.circular(VardhnamRadius.card),
    ),
    this.placeholder,
  });

  final double aspectRatio;
  final String semanticLabel;
  final String? imageUrl;
  final String? assetPath;
  final BoxFit fit;
  final BorderRadius borderRadius;
  final Widget? placeholder;

  @override
  Widget build(BuildContext context) {
    final fallback = ColoredBox(
      color: VardhnamColors.surfaceGreen,
      child: Center(
        child:
            placeholder ??
            const Icon(
              Icons.landscape_outlined,
              size: 42,
              color: VardhnamColors.leafGreen,
            ),
      ),
    );
    final asset = assetPath?.trim();
    final network = imageUrl?.trim();
    final image = asset != null && asset.isNotEmpty
        ? Image.asset(
            asset,
            fit: fit,
            errorBuilder: (context, error, stackTrace) => fallback,
          )
        : network != null && network.isNotEmpty
        ? Image.network(
            network,
            fit: fit,
            frameBuilder: (context, child, frame, wasSynchronouslyLoaded) =>
                wasSynchronouslyLoaded || frame != null ? child : fallback,
            errorBuilder: (context, error, stackTrace) => fallback,
          )
        : fallback;

    return Semantics(
      image: true,
      label: semanticLabel,
      child: ExcludeSemantics(
        child: AspectRatio(
          aspectRatio: aspectRatio,
          child: ClipRRect(borderRadius: borderRadius, child: image),
        ),
      ),
    );
  }
}
