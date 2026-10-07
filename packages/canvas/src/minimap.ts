import { union, type Rect } from './geometry';
import type { CanvasView } from './canvas-view';
import { visibleRect } from './view';

/** Colours of the overview; the defaults are the light ones. */
export interface MinimapPalette {
  background: string;
  border: string;
  elements: string;
  viewport: string;
}

export interface MinimapOptions {
  width?: number;
  height?: number;
}

/**
 * A small overview of the whole model with the visible area marked. Clicking or dragging in it
 * moves the view.
 */
export class Minimap {
  readonly element = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private frame = 0;
  private scale = 1;
  private origin = { x: 0, y: 0 };
  private dragging = false;
  private readonly stops: (() => void)[] = [];
  private readonly width: number;
  private readonly height: number;
  private palette: MinimapPalette = {
    background: '#ffffff',
    border: '#ced4da',
    elements: '#91a7ff',
    viewport: '#e8590c',
  };

  constructor(
    container: HTMLElement,
    private readonly view: CanvasView,
    options: MinimapOptions = {},
  ) {
    this.width = options.width ?? 180;
    this.height = options.height ?? 120;
    const dpr = window.devicePixelRatio || 1;
    this.element.width = Math.round(this.width * dpr);
    this.element.height = Math.round(this.height * dpr);
    this.element.style.cssText = `width:${this.width}px;height:${this.height}px;border-radius:4px;touch-action:none;cursor:pointer;`;
    this.applyColours();
    this.element.setAttribute('data-testid', 'minimap');
    this.ctx = this.element.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    container.append(this.element);
    this.stops.push(view.scene.onChange(() => this.schedule()));
    this.stops.push(view.onViewChange(() => this.schedule()));
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      const r = this.element.getBoundingClientRect();
      this.view.centreOnWorld({
        x: (e.clientX - r.left - this.origin.x) / this.scale,
        y: (e.clientY - r.top - this.origin.y) / this.scale,
      });
    };
    this.element.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.element.setPointerCapture(e.pointerId);
      move(e);
    });
    this.element.addEventListener('pointermove', move);
    this.element.addEventListener('pointerup', () => (this.dragging = false));
    this.schedule();
  }

  private applyColours(): void {
    this.element.style.background = this.palette.background;
    this.element.style.border = `1px solid ${this.palette.border}`;
  }

  /** Follows the page theme. */
  setPalette(palette: Partial<MinimapPalette>): void {
    this.palette = { ...this.palette, ...palette };
    this.applyColours();
    this.schedule();
  }

  private schedule(): void {
    if (this.frame !== 0) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  /** The world area the minimap shows: the model and the viewport. */
  private area(): Rect {
    const visible = visibleRect(
      this.view.view,
      this.view.width,
      this.view.height,
    );
    const model = this.view.scene.bounds();
    return model ? union(model, visible) : visible;
  }

  render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const area = this.area();
    const w = Math.max(1, area.maxX - area.minX);
    const h = Math.max(1, area.maxY - area.minY);
    const pad = 4;
    this.scale = Math.min(
      (this.width - 2 * pad) / w,
      (this.height - 2 * pad) / h,
    );
    this.origin = {
      x: (this.width - w * this.scale) / 2 - area.minX * this.scale,
      y: (this.height - h * this.scale) / 2 - area.minY * this.scale,
    };
    ctx.save();
    ctx.translate(this.origin.x, this.origin.y);
    ctx.scale(this.scale, this.scale);
    ctx.beginPath();
    // Elements under a pixel are still drawn as one pixel so that a dense model stays visible.
    const min = 1 / this.scale;
    for (const e of this.view.scene.elements.values())
      ctx.rect(e.x, e.y, Math.max(e.w, min), Math.max(e.h, min));
    ctx.fillStyle = this.palette.elements;
    ctx.fill();
    const v = visibleRect(this.view.view, this.view.width, this.view.height);
    ctx.strokeStyle = this.palette.viewport;
    ctx.lineWidth = 2 / this.scale;
    ctx.strokeRect(v.minX, v.minY, v.maxX - v.minX, v.maxY - v.minY);
    ctx.restore();
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    for (const stop of this.stops) stop();
    this.element.remove();
  }
}
