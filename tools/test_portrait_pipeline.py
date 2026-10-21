"""Run: python -m unittest discover -s tools -p 'test_portrait_pipeline.py'"""
import json
from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from portrait_pipeline import (build_previews, clip_to_mask, combo_id, config_load,
                               generate, load_part, part_path, publish)


class PortraitPipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.kitdir = self.root / "kit"
        self.kitdir.mkdir()
        (self.kitdir / "masks").mkdir()
        Image.new("RGBA", (1024, 1024), (190, 155, 135, 255)).save(self.kitdir / "template.png")
        self.rects = {
            "face": (320, 150, 705, 520),
            "hair_back": (300, 80, 730, 240),
            "hair_front": (320, 100, 700, 195),
            "body": (180, 500, 850, 970),
            "outfit": (190, 550, 840, 960),
        }
        self.masks = {}
        from PIL import ImageDraw
        for k, rect in self.rects.items():
            im = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
            ImageDraw.Draw(im).rectangle(rect, fill=(255, 255, 255, 255))
            im.save(self.kitdir / "masks" / f"{k}.png")
            self.masks[k] = im.getchannel("A")
        self.kit = {
            "schemaVersion": 1, "kitId": "adult-f-test", "template": "template.png",
            "size": [1024, 1024], "gender": "여성", "ageEstimate": {"min": 20, "max": 39},
            "masks": {k: "masks/" + k + ".png" for k in self.rects},
            "variants": {"face": {"f01": "round face"}, "hair": {"h01": "short hair"},
                         "body": {"b01": "normal physique"}, "outfit": {"o01": "a shirt"}},
        }
        self.cfg = self.kitdir / "config.json"
        self.cfg.write_text(json.dumps(self.kit, ensure_ascii=False))
        self.spec = config_load(self.cfg)
        self.build = self.root / "output" / self.spec["kitId"]
        (self.build / "parts").mkdir(parents=True)

    def create_parts(self):
        colors = {"face": (200, 155, 120, 255), "hair_back": (48, 34, 32, 255),
                  "hair_front": (48, 34, 32, 255), "body": (185, 140, 120, 255),
                  "outfit": (54, 100, 160, 255)}
        for kind, color in colors.items():
            variant = {"face": "f01", "hair_back": "h01", "hair_front": "h01", "body": "b01", "outfit": "o01"}[kind]
            body = "b01" if kind == "outfit" else None
            clipped = clip_to_mask(Image.new("RGBA", (1024, 1024), color), self.masks[kind])
            clipped.save(part_path(self.build, kind, variant, body))

    def test_generate_default_dry_run_creates_nothing(self):
        generate(self.cfg, self.spec, self.build, False, "gpt-image-2", False)
        self.assertFalse((self.build / "qa-report.json").exists())
        self.assertFalse((self.build / "parts" / "face_f01.png").exists())

    def test_composition_structural_qa_and_contact_sheet(self):
        self.create_parts()
        self.assertEqual(build_previews(self.cfg, self.spec, self.build, 5), 0)
        report = json.loads((self.build / "qa-report.json").read_text())
        self.assertEqual(len(report["generated"]), 1)
        self.assertEqual(len(report["checks"]), 5)
        self.assertTrue(report["visualApprovalRequired"])
        self.assertTrue((self.build / "contact-sheet.png").exists())
        self.assertEqual(report["generated"][0]["characterId"], "adult-f-test-f01")

    def test_missing_part_is_rejected(self):
        self.create_parts()
        part_path(self.build, "outfit", "o01", "b01").unlink()
        self.assertEqual(build_previews(self.cfg, self.spec, self.build, 5), 2)
        self.assertEqual(len(json.loads((self.build / "qa-report.json").read_text())["problems"]), 1)

    def test_alpha_bleed_rejected(self):
        self.create_parts()
        bad = part_path(self.build, "face", "f01")
        img = Image.open(bad)
        img.putpixel((0, 0), (50, 50, 50, 255))
        img.save(bad)
        with self.assertRaisesRegex(ValueError, "Alpha outside"):
            load_part(bad, (1024, 1024), self.masks["face"])

    def test_publish_rejects_unreviewed_and_adds_approved(self):
        self.create_parts()
        self.assertEqual(build_previews(self.cfg, self.spec, self.build, 5), 0)
        app_dir = self.root / "repo/src/assets/character-portraits"
        app_dir.mkdir(parents=True)
        (app_dir / "catalog.json").write_text(json.dumps({"schemaVersion": 1, "assets": []}))
        filename = combo_id(self.spec, "f01", "h01", "b01", "o01")
        approvals = self.root / "approved.json"
        approvals.write_text(json.dumps({"approved": ["invalid"]}))
        with self.assertRaisesRegex(ValueError, "Unknown"):
            publish(self.cfg, self.spec, self.build, approvals, self.root / "repo")
        approvals.write_text(json.dumps({"approved": [filename]}))
        publish(self.cfg, self.spec, self.build, approvals, self.root / "repo")
        manifest = json.loads((app_dir / "catalog.json").read_text())
        self.assertEqual(manifest["assets"][0]["characterId"], "adult-f-test-f01")
        self.assertEqual(manifest["assets"][0]["filename"], "characters/" + filename + ".webp")
        self.assertTrue((app_dir / (filename + ".webp")).exists())
        with self.assertRaisesRegex(ValueError, "overwrite"):
            publish(self.cfg, self.spec, self.build, approvals, self.root / "repo")


if __name__ == "__main__":
    unittest.main()
