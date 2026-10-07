import { expect, test, type Page } from '@playwright/test';

interface Hooks {
  scene: {
    nodes: { x: number; y: number; w: number; h: number }[];
    routes: Float64Array;
    adjacency: number[][];
    connectors: { from: number; to: number }[];
  };
  selection: { nodes: Set<number>; connectors: Set<number> };
  renderer: { view: { s: number }; sceneCanvas: HTMLCanvasElement };
  toClient(x: number, y: number): { x: number; y: number };
  zoomTo(s: number): void;
  isSettled(): boolean;
}

// Small model: the checks are about behaviour, not speed.
async function open(page: Page) {
  await page.goto('/?nodes=400&connectors=560');
  await page.waitForFunction(() => '__cv' in window);
  await page.evaluate(() =>
    (window as never as { __cv: Hooks }).__cv.zoomTo(1),
  );
  await page.waitForFunction(() =>
    (window as never as { __cv: Hooks }).__cv.isSettled(),
  );
}

/** Screen position of a node's centre. */
const centreOf = (page: Page, id: number) =>
  page.evaluate((i) => {
    const app = (window as never as { __cv: Hooks }).__cv;
    const n = app.scene.nodes[i]!;
    const p = app.toClient(n.x + n.w / 2, n.y + n.h / 2);
    return { x: p.x, y: p.y, nx: n.x, ny: n.y };
  }, id);

/** Picks a node that is on screen at 100% so the mouse can reach it. */
const visibleNode = (page: Page) =>
  page.evaluate(() => {
    const app = (window as never as { __cv: Hooks }).__cv;
    const found = app.scene.nodes.findIndex((n, i) => {
      const p = app.toClient(n.x + n.w / 2, n.y + n.h / 2);
      return (
        p.x > 250 &&
        p.x < 1000 &&
        p.y > 200 &&
        p.y < 650 &&
        app.scene.adjacency[i]!.length > 0
      );
    });
    return found;
  });

test('click selects a node', async ({ page }) => {
  await open(page);
  const id = await visibleNode(page);
  expect(id).toBeGreaterThanOrEqual(0);
  const p = await centreOf(page, id);
  await page.mouse.click(p.x, p.y);
  expect(
    await page.evaluate(() => [
      ...(window as never as { __cv: Hooks }).__cv.selection.nodes,
    ]),
  ).toEqual([id]);
  await page.mouse.click(5, 790);
  expect(
    await page.evaluate(
      () => (window as never as { __cv: Hooks }).__cv.selection.nodes.size,
    ),
  ).toBe(0);
});

test('rubber band selects the nodes inside it', async ({ page }) => {
  await open(page);
  await page.mouse.move(300, 250);
  await page.mouse.down();
  await page.mouse.move(700, 500, { steps: 5 });
  await page.mouse.up();
  const selected = await page.evaluate(
    () => (window as never as { __cv: Hooks }).__cv.selection.nodes.size,
  );
  expect(selected).toBeGreaterThan(2);
});

test('dragging moves the node and its connectors follow', async ({ page }) => {
  await open(page);
  const id = await visibleNode(page);
  const before = await centreOf(page, id);
  await page.mouse.move(before.x, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 90, before.y + 40, { steps: 6 });
  await page.mouse.up();
  const after = await centreOf(page, id);
  expect(after.nx - before.nx).toBeCloseTo(90, 0);
  expect(after.ny - before.ny).toBeCloseTo(40, 0);
  // Every connector of the node still starts or ends on its edge.
  const attached = await page.evaluate((i) => {
    const app = (window as never as { __cv: Hooks }).__cv;
    const n = app.scene.nodes[i]!;
    return app.scene.adjacency[i]!.every((c) => {
      const o = c * 8;
      const connector = app.scene.connectors[c]!;
      const [x, y] =
        connector.from === i
          ? [app.scene.routes[o]!, app.scene.routes[o + 1]!]
          : [app.scene.routes[o + 6]!, app.scene.routes[o + 7]!];
      return (
        x >= n.x - 1 && x <= n.x + n.w + 1 && y >= n.y - 1 && y <= n.y + n.h + 1
      );
    });
  }, id);
  expect(attached).toBe(true);
});

test('wheel zooms about the cursor and the scene re-renders sharp afterwards', async ({
  page,
}) => {
  await open(page);
  const before = await page.evaluate(
    () => (window as never as { __cv: Hooks }).__cv.renderer.view.s,
  );
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -300);
  const during = await page.evaluate(
    () =>
      (window as never as { __cv: Hooks }).__cv.renderer.sceneCanvas.style
        .transform,
  );
  expect(during).toContain('scale');
  await page.waitForFunction(() =>
    (window as never as { __cv: Hooks }).__cv.isSettled(),
  );
  const after = await page.evaluate(
    () => (window as never as { __cv: Hooks }).__cv.renderer.view.s,
  );
  expect(after).toBeGreaterThan(before);
  expect(
    await page.evaluate(
      () =>
        (window as never as { __cv: Hooks }).__cv.renderer.sceneCanvas.style
          .transform,
    ),
  ).toBe('');
});

test('middle-button drag pans the view', async ({ page }) => {
  await open(page);
  const n = await visibleNode(page);
  const before = await centreOf(page, n);
  await page.mouse.move(200, 200);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(260, 240, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  const after = await centreOf(page, n);
  expect(after.x - before.x).toBeCloseTo(60, 0);
  expect(after.y - before.y).toBeCloseTo(40, 0);
});

test('the benchmark runner completes on a small model', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?nodes=300&connectors=400&bench&frames=60');
  await page.waitForFunction(() => '__runBench' in window);
  const rows = await page.evaluate(async () => {
    const report = await (
      window as never as {
        __runBench: () => Promise<{
          rows: { scenario: string; frames: number }[];
        }>;
      }
    ).__runBench();
    return report.rows;
  });
  expect(rows.length).toBe(10);
  for (const row of rows) expect(row.frames).toBeGreaterThan(50);
});
