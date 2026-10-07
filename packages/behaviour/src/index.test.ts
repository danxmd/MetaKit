import { describe, expect, it } from 'vitest';
import { packageName } from './index';

describe('@metakit-app/behaviour', () => {
  it('loads', () => {
    expect(packageName).toBe('@metakit-app/behaviour');
  });
});
