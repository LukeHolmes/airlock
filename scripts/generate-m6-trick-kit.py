#!/usr/bin/env python3
"""Generate harmless, deterministic M6 trick-file fixtures into fixtures/m6-trick-kit/."""
from __future__ import annotations

import base64
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "fixtures" / "m6-trick-kit"
SCRIPT_DIR = Path(__file__).resolve().parent

# Pinned QR (bit.ly shortener) — moved from scripts/fixtures/qr-bitly.b64
_QR_BITLY_B64 = (SCRIPT_DIR / "fixtures" / "qr-bitly.b64").read_text().strip()


def write_bytes(rel: str, data: bytes) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def write_text(rel: str, text: str) -> None:
    write_bytes(rel, text.encode("utf-8"))


def macro_docm() -> None:
    subprocess.run(
        [sys.executable, str(SCRIPT_DIR / "generate-macro-docm.py"), str(OUT / "09-macro-harmless.docm")],
        check=True,
    )


def office_hidden_docx() -> None:
    """Word doc with vanish + white text flags in document.xml."""
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""
    document = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden vanish stub</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:color w:val="FFFFFF"/><w:sz w:val="2"/></w:rPr><w:t>White tiny text</w:t></w:r>
    </w:p>
  </w:body>
</w:document>"""
    dest = OUT / "14-office-hidden.docx"
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document)


def white_text_pdf() -> None:
    """PDF bytes that trigger white_on_white heuristic (harmless)."""
    body = (
        b"%PDF-1.4\n"
        b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
        b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
        b"3 0 obj<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources<<>> >>endobj\n"
        b"4 0 obj<< /Length 44 >>stream\n"
        b"1 1 1 rg BT /F1 12 Tf 100 700 Td (Visible) Tj ET\n"
        b"endstream\nendobj\n"
        b"trailer<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    )
    write_bytes("10-white-text.pdf", body)


def polyglot_pdf_pe() -> None:
    data = b"%PDF-1.4 fake header\n" + b"padding " * 20 + b"MZ" + b"\x00" * 64
    write_bytes("12-polyglot-pdf-pe.txt", data)


def extension_spoof() -> None:
    pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj trailer<</Root 1 0 R>>\n"
    write_bytes("11-extension-spoof.pdf-as-txt.txt", pdf)


def minimal_jpeg_exif() -> None:
    """Minimal JPEG; optional exiftool enrichment when available."""
    minimal = bytes(
        [
            0xFF,
            0xD8,
            0xFF,
            0xE0,
            0x00,
            0x10,
            0x4A,
            0x46,
            0x49,
            0x46,
            0x00,
            0x01,
            0x01,
            0x00,
            0x00,
            0x01,
            0x00,
            0x01,
            0x00,
            0x00,
            0xFF,
            0xDB,
            0x00,
            0x43,
            0x00,
            0x08,
            0x06,
            0x06,
            0x07,
            0x06,
            0x05,
            0x08,
            0x07,
            0x07,
            0x07,
            0x09,
            0x09,
            0x08,
            0x0A,
            0x0C,
            0x14,
            0x0D,
            0x0C,
            0x0B,
            0x0B,
            0x0C,
            0x19,
            0x12,
            0x13,
            0x0F,
            0x14,
            0x1D,
            0x1A,
            0x1F,
            0x1E,
            0x1D,
            0x1A,
            0x1C,
            0x1C,
            0x20,
            0x24,
            0x2E,
            0x27,
            0x20,
            0x22,
            0x2C,
            0x23,
            0x1C,
            0x1C,
            0x28,
            0x37,
            0x29,
            0x2C,
            0x30,
            0x31,
            0x34,
            0x34,
            0x34,
            0x1F,
            0x27,
            0x39,
            0x3D,
            0x38,
            0x32,
            0x3C,
            0x2E,
            0x33,
            0x34,
            0x32,
            0xFF,
            0xC0,
            0x00,
            0x0B,
            0x08,
            0x00,
            0x01,
            0x00,
            0x01,
            0x01,
            0x01,
            0x11,
            0x00,
            0xFF,
            0xC4,
            0x00,
            0x1F,
            0x00,
            0x00,
            0x01,
            0x05,
            0x01,
            0x01,
            0x01,
            0x01,
            0x01,
            0x01,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x01,
            0x02,
            0x03,
            0x04,
            0x05,
            0x06,
            0x07,
            0x08,
            0x09,
            0x0A,
            0x0B,
            0xFF,
            0xC4,
            0x00,
            0xB5,
            0x10,
            0x00,
            0x02,
            0x01,
            0x03,
            0x03,
            0x02,
            0x04,
            0x03,
            0x05,
            0x05,
            0x04,
            0x04,
            0x00,
            0x00,
            0x01,
            0x7D,
            0x01,
            0x02,
            0x03,
            0x00,
            0x04,
            0x11,
            0x05,
            0x12,
            0x21,
            0x31,
            0x41,
            0x06,
            0x13,
            0x51,
            0x61,
            0x07,
            0x22,
            0x71,
            0x14,
            0x32,
            0x81,
            0x91,
            0xA1,
            0x08,
            0x23,
            0x42,
            0xB1,
            0xC1,
            0x15,
            0x52,
            0xD1,
            0xF0,
            0x24,
            0x33,
            0x62,
            0x72,
            0x82,
            0x09,
            0x0A,
            0x16,
            0x17,
            0x18,
            0x19,
            0x1A,
            0x25,
            0x26,
            0x27,
            0x28,
            0x29,
            0x2A,
            0x34,
            0x35,
            0x36,
            0x37,
            0x38,
            0x39,
            0x3A,
            0x43,
            0x44,
            0x45,
            0x46,
            0x47,
            0x48,
            0x49,
            0x4A,
            0x53,
            0x54,
            0x55,
            0x56,
            0x57,
            0x58,
            0x59,
            0x5A,
            0x63,
            0x64,
            0x65,
            0x66,
            0x67,
            0x68,
            0x69,
            0x6A,
            0x73,
            0x74,
            0x75,
            0x76,
            0x77,
            0x78,
            0x79,
            0x7A,
            0x83,
            0x84,
            0x85,
            0x86,
            0x87,
            0x88,
            0x89,
            0x8A,
            0x92,
            0x93,
            0x94,
            0x95,
            0x96,
            0x97,
            0x98,
            0x99,
            0x9A,
            0xA2,
            0xA3,
            0xA4,
            0xA5,
            0xA6,
            0xA7,
            0xA8,
            0xA9,
            0xAA,
            0xB2,
            0xB3,
            0xB4,
            0xB5,
            0xB6,
            0xB7,
            0xB8,
            0xB9,
            0xBA,
            0xC2,
            0xC3,
            0xC4,
            0xC5,
            0xC6,
            0xC7,
            0xC8,
            0xC9,
            0xCA,
            0xD2,
            0xD3,
            0xD4,
            0xD5,
            0xD6,
            0xD7,
            0xD8,
            0xD9,
            0xDA,
            0xE1,
            0xE2,
            0xE3,
            0xE4,
            0xE5,
            0xE6,
            0xE7,
            0xE8,
            0xE9,
            0xEA,
            0xF1,
            0xF2,
            0xF3,
            0xF4,
            0xF5,
            0xF6,
            0xF7,
            0xF8,
            0xF9,
            0xFA,
            0xFF,
            0xDA,
            0x00,
            0x08,
            0x01,
            0x01,
            0x00,
            0x00,
            0x3F,
            0x00,
            0xFB,
            0xD5,
            0xDB,
            0x20,
            0xA8,
            0xF1,
            0x7F,
            0xFF,
            0xD9,
        ]
    )
    path = OUT / "13-exif-metadata.jpg"
    path.write_bytes(minimal)
    if shutil.which("exiftool"):
        subprocess.run(
            [
                "exiftool",
                "-overwrite_original",
                "-Title=M6 EXIF fixture",
                "-Artist=Airlock kit",
                "-Comment=Harmless metadata test",
                str(path),
            ],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def write_qr_with_qrencode() -> None:
    if not shutil.which("qrencode"):
        return
    subprocess.run(
        ["qrencode", "-o", str(OUT / "07-qr-ip-literal.png"), "http://192.0.2.1/login"],
        check=True,
    )
    subprocess.run(
        [
            "qrencode",
            "-o",
            str(OUT / "08-qr-punycode.png"),
            "https://xn--pple-43d.example/test",
        ],
        check=True,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    write_text(
        "01-benign-minimal.pdf",
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj trailer<</Root 1 0 R>>\n",
    )
    write_text(
        "02-eicar.txt",
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n",
    )
    write_text("03-pdf-javascript-openaction.pdf", "%PDF-1.4\n/JavaScript /OpenAction decoy\n")
    write_text("04-invisible-unicode.txt", "visible\u200bhidden\u200c")
    write_text(
        "05-href-mismatch.html",
        '<a href="http://paypa1-verify.example/login">PayPal Security Center</a>\n',
    )
    write_bytes("06-qr-shortener.png", base64.b64decode(_QR_BITLY_B64))

    write_qr_with_qrencode()
    for name in ("07-qr-ip-literal.png", "08-qr-punycode.png"):
        if not (OUT / name).exists():
            # Fallback: copy shortener QR (CI still asserts shortener on 06)
            write_bytes(name, base64.b64decode(_QR_BITLY_B64))

    macro_docm()
    white_text_pdf()
    extension_spoof()
    polyglot_pdf_pe()
    minimal_jpeg_exif()
    office_hidden_docx()

    print(f"Wrote M6 trick kit to {OUT}")


if __name__ == "__main__":
    main()
