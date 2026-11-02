"""Render a Markdown file to a designed PDF.

    python scripts/md-to-pdf.py input.md output.pdf

Handles the subset these documents use: headings, paragraphs, bullet and
ordered lists, pipe tables, images with captions, inline bold and inline code,
and `---` as a part break.

Produces a cover page, a table of contents with real page numbers, a running
footer, and tables that are readable rather than merely present. The table of
contents needs two passes, which is why the build goes through multiBuild.
"""
import html
import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, ListFlowable, ListItem, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

# Sourceline brand: navy and royal blue, taken from the logo.
NAVY = colors.HexColor('#051A38')
BLUE = colors.HexColor('#005CE6')
INK = colors.HexColor('#16202E')
BODY = colors.HexColor('#273142')
MUTED = colors.HexColor('#6B7686')
HAIR = colors.HexColor('#DCE1E8')
BAND = colors.HexColor('#F4F6F9')
ZEBRA = colors.HexColor('#FAFBFC')

PAGE_W, PAGE_H = A4
MARGIN_L, MARGIN_R = 20 * mm, 18 * mm
MARGIN_T, MARGIN_B = 22 * mm, 20 * mm

base = getSampleStyleSheet()


def _p(name, **kw):
    kw.setdefault('fontName', 'Helvetica')
    kw.setdefault('textColor', BODY)
    return ParagraphStyle(name, parent=base['BodyText'], **kw)


S = {
    'cover_title': _p('cover_title', fontName='Helvetica-Bold', fontSize=32, leading=37,
                      textColor=colors.white, alignment=TA_LEFT, spaceAfter=0),
    'cover_sub': _p('cover_sub', fontSize=12.5, leading=18, textColor=colors.HexColor('#AFC3DD')),
    'cover_meta': _p('cover_meta', fontSize=9.5, leading=14, textColor=colors.HexColor('#8FA6C4')),
    'part': _p('part', fontName='Helvetica-Bold', fontSize=19, leading=24, textColor=NAVY,
               spaceBefore=4, spaceAfter=10),
    'h2': _p('h2', fontName='Helvetica-Bold', fontSize=13.5, leading=17.5, textColor=NAVY,
             spaceBefore=17, spaceAfter=6),
    'h3': _p('h3', fontName='Helvetica-Bold', fontSize=10.8, leading=14, textColor=BLUE,
             spaceBefore=12, spaceAfter=4),
    'body': _p('body', fontSize=9.9, leading=15.2, spaceAfter=8),
    'li': _p('li', fontSize=9.9, leading=14.4, spaceAfter=4),
    'cap': _p('cap', fontName='Helvetica-Oblique', fontSize=8.4, leading=11.5, textColor=MUTED,
              spaceBefore=5, spaceAfter=15),
    'th': _p('th', fontName='Helvetica-Bold', fontSize=8.7, leading=11.6, textColor=NAVY),
    'td': _p('td', fontSize=8.7, leading=11.6),
    'toc_h': _p('toc_h', fontName='Helvetica-Bold', fontSize=15, leading=20, textColor=NAVY,
                spaceAfter=12),
}

# Heading styles get their own names so the document can spot them and build
# the table of contents from what was actually laid out.
S['part'].name = 'Hpart'
S['h2'].name = 'Hh2'
S['h3'].name = 'Hh3'


def inline(text):
    """Markdown inline -> reportlab markup, escaping first."""
    out = html.escape(text)
    out = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', out)
    out = re.sub(r'`(.+?)`', r'<font face="Courier" size="8.7">\1</font>', out)
    out = re.sub(r'\[(.+?)\]\((.+?)\)', r'<link href="\2" color="#005CE6">\1</link>', out)
    return out


def plain(text):
    """Heading text without markup, for the table of contents."""
    return re.sub(r'[*`]', '', text).strip()


class Doc(BaseDocTemplate):
    """Two page templates: a full-bleed cover, then the body."""

    def __init__(self, path, title):
        super().__init__(path, pagesize=A4, title=title, author='Sourceline',
                         leftMargin=MARGIN_L, rightMargin=MARGIN_R,
                         topMargin=MARGIN_T, bottomMargin=MARGIN_B)
        self.doc_title = title
        frame_cover = Frame(0, 0, PAGE_W, PAGE_H, id='cover',
                            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        frame_body = Frame(MARGIN_L, MARGIN_B,
                           PAGE_W - MARGIN_L - MARGIN_R,
                           PAGE_H - MARGIN_T - MARGIN_B, id='body')
        self.addPageTemplates([
            PageTemplate(id='cover', frames=[frame_cover], onPage=self._cover),
            PageTemplate(id='body', frames=[frame_body], onPage=self._body),
        ])

    def _cover(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        # The accent sits just above the title block, which starts ~300pt up.
        canvas.setFillColor(BLUE)
        canvas.rect(MARGIN_L, 332, 78, 4.5, fill=1, stroke=0)
        canvas.restoreState()

    def _body(self, canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(HAIR)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_L, MARGIN_B - 7 * mm, PAGE_W - MARGIN_R, MARGIN_B - 7 * mm)
        canvas.setFont('Helvetica', 7.8)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_L, MARGIN_B - 11.5 * mm, self.doc_title)
        canvas.drawRightString(PAGE_W - MARGIN_R, MARGIN_B - 11.5 * mm, str(doc.page - 1))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        """Record headings as they are laid out, so the contents has real pages."""
        if not isinstance(flowable, Paragraph):
            return
        name = getattr(flowable.style, 'name', '')
        if name not in ('Hpart', 'Hh2', 'Hh3'):
            return
        level = {'Hpart': 0, 'Hh2': 1, 'Hh3': 2}[name]
        text = getattr(flowable, '_toc_text', None) or flowable.getPlainText()
        self.notify('TOCEntry', (level, text, self.page - 1))


def build_toc():
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle('toc0', fontName='Helvetica-Bold', fontSize=10.5, leading=20,
                       textColor=NAVY, spaceBefore=9),
        ParagraphStyle('toc1', fontName='Helvetica', fontSize=9.5, leading=16.5,
                       textColor=BODY, leftIndent=12),
        ParagraphStyle('toc2', fontName='Helvetica', fontSize=8.9, leading=14.5,
                       textColor=MUTED, leftIndent=26),
    ]
    return toc


def image_block(src, caption, width, md_dir):
    path = src if os.path.isabs(src) else os.path.join(md_dir, src)
    if not os.path.exists(path):
        return [Paragraph(f'[missing image: {html.escape(src)}]', S['body'])]
    iw, ih = ImageReader(path).getSize()
    w = min(width, 165 * mm)
    img = Image(path, width=w, height=w * ih / iw)
    img.hAlign = 'LEFT'
    # A hairline keeps a pale screenshot from bleeding into the page.
    shell = Table([[img]], colWidths=[w], hAlign='LEFT')
    shell.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.6, HAIR),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    out = [shell]
    if caption:
        out.append(Paragraph(inline(caption), S['cap']))
    return out


def flush_list(items, ordered, start, story):
    if not items:
        return
    story.append(ListFlowable(
        [ListItem(Paragraph(inline(t), S['li']), leftIndent=15) for t in items],
        bulletType='1' if ordered else 'bullet',
        start=start if ordered else None,
        bulletFontSize=9.5, bulletColor=BLUE, leftIndent=17, bulletOffsetY=-1,
    ))
    story.append(Spacer(1, 8))


def build_table(rows, width):
    header, body = rows[0], rows[1:]
    ncols = len(header)
    if ncols == 2:
        widths = [width * 0.44, width * 0.56]
    elif ncols == 3:
        widths = [width * 0.26, width * 0.30, width * 0.44]
    elif ncols == 4:
        widths = [width * 0.07, width * 0.34, width * 0.21, width * 0.38]
    else:
        widths = [width / ncols] * ncols

    data = [[Paragraph(inline(c), S['th']) for c in header]]
    data += [[Paragraph(inline(c), S['td']) for c in r] for r in body]

    style = [
        ('BACKGROUND', (0, 0), (-1, 0), BAND),
        ('LINEBELOW', (0, 0), (-1, 0), 0.9, NAVY),
        ('LINEBELOW', (0, 1), (-1, -2), 0.4, HAIR),
        ('LINEBELOW', (0, -1), (-1, -1), 0.7, HAIR),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), ZEBRA))

    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle(style))
    return t


def convert(md_path, pdf_path):
    md_dir = os.path.dirname(os.path.abspath(md_path))
    lines = open(md_path, encoding='utf-8').read().split('\n')

    # Title and date come off the top of the document.
    title = 'Document'
    subtitle = ''
    date = ''
    for idx, l in enumerate(lines):
        if l.startswith('# '):
            raw = plain(l[2:])
            title = raw
            if '—' in raw:
                a, b = raw.split('—', 1)
                title, subtitle = a.strip(), b.strip()
            for nxt in lines[idx + 1:idx + 5]:
                if re.match(r'^\d{1,2} \w+ \d{4}$', nxt.strip()):
                    date = nxt.strip()
                    break
            break

    doc = Doc(pdf_path, title if not subtitle else f'{title} — {subtitle}')
    width = doc.width
    story = []

    # --- cover -------------------------------------------------------------
    story.append(Spacer(1, PAGE_H - 300))
    cover_pad = Table(
        [[Paragraph(html.escape(title), S['cover_title'])],
         ([Paragraph(html.escape(subtitle), S['cover_sub'])] if subtitle else [Spacer(1, 0)]),
         [Spacer(1, 16)],
         [Paragraph(html.escape(date), S['cover_meta'])]],
        colWidths=[PAGE_W - 2 * MARGIN_L], hAlign='LEFT')
    cover_pad.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), MARGIN_L),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(cover_pad)
    story.append(NextPageTemplate('body'))
    story.append(PageBreak())

    # --- contents ----------------------------------------------------------
    story.append(Paragraph('Contents', S['toc_h']))
    story.append(build_toc())
    story.append(PageBreak())

    # --- body --------------------------------------------------------------
    items, ordered, start = [], False, 1
    table_rows = []
    skipped_title = False
    i = 0

    def end_list():
        nonlocal items
        flush_list(items, ordered, start, story)
        items = []

    def end_table():
        nonlocal table_rows
        if table_rows:
            story.append(build_table(table_rows, width))
            story.append(Spacer(1, 11))
            table_rows = []

    while i < len(lines):
        line = lines[i].rstrip()

        if line.startswith('|'):
            end_list()
            cells = [c.strip() for c in line.strip('|').split('|')]
            if not all(set(c) <= set('- :') and c for c in cells):
                table_rows.append(cells)
            i += 1
            continue
        end_table()

        if not line.strip():
            end_list()
            i += 1
            continue

        if line.strip() == '---':
            end_list()
            story.append(PageBreak())
            i += 1
            continue

        m_img = re.match(r'^!\[(.*?)\]\((.+?)\)\s*$', line)
        if m_img:
            end_list()
            story.extend(image_block(m_img.group(2), m_img.group(1), width, md_dir))
            i += 1
            continue

        m = re.match(r'^(\d+)\.\s+(.*)$', line)
        if m:
            if not ordered:
                end_list()
                ordered, start = True, int(m.group(1))
            items.append(m.group(2))
            i += 1
            continue

        if line.startswith('- '):
            if ordered:
                end_list()
                ordered = False
            items.append(line[2:])
            i += 1
            continue

        end_list()
        ordered = False

        if line.startswith('### '):
            text = plain(line[4:])
            para = Paragraph(inline(line[4:]), S['h3'])
            para._toc_text = text
            story.append(para)
        elif line.startswith('## '):
            text = plain(line[3:])
            para = Paragraph(inline(line[3:]), S['h2'])
            para._toc_text = text
            story.append(para)
        elif line.startswith('# '):
            if not skipped_title:
                skipped_title = True   # the cover already carries it
                i += 1
                continue
            text = plain(line[2:])
            para = Paragraph(inline(line[2:]), S['part'])
            para._toc_text = text
            story.append(para)
        elif re.match(r'^\d{1,2} \w+ \d{4}$', line.strip()) and not skipped_title:
            pass
        elif line.strip() == date:
            pass
        else:
            story.append(Paragraph(inline(line), S['body']))
        i += 1

    end_list()
    end_table()

    doc.multiBuild(story)
    print(f'wrote {pdf_path}')


if __name__ == '__main__':
    convert(sys.argv[1], sys.argv[2])
