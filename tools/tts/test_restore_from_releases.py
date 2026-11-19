import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

TTS_DIR = Path(__file__).resolve().parent
if str(TTS_DIR) not in sys.path:
    sys.path.insert(0, str(TTS_DIR))

import kokoro_release  # noqa: E402
import restore_from_releases  # noqa: E402


class RestoreFromReleasesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.entry = {
            "slug": "artigo-teste",
            "title": "Artigo Teste",
            "narrationText": "Primeira frase do artigo. Segunda frase do artigo.",
        }

    def _write_valid_assets(self, directory: Path, entry: dict, mp3_name: str, chapters_name: str) -> None:
        plan = kokoro_release.build_chapter_plan(entry, "pf_dora", 1.0)
        cursor = 0.0
        for chapter in plan["chapters"]:
            chapter["start"] = round(cursor, 2)
            chapter["end"] = round(cursor + 1.5, 2)
            cursor = chapter["end"] + 0.25
        plan["timing"] = "measured"
        plan["durationSeconds"] = round(cursor, 2)
        plan["sourceHash"] = kokoro_release.source_hash(entry, "pf_dora", 1.0)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / mp3_name).write_bytes(b"fake-mp3")
        (directory / chapters_name).write_text(json.dumps(plan), encoding="utf-8")

    def test_restores_current_release_without_synthesis(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)

            def fake_download(slug: str, dest: Path, _repo: str | None) -> bool:
                self._write_valid_assets(dest, self.entry, f"{slug}.mp3", f"{slug}.chapters.json")
                return True

            with mock.patch.object(kokoro_release, "audio_duration", return_value=3.5):
                restored, pending = restore_from_releases.restore_entries(
                    [self.entry], out_dir, "pf_dora", 1.0, downloader=fake_download
                )

            self.assertEqual(restored, ["artigo-teste"])
            self.assertEqual(pending, [])
            self.assertTrue((out_dir / "artigo-teste" / "artigo-teste.mp3").is_file())
            self.assertTrue((out_dir / "artigo-teste" / "chapters.json").is_file())

    def test_marks_missing_release_for_synthesis(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            restored, pending = restore_from_releases.restore_entries(
                [self.entry], out_dir, "pf_dora", 1.0, downloader=lambda *_args: False
            )
            self.assertEqual(restored, [])
            self.assertEqual(pending, ["artigo-teste"])

    def test_marks_outdated_release_when_article_text_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            old_entry = {**self.entry, "narrationText": "Texto antigo do artigo."}

            def fake_download(slug: str, dest: Path, _repo: str | None) -> bool:
                self._write_valid_assets(dest, old_entry, f"{slug}.mp3", f"{slug}.chapters.json")
                return True

            with mock.patch.object(kokoro_release, "audio_duration", return_value=2.0):
                restored, pending = restore_from_releases.restore_entries(
                    [self.entry], out_dir, "pf_dora", 1.0, downloader=fake_download
                )

            self.assertEqual(restored, [])
            self.assertEqual(pending, ["artigo-teste"])
            self.assertFalse((out_dir / "artigo-teste" / "artigo-teste.mp3").exists())
            self.assertFalse((out_dir / "artigo-teste" / "chapters.json").exists())


if __name__ == "__main__":
    unittest.main()
