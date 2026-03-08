# Convert Worker Notes

## SVG Sanitization and Rendering

The worker accepts SVG inputs and sanitizes them before rasterization/conversion.

Security rules implemented in `index.ts` (`sanitizeSvg`):

- Strip `<!DOCTYPE ...>` declarations (including internal subsets) instead of rejecting the file.
- Strip all `<!ENTITY ...>` declarations and custom named entity references.
- Remove `<?xml-stylesheet ...?>` processing instructions.
- Remove `<script>` blocks, inline event handler attributes (`on*`), and `<foreignObject>` blocks.
- Remove unsafe external resource attributes (`href`, `xlink:href`, `src`) unless they are:
  - same-document fragment refs (`#id`)
  - data URIs for allowed raster image MIME types (`data:image/png`, `jpeg`, `webp`, etc.)
- Remove unsafe CSS imports/references:
  - strip `@import`
  - sanitize `url(...)` values using the same reference rules

Deterministic rendering defaults:

- SVG render density: `192` DPI equivalent (`sharp` density).
- If SVG root omits `width`/`height`, dimensions are inferred from `viewBox`.
- If `viewBox` is missing or invalid, fallback dimensions are `1024x1024`.
- Transparency is preserved for alpha-capable outputs (PNG/WebP/AVIF/TIFF/GIF), while JPG is flattened to white in the JPG encoder path.
- `SVG -> PDF` currently uses a sanitized-raster path (SVG -> PNG -> PDF) for deterministic Linux rendering.

## PAGES Canonical PDF Fallback

The PAGES pipeline (`pages_to_pdf.py`) now uses layered fallback logic:

1. Extract embedded preview PDF (`QuickLook/Preview.pdf` or equivalent).
2. If preview PDF is missing, extract QuickLook/preview images and assemble a visual PDF.
3. If neither exists, fail with a clear user-safe error and remediation hint.

This allows downstream PAGES conversions to continue via canonical PDF even when embedded preview PDFs are absent.

Output metadata includes:

- `converter`: `pages_quicklook_preview` or `pages_quicklook_images`
- `source_entry` and `source_entries`
- `visual_fallback`: `true` when image-based fallback was used
