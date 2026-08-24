# Regenerates the golden files in test/golden/goldens on Linux.
#
# Goldens are raster images and the host font engine decides how glyphs are
# anti-aliased, so they only match on the platform that produced them. CI runs
# ubuntu-latest, so Linux is the one that counts -- see ../dart_test.yaml.
#
# The Flutter version must stay in step with .github/workflows/ci.yml.
#
# From apps/farmer-mobile:
#
#   docker build -t vardhnam-flutter-linux:3.44.9 -f tool/golden-linux.Dockerfile .
#   docker run --rm -v "$(git rev-parse --show-toplevel):/repo" \
#     -w /repo/apps/farmer-mobile vardhnam-flutter-linux:3.44.9 \
#     bash -c "flutter pub get && flutter gen-l10n && flutter test --update-goldens test/golden"
#
# The container rewrites .dart_tool with container paths, so run `flutter pub get`
# on the host afterwards before running tests locally again.
FROM debian:bookworm-slim

ARG FLUTTER_VERSION=3.44.9

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates git unzip xz-utils zip libglu1-mesa fonts-droid-fallback \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/flutter.tar.xz \
      "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz" \
    && tar -xf /tmp/flutter.tar.xz -C /opt \
    && rm /tmp/flutter.tar.xz

ENV PATH="/opt/flutter/bin:${PATH}"

RUN git config --global --add safe.directory /opt/flutter \
    && git config --global --add safe.directory '*' \
    && flutter --version
