import type {
  ElementId,
  Json,
  Model,
  ModelId,
  ReferenceAttribute,
  Kit,
} from '@metakit-app/core';
import { effectiveAttributes, isA } from '@metakit-app/core';
import type { ModelEntry } from '@metakit-app/storage';
import { findInModel } from './find';

export interface ReferenceHit {
  element: ElementId;
  model: ModelId;
  modelName: string;
  title: string;
}

export interface ReferenceValue {
  element: ElementId;
  model?: ModelId;
}

/** What the reference picker needs from the app. */
export interface ReferenceServices {
  search: (query: string, attr: ReferenceAttribute) => Promise<ReferenceHit[]>;
  resolve: (
    ref: ReferenceValue,
  ) => { title: string; modelName: string } | undefined;
  open: (ref: ReferenceValue) => void;
}

interface Loaded {
  entry: ModelEntry;
  model: Model;
  kit: Kit;
}

/**
 * Answers the reference picker: which elements of which models can be chosen, and what a stored
 * reference points to. It reads all models of the workspace once (`load`) and keeps them.
 */
export class ReferenceIndex {
  private loaded: Loaded[] = [];
  private loading: Promise<void> | null = null;
  /** True once the models have been read, so that a missing target means it is gone, not not-yet-read. */
  isLoaded = false;

  constructor(private readonly read: () => Promise<Loaded[]>) {}

  /** Reads the models again; call after models were added, removed or saved. */
  refresh(): Promise<void> {
    this.loading = this.read().then((all) => {
      this.loaded = all;
      this.isLoaded = true;
    });
    return this.loading;
  }

  ready(): Promise<void> {
    return this.loading ?? this.refresh();
  }

  /** Elements whose name or text matches the query, limited to what the attribute may point to. */
  async search(
    query: string,
    attr: ReferenceAttribute,
    language = 'en',
    limit = 30,
  ): Promise<ReferenceHit[]> {
    await this.ready();
    const hits: ReferenceHit[] = [];
    for (const { entry, model, kit } of this.loaded) {
      const types = attr.target.modelTypes;
      if (
        types &&
        types.length > 0 &&
        !types.includes(model.manifest.modelType)
      )
        continue;
      const classes = attr.target.classes;
      const found =
        query.trim() === ''
          ? Object.values(model.elements)
              .sort((a, b) => (a.pos < b.pos ? -1 : 1))
              .map((e) => ({
                id: e.id,
                title: this.titleOf(kit, model, e.id, language),
              }))
          : findInModel(kit, model, query, language, 500)
              .filter((h) => h.kind === 'element')
              .map((h) => ({ id: h.id as ElementId, title: h.title }));
      for (const f of found) {
        const cls = model.elements[f.id]?.class;
        if (!cls) continue;
        if (
          classes &&
          classes.length > 0 &&
          !classes.some((c) => isA(kit, cls, c))
        )
          continue;
        hits.push({
          element: f.id,
          model: model.manifest.id,
          modelName: entry.name,
          title: f.title,
        });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  }

  /** What a stored reference points to, from what has been read; undefined when it is gone. */
  resolve(
    ref: ReferenceValue,
    language = 'en',
  ): { title: string; modelName: string; slug: string } | undefined {
    for (const { entry, model, kit } of this.loaded) {
      if (ref.model !== undefined && model.manifest.id !== ref.model) continue;
      if (ref.element in model.elements)
        return {
          title: this.titleOf(kit, model, ref.element, language),
          modelName: entry.name,
          slug: entry.slug,
        };
    }
    return undefined;
  }

  private titleOf(
    kit: Kit,
    model: Model,
    id: ElementId,
    language: string,
  ): string {
    const e = model.elements[id];
    const cls = e && kit.classes[e.class];
    if (!e || !cls) return id;
    for (const attr of effectiveAttributes(kit, e.class)) {
      const v = e.attrs[attr.id];
      if (attr.type === 'text' && typeof v === 'string' && v !== '') return v;
    }
    return cls.labels[language] ?? cls.key;
  }
}

/** The stored form of a chosen reference. */
export function referenceValue(hit: ReferenceHit): Json {
  return { element: hit.element, model: hit.model };
}
