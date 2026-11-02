"""Check that a generated PDF really contains the text it should.

    python scripts/verify-pdf.py file.pdf "some phrase" "another phrase"

Prints page count, size, image count, and whether each phrase is present.
Exits non-zero if any phrase is missing, so it can gate a build.

Written after an ad-hoc version of this check reported text as missing that
was present: its regex treated `\\(` inside a PDF string as a real closing
parenthesis and stopped reading early. A checker that cries wolf is worse
than none, because the next real failure is assumed to be the checker.
"""
import base64
import re
import sys
import zlib


def streams(blob: bytes):
    """Yield each content stream, decoded through whatever filters were used."""
    # `endstream` is not reliably preceded by a newline — reportlab writes it
    # straight after the data — so requiring one matches nothing at all.
    for m in re.finditer(rb'stream\r?\n(.*?)endstream', blob, re.S):
        data = m.group(1)
        for attempt in (
            lambda d: zlib.decompress(base64.a85decode(d.strip(), adobe=True)),
            lambda d: zlib.decompress(d),
            lambda d: base64.a85decode(d.strip(), adobe=True),
            lambda d: d,
        ):
            try:
                yield attempt(data).decode('latin-1')
                break
            except Exception:
                continue


def drawn_text(content: str) -> str:
    """Pull the literal strings a content stream draws.

    PDF string syntax escapes parentheses as \\( and \\), and they may also be
    balanced and nested. Both have to be handled or the scan ends early and
    everything after it is silently lost.
    """
    out = []
    i = 0
    n = len(content)
    while i < n:
        if content[i] != '(':
            i += 1
            continue
        depth = 1
        i += 1
        buf = []
        while i < n and depth:
            ch = content[i]
            if ch == '\\':
                if i + 1 < n:
                    buf.append(content[i + 1])
                    i += 2
                    continue
                i += 1
                continue
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    i += 1
                    break
            buf.append(ch)
            i += 1
        out.append(''.join(buf))
    return ' '.join(out)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    path = sys.argv[1]
    phrases = sys.argv[2:]
    blob = open(path, 'rb').read()

    pages = blob.count(b'/Type /Page') - blob.count(b'/Type /Pages')
    images = blob.count(b'/Subtype /Image')
    text = ' '.join(drawn_text(c) for c in streams(blob))
    flat = re.sub(r'[^a-z0-9]', '', text.lower())

    print(f'{path}')
    print(f'  pages  : {pages}')
    print(f'  size   : {round(len(blob) / 1024)} KB')
    print(f'  images : {images}')
    print(f'  text   : {len(flat)} characters')

    missing = 0
    if phrases:
        print()
        for p in phrases:
            key = re.sub(r'[^a-z0-9]', '', p.lower())
            ok = key in flat
            if not ok:
                missing += 1
            print(f'  {"ok     " if ok else "MISSING"} {p}')

    if len(flat) < 200:
        print('\n  WARNING: almost no text extracted — the PDF may be empty or image-only.')
        return 1

    print('\n' + ('all phrases present' if not missing else f'{missing} phrase(s) missing'))
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
