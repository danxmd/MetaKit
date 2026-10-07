export type ExportFormat = 'svg' | 'png' | 'pdf';

/** What the person chose in the export dialog. */
export interface ExportRequest {
  format: ExportFormat;
  scope: 'model' | 'selection';
  /** PNG only. */
  scale?: 1 | 2 | 3 | 4;
  /** PNG only: leave the background see-through. */
  transparent?: boolean;
  /** PDF only. */
  pageSize?: 'a4' | 'a3' | 'letter' | 'fit';
  /** PDF only. */
  orientation?: 'portrait' | 'landscape' | 'auto';
  /** PDF only: shrink or grow the drawing to fill one page. */
  fitToPage?: boolean;
}

/** Media type of each export format, for the file the person saves. */
export const EXPORT_MIME: Record<ExportFormat, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  pdf: 'application/pdf',
};

/** A file name made from the model's name, safe on Windows, macOS and in cloud folders. */
export function exportFileName(
  modelName: string,
  format: ExportFormat,
): string {
  const base = modelName
    // Characters that Windows, SharePoint or OneDrive refuse in a file name, and control characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Leading dots hide a file, and trailing dots or spaces are dropped by Windows.
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 100)
    .trim();
  return `${base === '' ? 'model' : base}.${format}`;
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable(): Promise<{
      write(data: Blob): Promise<void>;
      close(): Promise<void>;
    }>;
  }>;
}

/**
 * Saves a file chosen by the person: through the save dialog where the browser has one (so they
 * can pick the folder), and otherwise as a normal download. Returns false when they cancel.
 */
export async function saveBlob(blob: Blob, fileName: string): Promise<boolean> {
  const picker = (window as unknown as SaveFilePickerWindow).showSaveFilePicker;
  if (picker) {
    const extension = fileName.slice(fileName.lastIndexOf('.'));
    try {
      const handle = await picker.call(window, {
        suggestedName: fileName,
        types: [
          {
            description: extension.slice(1).toUpperCase() + ' file',
            accept: { [blob.type || 'application/octet-stream']: [extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        return false;
      // Some embedded or locked-down contexts refuse the picker; a download still works.
      if (!(error instanceof DOMException && error.name === 'SecurityError'))
        throw error;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // The download starts in a later task; revoking at once could cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
