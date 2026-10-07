import {
  deepEqual,
  type Json,
  type NodeShape,
  type ShapeDef,
  type ShapeId,
} from '@metakit-app/core';
import type { Scope, Value } from '@metakit-app/formula';
import { compileNode } from './compile';
import type { Compiled } from './ops';

export interface CachedCompile {
  shape: NodeShape;
  compiled: Compiled;
  /** Values of the names the shape read, in the order of `compiled.reads`. */
  seen: (Value | undefined)[];
}

/** Counts builds, so tests and the benchmark can see whether the cache works. */
export class CompileCache {
  builds = 0;

  /**
   * The compiled list for these inputs: `current` when the shape, size and every value it read
   * are unchanged, otherwise a new one.
   */
  get(
    current: CachedCompile | undefined,
    shape: NodeShape,
    w: number,
    h: number,
    scope: Scope,
    shapes: (id: ShapeId) => ShapeDef | undefined,
  ): CachedCompile {
    if (current && this.fresh(current, shape, w, h, scope, shapes))
      return current;
    this.builds += 1;
    const compiled = compileNode(shape, { w, h, scope, shapes });
    return {
      shape,
      compiled,
      seen: compiled.reads.map((name) => scope.get(name)),
    };
  }

  private fresh(
    c: CachedCompile,
    shape: NodeShape,
    w: number,
    h: number,
    scope: Scope,
    shapes: (id: ShapeId) => ShapeDef | undefined,
  ): boolean {
    if (c.shape !== shape || c.compiled.w !== w || c.compiled.h !== h)
      return false;
    for (const [id, def] of c.compiled.uses)
      if (shapes(id) !== def) return false;
    return c.compiled.reads.every((name, i) =>
      deepEqual(scope.get(name) as Json | undefined as Json, c.seen[i] as Json),
    );
  }
}
