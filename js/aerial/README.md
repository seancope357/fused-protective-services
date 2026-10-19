# Aerial scene lifecycle

Static world meshes are baked into eight material batches. Aircraft primitives are
baked with their complete world matrices before normalization, retaining original
materials, texture references, normals, tangents and UVs. The current asset yields
two meshes and retains all 127,011 triangles. Source geometries are disposed after
merging; shared materials and maps are disposed once when the scene is destroyed.
The depth-tested scan is one additional surface pass clipped in the fragment shader
to x [-19,20], z [-25,7]. It never changes the physical materials. One directional
shadow map remains. Browser draw statistics are still a controller acceptance gate.

`boot.mjs` accepts scroll and input synchronously, while camera/look-target and
sensor transitions converge using elapsed-time damping. RAF runs only for
hover/scan, unsettled camera movement or an unsettled sensor blend. QA setters
snap synchronously; reduced motion snaps without spatial travel. Pause freezes
the shared motion clock but explicit view transitions remain usable; reduced motion
uses a fixed sweep and immediate view changes. Hidden tabs cancel RAF; visibility
restoration starts a fresh timestamp without catching up hidden time. Context loss
stops rendering; Retry replaces the canvas and disposes the old scene. Pagehide
invalidates pending loads and disposes resources; BFCache restoration reloads.

Scroll selects the sensor chapter until an explicit view selection overrides it.
The scan uses a sinusoidal travelling front with a directional fading trail, fine
surface grid/contours, and parcel edge. These are illustrative surface markings.
Inspection exit clears yaw, pitch, pointer drag and parallax and redraws the current
scroll composition. Keyboard rotation applies only inside aerial controls/stage,
excluding editable fields. Portrait camera keys blend by aspect, leaving desktop
keys intact. Coarse-pointer devices and widths below 700 use DPR 1; others cap at 2.

With `?verify=1`, `window.__aerial.setProgress` and `setSensor` update pixels
synchronously. `stats()` includes `aircraftDraws`, `pixelRatio` and `lighting`.
Readiness waits for aircraft/images and the optional HDR attempt. Required aircraft
or texture failure is fatal. Optional HDR failure is explicitly reported as
`lighting: 'studio-fallback'`, not HDR success; its request-abort cause requires
controller network QA. The local HDR passes the vendored decoder in Node.

Validation: `node --test tests/*.test.mjs`, `node build.mjs --check`, and
`node build.mjs --aerial-preview --check`. Controller owns browser, shader, pixel,
performance and visual acceptance. No server or release operation is part of this
implementation slice. Controller-owned context files should incorporate this
handoff after acceptance.
