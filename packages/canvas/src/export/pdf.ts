import type { Scene } from '../scene';
import { type ExportSelection } from './content';
import { exportSvg } from './svg';

export type PdfPageSize = 'a4' | 'a3' | 'letter' | 'fit';
export type PdfOrientation = 'portrait' | 'landscape' | 'auto';

export interface PdfExportOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  /** Shrink or grow the drawing to fill one page. Off: real size, spread over as many pages as needed. */
  fitToPage: boolean;
  selection?: ExportSelection;
  /** Page margin in points. Default 36 (half an inch). */
  margin?: number;
  /** Background colour of the drawing, or none. */
  background?: string | null;
  title?: string;
  resolveImage?: (src: string) => string | null;
}

/** Page sizes in points, portrait. */
const PAGE_POINTS: Record<Exclude<PdfPageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  letter: [612, 792],
};

/** A CSS pixel is three quarters of a point. */
const POINTS_PER_PIXEL = 0.75;

export interface PdfLayout {
  /** Page size in points, after orientation. */
  page: { width: number; height: number };
  /** Points per drawing pixel. */
  scale: number;
  /** Where the drawing's top-left corner goes on each page, in points. */
  pages: { x: number; y: number }[];
  margin: number;
}

/** Works out the pages for a drawing of the given size in pixels. Pure, so it is tested in Node. */
export function pdfLayout(
  width: number,
  height: number,
  options: Pick<
    PdfExportOptions,
    'pageSize' | 'orientation' | 'fitToPage' | 'margin'
  >,
): PdfLayout {
  const margin = options.margin ?? 36;
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  if (options.pageSize === 'fit') {
    return {
      page: {
        width: w * POINTS_PER_PIXEL + 2 * margin,
        height: h * POINTS_PER_PIXEL + 2 * margin,
      },
      scale: POINTS_PER_PIXEL,
      pages: [{ x: margin, y: margin }],
      margin,
    };
  }
  let [pw, ph] = PAGE_POINTS[options.pageSize];
  const landscape =
    options.orientation === 'landscape' ||
    (options.orientation === 'auto' && w > h);
  if (landscape) [pw, ph] = [ph, pw];
  const printW = pw - 2 * margin;
  const printH = ph - 2 * margin;
  if (options.fitToPage) {
    const scale = Math.min(printW / w, printH / h);
    return {
      page: { width: pw, height: ph },
      scale,
      pages: [
        {
          x: margin + (printW - w * scale) / 2,
          y: margin + (printH - h * scale) / 2,
        },
      ],
      margin,
    };
  }
  const scale = POINTS_PER_PIXEL;
  const cols = Math.max(1, Math.ceil((w * scale) / printW - 1e-9));
  const rows = Math.max(1, Math.ceil((h * scale) / printH - 1e-9));
  const pages: PdfLayout['pages'] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      pages.push({ x: margin - c * printW, y: margin - r * printH });
  return { page: { width: pw, height: ph }, scale, pages, margin };
}

/**
 * A vector PDF of the model (or a selection), made from the SVG export. The libraries are loaded
 * only now, so that they stay out of the main bundle. Needs a DOM, for `DOMParser`.
 */
export async function exportPdf(
  scene: Scene,
  options: PdfExportOptions,
): Promise<Blob> {
  const svgText = exportSvg(scene, {
    padding: 0,
    background: options.background ?? null,
    ...(options.selection ? { selection: options.selection } : {}),
    ...(options.title ? { title: options.title } : {}),
    ...(options.resolveImage ? { resolveImage: options.resolveImage } : {}),
  });
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
  ]);
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml')
    .documentElement as unknown as SVGSVGElement;
  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;
  const layout = pdfLayout(width, height, options);

  const doc = new jsPDF({
    unit: 'pt',
    format: [layout.page.width, layout.page.height],
    orientation: layout.page.width > layout.page.height ? 'l' : 'p',
    compress: true,
  });
  if (options.title) doc.setProperties({ title: options.title });

  // svg2pdf reads computed styles and fonts, which needs the element to be in the document.
  const holder = document.createElement('div');
  holder.style.cssText =
    'position:fixed;left:-100000px;top:0;width:0;height:0;overflow:hidden;visibility:hidden;';
  holder.append(document.importNode(svg, true));
  document.body.append(holder);
  try {
    const attached = holder.firstElementChild as SVGSVGElement;
    for (let i = 0; i < layout.pages.length; i++) {
      if (i > 0) doc.addPage([layout.page.width, layout.page.height]);
      const at = layout.pages[i]!;
      // On a multi-page drawing each page shows one tile; the clip keeps the neighbouring tiles
      // out of the margins.
      doc.saveGraphicsState();
      doc.rect(
        layout.margin,
        layout.margin,
        layout.page.width - 2 * layout.margin,
        layout.page.height - 2 * layout.margin,
        null,
      );
      doc.clip();
      doc.discardPath();
      await svg2pdf(attached, doc, {
        x: at.x,
        y: at.y,
        width: width * layout.scale,
        height: height * layout.scale,
      });
      doc.restoreGraphicsState();
    }
  } finally {
    holder.remove();
  }
  return doc.output('blob');
}
