"""Render pages of a PDF to PNG, so a layout can be looked at.

    python scripts/pdf-preview.py file.pdf 1,2,5 outdir

Rasterises directly with pypdfium2. An earlier attempt drove Chrome's PDF
viewer and screenshotted it, which captured the viewer chrome and ignored the
page it was asked for — this renders the page itself.
"""
import os
import sys

import pypdfium2 as pdfium


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    path = sys.argv[1]
    pages = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '1').split(',')]
    out = sys.argv[3] if len(sys.argv) > 3 else 'pdf-preview'
    os.makedirs(out, exist_ok=True)

    doc = pdfium.PdfDocument(path)
    total = len(doc)
    for n in pages:
        if n < 1 or n > total:
            print(f'  page {n} is outside this document (1-{total})')
            continue
        page = doc[n - 1]
        # scale 2 gives roughly 144 dpi — enough to judge type and spacing.
        image = page.render(scale=2).to_pil()
        dest = os.path.join(out, f'page-{n}.png')
        image.save(dest)
        print(f'  {dest}  ({image.width}x{image.height})')
    print(f'{total} pages in total')
    return 0


if __name__ == '__main__':
    sys.exit(main())
