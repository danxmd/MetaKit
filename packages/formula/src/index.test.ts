import { describe, expect, it } from 'vitest';
import { packageName } from './index';

describe('@metakit-app/formula', () => {
  it('loads', () => {
    expect(packageName).toBe('@metakit-app/formula');
  });
});
