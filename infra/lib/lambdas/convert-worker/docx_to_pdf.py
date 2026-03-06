#!/usr/bin/env python3
"""
DOCX → PDF converter using mammoth (DOCX→HTML) + WeasyPrint (HTML→PDF).

Usage: python3 docx_to_pdf.py <input.docx> <output.pdf>

Exit code 0 = success (prints output byte-size to stdout).
Exit code 1 = failure (error message on stderr).

mammoth converts DOCX to semantic HTML preserving headings, paragraphs, tables,
and embedded images. WeasyPrint renders the HTML to a paginated PDF using
Pango/Cairo (system libraries installed in the Lambda container image).
"""

import sys
import os


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: docx_to_pdf.py <input.docx> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    docx_path = sys.argv[1]
    pdf_path = sys.argv[2]

    if not os.path.exists(docx_path):
        print(f"Input file not found: {docx_path}", file=sys.stderr)
        sys.exit(1)

    try:
        import mammoth  # type: ignore
    except ImportError as exc:
        print(f"mammoth is not installed: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        from weasyprint import HTML  # type: ignore
    except ImportError as exc:
        print(f"weasyprint is not installed: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(docx_path, "rb") as f:
            result = mammoth.convert_to_html(f)
        html_body = result.value

        html_doc = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {{ margin: 2cm; }}
body {{
    font-family: sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
}}
h1, h2, h3, h4, h5, h6 {{
    font-weight: bold;
    margin: 1em 0 0.5em;
}}
p {{ margin: 0.5em 0; }}
table {{
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
}}
td, th {{
    border: 1px solid #ccc;
    padding: 4px 8px;
    text-align: left;
}}
img {{ max-width: 100%; height: auto; }}
ul, ol {{ margin: 0.5em 0; padding-left: 1.5em; }}
</style>
</head>
<body>{html_body}</body>
</html>"""

        HTML(string=html_doc).write_pdf(pdf_path)
    except Exception as exc:
        print(f"Conversion failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(pdf_path):
        print("WeasyPrint did not produce an output file", file=sys.stderr)
        sys.exit(1)

    size = os.path.getsize(pdf_path)
    if size == 0:
        print("WeasyPrint produced an empty PDF", file=sys.stderr)
        sys.exit(1)

    print(f"OK:{size}", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
