# Aerial preview asset provenance

## Release status: PUBLISHED WITH ACCEPTED RIGHTS RISK (decided 2026-10-19)

The aircraft's original redistribution rights are **unresolved**. The source
uploader declares CC BY 4.0, but also says the model was taken from DJI's
website. That leaves the original rights holder's redistribution permission
unresolved, and a downstream Creative Commons label does not cure that ambiguity.

On 2026-10-19 Sean was presented with this finding and the alternatives
(replace with a rights-cleared asset, or publish the page without the 3D scene)
and **chose to deploy as-is and accept the rights risk**. This section records
that decision rather than implying the ambiguity was resolved — it was not.

Good-faith obligations honoured under the declared licence: the uploader is
credited below, the declared licence is named and linked, modifications are
listed, and the live page links to this file from its final chapter.

Residual exposure, stated plainly: if the original rights holder does not permit
redistribution, hosting this GLB on fusedprotectiveservices.com is infringing
regardless of the uploader's label. Mitigation if challenged: remove
`assets/aerial/aircraft.glb`, which makes the page fall back to its static
poster and error state without breaking the site. A rights-cleared replacement
asset remains the correct long-term fix.

This scene is a fictional visualization. The model is not a representation of
Fused's actual fleet, a verified service specification, or a manufacturer endorsement.

## Aircraft

- Model: Mavic 3 Cine.
- Credited uploader: aurumjuda747, https://sketchfab.com/aurumjuda747.
- Original listing: https://sketchfab.com/3d-models/mavic-3-cine-60d4a042a6eb4a1e944b1af2d4e9368b.
- Declared licence: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
- Download mirror: https://sceneview.github.io/models/platforms/dji_mavic_3_v2.glb.
- Mirror manifest pinned at sceneview/sceneview commit `2f62e027386c1776808124048ba11db0ba848675`, assets/manifest.json.
- Download SHA-256: `bab7735cf0bc54f20e35314d6230a1be93da0f246e5cf9c199a18a54b00f3579` (verified against mirror manifest).
- Modifications: embedded image data externalized into aircraft-texture-* same-origin files, maintaining the mesh and PBR data. This avoids forbidden blob-image URLs under Fused's existing CSP. See source-record.json for resulting file identity.
- Model includes 127,011 triangles, two materials and 147 mesh primitives before runtime optimization. These are inspected asset counts, not performance results.

## Image-based lighting

- Asset: Venice Sunset, Greg Zaal / Poly Haven.
- Primary source: https://polyhaven.com/a/venice_sunset.
- Licence: CC0, https://polyhaven.com/license.
- Download: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr.
- Local filename: blue-hour.hdr.
- SHA-256: `92fe2b29b1957828fb8925a57633540bbba5bf380d9285ed553443e834249352`.
- No modifications to downloaded HDR. Lighting colour/exposure adjustments are runtime art direction, not a claim of the pictured property being in Venice.

## Code and procedural environment

- three.js: r160, MIT. Existing engine unchanged. Matching auxiliary loader modules and their exact source/local hashes are under js/vendor/aerial/provenance.json, with the upstream licence beside them.
- Property geometry and procedural materials: original synthetic scene authored for this preview; no actual client location or captured surveillance imagery.
- Fonts and Fused logo: existing project assets; no new third-party fonts or remote image calls.

No paid assets were purchased and no model-gallery authentication was bypassed.
