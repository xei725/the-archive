# Archive Hall design spec

## Surface

- Native concept size: 1680 x 945 (16:9), full viewport.
- One immersive room scene with code-native labels and controls.
- Primary paths: Library (live), Studio, Gallery, Journal (reserved).

## Visual system

- Palette: tungsten amber, aged walnut, fluorescent olive, window cyan, soft off-white text.
- Typography: narrow system sans/monospace for interface copy; no decorative display face.
- Container model: full-bleed scene with open overlay labels; no cards or panels.
- Motion: doorway hover illumination and a short camera push-in on activation.
- Texture: restrained film grain and vignette; no color wash over the generated room asset.

## Responsive behavior

- Desktop/tablet landscape: labels align with the four architectural openings.
- Portrait/narrow screens: the central room remains visible while a compact code-native room list replaces spatial hotspots.

## Allowed visible copy

- THE ARCHIVE
- LIBRARY
- STUDIO
- GALLERY
- JOURNAL
- LOCAL TIME
- WEATHER
- SOUND ON / SOUND OFF
- OPEN / IN PREPARATION
- NOT CONNECTED / SYNCING

## Environment contract

- Clock uses the visitor's real local time and date.
- Weather never fabricates a condition. Until a real provider is supplied, it reports NOT CONNECTED.
- A future provider returns `{ condition, temperature, location }`; the view maps the condition to CSS data attributes.
