#!/usr/bin/env bash
# =============================================================================
# BRAND ASSET DERIVATIVES — RUN ONCE, COMMIT THE OUTPUT
# =============================================================================
# This is NOT part of the build. `node build.mjs` is zero-dependency and stays
# that way: it must never import an image library, so the derivatives below are
# produced here, by hand, and committed. This script exists so that work is
# reproducible and reviewable, not so it can run in CI.
#
#   Input   assets/logo.png   1000x1000 — the brand master, the only file a
#                             designer ever replaces
#   Output  assets/logo.webp        brand plate + voxel source
#           assets/logo-512.png     plate fallback; the portal's copy
#           assets/icon-{32,180,512}.png
#           assets/og-card.png      1200x630 social card
#
# Requires: node, and network access for npx and Google Fonts. Both tools are
# pinned; neither is installed into the repository, and there is still no
# package.json at the root.
#
#   ./scripts/build-assets.sh
#
# Then: node build.mjs && node --test 'tests/*.test.mjs' && git add assets/
#
# The five resizes are byte-for-byte reproducible. og-card.png is NOT: it comes
# out of a browser, and text rasterisation and gradient dithering vary slightly
# between runs, so a re-run rewrites the file with a visually identical one a
# few KB different. That is fine — this script is not a build step and
# `node build.mjs --check` does not compare asset bytes — but do not re-run it
# for no reason, and do not read a changed og-card.png in a diff as a change to
# the design. tests/assets.test.mjs pins what actually matters: 1200x630 and
# under 300 KB.
# -----------------------------------------------------------------------------
set -euo pipefail

SHARP="sharp-cli@5.1.0"
PLAYWRIGHT="playwright@1.56.1"

cd "$(dirname "$0")/.."
ROOT="$PWD"
SRC="assets/logo.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -f "$SRC" ] || { echo "missing $SRC — the brand master must be present to regenerate anything" >&2; exit 1; }

sharp() { npx --yes "$SHARP" "$@"; }

echo "==> brand plate"
# Full resolution, kept. The voxel forge in js/logo-forge.js uploads this file
# to the GPU whole and maps a tile of it onto each of 65,536 cubes, so the
# emblem's sharpness is a property of THIS file, not of the cube grid. Measured
# on a real Chromium at 1x and 2x DPR: downscaling to 512 costs 22% of the
# settled emblem's acutance and is visible on the sub-line and the shield
# bevel, while q95 WebP at full size keeps 95% of it for an eighth of the
# bytes. So the plate shrinks by re-encoding, not by resizing.
sharp --input "$SRC" --output "$TMP" --format webp --quality 95 --effort 6 resize 1000 1000
mv "$TMP/logo.webp" assets/logo.webp

# PNG at the largest size any <img> actually paints (hero 185px at 2x DPR).
# Nothing on the marketing site fetches it: it is the portal's copy, mirrored
# by app/scripts/sync-shared.mjs, and the fallback if the plate ever needs one.
sharp --input "$SRC" --output "$TMP" --format png --compressionLevel 9 --effort 6 resize 512 512
mv "$TMP/logo.png" assets/logo-512.png

echo "==> icons"
# Cropped to the shield alone. The master is a lockup — shield above a FUSED
# wordmark — and at 32px a wordmark is noise, so the icons carry the emblem
# only. Box measured from the master: the shield occupies x 315-683, y 135-565,
# and the wordmark starts at y 604, which is what caps the crop at 596.
CROP="extract 96 249 500 500"   # sharp-cli: top left width height
for size in 32 180 512; do
    # Palette-quantised: the crop is one photographed metal object on a flat
    # dark wall, so 128 entries carry the gold ramp without visible banding at
    # any size an icon is ever painted, and cut icon-512 from 161 KB to 46 KB.
    # shellcheck disable=SC2086
    sharp --input "$SRC" --output "$TMP" \
        --format png --palette --colours 128 --dither 1 --compressionLevel 9 --effort 6 \
        $CROP -- resize "$size" "$size"
    mv "$TMP/logo.png" "assets/icon-$size.png"
done

echo "==> social card"
# Composed, not cropped: emblem, wordmark and a line of positioning copy on the
# carbon/gold palette. Rendered from HTML because the card is typeset — see
# scripts/og-card.mjs, which reads every word of it from src/data/site.mjs.
node scripts/og-card.mjs > "$TMP/og-card.html"

# Google Fonts is fetched by the browser, so a proxied network needs telling.
# Unset on an ordinary machine, in which case these stay empty and Chromium
# goes direct. --ignore-https-errors is required only because a proxy of this
# kind re-signs TLS; it applies to this one local screenshot, nothing shipped.
PROXY_ARGS=()
if [ -n "${HTTPS_PROXY:-${https_proxy:-}}" ]; then
    PROXY_ARGS=(--proxy-server="${HTTPS_PROXY:-$https_proxy}" --ignore-https-errors)
fi

# Waits for the brand faces to be real (scripts/og-card.mjs sets the attribute
# only when both are in document.fonts) rather than for a hopeful timeout. If
# they never load this times out, set -e stops the run, and no card is written.
npx --yes "$PLAYWRIGHT" screenshot \
    --viewport-size=1200,630 \
    "${PROXY_ARGS[@]}" \
    --wait-for-selector='html[data-fonts="ready"]' \
    --timeout=45000 \
    "file://$TMP/og-card.html" "$TMP/og-card-raw.png"
# Palette-quantised: the card is flat gradients and one photograph, so 256
# colours is indistinguishable and keeps it far under the 300 KB that scrapers
# start refusing to fetch.
mkdir -p "$TMP/q"
sharp --input "$TMP/og-card-raw.png" --output "$TMP/q" --format png --palette
mv "$TMP/q/og-card-raw.png" assets/og-card.png

echo
echo "==> generated"
cd "$ROOT"
for f in assets/logo.webp assets/logo-512.png assets/icon-32.png assets/icon-180.png assets/icon-512.png assets/og-card.png; do
    printf '  %9d  %s\n' "$(wc -c < "$f")" "$f"
done
printf '  %9d  %s (master, not served)\n' "$(wc -c < "$SRC")" "$SRC"
