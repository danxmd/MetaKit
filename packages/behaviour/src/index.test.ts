import { describe, expect, it } from 'vitest';
import { silentHost } from './index';

describe('@metakit-app/behaviour', () => {
  it('has a silent host that answers no to everything', () => {
    const host = silentHost();
    expect(host.confirm('Sure?')).toBe(false);
    expect(host.choose('Which?', ['a', 'b'])).toBeNull();
    expect(silentHost({ confirm: () => true }).confirm('x')).toBe(true);
  });
});
