import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { loadHarness } from './bundle';
import type { ElementId } from '@metakit-app/core';
import type { CanvasHarness } from './canvas-harness';

const baseTool = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../tools/bpmn-lite/tool.json', import.meta.url),
    ),
    'utf8',
  ),
) as {
  modelTypes: Record<string, { containers?: Record<string, string[]> }>;
};
// The sample lane takes tasks, gateways and end events; a start event is not accepted.
const toolJson = JSON.stringify({
  ...baseTool,
  modelTypes: {
    ...baseTool.modelTypes,
    mt_process: {
      ...baseTool.modelTypes.mt_process,
      containers: { cls_lane: ['cls_task', 'cls_gateway', 'cls_end'] },
    },
  },
});

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
const TASK = 'cls_task';
const START = 'cls_start';
const LANE = 'cls_lane';

async function setup(page: Page) {
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
    w = 120,
    h = 60,
    parent?: string,
  ) =>
    (await call(page, 'exec', {
      type: 'createElement',
      class: cls,
      x,
      y,
      w,
      h,
      ...(parent ? { parent } : {}),
    } as never)) as string;
  const drag = async (
    from: Point,
    to: Point,
    options: { hold?: boolean } = {},
  ) => {
    const a = await call(page, 'client', from);
    const b = await call(page, 'client', to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    if (!options.hold) await page.mouse.up();
  };
  const el = async (id: string) =>
    (await call(page, 'model')).elements[id as ElementId]!;
  return { create, drag, el };
}

test.describe('containers and swimlanes', () => {
  test('dropping a task into a swimlane sets its parent, highlights the lane, and undo restores', async ({
    page,
  }) => {
    const t = await setup(page);
    const lane = await t.create(LANE, 50, 50, 500, 300);
    const task = await t.create(TASK, 600, 400);
    const before = await call(page, 'model');
    const steps = await call(page, 'historyLength');

    // The task's centre goes from (660, 430) to (300, 200), inside the lane.
    await t.drag({ x: 660, y: 430 }, { x: 300, y: 200 }, { hold: true });
    expect(await call(page, 'dropTarget')).toBe(lane);
    await page.mouse.up();
    expect(await call(page, 'dropTarget')).toBe(null);

    const moved = await t.el(task);
    expect(moved.parent).toBe(lane);
    expect(moved).toMatchObject({ x: 240, y: 170 });
    // The child is drawn above its lane.
    expect(moved.pos > (await t.el(lane)).pos).toBe(true);
    expect(await call(page, 'historyLength')).toBe(steps + 1);

    await call(page, 'undo');
    expect(await call(page, 'model')).toEqual(before);
  });

  test('dragging a task out of its swimlane clears the parent', async ({
    page,
  }) => {
    const t = await setup(page);
    const lane = await t.create(LANE, 50, 50, 500, 300);
    const task = await t.create(TASK, 200, 150, 120, 60, lane);
    await t.drag({ x: 260, y: 180 }, { x: 760, y: 580 });
    expect((await t.el(task)).parent).toBeUndefined();
    expect(await t.el(lane)).toMatchObject({ x: 50, y: 50, w: 500, h: 300 });
  });

  test('moving the swimlane moves its children, as one undo step', async ({
    page,
  }) => {
    const t = await setup(page);
    const lane = await t.create(LANE, 50, 50, 500, 300);
    const a = await t.create(TASK, 100, 100, 120, 60, lane);
    const b = await t.create(TASK, 300, 200, 120, 60, lane);
    const other = await t.create(TASK, 700, 100);
    const before = await call(page, 'model');
    const steps = await call(page, 'historyLength');

    // Press on empty lane space so that the lane itself is dragged.
    await t.drag({ x: 480, y: 320 }, { x: 580, y: 370 });
    expect(await t.el(lane)).toMatchObject({ x: 150, y: 100 });
    expect(await t.el(a)).toMatchObject({ x: 200, y: 150, parent: lane });
    expect(await t.el(b)).toMatchObject({ x: 400, y: 250, parent: lane });
    expect(await t.el(other)).toMatchObject({ x: 700, y: 100 });
    expect(await call(page, 'historyLength')).toBe(steps + 1);

    await call(page, 'undo');
    expect(await call(page, 'model')).toEqual(before);
  });

  test('shows the children following the lane while dragging', async ({
    page,
  }) => {
    const t = await setup(page);
    const lane = await t.create(LANE, 50, 50, 500, 300);
    const a = await t.create(TASK, 100, 100, 120, 60, lane);
    await t.drag({ x: 480, y: 320 }, { x: 580, y: 370 }, { hold: true });
    const ids = (await call(page, 'previews')).map((p) => p.id).sort();
    expect(ids).toEqual([lane, a].sort());
    await page.mouse.up();
  });

  test('a selection with a lane and its child moves the child once', async ({
    page,
  }) => {
    const t = await setup(page);
    const lane = await t.create(LANE, 50, 50, 500, 300);
    const a = await t.create(TASK, 100, 100, 120, 60, lane);
    const click = async (p: Point, shift: boolean) => {
      const c = await call(page, 'client', p);
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.click(c.x, c.y);
      if (shift) await page.keyboard.up('Shift');
    };
    await click({ x: 480, y: 320 }, false);
    await click({ x: 150, y: 120 }, true);
    expect((await call(page, 'selection')).elements.sort()).toEqual(
      [lane, a].sort(),
    );
    await t.drag({ x: 150, y: 120 }, { x: 250, y: 170 });
    expect(await t.el(lane)).toMatchObject({ x: 150, y: 100 });
    expect(await t.el(a)).toMatchObject({ x: 200, y: 150, parent: lane });
  });

  test('a drop partly beyond the right edge makes the swimlane grow', async ({
    page,
  }) => {
    const t = await setup(page);
    const lane = await t.create(LANE, 50, 50, 500, 300);
    const task = await t.create(TASK, 700, 400);
    const before = await call(page, 'model');
    // The task lands at x 460..580: its centre (520) is inside the lane, its right edge is not.
    await t.drag({ x: 760, y: 430 }, { x: 520, y: 230 });
    expect(await t.el(task)).toMatchObject({ x: 460, y: 200, parent: lane });
    // Padding 10 beyond the right edge of the child at 580.
    expect(await t.el(lane)).toMatchObject({ x: 50, w: 540, h: 300 });
    await call(page, 'undo');
    expect(await call(page, 'model')).toEqual(before);
  });

  test('a class the swimlane does not accept stays at the top level', async ({
    page,
  }) => {
    const t = await setup(page);
    const lane = await t.create(LANE, 50, 50, 500, 300);
    const start = await t.create(START, 700, 400, 60, 60);
    await t.drag({ x: 730, y: 430 }, { x: 300, y: 200 }, { hold: true });
    expect(await call(page, 'dropTarget')).toBe(null);
    await page.mouse.up();
    expect((await t.el(start)).parent).toBeUndefined();
    expect(await t.el(lane)).toMatchObject({ w: 500, h: 300 });
  });

  test('creating an element from the palette inside a swimlane sets its parent', async ({
    page,
  }) => {
    const t = await setup(page);
    const lane = await t.create(LANE, 50, 50, 500, 300);
    const inside = (await call(page, 'placeAt', TASK, {
      x: 300,
      y: 200,
    })) as string;
    const outside = (await call(page, 'placeAt', TASK, {
      x: 800,
      y: 600,
    })) as string;
    const refused = (await call(page, 'placeAt', START, {
      x: 300,
      y: 200,
    })) as string;
    expect((await t.el(inside)).parent).toBe(lane);
    expect((await t.el(inside)).pos > (await t.el(lane)).pos).toBe(true);
    expect((await t.el(outside)).parent).toBeUndefined();
    expect((await t.el(refused)).parent).toBeUndefined();
  });
});
