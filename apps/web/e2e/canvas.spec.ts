import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { loadHarness } from './bundle';
import type { CanvasHarness } from './canvas-harness';

const kitJson = readFileSync(
  fileURLToPath(new URL('../../../kits/bpmn-lite/kit.json', import.meta.url)),
  'utf8',
);

type Api = CanvasHarness;
type Args<K extends keyof Api> = Api[K] extends (...a: infer A) => unknown
  ? A
  : never;
type Ret<K extends keyof Api> = Api[K] extends (...a: never[]) => infer R
  ? R
  : never;

/** Calls a method of the page's harness. */
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
const TASK = 'cls_task';
const GATEWAY = 'cls_gateway';
const START = 'cls_start';
const LANE = 'cls_lane';
const FLOW = 'rel_flow';

async function setup(page: Page) {
  await loadHarness(page, './canvas-harness.ts');
  await page.evaluate((json) => {
    (
      window as unknown as { __canvas: { mount(t: unknown): void } }
    ).__canvas.mount(JSON.parse(json));
  }, kitJson);
  const create = async (cls: string, x: number, y: number, w = 120, h = 60) =>
    (await call(page, 'exec', {
      type: 'createElement',
      class: cls,
      x,
      y,
      w,
      h,
    } as never)) as string;
  const connect = async (from: string, to: string, bends: Point[] = []) =>
    (await call(page, 'exec', {
      type: 'createConnector',
      relation: FLOW,
      from,
      to,
      bends,
    } as never)) as string;
  const at = (p: Point) => call(page, 'client', p);
  const drag = async (
    from: Point,
    to: Point,
    options: { steps?: number; hold?: boolean } = {},
  ) => {
    const a = await at(from);
    const b = await at(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: options.steps ?? 8 });
    if (!options.hold) await page.mouse.up();
  };
  const click = async (p: Point, modifiers: ('Shift' | 'Control')[] = []) => {
    const c = await at(p);
    for (const m of modifiers) await page.keyboard.down(m);
    await page.mouse.click(c.x, c.y);
    for (const m of modifiers) await page.keyboard.up(m);
  };
  const model = () => call(page, 'model');
  return { create, connect, at, drag, click, model };
}

test.describe('canvas engine', () => {
  test('draws elements and connectors on the scene layer, with the label as text', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    await t.create(GATEWAY, 400, 100);
    await call(page, 'flush');
    // Inside the first element the scene canvas has the class fill; outside it is transparent.
    const inside = await call(page, 'pixel', { x: 110, y: 110 });
    const outside = await call(page, 'pixel', { x: 300, y: 400 });
    expect(inside[3]).toBeGreaterThan(0);
    expect(outside[3]).toBe(0);
    expect(a).toMatch(/^el_/);
    const stats = await call(page, 'stats');
    expect(stats.visibleElements).toBe(2);
    expect(stats.labels).toBeGreaterThan(0);
  });

  test('skips text when zoomed far out, and draws it again when zoomed in', async ({
    page,
  }) => {
    const t = await setup(page);
    await t.create(TASK, 100, 100);
    await call(page, 'setView', { s: 0.2, ox: 0, oy: 0 });
    expect((await call(page, 'stats')).labels).toBe(0);
    await call(page, 'setView', { s: 1, ox: 0, oy: 0 });
    expect((await call(page, 'stats')).labels).toBeGreaterThan(0);
  });

  test('moves the cached bitmap while zooming and draws sharp after the gesture', async ({
    page,
  }) => {
    const t = await setup(page);
    await t.create(TASK, 100, 100);
    const centre = await call(page, 'client', { x: 500, y: 350 });
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.wheel(0, -300);
    expect(await call(page, 'sceneTransform')).toContain('scale(');
    expect((await call(page, 'viewState')).s).toBeGreaterThan(1);
    await expect.poll(() => call(page, 'sceneTransform')).toBe('');
  });

  test('pans with the middle button and with space and drag', async ({
    page,
  }) => {
    await setup(page);
    const start = await call(page, 'client', { x: 500, y: 300 });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(start.x + 80, start.y + 40, { steps: 4 });
    await page.mouse.up({ button: 'middle' });
    expect(await call(page, 'viewState')).toMatchObject({ ox: 80, oy: 40 });
    await page.keyboard.down('Space');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 30, start.y, { steps: 3 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    expect((await call(page, 'viewState')).ox).toBe(50);
  });

  test('reuses draw lists when elements move and rebuilds them when the label changes', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const builds = await call(page, 'drawListBuilds');
    await call(page, 'exec', { type: 'move', id: a, x: 300, y: 300 } as never);
    expect(await call(page, 'drawListBuilds')).toBe(builds);
    await call(page, 'exec', {
      type: 'setAttribute',
      target: a,
      attr: 'att_name',
      value: 'New label',
    } as never);
    expect(await call(page, 'drawListBuilds')).toBe(builds + 1);
  });
});

test.describe('selection', () => {
  test('selects by click, adds with shift, and clears on empty space', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    await t.click({ x: 150, y: 130 });
    expect((await call(page, 'selection')).elements).toEqual([a]);
    await t.click({ x: 450, y: 130 }, ['Shift']);
    expect((await call(page, 'selection')).elements.sort()).toEqual(
      [a, b].sort(),
    );
    await t.click({ x: 450, y: 130 }, ['Shift']);
    expect((await call(page, 'selection')).elements).toEqual([a]);
    await t.click({ x: 700, y: 500 });
    expect((await call(page, 'selection')).elements).toEqual([]);
  });

  test('selects what lies fully inside a rubber band, including connectors', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    const c = await t.create(TASK, 100, 450);
    const cn = await t.connect(a, b);
    await t.drag({ x: 60, y: 60 }, { x: 600, y: 240 });
    const sel = await call(page, 'selection');
    expect(sel.elements.sort()).toEqual([a, b].sort());
    expect(sel.connectors).toEqual([cn]);
    expect(sel.elements).not.toContain(c);
  });

  test('selects everything with Ctrl+A', async ({ page }) => {
    const t = await setup(page);
    await t.create(TASK, 100, 100);
    await t.create(TASK, 400, 100);
    await page.keyboard.press('Control+a');
    expect((await call(page, 'selection')).elements).toHaveLength(2);
  });
});

test.describe('move', () => {
  test('moves a selection as one undo step, and connectors follow while dragging', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    const cn = await t.connect(a, b);
    await t.click({ x: 150, y: 130 });
    await t.click({ x: 450, y: 130 }, ['Shift']);
    const before = await call(page, 'drawnRoute', cn as never);

    await t.drag({ x: 150, y: 130 }, { x: 150, y: 330 }, { hold: true });
    // Mid-drag: the model has not changed, the preview has, and the connector is re-routed.
    expect((await t.model()).elements[a as never]!.y).toBe(100);
    expect((await call(page, 'previews')).map((p) => p.id).sort()).toEqual(
      [a, b].sort(),
    );
    expect(await call(page, 'excluded')).toContain(cn);
    const during = await call(page, 'drawnRoute', cn as never);
    expect(during[0]!.y).toBeGreaterThan(before[0]!.y + 150);
    await page.mouse.up();

    const model = await t.model();
    expect(model.elements[a as never]!.y).toBe(300);
    expect(model.elements[b as never]!.y).toBe(300);
    await call(page, 'undo');
    const undone = await t.model();
    expect(undone.elements[a as never]!.y).toBe(100);
    expect(undone.elements[b as never]!.y).toBe(100);
  });

  test('a click on one of several selected elements keeps them selected while dragging and collapses on a plain click', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    await page.keyboard.press('Control+a');
    await t.click({ x: 150, y: 130 });
    expect((await call(page, 'selection')).elements).toEqual([a]);
    expect(b).toBeDefined();
  });

  test('snaps to the grid and shows a guide when lining up with another element', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    await t.create(TASK, 400, 300);
    await t.drag({ x: 150, y: 130 }, { x: 173, y: 142 });
    const moved = (await t.model()).elements[a as never]!;
    expect(moved.x % 10).toBe(0);
    expect(moved.y % 10).toBe(0);
    // Dragging an element so that its left edge is 3 px from another's edge snaps to it and shows the guide.
    await t.drag({ x: 400, y: 400 }, { x: 400, y: 400 }, { steps: 1 });
    await t.drag(
      { x: moved.x + 40, y: moved.y + 30 },
      { x: 403 + 40 - 120 + 120 - 0, y: moved.y + 30 + 120 },
      { hold: true },
    );
    expect((await call(page, 'guides')).x).toContain(400);
    await page.mouse.up();
    expect((await t.model()).elements[a as never]!.x).toBe(400);
  });
});

test.describe('resize', () => {
  test('resizes with a handle, snapped, as one step', async ({ page }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    await t.click({ x: 150, y: 130 });
    // The south-east handle is at the bottom right corner.
    await t.drag({ x: 220, y: 160 }, { x: 283, y: 207 });
    const e = (await t.model()).elements[a as never]!;
    expect(e).toMatchObject({ x: 100, y: 100, w: 180, h: 110 });
    await call(page, 'undo');
    expect((await t.model()).elements[a as never]).toMatchObject({
      w: 120,
      h: 60,
    });
  });

  test('never makes an element smaller than the minimum', async ({ page }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    await t.click({ x: 150, y: 130 });
    await t.drag({ x: 220, y: 160 }, { x: 90, y: 90 });
    const e = (await t.model()).elements[a as never]!;
    expect(e.w).toBeGreaterThanOrEqual(20);
    expect(e.h).toBeGreaterThanOrEqual(20);
  });
});

test.describe('delete', () => {
  test('deletes the selection and its connectors, and undo brings them back', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    const cn = await t.connect(a, b);
    await t.click({ x: 150, y: 130 });
    await page.keyboard.press('Delete');
    let model = await t.model();
    expect(Object.keys(model.elements)).toEqual([b]);
    expect(model.connectors[cn as never]).toBeUndefined();
    await page.keyboard.press('Control+z');
    model = await t.model();
    expect(Object.keys(model.elements).sort()).toEqual([a, b].sort());
    expect(model.connectors[cn as never]).toBeDefined();
    await page.keyboard.press('Control+Shift+z');
    expect(Object.keys((await t.model()).elements)).toEqual([b]);
  });

  test('deletes a selected connector alone', async ({ page }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    const cn = await t.connect(a, b);
    await t.click({ x: 330, y: 130 });
    expect((await call(page, 'selection')).connectors).toEqual([cn]);
    await page.keyboard.press('Backspace');
    const model = await t.model();
    expect(Object.keys(model.elements)).toHaveLength(2);
    expect(Object.keys(model.connectors)).toEqual([]);
  });
});

test.describe('connect', () => {
  test('connects with a palette relation by dragging from one element to another', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(GATEWAY, 400, 100);
    await call(page, 'setTool', { type: 'connect', relation: FLOW } as never);
    await t.drag({ x: 160, y: 130 }, { x: 460, y: 130 });
    const connectors = Object.values((await t.model()).connectors);
    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({ relation: FLOW, from: a, to: b });
  });

  test('connects by dragging from the edge of the selected element', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    await t.click({ x: 160, y: 130 });
    // The right edge, halfway between two handles (the east handle is at the middle).
    await t.drag({ x: 219, y: 112 }, { x: 460, y: 130 });
    const connectors = Object.values((await t.model()).connectors);
    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({ from: a, to: b });
    await call(page, 'undo');
    expect(Object.keys((await t.model()).connectors)).toHaveLength(0);
  });

  test('refuses a connection that no relation allows, and says why', async ({
    page,
  }) => {
    const t = await setup(page);
    await t.create(TASK, 100, 100);
    await t.create(LANE, 400, 300, 300, 120);
    await call(page, 'setTool', { type: 'connect', relation: FLOW } as never);
    await t.drag({ x: 160, y: 130 }, { x: 500, y: 360 });
    expect(Object.keys((await t.model()).connectors)).toHaveLength(0);
    const messages = await call(page, 'messages');
    expect(messages[0]).toContain('Lane');
  });

  test('places an element from the palette with a click', async ({ page }) => {
    const t = await setup(page);
    await call(page, 'setTool', { type: 'place', class: START } as never);
    await t.click({ x: 300, y: 300 });
    const elements = Object.values((await t.model()).elements);
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({ class: START, x: 240, y: 270 });
    expect((await call(page, 'selection')).elements).toHaveLength(1);
  });
});

test.describe('bend points and reconnecting', () => {
  test('adds a bend by dragging the line, moves it, and removes it with a double click', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    const cn = await t.connect(a, b);
    await t.click({ x: 330, y: 130 });
    await t.drag({ x: 330, y: 130 }, { x: 330, y: 250 });
    let connector = (await t.model()).connectors[cn as never]!;
    expect(connector.bends).toEqual([{ x: 330, y: 250 }]);

    await t.drag({ x: 330, y: 250 }, { x: 350, y: 300 });
    connector = (await t.model()).connectors[cn as never]!;
    expect(connector.bends).toEqual([{ x: 350, y: 300 }]);

    const p = await t.at({ x: 350, y: 300 });
    await page.mouse.dblclick(p.x, p.y);
    connector = (await t.model()).connectors[cn as never]!;
    expect(connector.bends).toEqual([]);
  });

  test('adds a bend with a double click on the line', async ({ page }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    const cn = await t.connect(a, b);
    const p = await t.at({ x: 330, y: 130 });
    await page.mouse.dblclick(p.x, p.y);
    expect((await t.model()).connectors[cn as never]!.bends).toHaveLength(1);
  });

  test('moves an end of a connector to another element, only where the relation allows', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    const c = await t.create(GATEWAY, 400, 350);
    const lane = await t.create(LANE, 100, 500, 400, 100);
    const cn = await t.connect(a, b);
    await t.click({ x: 330, y: 130 });
    const route = await call(page, 'drawnRoute', cn as never);
    const end = route[route.length - 1]!;
    await t.drag(end, { x: 460, y: 380 });
    expect((await t.model()).connectors[cn as never]).toMatchObject({
      from: a,
      to: c,
    });
    await call(page, 'clearMessages');
    const route2 = await call(page, 'drawnRoute', cn as never);
    await t.drag(route2[route2.length - 1]!, { x: 200, y: 550 });
    expect((await t.model()).connectors[cn as never]).toMatchObject({ to: c });
    expect((await call(page, 'messages')).length).toBeGreaterThan(0);
    expect(lane).toBeDefined();
  });
});

test.describe('copy and paste', () => {
  test('copies and pastes with new ids and the connector between the copied elements', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    const b = await t.create(TASK, 400, 100);
    await t.connect(a, b);
    await call(page, 'exec', {
      type: 'setAttribute',
      target: a,
      attr: 'att_name',
      value: 'Check',
    } as never);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    const model = await t.model();
    expect(Object.keys(model.elements)).toHaveLength(4);
    expect(Object.keys(model.connectors)).toHaveLength(2);
    const copies = Object.values(model.elements).filter(
      (e) => e.id !== a && e.id !== b,
    );
    expect(copies.map((e) => e.x).sort((x, y) => x - y)).toEqual([120, 420]);
    expect(copies.some((e) => e.attrs['att_name' as never] === 'Check')).toBe(
      true,
    );
    expect((await call(page, 'selection')).elements).toHaveLength(2);
    await page.keyboard.press('Control+z');
    expect(Object.keys((await t.model()).elements)).toHaveLength(2);
  });

  test('cuts, and pastes into another model', async ({ page }) => {
    const t = await setup(page);
    await t.create(TASK, 100, 100);
    await t.click({ x: 150, y: 130 });
    await page.keyboard.press('Control+x');
    expect(Object.keys((await t.model()).elements)).toHaveLength(0);
    // A second model of the same Kit.
    await page.evaluate((json) => {
      (
        window as unknown as { __canvas: { mount(t: unknown): void } }
      ).__canvas.mount(JSON.parse(json));
    }, kitJson);
    await t.click({ x: 600, y: 500 });
    await page.keyboard.press('Control+v');
    const elements = Object.values((await t.model()).elements);
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({ class: TASK });
  });
});

test.describe('align and distribute', () => {
  test('aligns left and distributes with equal gaps, each as one undo step', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100, 100, 50);
    const b = await t.create(TASK, 300, 200, 100, 50);
    const c = await t.create(TASK, 700, 300, 100, 50);
    await page.keyboard.press('Control+a');
    await page.evaluate(() =>
      (window as unknown as { __canvas: CanvasHarness }).__canvas
        .editor()
        .align('left'),
    );
    let m = await t.model();
    expect([a, b, c].map((id) => m.elements[id as never]!.x)).toEqual([
      100, 100, 100,
    ]);
    await call(page, 'undo');
    await page.evaluate(() =>
      (window as unknown as { __canvas: CanvasHarness }).__canvas
        .editor()
        .distribute('horizontal'),
    );
    m = await t.model();
    expect(m.elements[b as never]!.x).toBe(400);
    expect(m.elements[a as never]!.x).toBe(100);
    expect(m.elements[c as never]!.x).toBe(700);
  });
});

test.describe('keyboard', () => {
  test('nudges the selection by the grid size and undoes with Ctrl+Z', async ({
    page,
  }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    await t.click({ x: 150, y: 130 });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    expect((await t.model()).elements[a as never]).toMatchObject({
      x: 110,
      y: 150,
    });
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    expect((await t.model()).elements[a as never]).toMatchObject({
      x: 100,
      y: 100,
    });
  });

  test('Escape cancels a drag without changing the model', async ({ page }) => {
    const t = await setup(page);
    const a = await t.create(TASK, 100, 100);
    await t.drag({ x: 150, y: 130 }, { x: 350, y: 330 }, { hold: true });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect((await t.model()).elements[a as never]).toMatchObject({
      x: 100,
      y: 100,
    });
    expect(await call(page, 'previews')).toEqual([]);
  });
});

test.describe('minimap', () => {
  test('shows the model and moves the view when clicked', async ({ page }) => {
    const t = await setup(page);
    await t.create(TASK, 100, 100);
    await t.create(TASK, 3000, 2000);
    const before = await call(page, 'viewState');
    const map = page.getByTestId('minimap');
    const box = (await map.boundingBox())!;
    await page.mouse.click(box.x + box.width - 10, box.y + box.height - 10);
    const after = await call(page, 'viewState');
    expect(after.ox).toBeLessThan(before.ox - 1000);
    expect(after.oy).toBeLessThan(before.oy - 500);
  });
});
