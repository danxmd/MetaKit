export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A path that could break out of the workspace or that sync tools handle badly. */
export class InvalidPathError extends StorageError {}
/** `writeNew` on a file that exists: change files and documents are write-once. */
export class AlreadyExistsError extends StorageError {}
export class NotFoundError extends StorageError {}
/** An instance tried to overwrite, remove or write into files that belong to another instance. */
export class NotOwnedError extends StorageError {}
/** The file does not end with a newline, so it may still be arriving. Retry later. */
export class PartialFileError extends StorageError {}
/** A file written by a newer MetaKit than this one. */
export class NewerFormatError extends StorageError {}
export class FormatError extends StorageError {}
