# woshahua wordmark

- `woshahua-wordmark.svg`: smooth vector artwork with a transparent background.
- `woshahua-wordmark-dot.svg`: pixel vector artwork on a 120 × 47 grid.
- `woshahua-wordmark.preview.png`: preview of the smooth artwork.
- `woshahua-wordmark-dot.preview.png`: preview of the pixel artwork.

The lettering uses outlined Z003 Medium Italic glyphs. Both SVG files contain vector paths, with no external fonts, scripts, or raster images.

Visual reference: [Candy splash logo](https://github.com/Ce-daros/Candy/blob/6325e495fca385ea73337e85f14951ff990c6f4d/packages/coding-agent/assets/candy-v3.png). The pink script lettering, blue shadow, and star motif informed this new wordmark.

The ring has been removed. The pixel version uses a coarse grid and a reduced color palette.

The Pi splash uses the pixel SVG. Run `node scripts/generate-splash-sprite.mjs` from the repository root to rebuild the terminal sprite. The generator removes transparent margins and keeps the original pixels and colors. The header has no outer frame.
