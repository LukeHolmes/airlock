#!/usr/bin/env python3
"""Office macro static probe via oletools (offline, read-only)."""
import json
import sys


def probe(path: str) -> dict:
    result = {
        "format": "unknown",
        "macros": False,
        "auto_exec": [],
        "ole_flags": [],
        "vba_hits": [],
    }
    try:
        from oletools import oleid
        from oletools.olevba import VBA_Parser
    except ImportError as err:
        result["ole_flags"] = [f"oletools_missing:{err}"]
        return result

    try:
        oid = oleid.OleID(path)
        indicators = oid.check()
        for ind in indicators:
            if ind.value and ind.name:
                result["ole_flags"].append(ind.name)
    except Exception as exc:
        result["ole_flags"].append(f"oleid_error:{exc}")

    try:
        vbap = VBA_Parser(path)
        if vbap.detect_vba_macros():
            result["macros"] = True
            result["format"] = "OLE" if vbap.ole_file else "OpenXML"
            macros = vbap.analyze_macros()
            macro_blob = "\n".join(str(entry) for entry in (macros or []))
            for keyword in ("AutoOpen", "Auto_Open", "Document_Open", "AutoExec"):
                if keyword in macro_blob:
                    result["auto_exec"].append(keyword)
            for entry in macros or []:
                if isinstance(entry, tuple) and len(entry) >= 1:
                    result["vba_hits"].append(str(entry[0])[:120])
    except Exception as exc:
        result["ole_flags"].append(f"olevba_error:{exc}")

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("{}", end="")
        sys.exit(0)
    print(json.dumps(probe(sys.argv[1]), separators=(",", ":")), end="")
