import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { loadHarness } from './bundle';
import type { CanvasHarness } from './canvas-harness';

const toolJson = readFileSync(
  fileURLToPath(new URL('../../../tools/bpmn-lite/tool.json', import.meta.url)),
  'utf8',
);

type Api = CanvasHarness;
type Args<K extends keyof Api> = Api[K] extends (...a: infer A) => unknown
  ? A
  : never;
type Ret<K extends keyof Api> = Api[K] extends (...a: never[]) => infer R
  ? R
  : never;

function call<K extends keyof Api>(
  page: Page,
  name: K,
  ...args: Args<K>
): Promise<Awaited<Ret<K>>> {
  return page.evaluate(
    ([n, a]) =>
      (
        window as unknown as {
          __canvas: Record<string, (...x: unknown[]) => unknown>;
        }
      ).__canvas[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<Awaited<Ret<K>>>;
}

interface Point {
  x: number;
  y: number;
}

/** A small order process: start, two tasks, a gateway, a closing task far to the right, and flows. */
async function sampleModel(page: Page) {
  await loadHarness(page, './canvas-harness.ts');
  await page.evaluate((json) => {
    (
      window as unknown as { __canvas: { mount(t: unknown): void } }
    ).__canvas.mount(JSON.parse(json));
  }, toolJson);
  const create = async (
    cls: string,
    x: number,
    y: number,
    w: number,
    h: number,
    name: string,
  ) => {
    const id = (await call(page, 'exec', {
      type: 'createElement',
      class: cls,
      x,
      y,
      w,
      h,
      attrs: { att_name: name },
    } as never)) as string;
    return id;
  };
  const connect = async (from: string, to: string, bends: Point[] = []) =>
    (await call(page, 'exec', {
      type: 'createConnector',
      relation: 'rel_flow',
      from,
      to,
      bends,
    } as never)) as string;

  const start = await create('cls_start', 20, 110, 60, 60, 'Start');
  const first = await create(
    'cls_task',
    140,
    110,
    140,
    60,
    'Check <order> & stock',
  );
  const gateway = await create('cls_gateway', 360, 105, 70, 70, 'OK?');
  const ship = await create('cls_task', 520, 40, 140, 60, 'Ship');
  const reject = await create('cls_task', 520, 190, 140, 60, 'Reject');
  const far = await create('cls_task', 2400, 110, 140, 60, 'Archive');
  const flows = [
    await connect(start, first),
    await connect(first, gateway),
    await connect(gateway, ship, [{ x: 395, y: 70 }]),
    await connect(gateway, reject, [{ x: 395, y: 220 }]),
    await connect(ship, far, [
      { x: 590, y: 20 },
      { x: 2470, y: 20 },
    ]),
  ];
  return { start, first, gateway, ship, reject, far, flows };
}

const svgSize = (svg: string) => {
  const m = /<svg [^>]*width="([\d.]+)" height="([\d.]+)"/.exec(svg)!;
  return { w: Number(m[1]), h: Number(m[2]) };
};

const near = (a: number[], b: number[], tolerance = 14) =>
  a.every((v, i) => Math.abs(v - b[i]!) <= tolerance);

test.describe('image export', () => {
  test('the SVG shows what the canvas shows', async ({ page }) => {
    await sampleModel(page);
    // Element fills, and points on the straight flow between the start event and the first task.
    const points: Point[] = [
      { x: 150, y: 120 },
      { x: 150, y: 160 },
      { x: 530, y: 50 },
      { x: 530, y: 240 },
      { x: 110, y: 139 },
      { x: 110, y: 140 },
      { x: 110, y: 141 },
      { x: 900, y: 19 },
      { x: 900, y: 20 },
      { x: 900, y: 21 },
    ];
    const { svg, screen } = await call(page, 'compareSvg', points);
    for (let i = 0; i < points.length; i++)
      expect(
        near(svg[i]!, screen[i]!),
        `point ${JSON.stringify(points[i])} svg ${svg[i]} screen ${screen[i]}`,
      ).toBe(true);
    // The samples are not all empty.
    expect(screen.filter((p) => p[3]! > 0).length).toBeGreaterThanOrEqual(5);
  });

  test('the SVG keeps text as text and escapes it', async ({ page }) => {
    await sampleModel(page);
    const svg = await call(page, 'exportSvg');
    expect(svg).toContain('Check &lt;order&gt; &amp;</text>');
    expect(svg).toContain('>Archive</text>');
    expect(svg).toContain('<path');
  });

  test('PNG at 1x and 2x has the size of the content', async ({ page }) => {
    await sampleModel(page);
    const { w, h } = svgSize(await call(page, 'exportSvg'));
    const one = await call(page, 'exportPng', { scale: 1, transparent: false });
    const two = await call(page, 'exportPng', { scale: 2, transparent: false });
    expect(one.type).toBe('image/png');
    expect(one.width).toBe(Math.ceil(w));
    expect(one.height).toBe(Math.ceil(h));
    expect(two.width).toBe(Math.ceil(w * 2));
    expect(two.height).toBe(Math.ceil(h * 2));
    // A white background by default.
    expect(one.pixels[0]).toEqual([255, 255, 255, 255]);
  });

  test('PNG with transparency has a see-through corner but keeps the drawing', async ({
    page,
  }) => {
    await sampleModel(page);
    // The corner is padding; (150, 120) is inside the first task.
    const png = await call(page, 'exportPng', { scale: 1, transparent: true }, [
      { x: 150, y: 120 },
    ]);
    expect(png.pixels[0]![3]).toBe(0);
    expect(png.pixels[1]![3]).toBeGreaterThan(0);
  });

  test('PNG matches the screen at known points', async ({ page }) => {
    await sampleModel(page);
    const world: Point[] = [
      { x: 150, y: 120 },
      { x: 530, y: 50 },
      { x: 900, y: 20 },
    ];
    const png = await call(
      page,
      'exportPng',
      { scale: 1, transparent: true },
      world,
    );
    for (let i = 0; i < world.length; i++) {
      const screen = await call(page, 'pixel', world[i]!);
      expect(near(png.pixels[i + 1]!, screen), JSON.stringify(world[i])).toBe(
        true,
      );
    }
  });

  test('refuses an image that is too large, in plain words', async ({
    page,
  }) => {
    const ids = await sampleModel(page);
    // 5 000 000 px on a side would never fit a canvas.
    await call(page, 'exec', {
      type: 'move',
      id: ids.far,
      x: 9_000_000,
      y: 110,
    } as never);
    const message = await page.evaluate(async () => {
      try {
        await (
          window as unknown as {
            __canvas: { exportPng(o: object): Promise<unknown> };
          }
        ).__canvas.exportPng({ scale: 1, transparent: true });
        return '';
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(message).toContain('limit is 16384 pixels');
  });

  test('exporting only the selection gives a smaller image', async ({
    page,
  }) => {
    const ids = await sampleModel(page);
    const all = await call(page, 'exportPng', { scale: 1, transparent: true });
    const part = await call(page, 'exportPng', {
      scale: 1,
      transparent: true,
      selection: {
        elements: [ids.first, ids.gateway],
        connectors: [ids.flows[1]!],
      },
    });
    expect(part.width).toBeLessThan(all.width);
    expect(part.height).toBeLessThan(all.height);
    const svg = await call(page, 'exportSvg', {
      selection: { elements: [ids.first], connectors: [] },
    });
    expect(svg).toContain('stock</text>');
    expect(svg).not.toContain('>Archive</text>');
    expect(svg).not.toContain('>Ship</text>');
  });

  test('PDF is vector, starts with %PDF and has the expected pages', async ({
    page,
  }) => {
    await sampleModel(page);
    const fitted = await call(page, 'exportPdf', {
      pageSize: 'a4',
      orientation: 'auto',
      fitToPage: true,
    });
    expect(fitted.head).toBe('%PDF-');
    expect(fitted.type).toBe('application/pdf');
    expect(fitted.pages).toBe(1);

    const fit = await call(page, 'exportPdf', {
      pageSize: 'fit',
      orientation: 'auto',
      fitToPage: false,
    });
    expect(fit.pages).toBe(1);

    // About 2 540 px wide at real size is 1 900 pt: four A4 portrait pages across.
    const tiled = await call(page, 'exportPdf', {
      pageSize: 'a4',
      orientation: 'portrait',
      fitToPage: false,
    });
    expect(tiled.pages).toBe(4);
  });

  test('the PDF libraries are not in the main bundle', async () => {
    const dist = fileURLToPath(new URL('../dist/', import.meta.url));
    test.skip(!existsSync(`${dist}index.html`), 'the app has not been built');
    const html = readFileSync(`${dist}index.html`, 'utf8');
    const files = [
      ...html.matchAll(/(?:src|href)="[^"]*?(assets\/[^"]+\.js)"/g),
    ].map((m) => m[1]!);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files)
      // `putTotalPages` only occurs inside the library; the app's own code names `jsPDF` in a destructuring.
      expect(readFileSync(`${dist}${file}`, 'utf8'), file).not.toContain(
        'putTotalPages',
      );
  });
});
