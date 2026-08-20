import 'package:flutter/material.dart';

class FarmerListLoadingState extends StatelessWidget {
  const FarmerListLoadingState({
    required this.label,
    super.key,
    this.itemCount = 3,
  });

  final String label;
  final int itemCount;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    liveRegion: true,
    label: label,
    child: ExcludeSemantics(
      child: Column(
        children: [
          const LinearProgressIndicator(),
          const SizedBox(height: 16),
          for (var index = 0; index < itemCount; index++) ...[
            const _SkeletonCard(lineCount: 2),
            if (index < itemCount - 1) const SizedBox(height: 12),
          ],
        ],
      ),
    ),
  );
}

class FarmerDetailLoadingState extends StatelessWidget {
  const FarmerDetailLoadingState({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Semantics(
      container: true,
      liveRegion: true,
      label: label,
      child: const ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LinearProgressIndicator(),
            SizedBox(height: 20),
            _SkeletonLine(widthFactor: 0.62, height: 26),
            SizedBox(height: 12),
            _SkeletonLine(widthFactor: 0.38),
            SizedBox(height: 20),
            _SkeletonCard(lineCount: 4),
            SizedBox(height: 14),
            _SkeletonCard(lineCount: 3),
          ],
        ),
      ),
    ),
  );
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.lineCount});

  final int lineCount;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var index = 0; index < lineCount; index++) ...[
            _SkeletonLine(widthFactor: index == 0 ? 0.7 : 0.92),
            if (index < lineCount - 1) const SizedBox(height: 10),
          ],
        ],
      ),
    ),
  );
}

class _SkeletonLine extends StatelessWidget {
  const _SkeletonLine({required this.widthFactor, this.height = 16});

  final double widthFactor;
  final double height;

  @override
  Widget build(BuildContext context) => FractionallySizedBox(
    widthFactor: widthFactor,
    alignment: Alignment.centerLeft,
    child: Container(
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
    ),
  );
}
