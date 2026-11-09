"""Build the Launch Manual and the User Manual from the shared part files in docs/manual-src.

    python scripts/build-docs.py            # both
    python scripts/build-docs.py user       # one of: launch, user

Each document takes a subset of the sections, renumbers its parts and every
cross-reference, gets its own cover, summary and closing page, and is written
to docs/. The Rollout Plan comes from its own file, docs/manual-src/rollout.html,
and is not renumbered. The PDFs are then printed with scripts/build-manual.py.

    python scripts/build-docs.py              # all three
    python scripts/build-docs.py rollout      # one of launch, user, rollout
"""
import base64
import io
import os
import re
import subprocess
import sys

from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.join(REPO, "docs", "manual-src")   # the shared part files
SITE = 'www.procureline.co.zw'
VERSION = '1.0 &middot; 6 November 2026'
COVERS = 'Procureline as released on 5 November 2026'

raw = ''.join(open(os.path.join(HERE, f'part{i}.html'), encoding='utf-8').read() for i in range(1, 6))
HEAD = raw[:raw.index('<body>') + len('<body>')]
SECTIONS = {m.group(1): m.group(0) for m in re.finditer(r'<section class="page" id="([^"]+)">.*?</section>', raw, re.S)}
HEADINGS = set(re.findall(r'<h3 id="p(\d+)-(\d+)">', raw))   # (part, section) pairs that exist

buf = io.BytesIO()
Image.open(os.path.join(REPO, r'client\public\sourceline-mark.png')).resize((160, 160), Image.LANCZOS).save(buf, 'PNG', optimize=True)
MARK = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

DOCS = {
    'launch': {
        'file': 'Procureline-Launch-Manual',
        'title': 'Launch Manual',
        'h1': 'Launch<br>Manual',
        'sub': 'How an organisation brings Procureline into use: the infrastructure that must be in place, the set-up, the pilot, and going live without losing a purchase on the way.',
        'for': 'The launch team and administrators',
        'glance': 'glance-launch.html',
        'parts': [('p1', 1), ('p10', 2), ('p3', 3), ('p12', 4)],
        'other': 'User Manual',
        'other_map': {2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11},
        'part_a': 'Part 1', 'part_b': 'the User Manual',
        'closing': 'Questions about this manual go to the technical team or the Procureline operators. Day-to-day use is covered by the User Manual.',
    },
    'user': {
        'file': 'Procureline-User-Manual',
        'title': 'User Manual',
        'h1': 'User<br>Manual',
        'sub': 'How every role does its work in Procureline: requesting, approving, sourcing, ordering, receiving, paying and supplying, step by step with screenshots.',
        'for': 'Staff and registered suppliers',
        'glance': 'glance-user.html',
        'parts': [('p2', 1), ('p3', 2), ('p4', 3), ('p5', 4), ('p6', 5), ('p7', 6), ('p8', 7), ('p9', 8), ('p10', 9), ('p11', 10), ('p12', 11)],
        'other': 'Launch Manual',
        'other_map': {1: 1},
        'part_a': 'the Launch Manual', 'part_b': 'Part 1',
        'closing': 'Questions about this manual go to your Procureline administrator. Suppliers contact the Procurement team of the organisation they supply.',
    },
    'rollout': {
        'file': 'Procureline-Rollout-Plan',
        'title': 'Rollout Plan',
        'h1': 'Rollout<br>Plan',
        'sub': "How Procureline goes live across the group's fifteen business units: the infrastructure gate, a two-unit pilot, two Zimbabwe waves and South Africa, starting Monday 16 November 2026.",
        'desc': 'The dated plan for bringing Procureline into live use in every business unit: the infrastructure gate from 16 November 2026, the pilot from 7 December, the second and third waves in January and February 2027, and South Africa in March.',
        'src': 'rollout.html',          # its own sections, numbered as written; nothing is renumbered
        'meta': [('Website', SITE), ('Starts', 'Monday 16 November 2026'), ('Status', 'Draft for review &middot; 6 November 2026')],
        'closing': 'Questions and comments on this plan go to the rollout lead. The Launch Manual says how each unit is set up; the User Manual says how each role works.',
    },
}


def renumber(html: str, inner: dict, other: str, other_map: dict, part_a: str, part_b: str) -> str:
    """Rewrite part numbers in kickers, headings and the running text."""
    def part_ref(n: int) -> str:
        if n in inner:
            return f'Part {inner[n]}'
        return f'{other} Part {other_map.get(n, n)}'

    def sec_ref(n: int, m: int) -> str:
        if n in inner:
            return f'{inner[n]}.{m}'
        return f'{other} {other_map.get(n, n)}.{m}'

    def text(chunk: str) -> str:
        chunk = chunk.replace('Part A', part_a).replace('Part B', part_b)
        # "Parts 6 and 7", "Part 6 or 7", "Parts 1, 2 and 10", "Part 7, 8.4"
        def parts_list(m):
            nums = [int(x) for x in re.findall(r'\d+', m.group(0))]
            inner_nums = [n for n in nums if n in inner]
            outer_nums = [n for n in nums if n not in inner]
            bits = []
            if inner_nums:
                bits.append(('Parts ' if len(inner_nums) > 1 else 'Part ') + join([str(inner[n]) for n in inner_nums]))
            if outer_nums:
                bits.append(f'{other} ' + ('Parts ' if len(outer_nums) > 1 else 'Part ') + join([str(other_map.get(n, n)) for n in outer_nums]))
            return ' and '.join(bits)
        chunk = re.sub(r'\bParts? \d+(?:, \d+)*(?: (?:and|or) \d+)?(?![.\d])', parts_list, chunk)
        chunk = re.sub(r'\b(\d{1,2})\.(\d{1,2})\b',
                       lambda m: sec_ref(int(m.group(1)), int(m.group(2))) if (m.group(1), m.group(2)) in HEADINGS else m.group(0),
                       chunk)
        return chunk

    def join(xs):
        return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1]

    # Kickers ("Part 10") and headings ("10.3 Staff Team") are ordinary text
    # nodes, so one pass over the text nodes renumbers them and every
    # cross-reference together, all while the numbers are still the old ones.
    parts = re.split(r'(<[^>]+>)', html)
    return ''.join(p if p.startswith('<') else text(p) for p in parts)


def cover(doc) -> str:
    return f'''
<div class="darkpage">
  <div class="brand">
    <div class="tile"><img src="{MARK}" alt=""></div>
    <div class="word">Procure<span>line</span><small>Procurement system</small></div>
  </div>
  <div class="body">
    <div class="kicker">Procurement system</div>
    <h1>{doc['h1']}</h1>
    <p class="sub">{doc['sub']}</p>
  </div>
  <div class="sitebox">
    <div class="lbl">Online at</div>
    <div class="url">www.<span>procureline</span>.co.zw</div>
    <div class="tag">Sign in, register as a supplier, or read more about Procureline.</div>
  </div>
  <div class="meta">
{meta_html(doc.get('meta') or [('Website', SITE), ('Version', VERSION), ('For', doc['for'])])}
  </div>
</div>
'''


def meta_html(items) -> str:
    return '\n'.join(f'    <div><div class="meta-label">{label}</div><div class="meta-value">{value}</div></div>' for label, value in items)


def closing(doc) -> str:
    return f'''
<div class="darkpage" style="break-before: page;">
  <div class="brand">
    <div class="tile"><img src="{MARK}" alt=""></div>
    <div class="word">Procure<span>line</span><small>Procurement system</small></div>
  </div>
  <div class="body">
    <h1>Thank you</h1>
    <div class="rule"></div>
    <p class="sub">{doc['closing']}</p>
    <p class="site">{SITE}</p>
  </div>
  <div class="meta">
    <div><div class="meta-label">Website</div><div class="meta-value">{SITE}</div></div>
    <div><div class="meta-label">Document</div><div class="meta-value">Procureline {doc['title']}</div></div>
    <div><div class="meta-label">Version</div><div class="meta-value">{VERSION}</div></div>
  </div>
</div>
'''


def contents(sections_html: str) -> str:
    rows = []
    for m in re.finditer(r'<section class="page" id="([^"]+)">\s*<span class="kicker-sm">([^<]+)</span>\s*<h2>([^<]+)</h2>(.*?)</section>', sections_html, re.S):
        sid, kicker, title, body = m.groups()
        part = kicker if kicker.lower().startswith('part') else ''
        group = [f'<div class="toc-row toc-h2" data-part="{part}"><span class="n">{part}</span><a href="#{sid}">{title}</a><span class="pg">0</span></div>']
        if part:
            for h in re.finditer(r'<h3 id="([^"]+)">([^<]+)</h3>', body):
                group.append(f'<div class="toc-row toc-h3"><a href="#{h.group(1)}">{h.group(2)}</a><span class="pg">0</span></div>')
        rows.append('<div class="toc-group">\n' + '\n'.join(group) + '\n</div>')
    return '<div class="toc-cols">\n' + '\n'.join(rows) + '\n</div>'


def build(key: str) -> str:
    doc = DOCS[key]
    head = HEAD.replace('<title>Procureline — Launch and User Manual</title>', f'<title>Procureline — {doc["title"]}</title>')
    if doc.get('desc'):
        head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{doc["desc"]}">', head)
    head = head.replace('.darkpage .rule {', '.darkpage .site { font-size: 13pt; font-weight: 700; color: var(--sky); margin: 7mm 0 0; letter-spacing: 0.2pt; }\n'
        '  .darkpage .sitebox { position: absolute; left: 20mm; right: 20mm; top: 183mm; display: flex; flex-direction: column; align-items: flex-start; gap: 1.2mm; padding: 8mm 12mm 9mm; border: 0.6mm solid rgba(47,123,255,0.95); border-radius: 4mm; background: linear-gradient(135deg, rgba(29,94,255,0.34), rgba(29,94,255,0.10)); }\n'
        '  .darkpage .sitebox .lbl { font-size: 8pt; font-weight: 700; letter-spacing: 2.4pt; text-transform: uppercase; color: #BFD3FF; }\n'
        '  .darkpage .sitebox .tag { font-size: 10.5pt; font-weight: 500; color: #DCE7FF; margin-top: 1mm; }\n'
        '  .darkpage .sitebox .url { font-size: 30pt; font-weight: 800; color: #fff; letter-spacing: -0.6pt; white-space: nowrap; }\n'
        '  .darkpage .sitebox .url span { color: var(--sky); }\n'
        '  .darkpage .rule {')
    if doc.get('src'):
        glance = ''
        body = open(os.path.join(HERE, doc['src']), encoding='utf-8').read()
    else:
        inner = {int(sid[1:]): n for sid, n in doc['parts']}
        glance = open(os.path.join(HERE, doc['glance']), encoding='utf-8').read()
        body = ''.join(renumber(SECTIONS[sid], inner, doc['other'], doc['other_map'], doc['part_a'], doc['part_b']) + '\n' for sid, _n in doc['parts'])
    toc = ('<div class="toc">\n  <span class="kicker-sm">Procureline ' + doc['title'] + '</span>\n  <h2>Contents</h2>\n'
           + contents(glance + body) + '\n</div>\n')
    html = head + '\n' + cover(doc) + toc + glance + body + closing(doc) + '\n</body>\n</html>\n'
    out = os.path.join(REPO, 'docs', doc['file'] + '.html')
    open(out, 'w', encoding='utf-8').write(html)
    print(f'wrote {out}: {len(html):,} bytes')
    return out


if __name__ == '__main__':
    which = sys.argv[1:] or list(DOCS)
    for key in which:
        html_path = build(key)
        pdf_path = html_path[:-5] + '.pdf'
        subprocess.run([sys.executable, '-I', os.path.join(REPO, 'scripts', 'build-manual.py'), html_path, pdf_path], check=True)
