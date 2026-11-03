#!/usr/bin/env python3
"""
tools/tts/kokoro_release.py
Segmentador e adaptador de síntese Kokoro ONNX (pf_dora) para o Azure AI-200 Study Hub.
Desacoplado do pipeline de deploy do GitHub Pages para não bloquear atualizações rápidas de resumos.
"""
from __future__ import annotations

import argparse
import json
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

    full_script_parts = [p for p in [title, tldr, body_narration] if p]
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

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
