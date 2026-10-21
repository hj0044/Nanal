#!/usr/bin/env python3
"""Nanal semi-realistic layered portrait production CLI.

Requires Pillow. AI generation is opt-in (--execute); publishing requires human QA approval.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time
import urllib.error
import urllib.request
import uuid
from itertools import product

from PIL import Image, ImageChops, ImageDraw

KINDS = ("face", "hair", "body", "outfit")
MASKS = ("face", "hair_front", "hair_back", "body", "outfit")
STYLE = (
    "Semi-realistic 2D digital illustration for a contemporary Korean life simulation game. "
    "Neutral expression, same camera angle and fixed head/eye/neck/shoulder landmarks, "
    "consistent soft upper-left studio lighting, consistent paint texture, no text, "
    "no photo collage or perspective shift. Change ONLY the requested masked region; "
    "keep all unmasked anatomy and geometry identical to the reference."
)


def config_load(path: Path) -> dict:
    spec = json.loads(path.read_text(encoding="utf-8"))
    if spec.get("schemaVersion") != 1 or not isinstance(spec.get("kitId"), str):
        raise ValueError("schemaVersion must be 1 and kitId is required")
    if not spec["kitId"].replace("-", "").replace("_", "").isalnum():
        raise ValueError("kitId must contain only letters, digits, hyphen or underscore")
    if spec.get("size") != [1024, 1024]:
        raise ValueError("Image API production kit must use 1024x1024 size")
    for key in MASKS:
        if key not in spec.get("masks", {}):
            raise ValueError(f"missing mask: {key}")
    for kind in KINDS:
        group = spec.get("variants", {}).get(kind)
        if not isinstance(group, dict) or not group:
            raise ValueError(f"variants.{kind} must be a nonempty object")
        for variant_id, description in group.items():
            if not variant_id.replace("-", "").replace("_", "").isalnum() or not isinstance(description, str) or not description.strip():
                raise ValueError(f"invalid {kind} variant: {variant_id}")
    if spec.get("gender") not in ("남성", "여성"):
        raise ValueError("gender must match the current Nanal catalog")
    ages = spec.get("ageEstimate", {})
    if not (isinstance(ages.get("min"), int) and isinstance(ages.get("max"), int) and 0 <= ages["min"] <= ages["max"] <= 120):
        raise ValueError("invalid ageEstimate range")
    return spec


def kit_file(config_path: Path, rel: str) -> Path:
    root = config_path.parent.resolve()
    resolved = (root / rel).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError(f"Path escapes kit folder: {rel}")
    return resolved


def read_kit_images(config_path: Path, spec: dict) -> tuple[Image.Image, dict[str, Image.Image]]:
    template = Image.open(kit_file(config_path, spec["template"])).convert("RGBA")
    size = tuple(spec["size"])
    if template.size != size:
        raise ValueError("Template dimensions do not match kit size")
    masks = {}
    paths = dict(spec["masks"])
    for kind in ("body", "outfit"):
        for body_id, relative in spec.get(kind + "Masks", {}).items():
            if body_id not in spec["variants"]["body"]:
                raise ValueError(f"Unknown body ID for {kind}Masks: {body_id}")
            paths[f"{kind}:{body_id}"] = relative
    for key, relative in paths.items():
        src = Image.open(kit_file(config_path, relative))
        if src.mode not in ("RGBA", "LA") or src.size != size:
            raise ValueError(f"Mask {key} must be an {size} image with an alpha channel")
        masks[key] = src.getchannel("A")
        if masks[key].getbbox() is None:
            raise ValueError(f"Empty mask: {key}")
    return template, masks


def part_path(build: Path, kind: str, variant: str, body: str | None = None) -> Path:
    if kind == "outfit":
        if body is None:
            raise ValueError("outfit requires a body variant")
        return build / "parts" / f"outfit_{body}_{variant}.png"
    return build / "parts" / f"{kind}_{variant}.png"


def clip_to_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    src = image.convert("RGBA")
    if src.size != mask.size:
        raise ValueError("AI returned a nonconforming image size")
    src.putalpha(ImageChops.multiply(src.getchannel("A"), mask))
    return src


def composite(parts: list[Image.Image], size: tuple[int, int]) -> Image.Image:
    result = Image.new("RGBA", size)
    for layer in parts:
        result.alpha_composite(layer)
    return result


def load_part(path: Path, size: tuple[int, int], expected_mask: Image.Image) -> tuple[Image.Image, dict]:
    if not path.exists():
        raise FileNotFoundError(f"Missing part: {path}")
    with Image.open(path) as original:
        if original.mode != "RGBA" or original.size != size:
            raise ValueError(f"Part must be RGBA {size}: {path}")
        image = original.copy()
    alpha = image.getchannel("A")
    inside = ImageChops.multiply(alpha, expected_mask)
    outside = ImageChops.subtract(alpha, expected_mask)
    region = expected_mask.histogram()
    mask_area = sum(i * n for i, n in enumerate(region)) / 255
    density = sum(i * n for i, n in enumerate(inside.histogram())) / (255 * max(mask_area, 1))
    bleed = sum(outside.histogram()[1:])
    if density < 0.03:
        raise ValueError(f"Almost empty asset ({density:.1%} coverage): {path}")
    if bleed > 0:
        raise ValueError(f"Alpha outside declared mask: {path}")
    return image, {"path": str(path), "coverage": round(density, 3), "bleedPixels": bleed}


def api_edit(reference: Image.Image, edit_area: Image.Image, prompt: str, model: str) -> Image.Image:
    """Call the documented images/edits multipart endpoint with an inverted edit mask."""
    token = os.environ.get("OPENAI_API_KEY")
    if not token:
        raise RuntimeError("OPENAI_API_KEY is required for --execute")
    # API mask alpha=0 selects edit region; our part masks alpha>0 select region.
    api_mask = Image.new("RGBA", edit_area.size, (255, 255, 255, 255))
    api_mask.putalpha(ImageChops.invert(edit_area))
    def png_bytes(im):
        import io
        stream = io.BytesIO()
        im.save(stream, format="PNG")
        return stream.getvalue()
    boundary = "nanal-" + uuid.uuid4().hex
    chunks = []
    def field(name, value):
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    def binary(name, fname, content):
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{fname}"\r\nContent-Type: image/png\r\n\r\n'.encode() + content + b"\r\n")
    field("model", model)
    field("prompt", STYLE + "\n" + prompt)
    field("size", "1024x1024")
    field("output_format", "png")
    binary("image[]", "reference.png", png_bytes(reference))
    binary("mask", "edit-mask.png", png_bytes(api_mask))
    data = b"".join(chunks) + f"--{boundary}--\r\n".encode()
    request = urllib.request.Request("https://api.openai.com/v1/images/edits", data=data, headers={
        "Authorization": f"Bearer {token}", "Content-Type": f"multipart/form-data; boundary={boundary}"
    }, method="POST")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                parsed = json.loads(response.read())
            payload = parsed["data"][0]["b64_json"]
            import io
            return Image.open(io.BytesIO(base64.b64decode(payload))).convert("RGBA")
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise RuntimeError(f"Image edit request failed (HTTP {exc.code})") from None
            time.sleep(2 ** attempt)
    raise RuntimeError("Image edit request failed")


def generate(config_path: Path, spec: dict, build: Path, execute: bool, model: str, force: bool, max_requests: int = 12):
    template, masks = read_kit_images(config_path, spec)
    size = tuple(spec["size"])
    total = sum(len(spec["variants"][k]) for k in ("face", "hair", "body")) + len(spec["variants"]["body"]) * len(spec["variants"]["outfit"])
    print(f"AI image edit requests (before skips): {total}; estimated generated parts: {total + len(spec['variants']['hair'])}")
    if not execute:
        print("DRY RUN — no paid API calls, output files, or catalog changes")
        return
    if total > max_requests:
        raise ValueError(f"Batch contains {total} potential API calls, exceeds --max-requests={max_requests}")
    (build / "parts").mkdir(parents=True, exist_ok=True)
    for kind in ("face", "hair", "body"):
        for vid, prompt in spec["variants"][kind].items():
            keys = ("hair_front", "hair_back") if kind == "hair" else (kind,)
            outpaths = [part_path(build, key, vid) for key in keys]
            if not force and all(path.exists() for path in outpaths):
                continue
            mask = masks.get(f"body:{vid}", masks["body"]) if kind == "body" else masks[keys[0]]
            if kind == "hair":
                mask = ImageChops.lighter(masks["hair_front"], masks["hair_back"])
            result = api_edit(template, mask, f"{kind} variation {vid}: {prompt}", model)
            if result.size != size:
                raise ValueError("AI model output size mismatch")
            for key, dest in zip(keys, outpaths):
                clip_to_mask(result, masks.get(f"body:{vid}", masks["body"]) if key == "body" else masks[key]).save(dest)
                print(f"generated {dest}")
    # Clothing generation references the selected physique so fit is body-specific.
    for body_id in spec["variants"]["body"]:
        body_layer, _ = load_part(part_path(build, "body", body_id), size, masks.get(f"body:{body_id}", masks["body"]))
        body_reference = template.copy()
        body_reference.alpha_composite(body_layer)
        for outfit_id, prompt in spec["variants"]["outfit"].items():
            dest = part_path(build, "outfit", outfit_id, body_id)
            if dest.exists() and not force:
                continue
            outfit_mask = masks.get(f"outfit:{body_id}", masks["outfit"])
            result = api_edit(body_reference, outfit_mask, f"outfit variation {outfit_id}, compatible with body {body_id}: {prompt}", model)
            clip_to_mask(result, outfit_mask).save(dest)
            print(f"generated {dest}")


def combos(spec: dict):
    v = spec["variants"]
    return product(v["face"], v["hair"], v["body"], v["outfit"])


def combo_id(spec: dict, face: str, hair: str, body: str, outfit: str) -> str:
    return f"{spec['kitId']}-{face}-{hair}-{body}-{outfit}"


def build_previews(config_path: Path, spec: dict, build: Path, limit: int):
    _, masks = read_kit_images(config_path, spec)
    size = tuple(spec["size"])
    previews = build / "previews"
    previews.mkdir(parents=True, exist_ok=True)
    rows, problems, checks = [], [], {}
    for index, (face, hair, body, outfit) in enumerate(combos(spec)):
        if index >= limit:
            break
        uid = combo_id(spec, face, hair, body, outfit)
        try:
            order = [("hair_back", hair, None), ("body", body, None), ("outfit", outfit, body),
                     ("face", face, None), ("hair_front", hair, None)]
            images = []
            for kind, variant, body_id in order:
                path = part_path(build, kind, variant, body_id)
                mask = masks.get(f"{kind}:{body}", masks[kind]) if kind in ("body", "outfit") else masks[kind]
                image, check = load_part(path, size, mask)
                images.append(image)
                checks[str(path)] = check
            merged = composite(images, size)
            outfile = previews / f"{uid}.webp"
            merged.save(outfile, "WEBP", quality=90, method=4)
            rows.append({"id": uid, "face": face, "hair": hair, "body": body, "outfit": outfit,
                         "filename": outfile.name, "sha256": hashlib.sha256(outfile.read_bytes()).hexdigest(),
                         "characterId": f"{spec['kitId']}-{face}"})
        except (OSError, ValueError) as exc:
            problems.append({"id": uid, "error": str(exc)})
    contact = build / "contact-sheet.png"
    if rows:
        thumb = (192, 192)
        cols = min(5, len(rows))
        lines = (len(rows) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * thumb[0], lines * (thumb[1] + 28)), (236, 238, 241))
        draw = ImageDraw.Draw(sheet)
        for j, item in enumerate(rows):
            with Image.open(previews / item["filename"]) as sample:
                img = sample.convert("RGBA")
                img.thumbnail(thumb)
            x, y = (j % cols) * thumb[0], (j // cols) * (thumb[1] + 28)
            bg = Image.new("RGBA", thumb, "white")
            bg.alpha_composite(img, ((thumb[0] - img.width) // 2, (thumb[1] - img.height) // 2))
            sheet.paste(bg.convert("RGB"), (x, y))
            draw.text((x + 6, y + 196), item["id"][:28], fill="black")
        sheet.save(contact)
    report = {"schemaVersion": 1, "kitId": spec["kitId"], "generated": rows,
              "checks": list(checks.values()), "problems": problems, "visualApprovalRequired": True,
              "contactSheet": str(contact) if rows else None}
    (build / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Composed {len(rows)} portraits, {len(problems)} failures. QA: {build / 'qa-report.json'}")
    if problems:
        return 2
    return 0


def publish(config_path: Path, spec: dict, build: Path, approvals: Path, repo_root: Path):
    """Publish only visually approved, structurally passing profiles into existing atlas-free catalog."""
    report = json.loads((build / "qa-report.json").read_text(encoding="utf-8"))
    if report["kitId"] != spec["kitId"] or report["problems"]:
        raise ValueError("QA report is missing, mismatched or has errors")
    selected = json.loads(approvals.read_text(encoding="utf-8"))["approved"]
    if not isinstance(selected, list) or not selected or len(selected) != len(set(selected)):
        raise ValueError("Approval list must contain distinct IDs")
    by_id = {row["id"]: row for row in report["generated"]}
    if any(uid not in by_id for uid in selected):
        raise ValueError("Unknown/unverified portrait in approval list")
    if len({by_id[uid]["characterId"] for uid in selected}) != len(selected):
        raise ValueError("Current runtime supports only one active appearance per face identity")
    target_dir = repo_root / "src/assets/character-portraits"
    catalog_path = target_dir / "catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    existing_ids = {item["assetId"] for item in catalog["assets"]}
    if any(uid in existing_ids or (target_dir / (uid + ".webp")).exists() for uid in selected):
        raise ValueError("Cannot overwrite existing catalog assets")
    for uid in selected:
        row = by_id[uid]
        preview = build / "previews" / row["filename"]
        if hashlib.sha256(preview.read_bytes()).hexdigest() != row.get("sha256"):
            raise ValueError(f"Preview altered after QA: {uid}")
    for uid in selected:
        row = by_id[uid]
        shutil.copyfile(build / "previews" / row["filename"], target_dir / (uid + ".webp"))
        catalog["assets"].append({"assetId": uid, "characterId": row["characterId"],
            "gender": spec["gender"], "ageEstimate": spec["ageEstimate"],
            "hairId": row["hair"], "outfitId": row["outfit"], "bodyId": row["body"],
            "visualStyle": "semi-realistic-illustration", "filename": f"characters/{uid}.webp",
            "runtimeEligible": True, "sourceId": f"layer-kit:{spec['kitId']}"})
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Published {len(selected)} approved portraits to {catalog_path}")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("action", choices=("generate", "compose", "publish"))
    p.add_argument("--kit", type=Path, required=True, help="Kit JSON config")
    p.add_argument("--build-dir", type=Path, default=Path(".portrait-build"))
    p.add_argument("--limit", type=int, default=72)
    p.add_argument("--execute", action="store_true", help="Allow paid generation requests")
    p.add_argument("--force", action="store_true")
    p.add_argument("--max-requests", type=int, default=12, help="Paid generation safety cap")
    p.add_argument("--model", default="gpt-image-2")
    p.add_argument("--approvals", type=Path)
    p.add_argument("--repo-root", type=Path, default=Path("."))
    args = p.parse_args(argv)
    if args.limit < 1:
        p.error("--limit must be >= 1")
    spec = config_load(args.kit)
    build = args.build_dir / spec["kitId"]
    try:
        if args.action == "generate":
            generate(args.kit, spec, build, args.execute, args.model, args.force, args.max_requests)
        elif args.action == "compose":
            return build_previews(args.kit, spec, build, args.limit)
        elif args.action == "publish":
            if not args.approvals:
                p.error("publish requires --approvals")
            publish(args.kit, spec, build, args.approvals, args.repo_root)
    except (ValueError, FileNotFoundError, RuntimeError, OSError, KeyError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
