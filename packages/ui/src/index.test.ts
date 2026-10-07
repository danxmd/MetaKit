import { describe, expect, it } from 'vitest';
import { packageName } from './index';

describe('@metakit-app/ui', () => {
  it('loads', () => {
    expect(packageName).toBe('@metakit-app/ui');
  });
});
