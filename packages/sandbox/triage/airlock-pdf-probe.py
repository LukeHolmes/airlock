#!/usr/bin/env python3
"""Lightweight PDF static probe (pdfid-style, no network)."""
import re
import sys


def probe(path: str) -> dict:
    with open(path, "rb") as fh:
        data = fh.read(8_000_000)
    text = data.decode("latin-1", errors="ignore")
    keywords = []
    for token in ("/JavaScript", "/JS", "/Launch", "/OpenAction", "/EmbeddedFile", "/AA"):
        if token in text:
            keywords.append(token)
    embedded = len(re.findall(r"/EmbeddedFile", text))
    return {
        "javascript": "/JavaScript" in text or "/JS" in text,
        "open_action": "/OpenAction" in text,
        "launch": "/Launch" in text,
        "embedded_files": embedded,
        "keywords": keywords,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("{}", end="")
        sys.exit(0)
    import json

    print(json.dumps(probe(sys.argv[1]), separators=(",", ":")), end="")
