import { describe, expect, it } from 'vitest';
import { packageName } from './index';

describe('@metakit-app/assistant', () => {
  it('loads', () => {
    expect(packageName).toBe('@metakit-app/assistant');
  });
});
