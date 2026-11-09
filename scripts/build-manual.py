"""Build the Launch and User Manual PDF from its HTML.

    python scripts/build-manual.py docs/Procureline-Launch-and-User-Manual.html docs/Procureline-Launch-and-User-Manual.pdf

Three passes:
  1. Print the HTML with headless Edge (no browser header or footer).
  2. Find the page each contents entry landed on, write the numbers back into
     the HTML, and print again.
  3. Stamp a running header (product name on the left, the current part on the
     right) and a footer (document name, "page / total") on every page except
     the cover and the closing page, with pypdf and reportlab.

Contents rows have this shape:

    <div class="toc-row toc-h2" data-part="Part 1"><span class="n">PART 1</span><a href="#p1">Launch</a><span class="pg">4</span></div>
    <div class="toc-row toc-h3"><a href="#p1-1">1.1 The four waves</a><span class="pg">4</span></div>

A heading is located by the first 30 characters of its text, searched forward
from the page the previous heading was found on, so a title that also appears
on the contents page is not matched there.
"""
import io
import os
import re
import subprocess
import sys
import time

import pypdfium2 as pdfium
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
]

TOC_ROW = re.compile(
    r'<div class="toc-row (toc-h2|toc-h3)"(?: data-part="([^"]*)")?>(?:<span class="n">[^<]*</span>)?'
    r'<a href="#([^"]+)">([^<]+)</a><span class="pg">(\d+)</span></div>'
)

PRODUCT = 'Procureline'
DOC_NAME = 'Launch and User Manual'
A4_W, A4_H = 595.28, 841.89
NAVY, MUTED, HAIR = '#051A38', '#6B7686', '#DCE1E8'


def browser() -> str:
    for path in EDGE_CANDIDATES:
        if os.path.exists(path):
            return path
    sys.exit('No Edge or Chrome found to print with')


def print_pdf(html_path: str, pdf_path: str) -> pdfium.PdfDocument:
    url = 'file:///' + os.path.abspath(html_path).replace('\\', '/')
    # Edge may hand the job to an already-running browser and return at once,
    # so the old file is removed first and the new one is waited for until its
    # size stops changing. Otherwise a second pass could read the first pass.
    if os.path.exists(pdf_path):
        os.remove(pdf_path)
    subprocess.run(
        [browser(), '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
         '--run-all-compositor-stages-before-draw', '--virtual-time-budget=8000',
         f'--print-to-pdf={os.path.abspath(pdf_path)}', url],
        check=True, capture_output=True,
    )
    last = -1
    for _ in range(120):
        if os.path.exists(pdf_path):
            size = os.path.getsize(pdf_path)
            if size and size == last:
                try:
                    return pdfium.PdfDocument(pdf_path)
                except Exception:
                    pass
            last = size
        time.sleep(0.5)
    raise RuntimeError(f'{pdf_path} was not produced')


def flat(text: str) -> str:
    return re.sub(r'\s+', ' ', text)


def page_texts(doc: pdfium.PdfDocument) -> list[list[str]]:
    """Each page as its non-empty lines, whitespace collapsed."""
    out = []
    for i in range(len(doc)):
        lines = [flat(l).strip() for l in doc[i].get_textpage().get_text_range().splitlines()]
        out.append([l for l in lines if l])
    return out


def unescape(text: str) -> str:
    return (text.replace('&amp;', '&').replace('&rsaquo;', '›').replace('&middot;', '·')
            .replace('&mdash;', '—').replace('&ndash;', '–').replace('&nbsp;', ' '))


def locate(html: str, pages: list[list[str]]):
    """Yield (level, part label, anchor, title, old number, found page) per contents row.

    A heading is its own line in the printed text, so a title is matched as a
    whole line first; a short title such as "Launch" is then not mistaken for
    the same word inside a paragraph. A substring search is the fallback for a
    heading long enough to wrap.
    """
    # The body starts after the cover and the contents page(s): the last page
    # with the line "Contents" on it, or page 2 if that is somehow missing.
    toc_pages = [i for i, lines in enumerate(pages) if 'Contents' in lines]
    cursor = (max(toc_pages) + 2) if toc_pages else 3
    # Spaces are dropped on both sides: the text extractor sometimes runs two
    # words of a tightly spaced heading together ("Whatthe system does").
    squash = lambda s: re.sub(r'\s+', '', s)
    for level, part, anchor, title, old in TOC_ROW.findall(html):
        key = squash(unescape(title))
        found = next((p + 1 for p in range(cursor - 1, len(pages)) if any(squash(l) == key for l in pages[p])), None)
        if found is None:
            short = key[:26]
            found = next((p + 1 for p in range(cursor - 1, len(pages)) if short in squash(''.join(pages[p]))), None)
        if found is not None:
            cursor = found
        yield level, part, anchor, title, old, found


def fix_contents(html: str, doc: pdfium.PdfDocument) -> tuple[str, int]:
    changed = 0
    for _level, _part, anchor, title, old, found in locate(html, page_texts(doc)):
        if found is None:
            print(f'  heading not found in the PDF, number left as is: {title}')
            continue
        if str(found) != old:
            pattern = re.compile(
                r'(<a href="#' + re.escape(anchor) + r'">[^<]*</a><span class="pg">)' + re.escape(old) + r'(</span>)'
            )
            html, n = pattern.subn(r'\g<1>' + str(found) + r'\g<2>', html, count=1)
            changed += n
    return html, changed


def part_by_page(html: str, doc: pdfium.PdfDocument) -> list[str]:
    """The running-header text for each page: the part whose heading is on or before it."""
    n = len(doc)
    starts: dict[int, str] = {}
    for level, part, _anchor, title, _old, found in locate(html, page_texts(doc)):
        if level == 'toc-h2' and found is not None:
            label = f'{part} · {title}' if part else title
            starts.setdefault(found, label)
    out, current = [], ''
    for p in range(1, n + 1):
        current = starts.get(p, current)
        out.append(current)
    return out


def stamp(pdf_path: str, headers: list[str]) -> None:
    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    total = len(reader.pages)
    for i, page in enumerate(reader.pages):
        number = i + 1
        is_cover = number == 1
        is_last = number == total
        if not is_cover and not is_last:
            # A page may be landscape (the rollout schedule), so its own size is used.
            w, h = float(page.mediabox.width), float(page.mediabox.height)
            buf = io.BytesIO()
            c = canvas.Canvas(buf, pagesize=(w, h))
            left, right = 56.7, w - 51.0   # 20mm and 18mm margins
            # header
            c.setFillColor(HexColor(NAVY)); c.setFont('Helvetica-Bold', 7.5)
            c.drawString(left, h - 34, PRODUCT)
            c.setFillColor(HexColor(MUTED)); c.setFont('Helvetica', 7.5)
            if number > 2 and headers[i]:
                c.drawRightString(right, h - 34, headers[i])
            # footer
            c.drawString(left, 30, DOC_NAME)
            c.drawRightString(right, 30, f'{number} / {total}')
            c.save()
            buf.seek(0)
            page.merge_page(PdfReader(buf).pages[0])
        writer.add_page(page)
    with open(pdf_path, 'wb') as f:
        writer.write(f)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    html_path, pdf_path = sys.argv[1], sys.argv[2]

    html = open(html_path, encoding='utf-8').read()
    # The footer carries the document's own name: the <title> after "Procureline — ".
    global DOC_NAME
    title = re.search(r'<title>([^<]*)</title>', html)
    if title:
        DOC_NAME = re.sub(r'^Procureline\s*[—-]\s*', '', title.group(1)).strip() or DOC_NAME
    doc = print_pdf(html_path, pdf_path)
    print(f'first pass: {len(doc)} pages')

    html, changed = fix_contents(html, doc)
    if changed:
        doc.close()  # release the file so it can be replaced
        open(html_path, 'w', encoding='utf-8').write(html)
        doc = print_pdf(html_path, pdf_path)
        print(f'contents page numbers corrected: {changed}; second pass: {len(doc)} pages')
    else:
        print('contents page numbers already correct')

    headers = part_by_page(html, doc)
    for i in range(len(doc)):
        lines = [l.strip() for l in doc[i].get_textpage().get_text_range().splitlines() if l.strip()]
        if lines:
            print(f'  p{i + 1:<3} {lines[0][:34]:<36} … {lines[-1][:34]:<36} [{headers[i]}]')
    doc.close()
    stamp(pdf_path, headers)
    print('running header and page numbers stamped')
    return 0


if __name__ == '__main__':
    sys.exit(main())
