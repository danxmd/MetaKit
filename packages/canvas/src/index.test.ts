import { describe, expect, it } from 'vitest';
import { packageName } from './index';

describe('@metakit-app/canvas', () => {
  it('loads', () => {
    expect(packageName).toBe('@metakit-app/canvas');
  });
});
