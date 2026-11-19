#!/usr/bin/env python3
"""Restore up-to-date MP3 and chapter assets from GitHub Releases (tts-<slug>).

Only articles with no release or whose release assets fail verify_entry
(for example because the article text changed) require Kokoro synthesis.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TTS_DIR = Path(__file__).resolve().parent
if str(TTS_DIR) not in sys.path:
    sys.path.insert(0, str(TTS_DIR))

from kokoro_release import DEFAULT_SPEED, DEFAULT_VOICE, selected_entries, verify_entry  # noqa: E402


def download_release_assets(slug: str, destination: Path, repo: str | None) -> bool:
    tag = f"tts-{slug}"
    cmd = ["gh", "release", "download", tag]
    if repo:
        cmd.extend(["--repo", repo])
    cmd.extend([
        "--pattern", f"{slug}.mp3",
        "--pattern", f"{slug}.chapters.json",
        "--dir", str(destination),
        "--clobber",
    ])
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return False
    return (destination / f"{slug}.mp3").is_file() and (destination / f"{slug}.chapters.json").is_file()


def clear_entry_dir(directory: Path, slug: str) -> None:
    for name in (f"{slug}.mp3", "chapters.json", f"{slug}.chapters.json"):
        path = directory / name
        if path.is_file():
            path.unlink()


def restore_entries(
    entries: list[dict],
    output_dir: Path,
    voice: str,
    speed: float,
    repo: str | None = None,
    downloader=download_release_assets,
) -> tuple[list[str], list[str]]:
    restored: list[str] = []
    pending: list[str] = []

    for entry in entries:
        slug = entry["slug"]
        entry_dir = output_dir / slug
        try:
            verify_entry(entry, output_dir, voice, speed)
            print(f"[CACHE] {slug}: cached audio matches current article", flush=True)
            restored.append(slug)
            continue
        except (ValueError, OSError, KeyError, subprocess.CalledProcessError):
            pass

        with tempfile.TemporaryDirectory(prefix=f"tts-release-{slug}-") as tmp:
            tmp_dir = Path(tmp)
            if not downloader(slug, tmp_dir, repo):
                print(f"[MISS] {slug}: no release tts-{slug} with mp3+chapters", flush=True)
                clear_entry_dir(entry_dir, slug)
                pending.append(slug)
                continue

            entry_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(tmp_dir / f"{slug}.mp3", entry_dir / f"{slug}.mp3")
            shutil.copy2(tmp_dir / f"{slug}.chapters.json", entry_dir / "chapters.json")

        try:
            verify_entry(entry, output_dir, voice, speed)
            print(f"[RELEASE] {slug}: restored current audio from tts-{slug}", flush=True)
            restored.append(slug)
        except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
            print(f"[STALE] {slug}: release tts-{slug} is outdated ({error})", flush=True)
            clear_entry_dir(entry_dir, slug)
            pending.append(slug)

    return restored, pending


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", default="dist/data/catalog.json")
    parser.add_argument("--slug", default="all")
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    parser.add_argument("--output-dir", default="tools/tts/output")
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--repo", default=os.environ.get("GH_REPO", ""))
    parser.add_argument("--github-output", default=os.environ.get("GITHUB_OUTPUT", ""))
    args = parser.parse_args(argv)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    entries = selected_entries(args)

    restored, pending = restore_entries(
        entries,
        output_dir,
        args.voice,
        float(args.speed),
        repo=args.repo or None,
    )
    needs_synthesis = "true" if pending else "false"
    print(
        f"Summary: {len(restored)} ready from cache/release, {len(pending)} need synthesis"
        + (f" ({', '.join(pending)})" if pending else ""),
        flush=True,
    )
    if args.github_output:
        with Path(args.github_output).open("a", encoding="utf-8") as fh:
            fh.write(f"needs_synthesis={needs_synthesis}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
