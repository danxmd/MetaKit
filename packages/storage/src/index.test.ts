import { describe, expect, it } from 'vitest';
import { packageName } from './index';

describe('@metakit-app/storage', () => {
  it('loads', () => {
    expect(packageName).toBe('@metakit-app/storage');
  });
});
