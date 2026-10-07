import { expect, test } from '@playwright/test';
import type { NodeShape } from '@metakit-app/core';
import { STARTER_SHAPES } from '@metakit-app/shapes';
import { loadHarness } from './bundle';
import type { ShapesHarness } from './shapes-harness';

/** The task shape from the plan, as written there (without images, which need assets). */
const PLAN_TASK = {
  id: 'shp_task',
  kind: 'node',
  size: {
    width: 140,
    height: 70,
    resizable: true,
    minWidth: 80,
    minHeight: 40,
  },
  outline: 'rect',
  let: {
    accent:
      "= Priority == 'High' ? '#D93025' : Priority == 'Medium' ? '#F29900' : '#5F6368'",
  },
  parts: [
    {
      type: 'rect',
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      radius: 10,
      fill: '#FFFFFF',
      stroke: '= accent',
      strokeWidth: 2,
    },
    {
      type: 'rect',
      x: 0,
      y: 0,
      width: 6,
      height: '100%',
      radius: 3,
      fill: '= accent',
    },
    {
      type: 'text',
      x: 14,
      y: 8,
      width: '100% - 28',
      height: '100% - 26',
      text: '= Name',
      wrap: true,
      fit: 'shrink',
      align: 'center',
      valign: 'middle',
      font: { size: 13, weight: 600 },
    },
    {
      type: 'text',
      x: 14,
      y: '100% - 18',
      width: '100% - 28',
      height: 14,
      text: "= Effort ? Effort + ' h' : ''",
      align: 'right',
      font: { size: 10 },
      fill: '#5F6368',
    },
  ],
} as unknown as NodeShape;

async function render(
  page: import('@playwright/test').Page,
  shape: NodeShape,
  w: number,
  h: number,
  values: Record<string, unknown>,
  points: [number, number][],
) {
  return page.evaluate(
    ([s, width, height, v, p]) =>
      (window as unknown as { __shapes: ShapesHarness }).__shapes.render(
        s as NodeShape,
        width as number,
        height as number,
        v as never,
        p as [number, number][],
      ),
    [shape, w, h, values, points] as const,
  );
}

test.beforeEach(async ({ page }) => {
  await loadHarness(page, './shapes-harness.ts');
});

// The pixels checked are away from text, so the result does not depend on the machine's fonts.
for (const [w, h] of [
  [140, 70],
  [220, 110],
  [90, 44],
] as const) {
  test(`the plan's task shape draws correctly at ${w} x ${h}`, async ({
    page,
  }, info) => {
    const high = await render(
      page,
      PLAN_TASK,
      w,
      h,
      { Name: 'Check order', Priority: 'High', Effort: 3 },
      [
        [3, Math.floor(h / 2)], // accent bar
        [Math.floor(w / 2), 0], // top border
        [w - 4, Math.floor(h / 2)], // inside, white
        [0, 0], // outside the rounded corner
      ],
    );
    expect(high.messages).toEqual([]);
    expect(high.pixels[0]).toBe('#d93025ff');
    expect(high.pixels[1]).toBe('#d93025ff');
    expect(high.pixels[2]).toBe('#ffffffff');
    // The stroke is centred on the edge, so the corner pixel may be faintly touched.
    expect(parseInt(high.pixels[3]!.slice(7), 16)).toBeLessThan(0x40);
    await info.attach(`task-${w}x${h}-high.png`, {
      body: Buffer.from(high.png.split(',')[1]!, 'base64'),
      contentType: 'image/png',
    });

    const low = await render(
      page,
      PLAN_TASK,
      w,
      h,
      { Name: 'Check order', Priority: 'Low', Effort: 3 },
      [[3, Math.floor(h / 2)]],
    );
    expect(low.pixels[0]).toBe('#5f6368ff');
  });
}

test('the gateway diamond is drawn inside its box and transparent in the corners', async ({
  page,
}) => {
  const shape = STARTER_SHAPES.shp_starter_gateway as NodeShape;
  for (const size of [40, 70, 140]) {
    const mid = Math.floor(size / 2);
    const r = await render(
      page,
      shape,
      size,
      size,
      { $label: '', $fill: '#eef4ff' },
      [
        [mid, 6], // inside near the top tip
        [2, 2], // corner
        [size - 3, size - 3], // corner
        [mid, mid + Math.floor(size / 4)], // inside
      ],
    );
    expect(r.pixels[0]).toBe('#eef4ffff');
    expect(r.pixels[1]).toMatch(/00$/);
    expect(r.pixels[2]).toMatch(/00$/);
    expect(r.pixels[3]).toBe('#eef4ffff');
  }
});
