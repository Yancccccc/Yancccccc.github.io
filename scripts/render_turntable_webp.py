#!/usr/bin/env python3
"""Render synchronized rotating PLY previews without an OpenGL dependency.

The renderer uses dense vertex splatting with a z-buffer and normal-based
shading. It is designed for project-page previews: every GT/1.5k/30k mesh in
one scene shares the same center, PCA frame, scale, camera path, and timing.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from numba import njit
from PIL import Image


SCENES = {
    "ACRIMSAT": ("acrimsat", "gt_tsdf_gray.ply", "tsdf_fusion_1.5k.ply", "tsdf_fusion_30K.ply"),
    "DESD": ("desdyni", "gt_tsdf_gray.ply", "tsdf_fusion_1.5k.ply", "tsdf_fusion_30K.ply"),
    "HINODE": ("hinode", "gt_tsdf_gray.ply", "tsdf_fusion_1.5k.ply", "tsdf_fusion_30K.ply"),
    "SAC-C": ("sacc", "gt_tsdf_gray.ply", "tsdf_fusion_1.5k.ply", "tsdf_fusion_30K.ply"),
}


def read_ply_vertices(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    with path.open("rb") as handle:
        lines = []
        while True:
            line = handle.readline()
            if not line:
                raise ValueError(f"Invalid PLY header: {path}")
            lines.append(line.decode("ascii").strip())
            if line.strip() == b"end_header":
                break
        if "format binary_little_endian 1.0" not in lines:
            raise ValueError(f"Only binary little-endian PLY is supported: {path}")
        count = int(next(line.split()[-1] for line in lines if line.startswith("element vertex ")))
        vertex_lines = []
        in_vertices = False
        for line in lines:
            if line.startswith("element vertex "):
                in_vertices = True
                continue
            if in_vertices and line.startswith("element "):
                break
            if in_vertices and line.startswith("property "):
                vertex_lines.append(line)

        type_map = {"float": "<f4", "float32": "<f4", "double": "<f8", "uchar": "u1", "uint8": "u1"}
        fields = []
        for line in vertex_lines:
            _, kind, name = line.split()
            fields.append((name, type_map[kind]))
        data = np.fromfile(handle, dtype=np.dtype(fields), count=count)

    vertices = np.column_stack([data["x"], data["y"], data["z"]]).astype(np.float32)
    if all(name in data.dtype.names for name in ("nx", "ny", "nz")):
        normals = np.column_stack([data["nx"], data["ny"], data["nz"]]).astype(np.float32)
    else:
        normals = np.zeros_like(vertices)
        normals[:, 2] = 1.0
    if all(name in data.dtype.names for name in ("red", "green", "blue")):
        colors = np.column_stack([data["red"], data["green"], data["blue"]]).astype(np.uint8)
    else:
        colors = np.full((len(vertices), 3), 205, dtype=np.uint8)
    return vertices, normals, colors


@njit(cache=True)
def splat_points(xy: np.ndarray, depth: np.ndarray, colors: np.ndarray, size: int, radius: int) -> np.ndarray:
    zbuffer = np.full((size, size), -1.0e30, dtype=np.float32)
    image = np.full((size, size, 3), 255, dtype=np.uint8)
    for index in range(xy.shape[0]):
        x = int(xy[index, 0])
        y = int(xy[index, 1])
        z = depth[index]
        for dy in range(-radius, radius + 1):
            py = y + dy
            if py < 0 or py >= size:
                continue
            for dx in range(-radius, radius + 1):
                px = x + dx
                if px < 0 or px >= size:
                    continue
                if z > zbuffer[py, px]:
                    zbuffer[py, px] = z
                    image[py, px, 0] = colors[index, 0]
                    image[py, px, 1] = colors[index, 1]
                    image[py, px, 2] = colors[index, 2]
    return image


def canonical_frame(gt_vertices: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    center = np.median(gt_vertices, axis=0)
    sample = gt_vertices[:: max(1, len(gt_vertices) // 150_000)] - center
    covariance = np.cov(sample.T)
    values, vectors = np.linalg.eigh(covariance)
    order = np.argsort(values)[::-1]
    basis = vectors[:, order]
    if np.linalg.det(basis) < 0:
        basis[:, 2] *= -1
    return center.astype(np.float32), basis.astype(np.float32)


def robust_scale(meshes: list[np.ndarray], center: np.ndarray, basis: np.ndarray) -> float:
    transformed = []
    for vertices in meshes:
        sample = vertices[:: max(1, len(vertices) // 180_000)]
        transformed.append((sample - center) @ basis)
    cloud = np.concatenate(transformed, axis=0)
    radial = np.sqrt(cloud[:, 0] ** 2 + cloud[:, 1] ** 2 + cloud[:, 2] ** 2)
    return float(np.percentile(radial, 99.85) * 1.14)


def render_mesh(
    vertices: np.ndarray,
    normals: np.ndarray,
    colors: np.ndarray,
    center: np.ndarray,
    basis: np.ndarray,
    radius: float,
    frames: int,
    size: int,
) -> list[Image.Image]:
    vertices = (vertices - center) @ basis
    normals = normals @ basis
    normal_length = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = normals / np.maximum(normal_length, 1.0e-8)
    # Use one neutral material for GT, 1.5k, and 30k so that the comparison
    # reflects geometry rather than differences in vertex color.
    base = np.empty((len(vertices), 3), dtype=np.float32)
    base[:] = np.array([202.0, 204.0, 208.0], dtype=np.float32)

    margin = 0.90 * (size / 2.0) / radius
    light = np.array([0.35, 0.45, 0.82], dtype=np.float32)
    light /= np.linalg.norm(light)
    rendered = []
    for frame in range(frames):
        angle = 2.0 * math.pi * frame / frames
        cosine, sine = math.cos(angle), math.sin(angle)
        rotation = np.array([[cosine, 0.0, sine], [0.0, 1.0, 0.0], [-sine, 0.0, cosine]], dtype=np.float32)
        points = vertices @ rotation.T
        rotated_normals = normals @ rotation.T
        shade = 0.44 + 0.56 * np.clip(np.abs(rotated_normals @ light), 0.0, 1.0)
        shaded = np.clip(base * shade[:, None], 38.0, 244.0).astype(np.uint8)
        xy = np.empty((len(points), 2), dtype=np.float32)
        xy[:, 0] = points[:, 0] * margin + size / 2.0
        xy[:, 1] = size / 2.0 - points[:, 1] * margin
        image = splat_points(xy, points[:, 2], shaded, size, 1)
        rendered.append(Image.fromarray(image, mode="RGB"))
    return rendered


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mesh-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--frames", type=int, default=24)
    parser.add_argument("--size", type=int, default=480)
    parser.add_argument("--duration", type=int, default=180, help="Frame duration in milliseconds")
    parser.add_argument("--quality", type=int, default=82)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    for scene_dir, (slug, gt_name, fast_name, full_name) in SCENES.items():
        paths = [args.mesh_root / scene_dir / name for name in (gt_name, fast_name, full_name)]
        print(f"[SCENE] {scene_dir}")
        loaded = [read_ply_vertices(path) for path in paths]
        center, basis = canonical_frame(loaded[0][0])
        radius = robust_scale([item[0] for item in loaded], center, basis)
        for suffix, (vertices, normals, colors) in zip(("gt", "1p5k", "30k"), loaded):
            output = args.output / f"{slug}_{suffix}.webp"
            print(f"  [RENDER] {suffix}: vertices={len(vertices):,} -> {output.name}")
            images = render_mesh(vertices, normals, colors, center, basis, radius, args.frames, args.size)
            images[0].save(
                output,
                save_all=True,
                append_images=images[1:],
                duration=args.duration,
                loop=0,
                quality=args.quality,
                method=4,
            )


if __name__ == "__main__":
    main()
