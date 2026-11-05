#!/usr/bin/env python3
"""
tools/tts/kokoro_release.py
Segmentador e adaptador de síntese Kokoro ONNX (pf_dora) para o Azure AI-200 Study Hub.
Gera e verifica o áudio exigido pelo deploy do GitHub Pages.
"""
from __future__ import annotations

import argparse
import json
import hashlib
import math
import subprocess
import wave
import re
from pathlib import Path
from typing import Any

DEFAULT_VOICE = "pf_dora"
DEFAULT_SPEED = 1.0
MAX_CHARS_PER_SEGMENT = 300


def normalize_narration_text(text: str) -> str:
    """Limpa marcações residuais e normaliza espaços para síntese de voz natural."""
    if not text or not isinstance(text, str):
        return ""
    cleaned = re.sub(r"==([^=\r\n]+)==", r"\1", text)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def split_into_sentences(text: str, max_chars: int = MAX_CHARS_PER_SEGMENT) -> list[str]:
    """Divide o roteiro de fala em sentenças respeitando limites fonéticos do Kokoro."""
    cleaned = normalize_narration_text(text)
    if not cleaned:
        return []

    raw_sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]
    segments: list[str] = []

    for sentence in raw_sentences:
        if len(sentence) <= max_chars:
            segments.append(sentence)
            continue

        words = sentence.split(" ")
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip() if current else word
            if len(candidate) <= max_chars:
                current = candidate
            else:
                if current:
                    segments.append(current)
                current = word
        if current:
            segments.append(current)

    return segments


def build_chapter_plan(entry: dict[str, Any], voice: str = DEFAULT_VOICE, speed: float = DEFAULT_SPEED) -> dict[str, Any]:
    """Gera o plano de capítulos de sentenças (schema version 2) para sincronização no player."""
    slug = entry.get("slug") or entry.get("id") or "unknown"
    title = entry.get("title") or slug
    tldr = entry.get("tldr") or ""
    body_narration = entry.get("narrationText") or ""

    # The compiled body already contains its heading; do not repeat it.
    full_script_parts = [body_narration] if body_narration else [p for p in [title, tldr] if p]
    full_script = ". ".join(full_script_parts)
    sentences = split_into_sentences(full_script)

    chapters = []
    estimated_cursor = 0.0
    for idx, sentence in enumerate(sentences):
        # Estimativa base (~14 caracteres/segundo em 1.0x) até síntese WAV real
        duration = round(max(1.2, len(sentence) / (14.0 * max(0.5, speed))), 2)
        chapters.append(
            {
                "index": idx,
                "block_index": 0 if idx < 2 else idx - 1,
                "sentence_index": idx,
                "text": sentence,
                "start": round(estimated_cursor, 2),
                "end": round(estimated_cursor + duration, 2),
            }
        )
        estimated_cursor += duration + 0.38

    return {
        "version": 2,
        "slug": slug,
        "title": title,
        "voice": voice,
        "speed": speed,
        "totalEstimatedSeconds": round(estimated_cursor, 2),
        "chapters": chapters,
    }


def cmd_prepare(args: argparse.Namespace) -> int:
    catalog_path = Path(args.catalog)
    if not catalog_path.exists():
        raise SystemExit(f"Catalog file not found: {catalog_path}")

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    output_root = Path(args.output_dir)
    output_root.mkdir(parents=True, exist_ok=True)

    selected = [
        item
        for item in catalog
        if args.slug == "all" or item.get("slug") == args.slug or item.get("id") == args.slug
    ]
    if not selected:
        raise SystemExit(f"No concept found matching slug '{args.slug}'")

    for item in selected:
        slug = item.get("slug") or item.get("id")
        item_dir = output_root / slug
        item_dir.mkdir(parents=True, exist_ok=True)

        plan = build_chapter_plan(item, voice=args.voice, speed=float(args.speed))
        chapters_path = item_dir / "chapters.json"
        chapters_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

        script_path = item_dir / "narration.txt"
        script_path.write_text("\n".join(ch["text"] for ch in plan["chapters"]), encoding="utf-8")
        print(f"Prepared {len(plan['chapters'])} sentence chapters for '{slug}' -> {chapters_path}")

    return 0


def selected_entries(args: argparse.Namespace) -> list[dict[str, Any]]:
    catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    selected = [e for e in catalog if args.slug == "all" or e.get("slug") == args.slug]
    if not selected:
        raise ValueError(f"No article found matching {args.slug!r}")
    for entry in selected:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", entry.get("slug", "")):
            raise ValueError("Invalid article slug")
        if not normalize_narration_text(entry.get("narrationText", "")):
            raise ValueError(f"Empty narration: {entry['slug']}")
    count, index = args.shard_count, args.shard_index
    if count < 1 or not 0 <= index < count:
        raise ValueError("Invalid shard index/count")
    return selected[index::count]


def source_hash(entry: dict[str, Any], voice: str, speed: float) -> str:
    payload = json.dumps([entry["slug"], entry.get("narrationText"), voice, speed,
                          "kokoro-v1.0/model-files-v1.1/0.6.1", "pt-br", 1], ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def audio_duration(path: Path) -> float:
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                            check=True, capture_output=True, text=True)
    duration = float(result.stdout.strip())
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError(f"Invalid audio duration: {path}")
    return duration


def verify_entry(entry: dict[str, Any], root: Path, voice: str, speed: float) -> dict[str, Any]:
    slug = entry["slug"]
    directory = root / slug
    mp3 = directory / f"{slug}.mp3"
    if not mp3.is_file() or mp3.stat().st_size == 0:
        raise ValueError(f"Missing synthesized audio: {slug}")
    plan = json.loads((directory / "chapters.json").read_text(encoding="utf-8"))
    if plan.get("timing") != "measured" or plan.get("sourceHash") != source_hash(entry, voice, speed):
        raise ValueError(f"Stale or estimated audio: {slug}")
    duration = audio_duration(mp3)
    chapters = plan.get("chapters", [])
    expected = build_chapter_plan(entry, voice, speed)["chapters"]
    if [c["text"] for c in chapters] != [c["text"] for c in expected]:
        raise ValueError(f"Incomplete narration: {slug}")
    previous = 0.0
    for chapter in chapters:
        if not previous <= chapter["start"] < chapter["end"] <= duration + 0.1:
            raise ValueError(f"Invalid chapter times: {slug}")
        previous = chapter["end"]
    if not chapters or abs(duration - plan["durationSeconds"]) > 0.2:
        raise ValueError(f"Invalid total duration: {slug}")
    return {"audioUrl": f"audio/{slug}/{slug}.mp3",
            "chaptersUrl": f"audio/{slug}/chapters.json", "durationSeconds": duration,
            "sourceHash": plan["sourceHash"], "voice": voice}


def cmd_verify(args: argparse.Namespace) -> int:
    entries = selected_entries(args)
    manifest = {e["slug"]: verify_entry(e, Path(args.output_dir), args.voice, float(args.speed)) for e in entries}
    (Path(args.output_dir) / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Verified complete audio for {len(manifest)} articles", flush=True)
    return 0


def cmd_synthesize(args: argparse.Namespace) -> int:
    # Heavy dependencies are only needed for synthesis, not planning/verification.
    import numpy as np
    from kokoro_onnx import Kokoro

    speed = float(args.speed)
    if not math.isfinite(speed) or not 0.5 <= speed <= 2:
        raise ValueError("Speed must be between 0.5 and 2")
    root = Path(args.output_dir)
    root.mkdir(parents=True, exist_ok=True)
    entries = selected_entries(args)
    engine = None
    for entry in entries:
        slug = entry["slug"]
        try:
            verify_entry(entry, root, args.voice, speed)
            print(f"Reusing verified audio: {slug}", flush=True)
            continue
        except (ValueError, OSError, KeyError, subprocess.CalledProcessError):
            pass
        if engine is None:
            engine = Kokoro(args.model, args.voices)
        directory = root / slug
        directory.mkdir(parents=True, exist_ok=True)
        plan = build_chapter_plan(entry, args.voice, speed)
        wav_path = directory / "narration.wav"
        sample_count = 0
        sample_rate = None
        with wave.open(str(wav_path), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            for chapter in plan["chapters"]:
                samples, rate = engine.create(chapter["text"], voice=args.voice, speed=speed, lang="pt-br")
                if sample_rate is None:
                    sample_rate = rate
                    output.setframerate(rate)
                if rate != sample_rate or len(samples) == 0 or not np.isfinite(samples).all():
                    raise ValueError(f"Invalid samples: {slug}")
                chapter["start"] = round(sample_count / rate, 4)
                pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
                output.writeframes(pcm.tobytes())
                sample_count += len(samples)
                chapter["end"] = round(sample_count / rate, 4)
                silence = int(rate * 0.25)
                output.writeframes(b"\0\0" * silence)
                sample_count += silence
        temporary_mp3 = directory / "narration.tmp.mp3"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(wav_path),
                        "-codec:a", "libmp3lame", "-b:a", "96k", str(temporary_mp3)], check=True)
        duration = audio_duration(temporary_mp3)
        temporary_mp3.replace(directory / f"{slug}.mp3")
        wav_path.unlink()
        plan.pop("totalEstimatedSeconds", None)
        plan.update(timing="measured", durationSeconds=duration,
                    sourceHash=source_hash(entry, args.voice, speed), language="pt-BR")
        (directory / "chapters.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        (directory / "narration.txt").write_text("\n".join(c["text"] for c in plan["chapters"]), encoding="utf-8")
        verify_entry(entry, root, args.voice, speed)
        print(f"Synthesized {slug}: {duration:.1f}s", flush=True)
    return cmd_verify(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Kokoro ONNX (pf_dora) narration tool for Azure AI-200")
    sub = parser.add_subparsers(dest="command", required=True)

    prep = sub.add_parser("prepare", help="Prepare sentence chapters and narration script from catalog.json")
    prep.add_argument("--catalog", default="dist/data/catalog.json", help="Path to compiled catalog.json")
    prep.add_argument("--slug", default="all", help="Concept slug or 'all'")
    prep.add_argument("--voice", default=DEFAULT_VOICE, help="Kokoro voice ID (default: pf_dora)")
    prep.add_argument("--speed", default=str(DEFAULT_SPEED), help="Playback/synthesis speed")
    prep.add_argument("--output-dir", default="tools/tts/output", help="Output directory for narration artifacts")
    prep.set_defaults(func=cmd_prepare)

    for name, function in [("synthesize", cmd_synthesize), ("verify", cmd_verify)]:
        command = sub.add_parser(name)
        command.add_argument("--catalog", default="dist/data/catalog.json")
        command.add_argument("--slug", default="all")
        command.add_argument("--voice", default=DEFAULT_VOICE)
        command.add_argument("--speed", type=float, default=DEFAULT_SPEED)
        command.add_argument("--output-dir", default="tools/tts/output")
        command.add_argument("--shard-index", type=int, default=0)
        command.add_argument("--shard-count", type=int, default=1)
        if name == "synthesize":
            command.add_argument("--model", required=True)
            command.add_argument("--voices", required=True)
        command.set_defaults(func=function)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
