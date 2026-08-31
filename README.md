# Multi-View Spacecraft Surface Reconstruction — Project Page

Static academic project page with four synchronized Ground Truth/Ours turntable comparisons in one row, following the PAHC-3DGS visual-comparison style.

## Add the visual-comparison assets

Render each Mesh with the same camera path, crop, background, resolution, frame count, and rotation direction, then save animated WebP files as:

- `static/video/acrimsat_{gt,1p5k,30k}.webp`
- `static/video/desdyni_{gt,1p5k,30k}.webp`
- `static/video/hinode_{gt,1p5k,30k}.webp`
- `static/video/sacc_{gt,1p5k,30k}.webp`

The comparison slider reveals Ground Truth on the left and either the 1.5k or 30k result on the right.

## Edit project information

Update the title, authors, links, abstract, metrics, and BibTeX directly in `index.html`. Place the final overall workflow image at `static/images/overview.png`.

## GitHub Pages

The site is served directly from the repository root. No build step is required.
