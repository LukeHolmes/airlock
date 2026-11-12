#!/usr/bin/env python3
"""Assert sandbox triage JSON against fixtures/m6-trick-kit/manifest.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path


def rule_names(doc: dict) -> set[str]:
    return {h.get("rule", "") for h in doc.get("yara", []) if isinstance(h, dict)}


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def exif_count(doc: dict) -> int:
    exif = doc.get("exiftool")
    if not exif:
        return 0
    if isinstance(exif, list) and exif and isinstance(exif[0], dict):
        return len(exif[0])
    if isinstance(exif, dict):
        return len(exif)
    return 0


def magic_matches(doc: dict) -> bool:
    if "magic_matches_extension" in doc:
        return bool(doc["magic_matches_extension"])
    mime = (doc.get("detectedMime") or doc.get("detected_mime") or "").lower()
    ext = (doc.get("declaredExtension") or doc.get("declared_extension") or "").lower()
    if ext in (".txt", ".log") and "pdf" in mime:
        return False
    if ext in (".jpg", ".jpeg") and mime.startswith("image/"):
        return True
    if ext == ".pdf" and "pdf" in mime:
        return True
    return ext != ""


def check_expect(fixture: str, doc: dict, expect: dict) -> list[str]:
    errors: list[str] = []
    rules = rule_names(doc)
    xray = doc.get("xray") or {}

    if "yara_rules_any" in expect:
        wanted = set(expect["yara_rules_any"])
        if not (rules & wanted):
            errors.append(f"{fixture}: expected YARA rule in {wanted}, got {rules}")

    if "yara_rules_exclude" in expect:
        bad = set(expect["yara_rules_exclude"]) & rules
        if bad:
            errors.append(f"{fixture}: excluded YARA hit {bad}")

    if expect.get("yara_rules_any_match"):
        patterns = [p.lower() for p in expect["yara_rules_any_match"]]
        if not any(any(p in r.lower() for p in patterns) for r in rules):
            errors.append(f"{fixture}: no YARA rule matching {patterns} in {rules}")

    pdf = doc.get("pdf") or {}
    if expect.get("pdf_javascript_or_open_action"):
        ok = pdf.get("javascript") or pdf.get("open_action") or any(
            "javascript" in r.lower() or "open_action" in r.lower() for r in rules
        )
        if not ok:
            errors.append(f"{fixture}: expected PDF JS/OpenAction signal, pdf={pdf}, yara={rules}")

    if expect.get("xray_invisible_unicode"):
        if not (xray.get("invisible_unicode") or []):
            errors.append(f"{fixture}: expected invisible_unicode, xray={xray}")

    urls = xray.get("urls") or []
    flags = {f for u in urls for f in (u.get("flags") or [])}
    if "xray_url_flags_any" in expect:
        wanted = set(expect["xray_url_flags_any"])
        if not (flags & wanted):
            errors.append(f"{fixture}: expected URL flags {wanted}, got {flags} urls={urls}")

    qrs = xray.get("qr_codes") or []
    if "xray_qr_codes_min" in expect:
        if len(qrs) < int(expect["xray_qr_codes_min"]):
            errors.append(f"{fixture}: expected >= {expect['xray_qr_codes_min']} QR codes, got {len(qrs)}")

    hidden = xray.get("hidden_text") or []
    kinds = {h.get("kind") for h in hidden if isinstance(h, dict)}
    if "xray_hidden_kinds_any" in expect:
        wanted = set(expect["xray_hidden_kinds_any"])
        if not (kinds & wanted):
            errors.append(f"{fixture}: expected hidden kinds {wanted}, got {kinds}")

    office = doc.get("office") or {}
    if expect.get("office_macros_or_auto_exec_or_yara_macro"):
        ok = bool(office.get("macros") or office.get("auto_exec")) or any(
            "macro" in r.lower() or "auto" in r.lower() for r in rules
        )
        if not ok:
            errors.append(f"{fixture}: expected office macro signal, office={office}, yara={rules}")

    if "magic_matches_extension" in expect:
        m = magic_matches(doc)
        if m is not expect["magic_matches_extension"]:
            errors.append(
                f"{fixture}: magic_matches_extension expected {expect['magic_matches_extension']}, "
                f"mime={doc.get('detectedMime')} ext={doc.get('declaredExtension')}"
            )

    if "exif_field_count_min" in expect:
        count = exif_count(doc)
        if count < int(expect["exif_field_count_min"]):
            errors.append(f"{fixture}: expected exif fields >= {expect['exif_field_count_min']}, got {count}")

    if "detected_mime_prefix" in expect:
        mime = (doc.get("detectedMime") or "").lower()
        if not mime.startswith(expect["detected_mime_prefix"].lower()):
            errors.append(f"{fixture}: expected mime prefix {expect['detected_mime_prefix']}, got {mime}")

    if expect.get("jpeg_xmp_metadata_urls"):
        urls = [str(u.get("url") or "") for u in (xray.get("urls") or [])]
        if not any("ns.adobe.com/xap" in u or "purl.org/dc" in u for u in urls):
            if exif_count(doc) < 1:
                errors.append(
                    f"{fixture}: expected JPEG XMP metadata URLs or exiftool rows, urls={urls}"
                )

    return errors


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: assert-m6-trick-kit.py <manifest.json> <out-dir-with-json>", file=sys.stderr)
        return 2

    manifest = load_json(Path(sys.argv[1]))
    out_dir = Path(sys.argv[2])
    all_errors: list[str] = []

    for entry in manifest.get("fixtures", []):
        file_name = entry["file"]
        out_path = out_dir / f"out-{file_name}.json"
        if not out_path.exists():
            all_errors.append(f"missing triage output for {file_name}")
            continue
        doc = load_json(out_path)
        all_errors.extend(check_expect(file_name, doc, entry.get("expect", {})))

    if all_errors:
        for line in all_errors:
            print(line, file=sys.stderr)
        return 1

    print(f"✓ M6 trick kit expectations met ({len(manifest.get('fixtures', []))} fixtures)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
