import { describe, expect, it } from 'vitest';
import {
  clampDocsWidth,
  DocsLayer,
  DocsNav,
  docsContext,
  OVERVIEW,
  pushDocsContext,
  setDocsContext,
} from './context';

describe('docsContext', () => {
  it('reports the base, and finer layers on top of it until they are taken back', () => {
    setDocsContext('build');
    expect(docsContext.get()).toBe('build');
    const section = pushDocsContext('build.classes');
    expect(docsContext.get()).toBe('build.classes');
    const dialog = pushDocsContext('dialog.export', DocsLayer.dialog);
    expect(docsContext.get()).toBe('dialog.export');
    // A section that changes while a dialog is open does not hide the dialog.
    const next = pushDocsContext('build.rules');
    expect(docsContext.get()).toBe('dialog.export');
    section();
    dialog();
    expect(docsContext.get()).toBe('build.rules');
    next();
    expect(docsContext.get()).toBe('build');
  });

  it('lets the Documentation area win over a view that stays mounted', () => {
    setDocsContext('model');
    const view = pushDocsContext('build.classes', DocsLayer.view);
    const area = pushDocsContext('docs', DocsLayer.area);
    expect(docsContext.get()).toBe('docs');
    area();
    expect(docsContext.get()).toBe('build.classes');
    view();
  });

  it('tells subscribers about changes only', () => {
    setDocsContext('models');
    const seen: string[] = [];
    const stop = docsContext.subscribe((c) => seen.push(c));
    setDocsContext('models');
    setDocsContext('tool-libraries');
    stop();
    setDocsContext('models');
    expect(seen).toEqual(['models', 'tool-libraries']);
  });
});

describe('DocsNav', () => {
  it('goes back and forward, and drops the forward history on a new link', () => {
    const nav = new DocsNav();
    nav.navigate('a');
    nav.navigate('b');
    nav.navigate('c');
    nav.back();
    expect(nav.get().current?.id).toBe('b');
    expect(nav.get()).toMatchObject({ canBack: true, canForward: true });
    nav.navigate('d');
    expect(nav.get().canForward).toBe(false);
    nav.back();
    nav.back();
    expect(nav.get().current?.id).toBe('a');
    expect(nav.get().canBack).toBe(false);
  });

  it('keeps the page topic one step back when a link is followed', () => {
    const nav = new DocsNav(true);
    nav.syncPage('page-models');
    expect(nav.get()).toMatchObject({
      current: { id: 'page-models' },
      following: true,
      canBack: false,
    });
    nav.navigate('palette');
    expect(nav.get()).toMatchObject({ following: false, canBack: true });
    nav.back();
    expect(nav.get().current?.id).toBe('page-models');
  });

  it('moves along with the page only while following', () => {
    const nav = new DocsNav(true);
    nav.syncPage('a');
    nav.syncPage('b');
    expect(nav.get()).toMatchObject({ current: { id: 'b' }, canBack: false });
    nav.navigate('link');
    nav.syncPage('c');
    expect(nav.get().current?.id).toBe('link');
    nav.followPage('c');
    expect(nav.get()).toMatchObject({ current: { id: 'c' }, following: true });
    nav.back();
    expect(nav.get().current?.id).toBe('link');
  });

  it('opens at the page after being asked, even when it left the page before', () => {
    const nav = new DocsNav(true);
    nav.syncPage('a');
    nav.navigate('elsewhere');
    nav.requestPage();
    nav.syncPage('a');
    expect(nav.get()).toMatchObject({ current: { id: 'a' }, following: true });
    nav.cancelPageRequest();
    nav.navigate('x');
    nav.syncPage('a');
    expect(nav.get().current?.id).toBe('x');
  });

  it('does not repeat the same entry and remembers anchors', () => {
    const nav = new DocsNav();
    nav.navigate('a', 'part');
    nav.navigate('a', 'part');
    expect(nav.get().canBack).toBe(false);
    expect(nav.get().current).toEqual({ id: 'a', anchor: 'part' });
    nav.navigate(OVERVIEW);
    expect(nav.get().current?.id).toBe(OVERVIEW);
  });
});

describe('width', () => {
  it('stays between 300px and 60% of the window', () => {
    expect(clampDocsWidth(100, 1200)).toBe(300);
    expect(clampDocsWidth(380, 1200)).toBe(380);
    expect(clampDocsWidth(2000, 1200)).toBe(720);
    expect(clampDocsWidth(2000, 400)).toBe(300);
  });
});
