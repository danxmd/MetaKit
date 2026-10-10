import {
  DEFAULT_ELEMENT_SIZE,
  effectiveAttributes,
  effectiveRelationAttributes,
  MODEL_FORMAT_VERSION,
  type AttributeDef,
  type ClassId,
  type ConnectorId,
  type ElementId,
  type Json,
  type Model,
  type ModelTypeId,
  type RelationId,
  type Kit,
} from '@metakit-app/core';
import { paintConnectors, paintOps, type LabelTheme } from './paint';
import { Scene } from './scene';

/** What a small drawing shows: one class as an object, or one relation class as a short line. */
export type PreviewTarget = { class: ClassId } | { relation: RelationId };

export interface PreviewOptions {
  /** CSS pixels. */
  width: number;
  height: number;
  /** Colours for connector labels left at their defaults; set it on a dark surface. */
  labelTheme?: LabelTheme;
  /** Draw text in shapes and labels. Off for thumbnails, where it would be a smear. */
  text?: boolean;
  /** Space around the drawing, CSS pixels. */
  padding?: number;
}

const PREVIEW_ID = 'preview';

function defaultValues(
  attributes: readonly AttributeDef[],
): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const a of attributes)
    if ('default' in a && a.default !== undefined)
      out[a.id] = a.default as Json;
  return out;
}

/**
 * A throwaway model holding one object of the class (with its default values), or two tiny
 * objects joined by one connector of the relation class. It exists only to be compiled and drawn.
 */
function previewModel(kit: Kit, target: PreviewTarget): Model {
  const manifest = {
    id: 'mdl_preview',
    name: 'Preview',
    kit: kit.manifest.id,
    kitVersion: kit.manifest.version,
    modelType: Object.keys(kit.modelTypes)[0] as ModelTypeId,
  } as Model['manifest'];
  const model: Model = {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest,
    attrs: {},
    elements: {},
    connectors: {},
  };
  if ('class' in target) {
    const cls = kit.classes[target.class];
    const size =
      cls?.kind === 'node'
        ? DEFAULT_ELEMENT_SIZE
        : { w: DEFAULT_ELEMENT_SIZE.w * 1.5, h: DEFAULT_ELEMENT_SIZE.h * 1.6 };
    const id = `el_${PREVIEW_ID}` as ElementId;
    model.elements[id] = {
      id,
      class: target.class,
      x: 0,
      y: 0,
      w: size.w,
      h: size.h,
      attrs: defaultValues(effectiveAttributes(kit, target.class)),
      pos: 'a',
    };
    return model;
  }
  // The ends are 2 by 2 units so that the line is all there is to see.
  const a = `el_${PREVIEW_ID}a` as ElementId;
  const b = `el_${PREVIEW_ID}b` as ElementId;
  const end = (id: ElementId, x: number) => ({
    id,
    class: 'cls_preview' as ClassId,
    x,
    y: 0,
    w: 2,
    h: 2,
    attrs: {},
    pos: id === a ? 'a' : 'b',
  });
  model.elements[a] = end(a, 0);
  model.elements[b] = end(b, 140);
  const cn = `cn_${PREVIEW_ID}` as ConnectorId;
  model.connectors[cn] = {
    id: cn,
    relation: target.relation,
    from: a,
    to: b,
    bends: [],
    attrs: defaultValues(effectiveRelationAttributes(kit, target.relation)),
    pos: 'a',
  };
  return model;
}

/**
 * Draws a class or relation class at small size with the same compiler and painter as the
 * canvas, using the default attribute values. Safe to call again on the same canvas.
 */
export function drawPreview(
  canvas: HTMLCanvasElement,
  kit: Kit,
  target: PreviewTarget,
  options: PreviewOptions,
): void {
  const { width, height } = options;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let scene: Scene;
  try {
    scene = new Scene(previewModel(kit, target), kit);
  } catch {
    // A Kit that does not compile has nothing to show yet; the card still has the text.
    return;
  }
  const pad = options.padding ?? 3;
  const text = options.text ?? true;
  const textPx = text ? 3 : 1e6;
  const images = { get: () => null };

  if ('class' in target) {
    const item = scene.elements.get(`el_${PREVIEW_ID}` as ElementId);
    if (item) {
      const k = Math.min(
        (width - 2 * pad) / item.w,
        (height - 2 * pad) / item.h,
        1.5,
      );
      ctx.setTransform(
        dpr * k,
        0,
        0,
        dpr * k,
        dpr * (width / 2 - (item.w * k) / 2),
        dpr * (height / 2 - (item.h * k) / 2),
      );
      paintOps(ctx, item.compiled.compiled.ops, {
        scale: k,
        minTextPx: textPx,
        images,
      });
    }
  } else {
    const item = scene.connectors.get(`cn_${PREVIEW_ID}` as ConnectorId);
    if (item && item.route.length >= 2) {
      const xs = item.route.map((p) => p.x);
      const ys = item.route.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
      // Room at the ends for the markers.
      const reach = Math.max(
        item.look.start?.size ?? 0,
        item.look.end?.size ?? 0,
      );
      const span = maxX - minX + 2 * reach;
      const k = Math.min((width - 2 * pad) / span, 2);
      ctx.setTransform(
        dpr * k,
        0,
        0,
        dpr * k,
        dpr * (width / 2 - ((minX + maxX) / 2) * k),
        dpr * (height / 2 - midY * k),
      );
      paintConnectors(ctx, [{ route: item.route, look: item.look }], {
        scale: k,
        minTextPx: textPx,
        minArrowPx: 0,
        ...(options.labelTheme ? { labelTheme: options.labelTheme } : {}),
      });
    }
  }
  scene.destroy();
}
