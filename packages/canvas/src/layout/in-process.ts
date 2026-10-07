import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs/lib/elk-api';
import { LayoutError, type LayoutEngine } from './elk-layout';

/**
 * Runs ELK on the calling thread. For tests and Node; the app uses the worker. It is not
 * exported from the package index, so the app never bundles a second copy of ELK.
 */
export class InProcessEngine implements LayoutEngine {
  async run(
    graph: ElkNode,
    control: { signal?: AbortSignal; timeoutMs: number },
  ): Promise<ElkNode> {
    if (control.signal?.aborted)
      throw new LayoutError('cancelled', 'Layout cancelled.');
    const result = await new ELK().layout(graph);
    // Without a thread of its own the layout cannot be interrupted; a late abort still wins.
    if (control.signal?.aborted)
      throw new LayoutError('cancelled', 'Layout cancelled.');
    return result;
  }
  dispose(): void {}
}
