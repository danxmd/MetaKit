import { describe, expect, it } from 'vitest';
import { packageName } from './index';

describe('@metakit-app/shapes', () => {
  it('loads', () => {
    expect(packageName).toBe('@metakit-app/shapes');
  });
});
