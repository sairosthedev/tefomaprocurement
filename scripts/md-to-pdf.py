"""Render a Markdown file to PDF with reportlab.

Handles the subset this document uses: headings, paragraphs, bullet lists,
ordered lists, pipe tables, inline bold and inline code. Deliberately small —
it is here so the PDF can be regenerated from the Markdown, not to be a
general-purpose converter.
"""
import html
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable, ListItem, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

INK = colors.HexColor('#111827')
MUTED = colors.HexColor('#6b7280')
RULE = colors.HexColor('#d1d5db')
HEAD_BG = colors.HexColor('#f3f4f6')
ACCENT = colors.HexColor('#005CE6')

base = getSampleStyleSheet()
S = {
    'h1': ParagraphStyle('h1', parent=base['Title'], fontName='Helvetica-Bold',
                         fontSize=22, leading=27, textColor=INK, alignment=TA_LEFT,
                         spaceAfter=2),
    'date': ParagraphStyle('date', parent=base['Normal'], fontName='Helvetica',
                           fontSize=9.5, textColor=MUTED, spaceAfter=14),
    'h2': ParagraphStyle('h2', parent=base['Heading2'], fontName='Helvetica-Bold',
                         fontSize=14.5, leading=19, textColor=INK,
                         spaceBefore=18, spaceAfter=7),
    'h3': ParagraphStyle('h3', parent=base['Heading3'], fontName='Helvetica-Bold',
                         fontSize=11.5, leading=15, textColor=ACCENT,
                         spaceBefore=12, spaceAfter=5),
    'p': ParagraphStyle('p', parent=base['BodyText'], fontName='Helvetica',
                        fontSize=9.8, leading=14.5, textColor=INK, spaceAfter=7),
    'li': ParagraphStyle('li', parent=base['BodyText'], fontName='Helvetica',
                         fontSize=9.8, leading=14, textColor=INK, spaceAfter=3),
    'th': ParagraphStyle('th', parent=base['BodyText'], fontName='Helvetica-Bold',
                         fontSize=8.8, leading=12, textColor=INK),
    'td': ParagraphStyle('td', parent=base['BodyText'], fontName='Helvetica',
                         fontSize=8.8, leading=12, textColor=INK),
}


def inline(text):
    """Markdown inline -> reportlab markup. Escape first, then re-add tags."""
    out = html.escape(text)
    out = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', out)
    out = re.sub(r'`(.+?)`', r'<font face="Courier" size="8.8">\1</font>', out)
    return out


def flush_list(items, ordered, start, story):
    if not items:
        return
    story.append(ListFlowable(
        [ListItem(Paragraph(inline(t), S['li']), leftIndent=14) for t in items],
        bulletType='1' if ordered else 'bullet',
        start=start if ordered else None,
        bulletFontSize=9.8, leftIndent=16, bulletOffsetY=-1,
    ))
    story.append(Spacer(1, 7))


def build_table(rows, width):
    header, body = rows[0], rows[1:]
    ncols = len(header)
    # Give the first column less room when a table is mostly explanatory text.
    if ncols == 2:
        widths = [width * 0.42, width * 0.58]
    elif ncols == 3:
        widths = [width * 0.24, width * 0.33, width * 0.43]
    else:
        widths = [width / ncols] * ncols

    data = [[Paragraph(inline(c), S['th']) for c in header]]
    data += [[Paragraph(inline(c), S['td']) for c in r] for r in body]

    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEAD_BG),
        ('LINEBELOW', (0, 0), (-1, 0), 0.7, RULE),
        ('GRID', (0, 0), (-1, -1), 0.3, RULE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def convert(md_path, pdf_path):
    lines = open(md_path, encoding='utf-8').read().split('\n')
    doc = SimpleDocTemplate(
        pdf_path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=16 * mm,
        title='Sourceline QA Test Pack', author='Sourceline',
    )
    width = doc.width
    story = []

    items, ordered, start = [], False, 1
    table_rows = []
    i = 0

    def end_list():
        nonlocal items
        flush_list(items, ordered, start, story)
        items = []

    def end_table():
        nonlocal table_rows
        if table_rows:
            story.append(build_table(table_rows, width))
            story.append(Spacer(1, 9))
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
            story.append(Paragraph(inline(line[4:]), S['h3']))
        elif line.startswith('## '):
            story.append(Paragraph(inline(line[3:]), S['h2']))
        elif line.startswith('# '):
            story.append(Paragraph(inline(line[2:]), S['h1']))
        elif re.match(r'^\d{1,2} \w+ \d{4}$', line.strip()):
            story.append(Paragraph(line.strip(), S['date']))
        else:
            story.append(Paragraph(inline(line), S['p']))
        i += 1

    end_list()
    end_table()
    doc.build(story)
    print(f'wrote {pdf_path}')


if __name__ == '__main__':
    convert(sys.argv[1], sys.argv[2])
