/*
 * Airlock static triage YARA rules (Airlock project, MIT-style — vendored, pinned in image build).
 * ~30 rules: macros, PDF actions, PE embeds, suspicious URIs, test patterns.
 */

rule airlock_eicar_test_string {
    meta:
        description = "Standard EICAR test string (harmless)"
        severity = "high"
    strings:
        $eicar = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE"
    condition:
        $eicar
}

rule airlock_pdf_javascript {
    meta:
        description = "PDF /JavaScript name object"
        severity = "high"
    strings:
        $js = "/JavaScript" ascii
    condition:
        $js
}

rule airlock_pdf_launch_action {
    meta:
        description = "PDF /Launch action"
        severity = "high"
    strings:
        $launch = "/Launch" ascii
    condition:
        $launch
}

rule airlock_pdf_open_action {
    meta:
        description = "PDF /OpenAction"
        severity = "medium"
    strings:
        $oa = "/OpenAction" ascii
    condition:
        $oa
}

rule airlock_pdf_embedded_file {
    meta:
        description = "PDF /EmbeddedFile marker"
        severity = "medium"
    strings:
        $ef = "/EmbeddedFile" ascii
    condition:
        $ef
}

rule airlock_pdf_aa_js {
    meta:
        description = "PDF additional actions /AA"
        severity = "medium"
    strings:
        $aa = "/AA" ascii
        $js = "/JavaScript" ascii
    condition:
        $aa and $js
}

rule airlock_office_autoexec_macro {
    meta:
        description = "Office VBA Auto* entry point"
        severity = "high"
    strings:
        $a1 = "AutoOpen" ascii wide
        $a2 = "Auto_Open" ascii wide
        $a3 = "AutoExec" ascii wide
        $a4 = "Document_Open" ascii wide
    condition:
        any of them
}

rule airlock_office_vba_shell {
    meta:
        description = "VBA shell/process invocation"
        severity = "high"
    strings:
        $s1 = "WScript.Shell" ascii wide
        $s2 = "Shell.Application" ascii wide
        $s3 = "CreateObject(\"WScript.Shell\")" ascii wide
    condition:
        any of them
}

rule airlock_office_macro_present {
    meta:
        description = "VBA project stream marker"
        severity = "medium"
    strings:
        $vba = "vbaProject.bin" ascii
        $mac = "Macros" ascii wide
    condition:
        $vba or $mac
}

rule airlock_office_dde {
    meta:
        description = "DDEAUTO / DDE attack pattern"
        severity = "medium"
    strings:
        $dde = "DDEAUTO" ascii wide nocase
        $dde2 = "\\dde" ascii wide nocase
    condition:
        any of them
}

rule airlock_embedded_pe {
    meta:
        description = "MZ header inside compound file"
        severity = "high"
    strings:
        $mz = { 4D 5A }
    condition:
        $mz at 0 or $mz
}

rule airlock_suspicious_uri {
    meta:
        description = "Suspicious URI scheme"
        severity = "medium"
    strings:
        $u1 = "javascript:" ascii nocase
        $u2 = "ms-msdt:" ascii nocase
        $u3 = "vbscript:" ascii nocase
        $u4 = "file://" ascii nocase
    condition:
        any of them
}

rule airlock_html_js_scheme {
    meta:
        description = "HTML javascript: href"
        severity = "medium"
    strings:
        $h = "href=\"javascript:" ascii nocase
    condition:
        $h
}

rule airlock_powershell_cmd {
    meta:
        description = "PowerShell invocation string"
        severity = "high"
    strings:
        $p1 = "powershell" ascii nocase
        $p2 = "-enc " ascii nocase
        $p3 = "FromBase64String" ascii nocase
    condition:
        $p1 and ($p2 or $p3)
}

rule airlock_cmd_exe {
    meta:
        description = "cmd.exe reference"
        severity = "medium"
    strings:
        $c = "cmd.exe" ascii nocase wide
    condition:
        $c
}

rule airlock_rtf_embed_obj {
    meta:
        description = "RTF embedded object"
        severity = "medium"
    strings:
        $r = "\\object" ascii nocase
    condition:
        $r
}

rule airlock_iso_lnk_combo {
    meta:
        description = "LNK shortcut marker"
        severity = "low"
    strings:
        $lnk = { 4C 00 00 00 01 14 02 00 }
    condition:
        $lnk at 0
}

rule airlock_zip_comment_exec {
    meta:
        description = "ZIP with suspicious central directory"
        severity = "low"
    strings:
        $pk = "PK\x03\x04"
        $exe = ".exe" ascii nocase
    condition:
        $pk at 0 and $exe
}

rule airlock_double_extension {
    meta:
        description = "Double extension filename pattern"
        severity = "low"
    strings:
        $d = ".pdf.exe" ascii nocase
        $d2 = ".doc.exe" ascii nocase
    condition:
        any of them
}

rule airlock_xor_loop {
    meta:
        description = "Simple XOR decode loop stub"
        severity = "medium"
    strings:
        $x = { 80 30 ?? 40 ?? 75 ?? }
    condition:
        $x
}

rule airlock_base64_blob {
    meta:
        description = "Large base64 alphabet run"
        severity = "low"
    strings:
        $b = /[A-Za-z0-9+\/]{200,}={0,2}/
    condition:
        #b > 3
}

rule airlock_msi_exec {
    meta:
        description = "Windows installer marker"
        severity = "low"
    strings:
        $msi = { D0 CF 11 E0 A1 B1 1A E1 }
    condition:
        $msi at 0
}

rule airlock_cve_msdt {
    meta:
        description = "MSDT follina-style protocol"
        severity = "high"
    strings:
        $m = "ms-msdt:/" ascii nocase
    condition:
        $m
}

rule airlock_url_unc {
    meta:
        description = "UNC path in content"
        severity = "medium"
    strings:
        $unc = "\\\\" ascii
    condition:
        $unc and filesize < 5000000
}

rule airlock_html_iframe {
    meta:
        description = "HTML remote iframe"
        severity = "low"
    strings:
        $i = "<iframe" ascii nocase
    condition:
        $i
}

rule airlock_office_equation {
    meta:
        description = "Equation editor marker (legacy attack surface)"
        severity = "medium"
    strings:
        $eq = "Microsoft Equation" ascii wide
    condition:
        $eq
}

rule airlock_xml_xxe_hint {
    meta:
        description = "DOCTYPE external entity"
        severity = "medium"
    strings:
        $x = "<!ENTITY" ascii nocase
    condition:
        $x
}

rule airlock_pe_import_wininet {
    meta:
        description = "PE imports wininet"
        severity = "medium"
    strings:
        $w = "WININET.dll" ascii nocase
        $mz = { 4D 5A }
    condition:
        $mz at 0 and $w
}

rule airlock_pdf_uri_action {
    meta:
        description = "PDF /URI action"
        severity = "low"
    strings:
        $u = "/URI" ascii
    condition:
        $u
}

rule airlock_office_xlm_macro {
    meta:
        description = "Excel 4.0 XLM macro sheet"
        severity = "medium"
    strings:
        $xlm = "Macro1" ascii wide
        $auto = "AUTO_OPEN" ascii wide
    condition:
        any of them
}

rule airlock_suspicious_office_ext {
    meta:
        description = "Dangerous Office extension in content"
        severity = "low"
    strings:
        $d = ".docm" ascii nocase
        $x = ".xlsm" ascii nocase
    condition:
        any of them
}

rule airlock_chromium_extension_crx {
    meta:
        description = "CRX extension header"
        severity = "low"
    strings:
        $crx = "Cr24" ascii
    condition:
        $crx
}

rule airlock_hta_application {
    meta:
        description = "HTML Application HTA"
        severity = "high"
    strings:
        $hta = "<HTA:APPLICATION" ascii nocase
    condition:
        $hta
}

rule airlock_iso_joliet_hint {
    meta:
        description = "ISO9660 marker"
        severity = "low"
    strings:
        $iso = { 01 43 44 30 30 31 }
    condition:
        $iso
}

rule airlock_svg_script {
    meta:
        description = "SVG script tag"
        severity = "medium"
    strings:
        $s = "<script" ascii nocase
        $svg = "<svg" ascii nocase
    condition:
        $svg and $s
}
