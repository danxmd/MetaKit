import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { FormatError } from './errors';

/** What a zip file may hold before it is refused, so that a small file cannot unpack into something huge. */
export const ZIP_LIMITS = {
  entries: 2_000,
  totalBytes: 100 * 1024 * 1024,
} as const;

// The zip format cannot hold dates before 1980. A fixed date makes equal contents give equal bytes.
// Built from local parts because fflate reads the local parts back out.
const FIXED_TIME = new Date(1980, 0, 1, 0, 0, 0);

/**
 * Packs files into a zip. The result is reproducible: names are sorted, every file has the same
 * date and the compression level is fixed, so an export can be compared and kept in Git.
 */
export function zipFiles(
  files: Record<string, Uint8Array | string>,
): Uint8Array {
  const zippable: Zippable = {};
  for (const name of Object.keys(files).sort()) {
    const content = files[name]!;
    zippable[name] = [
      typeof content === 'string' ? strToU8(content) : content,
      { mtime: FIXED_TIME, level: 6 },
    ];
  }
  return zipSync(zippable);
}

/** A name that would write outside the folder it is unpacked into, or that no file system accepts. */
export function unsafeZipPath(name: string): boolean {
  return (
    name === '' ||
    name.startsWith('/') ||
    /^[A-Za-z]:/.test(name) ||
    name.includes('\0') ||
    name.includes('\\') ||
    name.split('/').some((part) => part === '..')
  );
}

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

const tooBig = (bytes: number) =>
  `This zip file would unpack to more than ${mb(bytes)}, which is more than MetaKit accepts.`;

/**
 * Unpacks a zip with limits: at most 2,000 files and 100 MB once unpacked, and no file whose name
 * points outside the zip. Folders are skipped. Anything else wrong raises a `FormatError` in
 * plain English.
 */
export function unzipFiles(
  bytes: Uint8Array,
  limits: { entries: number; totalBytes: number } = ZIP_LIMITS,
): Record<string, Uint8Array> {
  let count = 0;
  let total = 0;
  try {
    const raw = unzipSync(bytes, {
      filter(file) {
        if (file.name.endsWith('/')) return false;
        count += 1;
        if (count > limits.entries)
          throw new FormatError(
            `This zip file holds more than ${limits.entries.toLocaleString('en')} files, which is more than MetaKit accepts.`,
          );
        if (unsafeZipPath(file.name))
          throw new FormatError(
            `This zip file has a file with an unsafe name ("${file.name}"), so it was not opened.`,
          );
        // These are the sizes the zip declares; the check below counts what came out.
        total += file.originalSize;
        if (total > limits.totalBytes)
          throw new FormatError(tooBig(limits.totalBytes));
        return true;
      },
    });
    const files: Record<string, Uint8Array> = {};
    let actual = 0;
    for (const name of Object.keys(raw).sort()) {
      actual += raw[name]!.length;
      if (actual > limits.totalBytes)
        throw new FormatError(tooBig(limits.totalBytes));
      files[name] = raw[name]!;
    }
    return files;
  } catch (error) {
    if (error instanceof FormatError) throw error;
    throw new FormatError(
      'This is not a valid zip file, or it is damaged, so it could not be opened.',
    );
  }
}
