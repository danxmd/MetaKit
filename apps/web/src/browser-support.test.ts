import { describe, expect, it } from 'vitest';
import { supportsLocalFolders } from './browser-support';

describe('supportsLocalFolders', () => {
  it('is true when showDirectoryPicker exists', () => {
    expect(supportsLocalFolders({ showDirectoryPicker: () => undefined })).toBe(
      true,
    );
  });

  it('is false when showDirectoryPicker is missing', () => {
    expect(supportsLocalFolders({})).toBe(false);
  });
});
