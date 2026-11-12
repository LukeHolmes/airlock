#!/usr/bin/env python3
"""Offline content X-ray: hidden text, QR, URLs (no network, no fetch)."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ZERO_WIDTH = {
    "\u200b",
    "\u200c",
    "\u200d",
    "\u2060",
    "\ufeff",
    "\u00ad",
    "\u034f",
}
BIDI = set(chr(c) for c in range(0x202A, 0x202F)) | {"\u061c"}

SHORTENER_HOSTS = {
    "bit.ly",
    "t.co",
    "tinyurl.com",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "rebrand.ly",
    "shorturl.at",
}

URL_PATTERN = re.compile(
    r"(https?://[^\s<>\"']+|www\.[^\s<>\"']+)",
    re.IGNORECASE,
)
HTML_LINK = re.compile(
    r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
CYRILLIC_IN_HOST = re.compile(r"[\u0400-\u04FF]")
IPV4_HOST = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
IPV6_BRACKET = re.compile(r"^\[.+\]$")


def run(cmd: list[str], timeout: int = 60) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def extract_visible_text(path: str) -> str:
    if shutil.which("pdftotext"):
        proc = run(["pdftotext", "-enc", "UTF-8", path, "-"])
        if proc.returncode == 0 and proc.stdout:
            return proc.stdout
    try:
        return Path(path).read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def scan_invisible_unicode(text: str) -> list[dict]:
    counts: dict[str, int] = {}
    for ch in text:
        if ch in ZERO_WIDTH or ch in BIDI:
            key = f"U+{ord(ch):04X}"
            counts[key] = counts.get(key, 0) + 1
    return [{"codepoint": k, "count": v} for k, v in sorted(counts.items())]


def pdf_hidden_from_bbox(path: str) -> list[dict]:
    findings: list[dict] = []
    if not shutil.which("pdftotext"):
        return findings
    proc = run(["pdftotext", "-bbox", path, "-"])
    if proc.returncode != 0 or not proc.stdout:
        return findings
    try:
        root = ET.fromstring(proc.stdout)
    except ET.ParseError:
        return findings
    pages = [el for el in root.iter() if el.tag.endswith("page")]
    if not pages:
        pages = [root]
    for page in pages:
        width = float(page.attrib.get("width", "612"))
        height = float(page.attrib.get("height", "792"))
        for word in [el for el in page.iter() if el.tag.endswith("word")]:
            text = (word.text or "").strip()
            if not text:
                continue
            try:
                x_min = float(word.attrib.get("xMin", "0"))
                x_max = float(word.attrib.get("xMax", "0"))
                y_min = float(word.attrib.get("yMin", "0"))
                y_max = float(word.attrib.get("yMax", "0"))
            except ValueError:
                continue
            h = y_max - y_min
            if h > 0 and h < 4:
                findings.append(
                    {"kind": "tiny_font", "detail": f"~{h:.1f}pt text: {text[:80]!r}"}
                )
            if x_min < -2 or y_min < -2 or x_max > width + 2 or y_max > height + 2:
                findings.append(
                    {"kind": "off_page", "detail": f"off-page text: {text[:80]!r}"}
                )
    return findings


def pdf_white_text_heuristic(path: str) -> list[dict]:
    findings: list[dict] = []
    try:
        data = Path(path).read_bytes()[:4_000_000]
    except OSError:
        return findings
    blob = data.decode("latin-1", errors="ignore")
    if re.search(r"1\s+1\s+1\s+rg[\s\S]{0,120}Tj", blob) or "/F" in blob and "FFFFFF" in blob:
        findings.append(
            {
                "kind": "white_on_white",
                "detail": "PDF content stream suggests white fill text (heuristic)",
            }
        )
    return findings


def office_hidden_text(path: str) -> list[dict]:
    findings: list[dict] = []
    if not path.lower().endswith((".docx", ".docm", ".dotx", ".dotm")):
        return findings
    try:
        with zipfile.ZipFile(path, "r") as zf:
            xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
    except (OSError, KeyError, zipfile.BadZipFile):
        return findings
    if "w:vanish" in xml or "<w:vanish" in xml:
        findings.append({"kind": "vanish", "detail": "Word processing vanish flag in document.xml"})
    if re.search(r'w:color\s+w:val="FFFFFF"', xml, re.I):
        findings.append({"kind": "white_on_white", "detail": "White text color in Office XML"})
    if re.search(r'w:sz\s+w:val="[12]"', xml):
        findings.append({"kind": "tiny_font", "detail": "Extremely small font size in Office XML"})
    return findings


def collect_image_paths(path: str, workdir: str) -> list[str]:
    images: list[str] = []
    mime = run(["file", "-b", "--mime-type", path]).stdout.strip()
    if mime.startswith("application/pdf") and shutil.which("pdfimages"):
        img_dir = os.path.join(workdir, "pdfimg")
        os.makedirs(img_dir, exist_ok=True)
        run(["pdfimages", "-j", "-p", path, os.path.join(img_dir, "page")])
        for name in sorted(os.listdir(img_dir)):
            if name.endswith((".jpg", ".jpeg", ".png", ".ppm")):
                images.append(os.path.join(img_dir, name))
    elif path.lower().endswith((".docx", ".docm", ".dotx", ".dotm")):
        try:
            with zipfile.ZipFile(path, "r") as zf:
                for info in zf.infolist():
                    if info.filename.startswith("word/media/"):
                        out = os.path.join(workdir, Path(info.filename).name)
                        with zf.open(info) as src, open(out, "wb") as dst:
                            dst.write(src.read())
                        images.append(out)
        except (OSError, zipfile.BadZipFile):
            pass
    elif mime.startswith("image/"):
        images.append(path)
    return images


def decode_qr(images: list[str]) -> list[dict]:
    if not shutil.which("zbarimg"):
        return []
    out: list[dict] = []
    for img in images:
        proc = run(["zbarimg", "-q", "--raw", img])
        if proc.returncode != 0:
            continue
        for line in proc.stdout.splitlines():
            payload = line.strip()
            if payload:
                out.append({"payload": payload[:500], "source": os.path.basename(img)})
    return out


def url_flags(url: str) -> list[str]:
    flags: list[str] = []
    normalized = url if url.lower().startswith(("http://", "https://")) else f"http://{url}"
    parsed = urllib.parse.urlparse(normalized)
    host = (parsed.hostname or "").lower()
    if not host:
        return flags
    if IPV4_HOST.match(host) or IPV6_BRACKET.match(host):
        flags.append("ip_literal")
    if "xn--" in host:
        flags.append("punycode")
    try:
        ascii_host = host.encode("idna").decode("ascii")
        if ascii_host != host and "xn--" not in host:
            flags.append("punycode")
    except UnicodeError:
        flags.append("idn_encoding_error")
    if CYRILLIC_IN_HOST.search(host) and re.search(r"[a-zA-Z]", host):
        flags.append("homoglyph")
    labels = host.split(".")
    for label in labels:
        if any(unicodedata.category(c) == "Mn" for c in label):
            flags.append("homoglyph")
    for short in SHORTENER_HOSTS:
        if host == short or host.endswith(f".{short}"):
            flags.append("url_shortener")
            break
    return flags


def display_href_mismatch(href: str, display: str) -> bool:
    display_l = display.lower().strip()
    if not display_l or not href:
        return False
    href_l = href.lower()
    host = (urllib.parse.urlparse(href_l if "://" in href_l else f"http://{href_l}").hostname or "").lower()
    if display_l in href_l or (host and host in display_l):
        return False
    words = [w for w in re.findall(r"[a-z]{4,}", display_l)]
    if not words:
        return False
    return not any(w in href_l or (host and w in host) for w in words)


def extract_urls(text: str, html: bool = False) -> list[dict]:
    entries: list[dict] = []
    seen: set[str] = set()
    if html:
        for href, inner in HTML_LINK.findall(text):
            inner_clean = re.sub(r"<[^>]+>", "", inner).strip()
            flags = url_flags(href)
            if display_href_mismatch(href, inner_clean):
                flags.append("href_display_mismatch")
            if href in seen:
                continue
            seen.add(href)
            entries.append(
                {
                    "url": href[:500],
                    "flags": list(dict.fromkeys(flags)),
                    "displayText": inner_clean[:200] if inner_clean else None,
                }
            )
    for match in URL_PATTERN.finditer(text):
        raw = match.group(1).rstrip(".,);]")
        if raw in seen:
            continue
        seen.add(raw)
        entries.append({"url": raw[:500], "flags": url_flags(raw)})
    return entries


def probe(path: str) -> dict:
    workdir = tempfile.mkdtemp(prefix="airlock-xray-")
    try:
        text = extract_visible_text(path)
        mime = run(["file", "-b", "--mime-type", path]).stdout.strip()
        is_html = mime.startswith("text/html") or path.lower().endswith((".html", ".htm"))
        if is_html:
            try:
                text = Path(path).read_text(encoding="utf-8", errors="ignore")
            except OSError:
                text = ""

        hidden: list[dict] = []
        hidden.extend(scan_invisible_unicode(text))
        hidden.extend(pdf_hidden_from_bbox(path) if mime.startswith("application/pdf") else [])
        hidden.extend(pdf_white_text_heuristic(path) if mime.startswith("application/pdf") else [])
        hidden.extend(office_hidden_text(path))

        images = collect_image_paths(path, workdir)
        qr_codes = decode_qr(images)

        urls = extract_urls(text, html=is_html)
        for qr in qr_codes:
            for u in extract_urls(qr["payload"]):
                urls.append({**u, "flags": u["flags"] + ["from_qr"]})

        dedup_urls: list[dict] = []
        seen_u: set[str] = set()
        for item in urls:
            if item["url"] in seen_u:
                continue
            seen_u.add(item["url"])
            item["flags"] = list(dict.fromkeys(item["flags"]))
            dedup_urls.append(item)

        invisible = scan_invisible_unicode(text)
        for item in invisible:
            hidden.append(
                {"kind": "invisible_unicode", "detail": f"{item['codepoint']} ×{item['count']}"}
            )
        return {
            "hidden_text": hidden,
            "invisible_unicode": invisible,
            "qr_codes": qr_codes,
            "urls": dedup_urls,
        }
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("{}", end="")
        sys.exit(0)
    print(json.dumps(probe(sys.argv[1]), separators=(",", ":")), end="")
