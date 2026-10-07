import { describe, expect, it } from 'vitest';
import { packageName } from './index';

describe('@metakit-app/sync', () => {
  it('loads', () => {
    expect(packageName).toBe('@metakit-app/sync');
  });
});
