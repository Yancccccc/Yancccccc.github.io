# Multi-View Spacecraft Surface Reconstruction — Project Page

Static academic project page with a synchronized, draggable Ground Truth/Ours PLY comparison.

## Replace the demo models

Copy aligned PLY files to:

- `static/models/gt.ply`
- `static/models/ours_1p5k.ply`
- `static/models/ours_30k.ply`

The two models must use the same coordinate system and scale. The viewer supports standard triangle-mesh and point-cloud PLY files. A 3D Gaussian Splatting PLY requires a specialized splat renderer and cannot be displayed correctly by the standard PLY viewer.

## Edit project information

Update the title, authors, links, abstract, metrics, and BibTeX directly in `index.html`. Place the final overall workflow image at `static/images/overview.png`.

## GitHub Pages

The site is served directly from the repository root. No build step is required.
