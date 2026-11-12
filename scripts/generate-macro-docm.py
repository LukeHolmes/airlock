#!/usr/bin/env python3
"""Assemble a harmless macro-enabled .docm at test time (no network)."""
from __future__ import annotations

import base64
import sys
import zipfile
from pathlib import Path

# Minimal vbaProject.bin (benign AutoOpen stub) — assembled at runtime from pinned base64.
_VBA_PROJECT_B64 = (
    "0M8R4KGxGuEAAAAAAAAAAAAAAAAAAAAAPgADAP7/CQAGAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAA"
    "AAAAEAAAAgAAAAEAAAD+////AAAAAAAAAAD/////////////////////////////////////////"
    "//////////////////////////////////////////////////////////////////////////8A"
    "bwBvAGwAXwBWAEIAQQBfAFAAcgBvAGoAZQBjAHQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAIAAgAnAEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAD/////BwAAAAMAAAAGAAAABgAAAAYAAAAGAAAA"
    "BAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAP7////+////BQAAAAYAAAAG"
    "AAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYA"
    "AAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAA"
    "AAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAA"
    "BgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAA"
    "BgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAA"
    "BgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAAGAAAABgAAAAYAAAA="
)

# Fallback when trimmed template is too small: OLE header + ASCII AutoOpen marker (probe + YARA backstop).
_VBA_FALLBACK = (
    b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    + b"\x00" * 504
    + b"Attribut"
    + b"vbaProject"
    + b"AutoOpen"
    + b"Auto_Open"
    + b"\x00" * 400
)

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/>
  <Override PartName="/word/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/>
</Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Harmless macro fixture (AutoOpen stub)</w:t></w:r></w:p>
  </w:body>
</w:document>"""


def vba_project_bytes() -> bytes:
    try:
        raw = base64.b64decode(_VBA_PROJECT_B64, validate=True)
        if len(raw) >= 512:
            return raw
    except (ValueError, TypeError):
        pass
    return _VBA_FALLBACK


def write_docm(dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", CONTENT_TYPES)
        zf.writestr("_rels/.rels", ROOT_RELS)
        zf.writestr("word/document.xml", DOCUMENT_XML)
        zf.writestr("word/vbaProject.bin", vba_project_bytes())


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: generate-macro-docm.py <output.docm>", file=sys.stderr)
        sys.exit(1)
    write_docm(Path(sys.argv[1]))
    print(sys.argv[1])


if __name__ == "__main__":
    main()
