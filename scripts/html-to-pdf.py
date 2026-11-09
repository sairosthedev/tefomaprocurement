"""Print a designed HTML document to PDF with headless Edge, then fix its contents page numbers.

    python scripts/html-to-pdf.py docs/Procureline-Project-Scope.html docs/Procureline-Project-Scope.pdf

The documents under docs/ that are written as HTML (the Project Scope
document, for one) carry their own print CSS (@page, break-before, cover
page) and a hand-written contents list whose page numbers are plain text.
This prints the page with Edge, reads the rendered PDF back to find which page
each heading landed on, writes the corrected numbers into the HTML, and prints
again. Two passes, for the same reason md-to-pdf.py uses multiBuild.

A contents row is recognised by this shape (what the Scope document uses):

    <div class="toc-row toc-h2"><a href="#s1"><span class="n">01</span>Title</a><span class="dots"></span><span class="pg">3</span></div>
    <div class="toc-row toc-h3"><a href="#s1-x">Subtitle</a><span class="dots"></span><span class="pg">3</span></div>

Headings are located by their first 28 characters of text, searched forward
from the page the previous heading was found on, so a title that also appears
in the contents list is not matched there.
"""
import os
import re
import subprocess
import sys
import time

import pypdfium2 as pdfium

EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
]

TOC_ROW = re.compile(
    r'<div class="toc-row (toc-h2|toc-h3)"><a href="#([^"]+)">(?:<span class="n">\d+</span>)?'
    r'([^<]+)</a><span class="dots"></span><span class="pg">(\d+)</span></div>'
)


def browser() -> str:
    for path in EDGE_CANDIDATES:
        if os.path.exists(path):
            return path
    sys.exit('No Edge or Chrome found to print with')


def print_pdf(html_path: str, pdf_path: str) -> pdfium.PdfDocument:
    url = 'file:///' + os.path.abspath(html_path).replace('\\', '/')
    subprocess.run(
        [browser(), '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
         f'--print-to-pdf={os.path.abspath(pdf_path)}', url],
        check=True, capture_output=True,
    )
    # Edge returns before the file is always closed; wait for it to be readable.
    for _ in range(40):
        try:
            return pdfium.PdfDocument(pdf_path)
        except Exception:
            time.sleep(0.5)
    raise RuntimeError(f'{pdf_path} was not produced')


def flat(text: str) -> str:
    return re.sub(r'\s+', ' ', text)


def fix_contents(html: str, doc: pdfium.PdfDocument) -> tuple[str, int]:
    pages = [flat(doc[i].get_textpage().get_text_range()) for i in range(len(doc))]
    rows = TOC_ROW.findall(html)
    cursor = 3  # the body starts after the cover and the contents page
    changed = 0
    for _level, anchor, title, old in rows:
        key = flat(re.sub(r'&\w+;', ' ', title)).strip().split(' (')[0][:28]
        found = next((p + 1 for p in range(cursor - 1, len(pages)) if key in pages[p]), None)
        if found is None:
            print(f'  heading not found in the PDF, number left as is: {title}')
            continue
        cursor = found
        if str(found) != old:
            pattern = re.compile(
                r'(<a href="#' + re.escape(anchor) + r'">.*?<span class="pg">)' + re.escape(old) + r'(</span>)'
            )
            html, n = pattern.subn(r'\g<1>' + str(found) + r'\g<2>', html, count=1)
            changed += n
    return html, changed


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    html_path, pdf_path = sys.argv[1], sys.argv[2]

    html = open(html_path, encoding='utf-8').read()
    doc = print_pdf(html_path, pdf_path)
    print(f'first pass: {len(doc)} pages')

    html, changed = fix_contents(html, doc)
    if changed:
        open(html_path, 'w', encoding='utf-8').write(html)
        doc = print_pdf(html_path, pdf_path)
        print(f'contents page numbers corrected: {changed}; second pass: {len(doc)} pages')
    else:
        print('contents page numbers already correct')

    # The first and last line of each page, to spot a heading stranded at a page foot.
    for i in range(len(doc)):
        lines = [l.strip() for l in doc[i].get_textpage().get_text_range().splitlines() if l.strip()]
        if lines:
            print(f'  p{i + 1:<3} {lines[0][:40]:<42} … {lines[-1][:40]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
